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

export interface Page<T> {
  data: T[];
  meta: { page: number; limit: number; total: number };
}

export interface StatusEvent {
  action: 'BLOCK' | 'UNBLOCK';
  reason: string;
  actorId: string;
  createdAt: string;
}

export interface AdminUserDetail extends Profile {
  statusHistory: StatusEvent[];
}

export type IdentityType = 'EMAIL' | 'PHONE' | 'BVN';

export interface BlacklistEntry {
  id: string;
  identityType: IdentityType;
  identity: string;
  reason: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface RegisterInput {
  email: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  password: string;
}
