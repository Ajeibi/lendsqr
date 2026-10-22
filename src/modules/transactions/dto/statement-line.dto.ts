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

  static fromStatement(row: StatementRow): StatementLineDto {
    return {
      ...TransactionResponseDto.from(row),
      direction: row.direction,
      balanceAfter: row.balance_after,
    };
  }
}

export class StatementPageDto {
  data: StatementLineDto[];
  meta: { page: number; limit: number; total: number };
}
