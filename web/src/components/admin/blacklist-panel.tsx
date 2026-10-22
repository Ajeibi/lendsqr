'use client';

import { useId, useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import type { BlacklistEntry, IdentityType, Page } from '@/lib/types';
import { useSignedIn } from '../session-provider';
import { Alert, ErrorAlert, Pager, shortDate } from '../ui';
import { useApiQuery } from '../use-api-query';

const PAGE_SIZE = 10;

const TYPES: { value: IdentityType; label: string; placeholder: string }[] = [
  { value: 'EMAIL', label: 'Email', placeholder: 'fraudster@example.com' },
  { value: 'PHONE', label: 'Phone', placeholder: '0803 123 4567' },
  { value: 'BVN', label: 'BVN', placeholder: '22212345678' },
];

export function BlacklistPanel() {
  const { token } = useSignedIn();
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const list = useApiQuery<Page<BlacklistEntry>>(
    `/admin/blacklist?page=${page}&limit=${PAGE_SIZE}`,
    version,
  );

  const [type, setType] = useState<IdentityType>('EMAIL');
  const [identity, setIdentity] = useState('');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const id = useId();

  /** Runs a change; on success shows `success(result)` and reloads the list. */
  async function call<T>(run: () => Promise<T>, success: (result: T) => string) {
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const result = await run();
      setNotice(success(result));
      setVersion((v) => v + 1);
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, ['Something went wrong']));
      return false;
    } finally {
      setPending(false);
    }
  }

  async function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const added = await call(
      () =>
        api<BlacklistEntry>('/admin/blacklist', {
          method: 'POST',
          token,
          body: { identityType: type, identity, reason },
        }),
      // The server's normalised form (e.g. +234…), which is what's matched at signup.
      ({ data }) => `${data.identity} can no longer create an account`,
    );
    if (added) {
      setIdentity('');
      setReason('');
      setPage(1);
    }
  }

  function onRemove(entry: BlacklistEntry) {
    if (!window.confirm(`Remove ${entry.identity} from the blacklist? They'll be able to sign up again.`)) {
      return;
    }
    void call(
      () => api(`/admin/blacklist/${entry.id}`, { method: 'DELETE', token }),
      () => `${entry.identity} removed from the blacklist`,
    );
  }

  const placeholder = TYPES.find((t) => t.value === type)?.placeholder;
  const total = list.data?.meta.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="card" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>Blacklist</h2>
      <form
        className="form-row"
        onSubmit={onAdd}
        onChange={() => {
          setNotice(null);
          setError(null);
        }}
      >
        <div className="field">
          <label htmlFor={`${id}-type`}>Type</label>
          <select id={`${id}-type`} className="input" value={type}
            onChange={(e) => setType(e.target.value as IdentityType)}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-identity`}>Identity</label>
          <input id={`${id}-identity`} className="input" required maxLength={255}
            placeholder={placeholder} value={identity}
            onChange={(e) => setIdentity(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-reason`}>Reason</label>
          <input id={`${id}-reason`} className="input" required maxLength={255}
            placeholder="Confirmed card fraud" value={reason}
            onChange={(e) => setReason(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          Add to blacklist
        </button>
      </form>
      <p className="hint">
        Blacklisted identities can&apos;t create an account. Lendsqr Karma is checked
        at signup as well. To stop an existing account, block it on the Users tab.
      </p>

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <ErrorAlert error={error} />}
      {list.error && <ErrorAlert error={list.error} />}

      {list.data && list.data.data.length === 0 && (
        <div className="empty">
          <strong>The blacklist is empty</strong>
          <span className="muted">Entries you add appear here, newest first.</span>
        </div>
      )}

      {list.data && list.data.data.length > 0 && (
        <>
          <div className="table-scroll" style={{ marginTop: 12, padding: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Type</th>
                  <th scope="col">Identity</th>
                  <th scope="col" className="hide-sm">Reason</th>
                  <th scope="col" className="hide-sm">Added</th>
                  <th scope="col"><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {list.data.data.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <span className="badge badge-info">
                        {TYPES.find((t) => t.value === entry.identityType)?.label}
                      </span>
                    </td>
                    <td className="mono" style={{ overflowWrap: 'anywhere' }}>{entry.identity}</td>
                    <td className="hide-sm">{entry.reason}</td>
                    <td className="muted hide-sm">{shortDate.format(new Date(entry.createdAt))}</td>
                    <td className="num">
                      <button type="button" className="btn btn-sm btn-danger" disabled={pending}
                        onClick={() => onRemove(entry)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={page} pages={pages} busy={list.loading} onChange={setPage} />
        </>
      )}
    </section>
  );
}
