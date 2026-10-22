import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { Knex } from 'knex';

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

const REFERENCE_PREFIX: Record<TransactionType, string> = {
  FUNDING: 'FND',
  TRANSFER: 'TRF',
};

@Injectable()
export class TransactionsRepository {
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
}
