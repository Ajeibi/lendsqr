import { Module } from '@nestjs/common';
import { TransactionsRepository } from './transactions.repository';

@Module({
  providers: [TransactionsRepository],
  exports: [TransactionsRepository],
})
export class TransactionsModule {}
