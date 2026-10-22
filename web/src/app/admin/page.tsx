'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BlacklistPanel } from '@/components/admin/blacklist-panel';
import { UsersPanel } from '@/components/admin/users-panel';
import { RequireAuth } from '@/components/require-auth';
import { useSignedIn } from '@/components/session-provider';
import { TopBar } from '@/components/top-bar';

type Tab = 'users' | 'blacklist';

export default function AdminPage() {
  return (
    <RequireAuth>
      <TopBar />
      <AdminView />
    </RequireAuth>
  );
}

function AdminView() {
  const { profile } = useSignedIn();
  const [tab, setTab] = useState<Tab>('users');

  // The API enforces this too (403); here it just avoids a broken screen.
  if (profile.user.role !== 'ADMIN') {
    return (
      <main className="page">
        <div className="card">
          <h1>Admins only</h1>
          <p className="muted">
            This area is for administrators. <Link href="/wallet/">Go to your wallet</Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="tabs" role="tablist" aria-label="Admin">
        <button type="button" role="tab" id="tab-users" aria-controls="panel-users"
          aria-selected={tab === 'users'} onClick={() => setTab('users')}>
          Users
        </button>
        <button type="button" role="tab" id="tab-blacklist" aria-controls="panel-blacklist"
          aria-selected={tab === 'blacklist'} onClick={() => setTab('blacklist')}>
          Blacklist
        </button>
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'users' ? <UsersPanel /> : <BlacklistPanel />}
      </div>
    </main>
  );
}
