import { Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import { UserRole, UserStatus } from '../../common/auth/auth-user';
import { InjectKnex } from '../../database/database.module';

export interface UserRow {
  id: string;
  email: string;
  phone_number: string;
  first_name: string;
  last_name: string;
  password_hash: string;
  role: UserRole;
  status: UserStatus;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class UsersRepository {
  constructor(@InjectKnex() private readonly db: Knex) {}

  findById(id: string, trx: Knex = this.db): Promise<UserRow | undefined> {
    return trx<UserRow>('users').where({ id }).first();
  }

  findByEmail(
    email: string,
    trx: Knex = this.db,
  ): Promise<UserRow | undefined> {
    return trx<UserRow>('users').where({ email: email.toLowerCase() }).first();
  }
}
