'use client';

import { useId, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { formatKobo, parseNairaToKobo } from '@/lib/money';
import type { Wallet } from '@/lib/types';
import { useSignedIn } from './session-provider';
import { Alert, ErrorAlert } from './ui';
import { useMoneyAction } from './use-money-action';

interface Transaction {
  reference: string;
  amount: number;
}
interface MoneyResponse {
  transaction: Transaction;
  wallet: Wallet;
}

/** Called after money moved, so the balance and statement can refresh. */
type OnMoved = () => void;

export function AddMoneyForm({ onMoved }: { onMoved: OnMoved }) {
  const { token } = useSignedIn();
  const action = useMoneyAction<MoneyResponse>();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const id = useId();
  const parsed = parseNairaToKobo(amount);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!parsed.ok) return setAmountError(parsed.error);
    const narration = note.trim();
    const done = await action.run(JSON.stringify(['fund', parsed.kobo, narration]), (key) =>
      api<MoneyResponse>('/wallets/fund', {
        method: 'POST',
        token,
        idempotencyKey: key,
        body: { amount: parsed.kobo, ...(narration && { narration }) },
      }),
    );
    if (done) {
      setAmount('');
      setNote('');
      onMoved();
    }
  }

  const result = action.result;
  return (
    <section className="card" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>Add money</h2>
      <form onSubmit={onSubmit} noValidate>
        <AmountField
          id={`${id}-amount`}
          value={amount}
          error={amountError}
          onChange={(v) => {
            setAmount(v);
            setAmountError(null);
          }}
        />
        <NoteField id={`${id}-note`} value={note} onChange={setNote} placeholder="Top-up from bank" />
        <button type="submit" className="btn btn-primary btn-full" disabled={action.pending}>
          {action.pending
            ? 'Adding…'
            : parsed.ok
              ? `Add ${formatKobo(parsed.kobo)}`
              : 'Add money'}
        </button>
      </form>
      {result &&
        (result.replayed ? (
          <Alert tone="warning" meta="Idempotent-Replayed: true">
            This top-up was already processed, so it wasn&apos;t added twice.
          </Alert>
        ) : (
          <Alert tone="success" meta={result.data.transaction.reference}>
            Added {formatKobo(result.data.transaction.amount)} to your wallet
          </Alert>
        ))}
      {action.error && <ErrorAlert error={action.error} retrySafe />}
    </section>
  );
}

export function SendMoneyForm({ onMoved }: { onMoved: OnMoved }) {
  const { token } = useSignedIn();
  const action = useMoneyAction<MoneyResponse>();
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const id = useId();
  const parsed = parseNairaToKobo(amount);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!parsed.ok) return setAmountError(parsed.error);
    const email = recipient.trim().toLowerCase();
    const narration = note.trim();
    const done = await action.run(
      JSON.stringify(['send', email, parsed.kobo, narration]),
      (key) =>
        api<MoneyResponse>('/transfers', {
          method: 'POST',
          token,
          idempotencyKey: key,
          body: {
            recipientEmail: email,
            amount: parsed.kobo,
            ...(narration && { narration }),
          },
        }),
    );
    if (done) {
      setSentTo(email);
      setAmount('');
      setNote('');
      onMoved();
    }
  }

  const result = action.result;
  return (
    <section className="card" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>Send money</h2>
      <form onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor={`${id}-to`}>Recipient email</label>
          <input
            id={`${id}-to`}
            className="input"
            type="email"
            autoComplete="off"
            placeholder="tunde@example.com"
            required
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
        </div>
        <AmountField
          id={`${id}-amount`}
          value={amount}
          error={amountError}
          onChange={(v) => {
            setAmount(v);
            setAmountError(null);
          }}
        />
        <NoteField id={`${id}-note`} value={note} onChange={setNote} placeholder="Rent share" />
        <button type="submit" className="btn btn-primary btn-full" disabled={action.pending}>
          {action.pending
            ? 'Sending…'
            : parsed.ok
              ? `Send ${formatKobo(parsed.kobo)}`
              : 'Send money'}
        </button>
      </form>
      {result &&
        (result.replayed ? (
          <Alert tone="warning" meta="Idempotent-Replayed: true">
            This transfer was already processed, so it wasn&apos;t sent twice.
            Showing the original result.
          </Alert>
        ) : (
          <Alert tone="success" meta={result.data.transaction.reference}>
            Sent {formatKobo(result.data.transaction.amount)} to {sentTo}
          </Alert>
        ))}
      {action.error && <ErrorAlert error={action.error} retrySafe />}
    </section>
  );
}

function AmountField({
  id,
  value,
  error,
  onChange,
}: {
  id: string;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>Amount</label>
      <div className="prefix">
        <span aria-hidden="true">₦</span>
        <input
          id={id}
          className="input"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {error && (
        <div id={`${id}-error`} className="field-error">
          {error}
        </div>
      )}
    </div>
  );
}

function NoteField({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>
        Note <span className="optional">(optional)</span>
      </label>
      <input
        id={id}
        className="input"
        maxLength={255}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
