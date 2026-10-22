import { Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import { UserStatus } from '../../common/auth/auth-user';
import { InjectKnex } from '../../database/database.module';

export interface WalletRow {
  id: string;
  user_id: string;
  currency: string;
  balance: number; // kobo
  created_at: Date;
  updated_at: Date;
}

/** A wallet row locked for update, with its owner's status read under a share lock. */
export interface LockedWallet extends WalletRow {
  owner_status: UserStatus;
}

@Injectable()
export class WalletsRepository {
  constructor(@InjectKnex() private readonly db: Knex) {}

  async create(userId: string, trx: Knex = this.db): Promise<WalletRow> {
    const [wallet] = await trx<WalletRow>('wallets')
      .insert({ user_id: userId })
      .returning('*');
    return wallet;
  }

  findByUserId(
    userId: string,
    trx: Knex = this.db,
  ): Promise<WalletRow | undefined> {
    return trx<WalletRow>('wallets').where({ user_id: userId }).first();
  }

  findById(id: string, trx: Knex = this.db): Promise<WalletRow | undefined> {
    return trx<WalletRow>('wallets').where({ id }).first();
  }

  findByOwnerEmail(
    email: string,
    trx: Knex = this.db,
  ): Promise<WalletRow | undefined> {
    return trx<WalletRow>('wallets')
      .join('users', 'users.id', 'wallets.user_id')
      .where('users.email', email)
      .first('wallets.*');
  }

  async lockByUserId(
    userId: string,
    trx: Knex.Transaction,
  ): Promise<LockedWallet | undefined> {
    const [wallet] = await this.lock(trx, 'user_id', [userId]);
    return wallet;
  }

  /** Locks several wallets at once, always in wallet-id order. */
  lockByIds(ids: string[], trx: Knex.Transaction): Promise<LockedWallet[]> {
    return this.lock(trx, 'id', ids);
  }

  /**
   * Locks wallets (FOR UPDATE) and their owners (FOR SHARE) until the
   * transaction ends.
   *
   * - Wallet lock: concurrent balance changes on the same wallet queue up
   *   instead of racing, so no update is ever lost.
   * - Owner share lock: a concurrent block/unblock (an UPDATE on users) waits
   *   for in-flight money movement, and money movement started after a block
   *   commits sees the BLOCKED status.
   * - Rows are locked in wallet-id order, so operations touching several
   *   wallets always acquire locks in the same order and cannot deadlock.
   */
  private async lock(
    trx: Knex.Transaction,
    column: 'id' | 'user_id',
    values: string[],
  ): Promise<LockedWallet[]> {
    const result = await trx.raw<{ rows: LockedWallet[] }>(
      `SELECT w.*, u.status AS owner_status
         FROM wallets w
         JOIN users u ON u.id = w.user_id
        WHERE w.?? = ANY(?::uuid[])
        ORDER BY w.id
          FOR UPDATE OF w
          FOR SHARE OF u`,
      [column, values],
    );
    return result.rows;
  }

  async setBalance(
    walletId: string,
    balance: number,
    trx: Knex.Transaction,
  ): Promise<void> {
    await trx('wallets')
      .where({ id: walletId })
      .update({ balance, updated_at: trx.fn.now() });
  }
}
