import { DatabaseError } from 'pg';

export const PG_UNIQUE_VIOLATION = '23505';

export function isUniqueViolation(
  error: unknown,
  constraint?: string,
): error is DatabaseError {
  return (
    error instanceof DatabaseError &&
    error.code === PG_UNIQUE_VIOLATION &&
    (constraint === undefined || error.constraint === constraint)
  );
}
