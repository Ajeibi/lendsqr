import { Module } from '@nestjs/common';
import { WalletsModule } from '../wallets/wallets.module';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

@Module({
  imports: [WalletsModule],
  controllers: [UsersController, AdminUsersController],
  providers: [UsersRepository, UsersService, AdminUsersService],
  exports: [UsersRepository],
})
export class UsersModule {}
