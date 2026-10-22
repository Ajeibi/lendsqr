import { randomBytes } from 'crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { Knex } from 'knex';
import { JwtPayload } from '../../common/auth/auth-user';
import { AppConfig } from '../../config/configuration';
import { InjectKnex } from '../../database/database.module';
import { isUniqueViolation } from '../../database/pg-errors';
import { BlacklistService } from '../blacklist/blacklist.service';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { UserRow, UsersRepository } from '../users/users.repository';
import { WalletResponseDto } from '../wallets/dto/wallet-response.dto';
import { WalletsRepository } from '../wallets/wallets.repository';
import { RegisterResponseDto, TokenResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const DUPLICATE_MESSAGES: Record<string, string> = {
  users_email_unique: 'Email is already registered',
  users_phone_number_unique: 'Phone number is already registered',
};

@Injectable()
export class AuthService implements OnModuleInit {
  /** Verified against when the email is unknown, so both paths cost the same. */
  private dummyHash: string;

  constructor(
    @InjectKnex() private readonly db: Knex,
    private readonly users: UsersRepository,
    private readonly wallets: WalletsRepository,
    private readonly blacklist: BlacklistService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyHash = await argon2.hash(randomBytes(32).toString('hex'));
  }

  /**
   * Blacklist-checks the identity, then creates the user and their wallet in
   * one transaction so a user can never exist without a wallet.
   *
   * Duplicates are rejected before the blacklist check: Karma lookups are
   * rate-limited and billed per call, so they're spent only on sign-ups that
   * can succeed. The unique constraints still catch concurrent duplicates.
   */
  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    const existing = await this.users.findByEmailOrPhone(
      dto.email,
      dto.phoneNumber,
    );
    if (existing) {
      throw new ConflictException(
        existing.email === dto.email
          ? DUPLICATE_MESSAGES.users_email_unique
          : DUPLICATE_MESSAGES.users_phone_number_unique,
      );
    }

    await this.blacklist.assertEligible([
      { type: 'EMAIL', identity: dto.email },
      { type: 'PHONE', identity: dto.phoneNumber },
    ]);

    const passwordHash = await argon2.hash(dto.password);

    try {
      const { user, wallet } = await this.db.transaction(async (trx) => {
        const user = await this.users.create(
          {
            email: dto.email,
            phoneNumber: dto.phoneNumber,
            firstName: dto.firstName,
            lastName: dto.lastName,
            passwordHash,
          },
          trx,
        );
        const wallet = await this.wallets.create(user.id, trx);
        return { user, wallet };
      });

      return {
        user: UserResponseDto.from(user),
        wallet: WalletResponseDto.from(wallet),
        auth: await this.issueToken(user),
      };
    } catch (error) {
      // Covers the race where two sign-ups with the same email arrive together.
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          DUPLICATE_MESSAGES[error.constraint ?? ''] ??
            'Account already exists',
        );
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<TokenResponseDto> {
    const user = await this.users.findByEmail(dto.email);
    const passwordValid = await argon2.verify(
      user?.password_hash ?? this.dummyHash,
      dto.password,
    );
    if (!user || !passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    // Only revealed to someone who already proved they know the password.
    if (user.status === 'BLOCKED') {
      throw new ForbiddenException('Account is blocked');
    }
    return this.issueToken(user);
  }

  private async issueToken(user: UserRow): Promise<TokenResponseDto> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return {
      accessToken: await this.jwt.signAsync(payload),
      tokenType: 'Bearer',
      expiresIn: this.config.get('jwt.expiresIn', { infer: true }),
    };
  }
}
