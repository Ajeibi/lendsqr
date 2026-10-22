import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import {
  toNormalizedEmail,
  trimString,
} from '../../../common/utils/transforms';
import { TransactionResponseDto } from '../../transactions/dto/transaction-response.dto';
import { WalletResponseDto } from '../../wallets/dto/wallet-response.dto';

/** Identify the recipient by exactly one of recipientWalletId or recipientEmail. */
export class CreateTransferDto {
  /** @example 7b9d7ac0-1e7f-49b7-a787-aa81b03fb12b */
  @IsOptional()
  @IsUUID()
  recipientWalletId?: string;

  /** @example tunde@demo.wallet */
  @IsOptional()
  @Transform(toNormalizedEmail)
  @IsEmail()
  @MaxLength(255)
  recipientEmail?: string;

  /**
   * Amount in minor units (kobo), as a JSON integer: 150000 = NGN 1,500.00
   * @example 150000
   */
  @IsInt()
  @Min(1)
  amount: number;

  /** @example Rent share */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(255)
  narration?: string;
}

export class TransferResponseDto {
  transaction: TransactionResponseDto;
  /** The sender's wallet after the transfer. The recipient's balance is never exposed. */
  wallet: WalletResponseDto;
}
