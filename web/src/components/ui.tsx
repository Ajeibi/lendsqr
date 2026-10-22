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

/** An API failure: every message from the server, plus its request id for support. */
export function ErrorAlert({ error }: { error: ApiError }) {
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
    </Alert>
  );
}
