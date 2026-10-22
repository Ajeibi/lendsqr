import { describe, expect, it } from 'vitest';
import { friendlyMessage, friendlyMessages } from './friendly';

describe('friendlyMessage', () => {
  it.each([
    ['phoneNumber must be a valid Nigerian mobile number', 'Enter a valid Nigerian mobile number, like 0803 123 4567.'],
    ['password must be longer than or equal to 8 characters', 'Your password needs at least 8 characters.'],
    ['Insufficient funds', "You don't have enough money for this."],
    ['Recipient not found', "We couldn't find an account with that email."],
    ['firstName should not be empty', 'Enter your first name.'],
    ['identity is not a valid PHONE', "That isn't a valid Nigerian phone number."],
    ['amount must not exceed 500000000 (kobo) per transaction', 'The most you can move at once is ₦5,000,000.00.'],
  ])('%p -> %p', (api, friendly) => {
    expect(friendlyMessage(api)).toBe(friendly);
  });

  it('hides messages that only make sense to developers', () => {
    expect(friendlyMessage('property role should not exist')).toBeNull();
  });

  it('passes unknown messages through rather than hiding them', () => {
    expect(friendlyMessage('User is already blocked')).toBe('User is already blocked');
  });
});

describe('friendlyMessages', () => {
  it('never shows field names, header names or kobo', () => {
    const shown = friendlyMessages([
      'email must be an email',
      'phoneNumber must be a valid Nigerian mobile number',
      'password must contain at least one letter and one digit',
      'password must be longer than or equal to 8 characters',
      'property role should not exist',
    ]).join(' ');
    expect(shown).not.toMatch(/phoneNumber|property|kobo|Idempotency|must be longer/);
  });

  it('falls back to a generic message if nothing is left to show', () => {
    expect(friendlyMessages(['property x should not exist'])).toEqual([
      'Something went wrong. Please try again.',
    ]);
  });
});
