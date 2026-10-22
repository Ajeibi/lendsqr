'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useSignedIn } from './session-provider';

interface Loaded<T> {
  request: string;
  data?: T;
  error?: ApiError;
}

/**
 * GETs `path` with the session token. Pass `null` to skip; bump `version`
 * to reload. Results for a request that's no longer current are ignored.
 *
 * `data` is the latest successful result, kept while the next one loads so
 * lists don't flicker; `fresh` says whether it belongs to the current request
 * (use it when showing stale data would mislead, e.g. a different user).
 */
export function useApiQuery<T>(path: string | null, version = 0) {
  const { token } = useSignedIn();
  const [loaded, setLoaded] = useState<Loaded<T> | null>(null);
  const request = path === null ? null : `${path}#${version}`;

  useEffect(() => {
    if (path === null || request === null) return;
    let cancelled = false;
    api<T>(path, { token })
      .then(({ data }) => !cancelled && setLoaded({ request, data }))
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoaded({
          request,
          error:
            error instanceof ApiError ? error : new ApiError(0, ['Something went wrong']),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [path, request, token]);

  const fresh = request !== null && loaded?.request === request;
  return {
    data: loaded?.data,
    fresh,
    error: fresh ? loaded?.error : undefined,
    loading: request !== null && !fresh,
  };
}
