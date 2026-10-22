/** One line of GET /transactions: a transaction from the caller's side. */
export interface StatementLine {
  reference: string;
  type: 'FUNDING' | 'TRANSFER';
  amount: number;
  narration: string | null;
  sourceWalletId: string | null;
  destinationWalletId: string;
  direction: 'DEBIT' | 'CREDIT';
  balanceAfter: number;
  /** Recipient of a debit, sender of a credit; null for funding. */
  counterpartyName: string | null;
  createdAt: string;
}

/** Who the money went to or came from, with the note underneath. */
export function describeLine(line: StatementLine): {
  title: string;
  detail: string | null;
} {
  if (line.type === 'FUNDING') {
    return { title: 'Money added', detail: line.narration };
  }
  const debit = line.direction === 'DEBIT';
  const walletId = (debit ? line.destinationWalletId : line.sourceWalletId) ?? '';
  const who = line.counterpartyName ?? `wallet ${walletId.slice(0, 8)}…`;
  return {
    title: debit ? `Sent to ${who}` : `Received from ${who}`,
    detail: line.narration,
  };
}
