import { WalletRow } from '../wallets.repository';

export class WalletResponseDto {
  id: string;
  /** ISO 4217 currency code */
  currency: string;
  /**
   * Balance in minor units (kobo)
   * @example 1000000
   */
  balance: number;

  static from(row: WalletRow): WalletResponseDto {
    return { id: row.id, currency: row.currency, balance: row.balance };
  }
}
