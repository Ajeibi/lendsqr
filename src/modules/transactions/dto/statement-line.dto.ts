import { LedgerDirection, StatementRow } from '../transactions.repository';
import { TransactionResponseDto } from './transaction-response.dto';

/** A transaction from the caller's point of view. */
export class StatementLineDto extends TransactionResponseDto {
  /** DEBIT if money left your wallet, CREDIT if it arrived */
  direction: LedgerDirection;
  /**
   * Your balance after this transaction (kobo)
   * @example 750000
   */
  balanceAfter: number;
  /**
   * The other party: the recipient of a debit, the sender of a credit.
   * Null for funding.
   * @example Tunde Bello
   */
  counterpartyName: string | null;

  static fromStatement(row: StatementRow): StatementLineDto {
    return {
      ...TransactionResponseDto.from(row),
      direction: row.direction,
      balanceAfter: row.balance_after,
      counterpartyName: row.counterparty_name,
    };
  }
}

export class StatementPageDto {
  data: StatementLineDto[];
  meta: { page: number; limit: number; total: number };
}
