import { Injectable, NotFoundException } from '@nestjs/common';
import { WalletResponseDto } from '../wallets/dto/wallet-response.dto';
import { WalletsRepository } from '../wallets/wallets.repository';
import { ProfileResponseDto, UserResponseDto } from './dto/user-response.dto';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly users: UsersRepository,
    private readonly wallets: WalletsRepository,
  ) {}

  async getProfile(userId: string): Promise<ProfileResponseDto> {
    const [user, wallet] = await Promise.all([
      this.users.findById(userId),
      this.wallets.findByUserId(userId),
    ]);
    if (!user || !wallet) throw new NotFoundException('User not found');

    return {
      user: UserResponseDto.from(user),
      wallet: WalletResponseDto.from(wallet),
    };
  }
}
