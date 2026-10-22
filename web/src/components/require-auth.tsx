'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useSession } from './session-provider';
import { Spinner } from './ui';

/** Renders children only for a signed-in user; otherwise sends them to sign in. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { state } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (state.status === 'signed-out') router.replace('/');
  }, [state.status, router]);

  if (state.status !== 'signed-in') return <Spinner />;
  return <>{children}</>;
}
