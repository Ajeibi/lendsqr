import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { toNormalizedEmail } from '../../../common/utils/transforms';

export class LoginDto {
  /** @example ada@demo.wallet */
  @Transform(toNormalizedEmail)
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}
