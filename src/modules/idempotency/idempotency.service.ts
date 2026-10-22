import {
  ConflictException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Knex } from 'knex';
import { AppConfig } from '../../config/configuration';
import { InjectKnex } from '../../database/database.module';
import { isUniqueViolation } from '../../database/pg-errors';
import { hashRequest } from './request-hash';

const PRIMARY_KEY = 'idempotency_keys_pkey';

export interface IdempotentRequest {
  userId: string;
  key: string;
  /** Names the operation, e.g. "POST /wallets/fund"; part of the fingerprint. */
  scope: string;
  /** The validated request payload. */
  payload: unknown;
}

export interface IdempotentResult<T> {
  status: number;
  body: T;
  replayed: boolean;
}

interface IdempotencyRow {
  user_id: string;
  key: string;
  request_hash: string;
  response_status: number | null;
  response_body: unknown;
}

/**
 * Exactly-once execution of money-moving requests.
 *
 * The key is claimed by inserting it in the SAME database transaction as the
 * work and the stored response:
 *
 * - First request: insert succeeds, work runs, response is saved, commit.
 * - Retry after commit: the insert hits the primary key, so we return the
 *   stored response without running the work again.
 * - Concurrent duplicate: Postgres makes the second insert wait on the first
 *   transaction. If that commits, the second gets a unique violation and
 *   replays; if it rolls back, the second simply proceeds.
 * - Same key, different payload: 422, since the client is misusing the key.
 *
 * Failed requests roll back their claim, so a client can safely retry them
 * with the same key (e.g. after topping up for an insufficient balance).
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly ttlHours: number;

  constructor(
    @InjectKnex() private readonly db: Knex,
    config: ConfigService<AppConfig, true>,
  ) {
    this.ttlHours = config.get('limits.idempotencyTtlHours', { infer: true });
  }

  async execute<T>(
    request: IdempotentRequest,
    successStatus: number,
    work: (trx: Knex.Transaction) => Promise<T>,
  ): Promise<IdempotentResult<T>> {
    const requestHash = hashRequest(request.scope, request.payload);
    const where = { user_id: request.userId, key: request.key };

    try {
      return await this.db.transaction(async (trx) => {
        // An expired key may be reused for a new operation.
        await trx('idempotency_keys')
          .where(where)
          .andWhere('expires_at', '<=', trx.fn.now())
          .del();

        await trx('idempotency_keys').insert({
          ...where,
          request_method: request.scope.split(' ')[0],
          request_path: request.scope,
          request_hash: requestHash,
          expires_at: trx.raw('now() + make_interval(hours => ?)', [
            this.ttlHours,
          ]),
        });

        const body = await work(trx);

        await trx('idempotency_keys')
          .where(where)
          .update({ response_status: successStatus, response_body: body });

        return { status: successStatus, body, replayed: false };
      });
    } catch (error) {
      if (!isUniqueViolation(error, PRIMARY_KEY)) throw error;
      return this.replay<T>(where, requestHash);
    }
  }

  private async replay<T>(
    where: { user_id: string; key: string },
    requestHash: string,
  ): Promise<IdempotentResult<T>> {
    const stored = await this.db<IdempotencyRow>('idempotency_keys')
      .where(where)
      .first();

    // Only possible if the row expired and was purged between our insert
    // attempt and this read; the client can simply retry.
    if (!stored || stored.response_status === null) {
      throw new ConflictException(
        'A request with this Idempotency-Key is being processed; retry shortly',
      );
    }
    if (stored.request_hash !== requestHash) {
      throw new UnprocessableEntityException(
        'Idempotency-Key has already been used for a different request',
      );
    }

    this.logger.log(`Replayed idempotent response for key ${where.key}`);
    return {
      status: stored.response_status,
      body: stored.response_body as T,
      replayed: true,
    };
  }
}
