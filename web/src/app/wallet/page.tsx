'use client';

import { useCallback, useState } from 'react';
import { BalanceCard } from '@/components/balance-card';
import { AddMoneyForm, SendMoneyForm } from '@/components/money-forms';
import { RequireAuth } from '@/components/require-auth';
import { useSignedIn } from '@/components/session-provider';
import { Statement } from '@/components/statement';
import { TopBar } from '@/components/top-bar';

export default function WalletPage() {
  return (
    <RequireAuth>
      <TopBar />
      <WalletView />
    </RequireAuth>
  );
}

function WalletView() {
  const { profile, refresh } = useSignedIn();
  // Bumped after money moves so the statement reloads with the balance.
  const [version, setVersion] = useState(0);

  const onMoved = useCallback(() => {
    setVersion((v) => v + 1);
    // A failed refresh leaves the last known balance; the next action retries.
    refresh().catch(() => undefined);
  }, [refresh]);

  return (
    <main className="page">
      <BalanceCard wallet={profile.wallet} />
      <div className="grid">
        <AddMoneyForm onMoved={onMoved} />
        <SendMoneyForm onMoved={onMoved} />
      </div>
      <Statement version={version} />
    </main>
  );
}
