import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  toNormalizedEmail,
  toNormalizedPhone,
  trimString,
} from '../../../common/utils/transforms';

export class RegisterDto {
  /** @example ada@example.com */
  @Transform(toNormalizedEmail)
  @IsEmail()
  @MaxLength(255)
  email: string;

  /**
   * Nigerian mobile number; 0803..., 234803... and +234803... are accepted
   * and stored as +234803...
   * @example 08031234567
   */
  @Transform(toNormalizedPhone)
  @Matches(/^\+234[789][01]\d{8}$/, {
    message: 'phoneNumber must be a valid Nigerian mobile number',
  })
  phoneNumber: string;

  /** @example Ada */
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  /** @example Obi */
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  /**
   * 8-128 characters with at least one letter and one digit
   * @example Sup3rSecret
   */
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'password must contain at least one letter and one digit',
  })
  password: string;
}
