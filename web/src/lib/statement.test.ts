import { describe, expect, it } from 'vitest';
import { describeLine, type StatementLine } from './statement';

const line = (overrides: Partial<StatementLine>): StatementLine => ({
  reference: 'TRF-1',
  type: 'TRANSFER',
  amount: 100,
  narration: null,
  sourceWalletId: 'aaaaaaaa-1111',
  destinationWalletId: 'bbbbbbbb-2222',
  direction: 'DEBIT',
  balanceAfter: 0,
  counterpartyName: 'Tunde Bello',
  createdAt: '2026-10-22T12:00:00Z',
  ...overrides,
});

describe('describeLine', () => {
  it('names the recipient of money sent and the sender of money received', () => {
    expect(describeLine(line({})).title).toBe('Sent to Tunde Bello');
    expect(
      describeLine(line({ direction: 'CREDIT', counterpartyName: 'Ada Obi' })).title,
    ).toBe('Received from Ada Obi');
  });

  it('shows the note underneath', () => {
    expect(describeLine(line({ narration: 'Rent share' })).detail).toBe('Rent share');
  });

  it('describes funding without a counterparty', () => {
    expect(
      describeLine(
        line({ type: 'FUNDING', direction: 'CREDIT', counterpartyName: null, narration: 'Salary' }),
      ),
    ).toEqual({ title: 'Money added', detail: 'Salary' });
  });

  it('falls back to the wallet id if a name is missing', () => {
    expect(describeLine(line({ counterpartyName: null })).title).toBe(
      'Sent to wallet bbbbbbbb…',
    );
  });
});
