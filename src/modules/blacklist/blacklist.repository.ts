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

  async create(entry: {
    type: IdentityType;
    identity: string;
    reason: string;
    createdBy: string;
  }): Promise<BlacklistRow> {
    const [row] = await this.db<BlacklistRow>('blacklist')
      .insert({
        identity_type: entry.type,
        identity: entry.identity,
        reason: entry.reason,
        created_by: entry.createdBy,
      })
      .returning('*');
    return row;
  }

  /** Newest first. */
  async list(
    limit: number,
    offset: number,
  ): Promise<{ rows: BlacklistRow[]; total: number }> {
    const [rows, [{ total }]] = await Promise.all([
      this.db<BlacklistRow>('blacklist')
        .orderBy([
          { column: 'created_at', order: 'desc' },
          { column: 'id', order: 'desc' },
        ])
        .limit(limit)
        .offset(offset),
      this.db('blacklist').count<{ total: number }[]>({ total: '*' }),
    ]);
    return { rows, total: Number(total) };
  }

  /** Returns true if an entry was removed. */
  async deleteById(id: string): Promise<boolean> {
    return (await this.db('blacklist').where({ id }).del()) > 0;
  }
}
