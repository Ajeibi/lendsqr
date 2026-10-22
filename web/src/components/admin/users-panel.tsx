'use client';

import { useId, useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { formatKobo } from '@/lib/money';
import type { AdminUserDetail, Page, User } from '@/lib/types';
import { useSignedIn } from '../session-provider';
import { Alert, ErrorAlert, shortDate } from '../ui';
import { useApiQuery } from '../use-api-query';

const longDate = new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' });

const initials = (u: User) => `${u.firstName[0] ?? ''}${u.lastName[0] ?? ''}`.toUpperCase();

export function UsersPanel() {
  const [query, setQuery] = useState('');
  const [searchPath, setSearchPath] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const id = useId();

  const recent = useApiQuery<Page<User>>('/admin/users?limit=5', version);
  const search = useApiQuery<Page<User>>(searchPath);

  // Show the user picked from the list, else the search's (unique) match.
  const matches = search.fresh ? search.data?.data : undefined;
  const shownId = selectedId ?? (matches?.length === 1 ? matches[0].id : null);
  const detail = useApiQuery<AdminUserDetail>(
    shownId && `/admin/users/${shownId}`,
    version,
  );
  // Never show one user's data while another is loading.
  const user = detail.data?.user.id === shownId ? detail.data : undefined;

  function onSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = query.trim().toLowerCase();
    if (!email) return;
    setSelectedId(null);
    setSearchPath(`/admin/users?email=${encodeURIComponent(email)}`);
  }

  function backToList() {
    setSelectedId(null);
    setSearchPath(null);
    setQuery('');
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))' }}>
      <section className="card" aria-labelledby={`${id}-find`}>
        <h2 id={`${id}-find`}>Find a user</h2>
        <form className="search-row" onSubmit={onSearch}>
          <div className="field">
            <label htmlFor={`${id}-email`}>Email</label>
            <input id={`${id}-email`} className="input" type="email" placeholder="tunde@demo.wallet"
              value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <button type="submit" className="btn">Search</button>
        </form>

        {search.error && <ErrorAlert error={search.error} />}
        {detail.error && <ErrorAlert error={detail.error} />}
        {matches?.length === 0 && <Alert tone="info">No user with that email.</Alert>}

        {shownId ? (
          <>
            {user ? (
              <UserCard
                key={user.user.id}
                detail={user}
                onChanged={() => setVersion((v) => v + 1)}
              />
            ) : (
              <p className="muted divider" role="status">Loading…</p>
            )}
            <button type="button" className="btn btn-sm" style={{ marginTop: 16 }}
              onClick={backToList}>
              ← Back to recent sign-ups
            </button>
          </>
        ) : (
          <div className="divider">
            <p className="section-label">Recent sign-ups</p>
            {recent.error && <ErrorAlert error={recent.error} />}
            <ul className="user-list">
              {recent.data?.data.map((u) => (
                <li key={u.id}>
                  <button type="button" onClick={() => setSelectedId(u.id)}>
                    <span style={{ minWidth: 0 }}>
                      <strong>{u.firstName} {u.lastName}</strong>
                      <span className="muted person-meta" style={{ display: 'block' }}>
                        {u.email}
                      </span>
                    </span>
                    <StatusBadge status={u.status} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="card" aria-labelledby={`${id}-history`}>
        <h2 id={`${id}-history`}>History</h2>
        {!user && <p className="muted">Select a user to see when they were blocked or unblocked, by whom and why.</p>}
        {user && user.statusHistory.length === 0 && (
          <p className="muted">Never blocked.</p>
        )}
        {user && user.statusHistory.length > 0 && <History events={user.statusHistory} />}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: User['status'] }) {
  return status === 'BLOCKED' ? (
    <span className="badge badge-danger">Blocked</span>
  ) : (
    <span className="badge badge-success">Active</span>
  );
}

function UserCard({ detail, onChanged }: { detail: AdminUserDetail; onChanged: () => void }) {
  const { token, profile } = useSignedIn();
  const { user, wallet } = detail;
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const id = useId();

  const isSelf = user.id === profile.user.id;
  const blocking = user.status === 'ACTIVE';

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reason.trim()) return setReasonError('Give a reason; it goes on the audit trail');
    setPending(true);
    setError(null);
    setDone(null);
    try {
      await api(`/admin/users/${user.id}/${blocking ? 'block' : 'unblock'}`, {
        method: 'PATCH',
        token,
        body: { reason: reason.trim() },
      });
      setDone(blocking ? `${user.firstName} is blocked` : `${user.firstName} is active again`);
      setReason('');
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, ['Something went wrong']));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="divider">
      <div className="person">
        <div className="person-main">
          <span className="avatar avatar-lg" aria-hidden="true">{initials(user)}</span>
          <div>
            <div className="person-name">{user.firstName} {user.lastName}</div>
            <div className="muted person-meta">{user.email} · {user.phoneNumber}</div>
          </div>
        </div>
        <StatusBadge status={user.status} />
      </div>
      <p className="muted person-meta" style={{ marginBottom: 0 }}>
        Balance <strong style={{ color: 'var(--text)' }}>{formatKobo(wallet.balance)}</strong>
        {' · '}Joined {longDate.format(new Date(user.createdAt))}
        {user.role === 'ADMIN' && ' · Admin'}
      </p>

      {isSelf ? (
        <Alert tone="info">This is your account. Admins can&apos;t block themselves.</Alert>
      ) : (
        <form
          onSubmit={onSubmit}
          onChange={() => {
            setDone(null);
            setError(null);
          }}
          noValidate
        >
          <div className="field">
            <label htmlFor={`${id}-reason`}>Reason</label>
            <input id={`${id}-reason`} className="input" maxLength={255}
              placeholder={blocking ? 'Suspicious activity' : 'Verified by support'}
              value={reason} aria-invalid={reasonError ? true : undefined}
              onChange={(e) => {
                setReason(e.target.value);
                setReasonError(null);
              }} />
            {reasonError && <div className="field-error">{reasonError}</div>}
            <div className="hint">
              {blocking
                ? 'Blocking signs them out everywhere and stops all sending and receiving.'
                : 'Unblocking restores sign-in, sending and receiving.'}
            </div>
          </div>
          <button type="submit" className={`btn ${blocking ? 'btn-danger' : 'btn-primary'}`}
            style={{ marginTop: 12 }} disabled={pending}>
            {pending ? 'Saving…' : blocking ? 'Block account' : 'Unblock account'}
          </button>
        </form>
      )}
      {done && <Alert tone="success">{done}</Alert>}
      {error && <ErrorAlert error={error} />}
    </div>
  );
}

function History({ events }: { events: AdminUserDetail['statusHistory'] }) {
  const { profile } = useSignedIn();
  return (
    <ul className="timeline">
      {events.map((event) => (
        <li key={`${event.createdAt}:${event.action}`}
          className={event.action === 'BLOCK' ? 'event-block' : 'event-unblock'}>
          <strong>{event.action === 'BLOCK' ? 'Blocked' : 'Unblocked'}</strong>{' '}
          by {event.actorId === profile.user.id ? 'you' : 'another admin'}
          <div className="muted person-meta">
            “{event.reason}” · {shortDate.format(new Date(event.createdAt))}
          </div>
        </li>
      ))}
    </ul>
  );
}
