'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AuthForm } from '@/components/auth-form';
import { useSession } from '@/components/session-provider';
import { Logo, Spinner } from '@/components/ui';

export default function SignInPage() {
  const { state, notice } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (state.status === 'signed-in') router.replace('/wallet/');
  }, [state.status, router]);

  if (state.status !== 'signed-out') return <Spinner />;

  return (
    <main className="auth">
      <div className="auth-inner">
        <Logo />
        <AuthForm notice={notice} />
        <p className="auth-footer muted">
          Demo client for the wallet API · <a href="/docs">API docs</a>
        </p>
      </div>
    </main>
  );
}
