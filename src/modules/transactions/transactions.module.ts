import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsRepository } from './transactions.repository';

@Module({
  controllers: [TransactionsController],
  providers: [TransactionsRepository],
  exports: [TransactionsRepository],
})
export class TransactionsModule {}
