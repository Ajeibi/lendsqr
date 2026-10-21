import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IdentityType, identitiesMatch } from '../../common/utils/identity';
import { AppConfig } from '../../config/configuration';

export type KarmaResult = 'HIT' | 'CLEAR';

/** Karma could not give a usable answer (network, timeout, 5xx, auth, bad payload). */
export class KarmaUnavailableError extends Error {}

interface KarmaResponse {
  status?: string;
  'mock-response'?: string;
  data?: { karma_identity?: string } | null;
}

/**
 * Client for the Lendsqr Adjutor Karma blacklist:
 * GET {base}/verification/karma/:identity
 *
 * A lookup only counts as a hit when the identity Karma returns matches the
 * one we asked about. Test-mode apps get the same mock record for every
 * query, and a mismatched record must never be read as "blacklisted".
 */
@Injectable()
export class KarmaClient {
  private readonly logger = new Logger(KarmaClient.name);
  private readonly options: AppConfig['adjutor'];

  constructor(config: ConfigService<AppConfig, true>) {
    this.options = config.get('adjutor', { infer: true });
    if (!this.enabled) {
      this.logger.warn(
        'ADJUTOR_API_KEY is not set: Karma checks are disabled, only the local blacklist applies',
      );
    }
  }

  get enabled(): boolean {
    return this.options.apiKey.length > 0;
  }

  async lookup(type: IdentityType, identity: string): Promise<KarmaResult> {
    const url = `${this.options.baseUrl}/verification/karma/${encodeURIComponent(identity)}`;

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${this.options.apiKey}` },
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });
    } catch (error) {
      throw new KarmaUnavailableError('Karma request failed', { cause: error });
    }

    // Karma answers 404 when the identity is not on the blacklist.
    if (response.status === 404) return 'CLEAR';
    if (!response.ok) {
      throw new KarmaUnavailableError(`Karma responded ${response.status}`);
    }

    let body: KarmaResponse;
    try {
      body = (await response.json()) as KarmaResponse;
    } catch (error) {
      throw new KarmaUnavailableError('Karma returned invalid JSON', {
        cause: error,
      });
    }

    const returned = body.data?.karma_identity;
    if (
      typeof returned === 'string' &&
      identitiesMatch(type, identity, returned)
    ) {
      return 'HIT';
    }
    if (returned && body['mock-response']) {
      this.logger.debug(
        `Ignoring Karma test-mode mock record for a ${type} lookup (identity mismatch)`,
      );
    }
    return 'CLEAR';
  }
}
