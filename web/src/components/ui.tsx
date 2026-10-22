import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ApiError } from '@/lib/api';
import { friendlyMessages } from '@/lib/friendly';

export function Logo() {
  return (
    <Link href="/" className="logo">
      {/* Same mark as the favicon (app/icon.svg). */}
      <svg className="logo-mark" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="currentColor" />
        <rect x="8" y="11" width="16" height="11" rx="2.5" fill="none" stroke="#fff" strokeWidth="2" />
        <path d="M8 15h16" stroke="#fff" strokeWidth="2" />
      </svg>
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
  detail,
}: {
  tone: Tone;
  children: ReactNode;
  /** A smaller second line, e.g. a transaction reference. */
  detail?: ReactNode;
}) {
  return (
    <div
      className={`alert alert-${tone}`}
      role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'}
    >
      {children}
      {detail && <span className="alert-detail">{detail}</span>}
    </div>
  );
}

/**
 * An API failure, in plain language (see lib/friendly). `retrySafe` marks
 * money actions that reuse their Idempotency-Key, so retrying can't charge twice.
 */
export function ErrorAlert({
  error,
  retrySafe = false,
}: {
  error: ApiError;
  retrySafe?: boolean;
}) {
  const messages = friendlyMessages(error.messages);
  return (
    <Alert
      tone={error.isTransient ? 'warning' : 'danger'}
      detail={
        retrySafe && error.isTransient
          ? "It's safe to try again. You won't be charged twice."
          : undefined
      }
    >
      {messages.length > 1 ? (
        <ul>
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : (
        messages[0]
      )}
    </Alert>
  );
}

/** A short, readable form of a transaction reference: "FND-42465D17". */
export function shortReference(reference: string): string {
  return reference.slice(0, 12).toUpperCase();
}
