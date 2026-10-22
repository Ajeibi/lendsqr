'use client';

import { useEffect, useState } from 'react';

/**
 * True once `pending` has lasted longer than `afterMs`. The demo runs on a
 * free host that sleeps when idle, so the first request can take ~50s.
 */
export function useSlowHint(pending: boolean, afterMs = 4000): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setSlow(true), afterMs);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [pending, afterMs]);
  return pending && slow;
}
