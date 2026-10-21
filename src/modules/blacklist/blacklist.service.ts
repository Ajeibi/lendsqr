import {
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import { BlacklistRepository, IdentityQuery } from './blacklist.repository';
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
}
