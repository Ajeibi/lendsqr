import {
  identitiesMatch,
  normalizeEmail,
  normalizeIdentity,
  normalizeNigerianPhone,
} from './identity';

describe('identity helpers', () => {
  it('normalises email case and whitespace', () => {
    expect(normalizeEmail('  Ada@Example.COM ')).toBe('ada@example.com');
  });

  it.each([
    ['08031234567', '+2348031234567'],
    ['2348031234567', '+2348031234567'],
    ['+234 803 123 4567', '+2348031234567'],
    ['0701-234-5678', '+2347012345678'],
  ])('normalises phone %s to %s', (input, expected) => {
    expect(normalizeNigerianPhone(input)).toBe(expected);
  });

  it.each(['12345', '+14155552671', '0603123456', '080312345678'])(
    'rejects non-Nigerian mobile %s',
    (input) => {
      expect(normalizeNigerianPhone(input)).toBeNull();
    },
  );

  it.each([
    ['EMAIL', ' Bad@Actor.COM ', 'bad@actor.com'],
    ['EMAIL', 'not-an-email', null],
    ['PHONE', '0803 123 4567', '+2348031234567'],
    ['PHONE', '12345', null],
    ['BVN', ' 22212345678 ', '22212345678'],
    ['BVN', '2221234567', null],
    ['BVN', '2221234567a', null],
  ] as const)('normalizeIdentity(%s, %p) -> %p', (type, value, expected) => {
    expect(normalizeIdentity(type, value)).toBe(expected);
  });

  it('matches identities after normalisation', () => {
    expect(identitiesMatch('EMAIL', 'A@b.com', 'a@B.com')).toBe(true);
    expect(identitiesMatch('PHONE', '08031234567', '+2348031234567')).toBe(
      true,
    );
    expect(identitiesMatch('EMAIL', 'a@b.com', '0zspgifzbo.ga')).toBe(false);
  });
});
