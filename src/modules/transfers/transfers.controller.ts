import { Body, Controller, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import {
  ApiIdempotencyKey,
  IdempotencyKey,
  sendIdempotent,
} from '../idempotency/idempotency-key.decorator';
import {
  CreateTransferDto,
  TransferResponseDto,
} from './dto/create-transfer.dto';
import { TransfersService } from './transfers.service';

@ApiTags('transfers')
@ApiBearerAuth()
@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfers: TransfersService) {}

  /**
   * Send money from your wallet to another wallet, identified by wallet id or
   * by the owner's email. Requires an Idempotency-Key.
   */
  @Post()
  @ApiIdempotencyKey()
  async create(
    @CurrentUser() user: AuthUser,
    @IdempotencyKey() key: string,
    @Body() dto: CreateTransferDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<TransferResponseDto> {
    return sendIdempotent(
      res,
      await this.transfers.transfer(user.id, key, dto),
    );
  }
}
