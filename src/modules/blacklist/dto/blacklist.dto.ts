import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import {
  IDENTITY_TYPES,
  type IdentityType,
} from '../../../common/utils/identity';
import { trimString } from '../../../common/utils/transforms';
import { BlacklistRow } from '../blacklist.repository';

export class CreateBlacklistEntryDto {
  /** @example EMAIL */
  @IsIn(IDENTITY_TYPES)
  identityType: IdentityType;

  /**
   * Email, Nigerian mobile number (any common format) or 11-digit BVN.
   * Stored normalised, so later matches are format-proof.
   * @example fraudster@example.com
   */
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  identity: string;

  /** Required for the audit trail @example Confirmed card fraud */
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reason: string;
}

export class BlacklistEntryResponseDto {
  id: string;
  identityType: IdentityType;
  identity: string;
  reason: string | null;
  createdBy: string | null;
  createdAt: Date;

  static from(row: BlacklistRow): BlacklistEntryResponseDto {
    return {
      id: row.id,
      identityType: row.identity_type,
      identity: row.identity,
      reason: row.reason,
      createdBy: row.created_by,
      createdAt: row.created_at,
    };
  }
}
