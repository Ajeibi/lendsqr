import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { StatementLineDto, StatementPageDto } from './dto/statement-line.dto';
import { TransactionsRepository } from './transactions.repository';

@ApiTags('transactions')
@ApiBearerAuth()
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsRepository) {}

  /** Your wallet's statement, newest first: fundings and transfers in and out */
  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQueryDto,
  ): Promise<StatementPageDto> {
    const { rows, total } = await this.transactions.listStatement(
      user.id,
      query.limit,
      query.offset,
    );
    return {
      data: rows.map((row) => StatementLineDto.fromStatement(row)),
      meta: { page: query.page, limit: query.limit, total },
    };
  }

  /** One of your transactions by reference (404 if your wallet wasn't part of it) */
  @Get(':reference')
  async get(
    @CurrentUser() user: AuthUser,
    @Param('reference') reference: string,
  ): Promise<StatementLineDto> {
    const row = await this.transactions.findStatementLine(user.id, reference);
    if (!row) throw new NotFoundException('Transaction not found');
    return StatementLineDto.fromStatement(row);
  }
}
