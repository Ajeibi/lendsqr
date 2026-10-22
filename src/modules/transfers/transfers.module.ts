import { Module } from '@nestjs/common';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { WalletsModule } from '../wallets/wallets.module';
import { TransfersController } from './transfers.controller';
import { TransfersService } from './transfers.service';

@Module({
  imports: [WalletsModule, TransactionsModule, IdempotencyModule],
  controllers: [TransfersController],
  providers: [TransfersService],
})
export class TransfersModule {}
