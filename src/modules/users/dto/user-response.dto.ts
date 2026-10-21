import { UserRole, UserStatus } from '../../../common/auth/auth-user';
import { WalletResponseDto } from '../../wallets/dto/wallet-response.dto';
import { UserRow } from '../users.repository';

/** Public view of a user. Never exposes the password hash. */
export class UserResponseDto {
  id: string;
  email: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;

  static from(row: UserRow): UserResponseDto {
    return {
      id: row.id,
      email: row.email,
      phoneNumber: row.phone_number,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role,
      status: row.status,
      createdAt: row.created_at,
    };
  }
}

export class ProfileResponseDto {
  user: UserResponseDto;
  wallet: WalletResponseDto;
}
