import { Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import { IdentityType } from '../../common/utils/identity';
import { InjectKnex } from '../../database/database.module';

export interface BlacklistRow {
  id: string;
  identity_type: IdentityType;
  identity: string;
  reason: string | null;
  created_by: string | null;
  created_at: Date;
}

export interface IdentityQuery {
  type: IdentityType;
  identity: string; // already normalised
}

@Injectable()
export class BlacklistRepository {
  constructor(@InjectKnex() private readonly db: Knex) {}

  /** Returns the first local blacklist entry matching any of the identities. */
  findFirstMatch(
    identities: IdentityQuery[],
  ): Promise<BlacklistRow | undefined> {
    return this.db<BlacklistRow>('blacklist')
      .where((qb) => {
        for (const { type, identity } of identities) {
          void qb.orWhere({ identity_type: type, identity });
        }
      })
      .first();
  }
}
