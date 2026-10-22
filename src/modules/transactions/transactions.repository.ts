import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import { InjectKnex } from '../../database/database.module';

export type TransactionType = 'FUNDING' | 'TRANSFER';
export type TransactionStatus = 'SUCCESS' | 'FAILED';
export type LedgerDirection = 'DEBIT' | 'CREDIT';

export interface TransactionRow {
  id: string;
  reference: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  currency: string;
  source_wallet_id: string | null;
  destination_wallet_id: string;
  narration: string | null;
  initiated_by: string;
  created_at: Date;
}

export interface NewTransaction {
  type: TransactionType;
  amount: number;
  currency: string;
  sourceWalletId: string | null;
  destinationWalletId: string;
  narration: string | null;
  initiatedBy: string;
}

export interface LedgerEntry {
  walletId: string;
  direction: LedgerDirection;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
}

/** A transaction as seen from one wallet: its ledger entry on that wallet. */
export interface StatementRow extends TransactionRow {
  direction: LedgerDirection;
  balance_before: number;
  balance_after: number;
}

const REFERENCE_PREFIX: Record<TransactionType, string> = {
  FUNDING: 'FND',
  TRANSFER: 'TRF',
};

@Injectable()
export class TransactionsRepository {
  constructor(@InjectKnex() private readonly db: Knex) {}

  /**
   * Writes a successful transaction and its ledger entries. Must run inside
   * the transaction that changed the balances, so they commit together.
   */
  async record(
    trx: Knex.Transaction,
    transaction: NewTransaction,
    entries: LedgerEntry[],
  ): Promise<TransactionRow> {
    const [row] = await trx<TransactionRow>('transactions')
      .insert({
        reference: `${REFERENCE_PREFIX[transaction.type]}-${randomUUID()}`,
        type: transaction.type,
        status: 'SUCCESS',
        amount: transaction.amount,
        currency: transaction.currency,
        source_wallet_id: transaction.sourceWalletId,
        destination_wallet_id: transaction.destinationWalletId,
        narration: transaction.narration,
        initiated_by: transaction.initiatedBy,
      })
      .returning('*');

    await trx('ledger_entries').insert(
      entries.map((entry) => ({
        transaction_id: row.id,
        wallet_id: entry.walletId,
        direction: entry.direction,
        amount: entry.amount,
        balance_before: entry.balanceBefore,
        balance_after: entry.balanceAfter,
      })),
    );

    return row;
  }

  /**
   * A user's statement: one line per ledger entry on their wallet, newest
   * first, joined to its transaction. Each line therefore carries the
   * direction and running balance from that wallet's point of view.
   */
  async listStatement(
    ownerId: string,
    limit: number,
    offset: number,
  ): Promise<{ rows: StatementRow[]; total: number }> {
    const [rows, [{ total }]] = await Promise.all([
      this.ownLedger(ownerId)
        .join({ t: 'transactions' }, 't.id', 'l.transaction_id')
        .select('t.*', 'l.direction', 'l.balance_before', 'l.balance_after')
        // Not created_at: now() is the transaction's *start* time, and a
        // transfer that waited on the wallet lock is applied after ones that
        // started later. The ledger id is assigned under the lock, so it is
        // the true order in which this wallet's balance changed.
        .orderBy('l.id', 'desc')
        .limit(limit)
        .offset(offset) as Promise<StatementRow[]>,
      this.ownLedger(ownerId).count<{ total: number }[]>({ total: '*' }),
    ]);
    return { rows, total: Number(total) };
  }

  /**
   * One statement line by transaction reference, or undefined if the user's
   * wallet took no part in it (so others' transactions read as "not found").
   */
  findStatementLine(
    ownerId: string,
    reference: string,
  ): Promise<StatementRow | undefined> {
    return this.ownLedger(ownerId)
      .join({ t: 'transactions' }, 't.id', 'l.transaction_id')
      .where('t.reference', reference)
      .first('t.*', 'l.direction', 'l.balance_before', 'l.balance_after');
  }

  /** Ledger entries on the wallet owned by this user. */
  private ownLedger(ownerId: string) {
    return this.db({ l: 'ledger_entries' })
      .join({ w: 'wallets' }, 'w.id', 'l.wallet_id')
      .where('w.user_id', ownerId);
  }
}
