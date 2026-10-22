/**
 * Turns the API's messages (written for developers: field names, header
 * names, units in kobo) into plain language for the people using the app.
 * Anything unrecognised passes through unchanged, so a new API message is
 * still shown rather than swallowed.
 */
const EXACT: Record<string, string> = {
  // Sign up / sign in
  'email must be an email': 'Enter a valid email address.',
  'phoneNumber must be a valid Nigerian mobile number':
    'Enter a valid Nigerian mobile number, like 0803 123 4567.',
  'password must contain at least one letter and one digit':
    'Your password needs at least one letter and one number.',
  'password must be longer than or equal to 8 characters':
    'Your password needs at least 8 characters.',
  'Email is already registered':
    'An account with this email already exists. Try signing in instead.',
  'Phone number is already registered':
    'An account with this phone number already exists.',
  'Account cannot be created: identity is blacklisted':
    "We can't open an account with these details.",
  'Invalid email or password': "That email and password don't match.",

  // Money
  'Insufficient funds': "You don't have enough money for this.",
  'Recipient not found': "We couldn't find an account with that email.",
  'Cannot transfer to your own wallet': "You can't send money to yourself.",
  'Recipient account cannot receive transfers':
    "This person can't receive money right now.",
  'recipientEmail must be an email': "Enter the recipient's email address.",
  'Idempotency-Key has already been used for a different request':
    'Something went wrong. Please try again.',
  'Wallet balance limit exceeded': 'This would take the balance over the limit.',
  'Recipient wallet balance limit exceeded':
    "This would take the recipient's balance over the limit.",

  // Admin
  'Identity is already blacklisted': "That's already on the blacklist.",
  'Insufficient permissions': "You don't have access to this.",
  'User not found': "We couldn't find that user.",
};

const LABELS: Record<string, string> = {
  firstName: 'your first name',
  lastName: 'your last name',
  email: 'an email address',
  password: 'a password',
  phoneNumber: 'a phone number',
  reason: 'a reason',
  identity: 'the email, phone number or BVN',
  recipientEmail: "the recipient's email",
  amount: 'an amount',
};

const IDENTITY_TYPES: Record<string, string> = {
  EMAIL: 'email address',
  PHONE: 'Nigerian phone number',
  BVN: 'BVN (11 digits)',
};

export function friendlyMessage(message: string): string | null {
  if (message in EXACT) return EXACT[message];

  // "property role should not exist": a client bug, not something to show.
  if (/^property \w+ should not exist$/.test(message)) return null;

  const empty = /^(\w+) should not be empty$/.exec(message);
  if (empty) return `Enter ${LABELS[empty[1]] ?? 'this field'}.`;

  const identity = /^identity is not a valid (EMAIL|PHONE|BVN)$/.exec(message);
  if (identity) return `That isn't a valid ${IDENTITY_TYPES[identity[1]]}.`;

  if (/^amount must not exceed/.test(message)) {
    return 'The most you can move at once is ₦5,000,000.00.';
  }
  return message;
}

/** Friendly, de-duplicated messages for display. */
export function friendlyMessages(messages: string[]): string[] {
  const out = messages
    .map(friendlyMessage)
    .filter((m): m is string => m !== null);
  const unique = [...new Set(out)];
  return unique.length ? unique : ['Something went wrong. Please try again.'];
}
