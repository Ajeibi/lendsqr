'use client';

import { useState } from 'react';
import { formatKobo } from '@/lib/money';
import type { Wallet } from '@/lib/types';

export function BalanceCard({ wallet }: { wallet: Wallet }) {
  const [copied, setCopied] = useState(false);

  async function copyId() {
    try {
      await navigator.clipboard.writeText(wallet.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be unavailable (permissions, insecure context); the id stays visible.
    }
  }

  return (
    <section className="card balance" aria-label="Balance">
      <div>
        <div className="balance-label">Available balance</div>
        <div className="balance-amount">{formatKobo(wallet.balance)}</div>
      </div>
      <div className="balance-meta">
        <div className="balance-label">Wallet ID · {wallet.currency}</div>
        <button type="button" className="copy" onClick={copyId} title="Copy wallet ID">
          <span className="mono">
            {copied ? 'Copied' : `${wallet.id.slice(0, 13)}…${wallet.id.slice(-6)} ⧉`}
          </span>
        </button>
      </div>
    </section>
  );
}
