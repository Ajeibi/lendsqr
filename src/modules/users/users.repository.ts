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

export type StatusAction = 'BLOCK' | 'UNBLOCK';

export interface StatusEventRow {
  id: number;
  user_id: string;
  action: StatusAction;
  reason: string;
  actor_id: string;
  created_at: Date;
}

export interface NewUser {
  email: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
}

@Injectable()
export class UsersRepository {
  constructor(@InjectKnex() private readonly db: Knex) {}

  async create(user: NewUser, trx: Knex = this.db): Promise<UserRow> {
    const [row] = await trx<UserRow>('users')
      .insert({
        email: user.email,
        phone_number: user.phoneNumber,
        first_name: user.firstName,
        last_name: user.lastName,
        password_hash: user.passwordHash,
      })
      .returning('*');
    return row;
  }

  findById(id: string, trx: Knex = this.db): Promise<UserRow | undefined> {
    return trx<UserRow>('users').where({ id }).first();
  }

  findByEmail(
    email: string,
    trx: Knex = this.db,
  ): Promise<UserRow | undefined> {
    return trx<UserRow>('users').where({ email: email.toLowerCase() }).first();
  }

  /** Newest first, optionally narrowed to one (normalised) email. */
  async list(
    limit: number,
    offset: number,
    email?: string,
  ): Promise<{ rows: UserRow[]; total: number }> {
    const filter = email ? { email } : {};
    const [rows, [{ total }]] = await Promise.all([
      this.db<UserRow>('users')
        .where(filter)
        .orderBy([
          { column: 'created_at', order: 'desc' },
          { column: 'id', order: 'desc' },
        ])
        .limit(limit)
        .offset(offset),
      this.db('users').where(filter).count<{ total: number }[]>({ total: '*' }),
    ]);
    return { rows, total: Number(total) };
  }

  /**
   * Locks the user row until the transaction ends. Money movement holds a
   * share lock on the same row, so a status change waits for in-flight
   * transfers and vice versa.
   */
  lockById(id: string, trx: Knex.Transaction): Promise<UserRow | undefined> {
    return trx<UserRow>('users').where({ id }).forUpdate().first();
  }

  async setStatus(
    id: string,
    status: UserStatus,
    trx: Knex.Transaction,
  ): Promise<UserRow> {
    const [row] = await trx<UserRow>('users')
      .where({ id })
      .update({ status, updated_at: trx.fn.now() })
      .returning('*');
    return row;
  }

  async addStatusEvent(
    event: {
      userId: string;
      action: StatusAction;
      reason: string;
      actorId: string;
    },
    trx: Knex.Transaction,
  ): Promise<void> {
    await trx('account_status_events').insert({
      user_id: event.userId,
      action: event.action,
      reason: event.reason,
      actor_id: event.actorId,
    });
  }

  /** Newest first. */
  listStatusEvents(userId: string): Promise<StatusEventRow[]> {
    return this.db<StatusEventRow>('account_status_events')
      .where({ user_id: userId })
      .orderBy('id', 'desc');
  }
}
