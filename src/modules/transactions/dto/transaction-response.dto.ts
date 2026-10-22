import {
  TransactionRow,
  TransactionStatus,
  TransactionType,
} from '../transactions.repository';

export class TransactionResponseDto {
  id: string;
  /** @example FND-1b4e28ba-2fa1-41d2-883f-0016d3cca427 */
  reference: string;
  type: TransactionType;
  status: TransactionStatus;
  /**
   * Amount in minor units (kobo)
   * @example 250000
   */
  amount: number;
  currency: string;
  /** Null for funding: the money comes from outside the system */
  sourceWalletId: string | null;
  destinationWalletId: string;
  narration: string | null;
  createdAt: Date;

  static from(row: TransactionRow): TransactionResponseDto {
    return {
      id: row.id,
      reference: row.reference,
      type: row.type,
      status: row.status,
      amount: row.amount,
      currency: row.currency,
      sourceWalletId: row.source_wallet_id,
      destinationWalletId: row.destination_wallet_id,
      narration: row.narration,
      createdAt: row.created_at,
    };
  }
}
