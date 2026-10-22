import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Knex } from 'knex';
import { InjectKnex } from '../../database/database.module';
import { WalletResponseDto } from '../wallets/dto/wallet-response.dto';
import { WalletsRepository } from '../wallets/wallets.repository';
import {
  AdminUserDetailDto,
  ListUsersQueryDto,
  StatusEventDto,
  UserPageDto,
} from './dto/admin-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { StatusAction, UsersRepository } from './users.repository';

const TARGET_STATUS = { BLOCK: 'BLOCKED', UNBLOCK: 'ACTIVE' } as const;

@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(
    @InjectKnex() private readonly db: Knex,
    private readonly users: UsersRepository,
    private readonly wallets: WalletsRepository,
  ) {}

  async list(query: ListUsersQueryDto): Promise<UserPageDto> {
    const { rows, total } = await this.users.list(
      query.limit,
      query.offset,
      query.email,
    );
    return {
      data: rows.map((row) => UserResponseDto.from(row)),
      meta: { page: query.page, limit: query.limit, total },
    };
  }

  async getDetail(userId: string): Promise<AdminUserDetailDto> {
    const [user, wallet, events] = await Promise.all([
      this.users.findById(userId),
      this.wallets.findByUserId(userId),
      this.users.listStatusEvents(userId),
    ]);
    if (!user || !wallet) throw new NotFoundException('User not found');
    return {
      user: UserResponseDto.from(user),
      wallet: WalletResponseDto.from(wallet),
      statusHistory: events.map((e) => StatusEventDto.from(e)),
    };
  }

  /**
   * Blocks or unblocks an account and records who did it and why, in one
   * transaction. The user row is locked FOR UPDATE, which waits for any
   * in-flight transfer/funding (they hold a share lock on it); anything that
   * starts after this commits sees the new status.
   *
   * Effect of a block: the user can't log in, existing tokens stop working,
   * they can't send or fund, and they can't receive transfers.
   */
  async changeStatus(
    userId: string,
    action: StatusAction,
    reason: string,
    adminId: string,
  ): Promise<UserResponseDto> {
    if (action === 'BLOCK' && userId === adminId) {
      throw new BadRequestException('You cannot block your own account');
    }
    const target = TARGET_STATUS[action];

    const updated = await this.db.transaction(async (trx) => {
      const user = await this.users.lockById(userId, trx);
      if (!user) throw new NotFoundException('User not found');
      if (user.status === target) {
        throw new ConflictException(
          `User is already ${target === 'BLOCKED' ? 'blocked' : 'active'}`,
        );
      }

      const row = await this.users.setStatus(userId, target, trx);
      await this.users.addStatusEvent(
        { userId, action, reason, actorId: adminId },
        trx,
      );
      return row;
    });

    this.logger.log(`User ${userId} ${action} by ${adminId}`);
    return UserResponseDto.from(updated);
  }
}
