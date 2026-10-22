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
import { Knex } from 'knex';
import { AppConfig } from '../../config/configuration';
import {
  IdempotencyService,
  IdempotentResult,
} from '../idempotency/idempotency.service';
import { TransactionResponseDto } from '../transactions/dto/transaction-response.dto';
import { TransactionsRepository } from '../transactions/transactions.repository';
import { WalletResponseDto } from '../wallets/dto/wallet-response.dto';
import { WalletsRepository } from '../wallets/wallets.repository';
import {
  CreateTransferDto,
  TransferResponseDto,
} from './dto/create-transfer.dto';

@Injectable()
export class TransfersService {
  private readonly logger = new Logger(TransfersService.name);
  private readonly maxAmount: number;

  constructor(
    private readonly wallets: WalletsRepository,
    private readonly transactions: TransactionsRepository,
    private readonly idempotency: IdempotencyService,
    config: ConfigService<AppConfig, true>,
  ) {
    this.maxAmount = config.get('limits.maxTransactionAmount', { infer: true });
  }

  /**
   * Moves money from the caller's wallet to another wallet, exactly once per
   * Idempotency-Key. Inside one transaction: claim the key, lock BOTH wallets
   * (in wallet-id order, so opposite-direction transfers can't deadlock),
   * check both owners and the balance, debit + credit, write the transaction
   * with a DEBIT and a CREDIT ledger entry, store the response.
   */
  transfer(
    senderId: string,
    idempotencyKey: string,
    dto: CreateTransferDto,
  ): Promise<IdempotentResult<TransferResponseDto>> {
    if (!dto.recipientWalletId === !dto.recipientEmail) {
      throw new BadRequestException(
        'Provide exactly one of recipientWalletId or recipientEmail',
      );
    }
    if (dto.amount > this.maxAmount) {
      throw new BadRequestException(
        `amount must not exceed ${this.maxAmount} (kobo) per transaction`,
      );
    }

    return this.idempotency.execute(
      {
        userId: senderId,
        key: idempotencyKey,
        scope: 'POST /transfers',
        payload: dto,
      },
      HttpStatus.CREATED,
      (trx) => this.execute(trx, senderId, dto),
    );
  }

  private async execute(
    trx: Knex.Transaction,
    senderId: string,
    dto: CreateTransferDto,
  ): Promise<TransferResponseDto> {
    const [senderWallet, recipientWallet] = await Promise.all([
      this.wallets.findByUserId(senderId, trx),
      dto.recipientWalletId
        ? this.wallets.findById(dto.recipientWalletId, trx)
        : this.wallets.findByOwnerEmail(dto.recipientEmail!, trx),
    ]);
    if (!senderWallet) throw new NotFoundException('Wallet not found');
    if (!recipientWallet) throw new NotFoundException('Recipient not found');
    if (recipientWallet.id === senderWallet.id) {
      throw new BadRequestException('Cannot transfer to your own wallet');
    }

    const locked = await this.wallets.lockByIds(
      [senderWallet.id, recipientWallet.id],
      trx,
    );
    const sender = locked.find((w) => w.id === senderWallet.id)!;
    const recipient = locked.find((w) => w.id === recipientWallet.id)!;

    // Re-checked under the locks: these are the values that count.
    if (sender.owner_status === 'BLOCKED') {
      throw new ForbiddenException('Account is blocked');
    }
    if (recipient.owner_status === 'BLOCKED') {
      throw new UnprocessableEntityException(
        'Recipient account cannot receive transfers',
      );
    }
    if (sender.currency !== recipient.currency) {
      throw new UnprocessableEntityException('Currency mismatch');
    }
    if (sender.balance < dto.amount) {
      throw new UnprocessableEntityException('Insufficient funds');
    }

    const senderAfter = sender.balance - dto.amount;
    const recipientAfter = recipient.balance + dto.amount;
    if (!Number.isSafeInteger(recipientAfter)) {
      throw new UnprocessableEntityException(
        'Recipient wallet balance limit exceeded',
      );
    }

    await this.wallets.setBalance(sender.id, senderAfter, trx);
    await this.wallets.setBalance(recipient.id, recipientAfter, trx);
    const transaction = await this.transactions.record(
      trx,
      {
        type: 'TRANSFER',
        amount: dto.amount,
        currency: sender.currency,
        sourceWalletId: sender.id,
        destinationWalletId: recipient.id,
        narration: dto.narration ?? null,
        initiatedBy: senderId,
      },
      [
        {
          walletId: sender.id,
          direction: 'DEBIT',
          amount: dto.amount,
          balanceBefore: sender.balance,
          balanceAfter: senderAfter,
        },
        {
          walletId: recipient.id,
          direction: 'CREDIT',
          amount: dto.amount,
          balanceBefore: recipient.balance,
          balanceAfter: recipientAfter,
        },
      ],
    );

    this.logger.log(
      `Transfer ${transaction.reference}: ${sender.id} -> ${recipient.id} (${dto.amount} ${sender.currency})`,
    );
    return {
      transaction: TransactionResponseDto.from(transaction),
      wallet: WalletResponseDto.from({ ...sender, balance: senderAfter }),
    };
  }
}
