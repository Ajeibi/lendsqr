import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { TransactionResponseDto } from '../../transactions/dto/transaction-response.dto';
import { WalletResponseDto } from './wallet-response.dto';
import { trimString } from '../../../common/utils/transforms';

export class FundWalletDto {
  /**
   * Amount in minor units (kobo), as a JSON integer: 250000 = NGN 2,500.00
   * @example 250000
   */
  @IsInt()
  @Min(1)
  amount: number;

  /** @example Top-up from bank */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(255)
  narration?: string;
}

export class FundWalletResponseDto {
  transaction: TransactionResponseDto;
  wallet: WalletResponseDto;
}
