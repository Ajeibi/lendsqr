import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ApiError } from '@/lib/api';

export function Logo() {
  return (
    <Link href="/" className="logo">
      <span className="logo-mark" aria-hidden="true" />
      Wallet
    </Link>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="center-screen" role="status">
      <div className="spinner" />
      <span className="visually-hidden">{label}</span>
    </div>
  );
}

export function Pager({
  page,
  pages,
  busy,
  onChange,
}: {
  page: number;
  pages: number;
  busy: boolean;
  onChange: (page: number) => void;
}) {
  return (
    <div className="pager">
      <span className="muted">
        Page {page} of {pages}
      </span>
      <span>
        <button type="button" className="btn btn-sm" disabled={page <= 1 || busy}
          onClick={() => onChange(page - 1)}>
          Previous
        </button>{' '}
        <button type="button" className="btn btn-sm" disabled={page >= pages || busy}
          onClick={() => onChange(page + 1)}>
          Next
        </button>
      </span>
    </div>
  );
}

/** "22 Oct, 13:45" in the user's time zone. */
export const shortDate = new Intl.DateTimeFormat('en-NG', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

type Tone = 'danger' | 'success' | 'warning' | 'info';

export function Alert({
  tone,
  children,
  meta,
}: {
  tone: Tone;
  children: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div
      className={`alert alert-${tone}`}
      role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}
    >
      {children}
      {meta && <span className="alert-meta">{meta}</span>}
    </div>
  );
}

/**
 * An API failure: every message from the server, plus its request id for
 * support. `retrySafe` marks money actions that reuse their Idempotency-Key.
 */
export function ErrorAlert({
  error,
  retrySafe = false,
}: {
  error: ApiError;
  retrySafe?: boolean;
}) {
  return (
    <Alert
      tone={error.isTransient ? 'warning' : 'danger'}
      meta={error.requestId && `request ${error.requestId.slice(0, 8)}`}
    >
      {error.messages.length > 1 ? (
        <ul>
          {error.messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : (
        error.message
      )}
      {retrySafe && error.isTransient && (
        <div>It&apos;s safe to try again: the same request is never processed twice.</div>
      )}
    </Alert>
  );
}
