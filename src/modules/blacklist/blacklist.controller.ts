import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { Paginated, PaginationQueryDto } from '../../common/dto/pagination.dto';
import { BlacklistService } from './blacklist.service';
import {
  BlacklistEntryResponseDto,
  CreateBlacklistEntryDto,
} from './dto/blacklist.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/blacklist')
export class BlacklistController {
  constructor(private readonly blacklist: BlacklistService) {}

  /** Blacklist an email, phone number or BVN so it can never be onboarded */
  @Post()
  add(
    @CurrentUser() admin: AuthUser,
    @Body() dto: CreateBlacklistEntryDto,
  ): Promise<BlacklistEntryResponseDto> {
    return this.blacklist.addEntry(dto, admin.id);
  }

  /** Local blacklist entries, newest first */
  @Get()
  list(
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<BlacklistEntryResponseDto>> {
    return this.blacklist.listEntries(query);
  }

  /** Remove an entry, allowing that identity to sign up again */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() admin: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.blacklist.removeEntry(id, admin.id);
  }
}
