import { ProfileResponseDto } from '../../users/dto/user-response.dto';

export class TokenResponseDto {
  accessToken: string;
  /** @example Bearer */
  tokenType: 'Bearer';
  /** @example 1h */
  expiresIn: string;
}

export class RegisterResponseDto extends ProfileResponseDto {
  auth: TokenResponseDto;
}
