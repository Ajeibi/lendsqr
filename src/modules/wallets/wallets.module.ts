import { Module } from '@nestjs/common';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { WalletsController } from './wallets.controller';
import { WalletsRepository } from './wallets.repository';
import { WalletsService } from './wallets.service';

@Module({
  imports: [IdempotencyModule, TransactionsModule],
  controllers: [WalletsController],
  providers: [WalletsRepository, WalletsService],
  exports: [WalletsRepository],
})
export class WalletsModule {}
