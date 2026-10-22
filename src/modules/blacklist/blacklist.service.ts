import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Paginated, PaginationQueryDto } from '../../common/dto/pagination.dto';
import { normalizeIdentity } from '../../common/utils/identity';
import { AppConfig } from '../../config/configuration';
import { isUniqueViolation } from '../../database/pg-errors';
import { BlacklistRepository, IdentityQuery } from './blacklist.repository';
import {
  BlacklistEntryResponseDto,
  CreateBlacklistEntryDto,
} from './dto/blacklist.dto';
import { KarmaClient, KarmaUnavailableError } from './karma.client';

export const BLACKLISTED_MESSAGE =
  'Account cannot be created: identity is blacklisted';

@Injectable()
export class BlacklistService {
  private readonly logger = new Logger(BlacklistService.name);
  private readonly failOpen: boolean;

  constructor(
    private readonly repository: BlacklistRepository,
    private readonly karma: KarmaClient,
    config: ConfigService<AppConfig, true>,
  ) {
    this.failOpen = config.get('adjutor.failOpen', { infer: true });
  }

  /**
   * Refuses onboarding if any identity is on the local blacklist or Lendsqr
   * Karma. The local list is checked first: it is free and needs no network.
   *
   * If Karma is unreachable we fail closed by default (KARMA_FAIL_OPEN=false):
   * for a lender, letting an unchecked identity in is worse than asking a
   * legitimate user to retry.
   */
  async assertEligible(identities: IdentityQuery[]): Promise<void> {
    const local = await this.repository.findFirstMatch(identities);
    if (local) {
      this.logger.log(
        `Onboarding refused: local blacklist match on ${local.identity_type}`,
      );
      throw new ForbiddenException(BLACKLISTED_MESSAGE);
    }

    if (!this.karma.enabled) return;

    let results: string[];
    try {
      results = await Promise.all(
        identities.map(({ type, identity }) =>
          this.karma.lookup(type, identity),
        ),
      );
    } catch (error) {
      if (!(error instanceof KarmaUnavailableError)) throw error;
      if (this.failOpen) {
        this.logger.warn(
          `Karma unavailable, continuing (fail-open): ${error.message}`,
        );
        return;
      }
      this.logger.error(
        `Karma unavailable, refusing onboarding (fail-closed): ${error.message}`,
      );
      throw new ServiceUnavailableException(
        'Identity verification is temporarily unavailable. Please try again shortly.',
      );
    }

    if (results.includes('HIT')) {
      this.logger.log('Onboarding refused: Karma blacklist match');
      throw new ForbiddenException(BLACKLISTED_MESSAGE);
    }
  }

  /**
   * Adds an identity to the local blacklist. It is stored in the same
   * normalised form signup uses, so "0803..." blocks "+234803..." too.
   *
   * The blacklist gates onboarding; an existing account is restricted with
   * block/unblock instead.
   */
  async addEntry(
    dto: CreateBlacklistEntryDto,
    adminId: string,
  ): Promise<BlacklistEntryResponseDto> {
    const identity = normalizeIdentity(dto.identityType, dto.identity);
    if (!identity) {
      throw new BadRequestException(
        `identity is not a valid ${dto.identityType}`,
      );
    }

    try {
      const row = await this.repository.create({
        type: dto.identityType,
        identity,
        reason: dto.reason,
        createdBy: adminId,
      });
      this.logger.log(
        `Blacklist entry ${row.id} (${row.identity_type}) added by ${adminId}`,
      );
      return BlacklistEntryResponseDto.from(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Identity is already blacklisted');
      }
      throw error;
    }
  }

  async listEntries(
    query: PaginationQueryDto,
  ): Promise<Paginated<BlacklistEntryResponseDto>> {
    const { rows, total } = await this.repository.list(
      query.limit,
      query.offset,
    );
    return {
      data: rows.map((row) => BlacklistEntryResponseDto.from(row)),
      meta: { page: query.page, limit: query.limit, total },
    };
  }

  async removeEntry(id: string, adminId: string): Promise<void> {
    if (!(await this.repository.deleteById(id))) {
      throw new NotFoundException('Blacklist entry not found');
    }
    this.logger.log(`Blacklist entry ${id} removed by ${adminId}`);
  }
}
