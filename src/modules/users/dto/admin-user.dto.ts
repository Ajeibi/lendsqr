import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import {
  toNormalizedEmail,
  trimString,
} from '../../../common/utils/transforms';
import { WalletResponseDto } from '../../wallets/dto/wallet-response.dto';
import { StatusAction, StatusEventRow } from '../users.repository';
import { UserResponseDto } from './user-response.dto';

export class ListUsersQueryDto extends PaginationQueryDto {
  /** Exact match (case-insensitive) @example ada@demo.wallet */
  @IsOptional()
  @Transform(toNormalizedEmail)
  @IsEmail()
  email?: string;
}

export class ChangeStatusDto {
  /** Required for the audit trail @example Suspected account takeover */
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reason: string;
}

export class StatusEventDto {
  action: StatusAction;
  reason: string;
  /** The admin who made the change */
  actorId: string;
  createdAt: Date;

  static from(row: StatusEventRow): StatusEventDto {
    return {
      action: row.action,
      reason: row.reason,
      actorId: row.actor_id,
      createdAt: row.created_at,
    };
  }
}

export class AdminUserDetailDto {
  user: UserResponseDto;
  wallet: WalletResponseDto;
  /** Block/unblock history, newest first */
  statusHistory: StatusEventDto[];
}

export class UserPageDto {
  data: UserResponseDto[];
  meta: { page: number; limit: number; total: number };
}
