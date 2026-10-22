import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { AdminUsersService } from './admin-users.service';
import {
  AdminUserDetailDto,
  ChangeStatusDto,
  ListUsersQueryDto,
  UserPageDto,
} from './dto/admin-user.dto';
import { UserResponseDto } from './dto/user-response.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  /** Users, newest first; filter by exact email */
  @Get()
  list(@Query() query: ListUsersQueryDto): Promise<UserPageDto> {
    return this.adminUsers.list(query);
  }

  /** A user with their wallet and block/unblock history */
  @Get(':id')
  get(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<AdminUserDetailDto> {
    return this.adminUsers.getDetail(id);
  }

  /** Block an account: no login, no sending, no receiving. Reason required. */
  @Patch(':id/block')
  block(
    @CurrentUser() admin: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ChangeStatusDto,
  ): Promise<UserResponseDto> {
    return this.adminUsers.changeStatus(id, 'BLOCK', dto.reason, admin.id);
  }

  /** Restore a blocked account. Reason required. */
  @Patch(':id/unblock')
  unblock(
    @CurrentUser() admin: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ChangeStatusDto,
  ): Promise<UserResponseDto> {
    return this.adminUsers.changeStatus(id, 'UNBLOCK', dto.reason, admin.id);
  }
}
