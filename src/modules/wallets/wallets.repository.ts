import { Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import { InjectKnex } from '../../database/database.module';

export interface WalletRow {
  id: string;
  user_id: string;
  currency: string;
  balance: number; // kobo
  created_at: Date;
  updated_at: Date;
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
}
