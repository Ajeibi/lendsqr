'use client';

import { BalanceCard } from '@/components/balance-card';
import { RequireAuth } from '@/components/require-auth';
import { useSignedIn } from '@/components/session-provider';
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
  const { profile } = useSignedIn();
  return (
    <main className="page">
      <BalanceCard wallet={profile.wallet} />
      <div className="card muted">
        Add money, send money and your statement are coming in the next step.
      </div>
    </main>
  );
}
