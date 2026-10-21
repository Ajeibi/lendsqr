export type IdentityType = 'EMAIL' | 'PHONE' | 'BVN';

const NG_PHONE = /^(?:\+?234|0)([789][01]\d{8})$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Normalises Nigerian mobile numbers (0803..., 234803..., +234 803 ...)
 * to E.164 (+234803...). Returns null for anything else.
 */
export function normalizeNigerianPhone(phone: string): string | null {
  const match = NG_PHONE.exec(phone.replace(/[\s()-]/g, ''));
  return match ? `+234${match[1]}` : null;
}

/** Compares two identities of the same type after normalisation. */
export function identitiesMatch(
  type: IdentityType,
  a: string,
  b: string,
): boolean {
  switch (type) {
    case 'EMAIL':
      return normalizeEmail(a) === normalizeEmail(b);
    case 'PHONE':
      return (
        (normalizeNigerianPhone(a) ?? a.trim()) ===
        (normalizeNigerianPhone(b) ?? b.trim())
      );
    case 'BVN':
      return a.trim() === b.trim();
  }
}
