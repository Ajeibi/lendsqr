// Response shapes of the wallet API (see Swagger at /docs).

export type Role = 'USER' | 'ADMIN';
export type AccountStatus = 'ACTIVE' | 'BLOCKED';

export interface User {
  id: string;
  email: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: AccountStatus;
  createdAt: string;
}

export interface Wallet {
  id: string;
  currency: string;
  /** Minor units (kobo). */
  balance: number;
}

export interface Profile {
  user: User;
  wallet: Wallet;
}

export interface TokenResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

export interface RegisterResponse extends Profile {
  auth: TokenResponse;
}

export interface RegisterInput {
  email: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  password: string;
}
