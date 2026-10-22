import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../../config/configuration';
import {
  IdempotencyService,
  IdempotentResult,
} from '../idempotency/idempotency.service';
import { TransactionResponseDto } from '../transactions/dto/transaction-response.dto';
import { TransactionsRepository } from '../transactions/transactions.repository';
import { FundWalletDto, FundWalletResponseDto } from './dto/fund-wallet.dto';
import { WalletResponseDto } from './dto/wallet-response.dto';
import { WalletsRepository } from './wallets.repository';

@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);
  private readonly maxAmount: number;

  constructor(
    private readonly wallets: WalletsRepository,
    private readonly transactions: TransactionsRepository,
    private readonly idempotency: IdempotencyService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.maxAmount = config.get('limits.maxTransactionAmount', { infer: true });
  }

  async getForUser(userId: string): Promise<WalletResponseDto> {
    const wallet = await this.wallets.findByUserId(userId);
    if (!wallet) throw new NotFoundException('Wallet not found');
    return WalletResponseDto.from(wallet);
  }

  /**
   * Credits the caller's wallet. Simulates a confirmed deposit (in production
   * this would be driven by a payment provider's verified webhook).
   *
   * Runs exactly once per Idempotency-Key. Inside one transaction: claim the
   * key, lock the wallet, credit it, write the transaction + ledger entry,
   * store the response.
   */
  fund(
    userId: string,
    idempotencyKey: string,
    dto: FundWalletDto,
  ): Promise<IdempotentResult<FundWalletResponseDto>> {
    this.assertWithinLimit(dto.amount);

    return this.idempotency.execute(
      {
        userId,
        key: idempotencyKey,
        scope: 'POST /wallets/fund',
        payload: dto,
      },
      HttpStatus.CREATED,
      async (trx) => {
        const wallet = await this.wallets.lockByUserId(userId, trx);
        if (!wallet) throw new NotFoundException('Wallet not found');
        if (wallet.owner_status === 'BLOCKED') {
          throw new ForbiddenException('Account is blocked');
        }

        const balanceAfter = wallet.balance + dto.amount;
        if (!Number.isSafeInteger(balanceAfter)) {
          throw new UnprocessableEntityException(
            'Wallet balance limit exceeded',
          );
        }

        await this.wallets.setBalance(wallet.id, balanceAfter, trx);
        const transaction = await this.transactions.record(
          trx,
          {
            type: 'FUNDING',
            amount: dto.amount,
            currency: wallet.currency,
            sourceWalletId: null,
            destinationWalletId: wallet.id,
            narration: dto.narration ?? null,
            initiatedBy: userId,
          },
          [
            {
              walletId: wallet.id,
              direction: 'CREDIT',
              amount: dto.amount,
              balanceBefore: wallet.balance,
              balanceAfter,
            },
          ],
        );

        this.logger.log(
          `Wallet ${wallet.id} funded: ${transaction.reference} (${dto.amount} ${wallet.currency})`,
        );
        return {
          transaction: TransactionResponseDto.from(transaction),
          wallet: WalletResponseDto.from({ ...wallet, balance: balanceAfter }),
        };
      },
    );
  }

  private assertWithinLimit(amount: number): void {
    if (amount > this.maxAmount) {
      throw new BadRequestException(
        `amount must not exceed ${this.maxAmount} (kobo) per transaction`,
      );
    }
  }
}
