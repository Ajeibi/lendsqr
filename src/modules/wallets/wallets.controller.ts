import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import {
  ApiIdempotencyKey,
  IdempotencyKey,
  sendIdempotent,
} from '../idempotency/idempotency-key.decorator';
import { FundWalletDto, FundWalletResponseDto } from './dto/fund-wallet.dto';
import { WalletResponseDto } from './dto/wallet-response.dto';
import { WalletsService } from './wallets.service';

@ApiTags('wallets')
@ApiBearerAuth()
@Controller('wallets')
export class WalletsController {
  constructor(private readonly wallets: WalletsService) {}

  /** The signed-in user's wallet and balance (kobo) */
  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<WalletResponseDto> {
    return this.wallets.getForUser(user.id);
  }

  /** Credit your wallet (simulated deposit). Requires an Idempotency-Key. */
  @Post('fund')
  @ApiIdempotencyKey()
  async fund(
    @CurrentUser() user: AuthUser,
    @IdempotencyKey() key: string,
    @Body() dto: FundWalletDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<FundWalletResponseDto> {
    return sendIdempotent(res, await this.wallets.fund(user.id, key, dto));
  }
}
