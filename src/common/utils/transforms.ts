import { normalizeEmail, normalizeNigerianPhone } from './identity';

/** class-transformer @Transform functions for DTOs. Non-strings pass through to fail validation. */
type TransformInput = { value: unknown };

export const trimString = ({ value }: TransformInput): unknown =>
  typeof value === 'string' ? value.trim() : value;

export const toNormalizedEmail = ({ value }: TransformInput): unknown =>
  typeof value === 'string' ? normalizeEmail(value) : value;

export const toNormalizedPhone = ({ value }: TransformInput): unknown =>
  typeof value === 'string' ? (normalizeNigerianPhone(value) ?? value) : value;
