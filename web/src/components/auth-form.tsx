'use client';

import { useId, useState, type FormEvent } from 'react';
import { ApiError } from '@/lib/api';
import { useSession } from './session-provider';
import { Alert, ErrorAlert } from './ui';
import { useSlowHint } from './use-slow-hint';

type Mode = 'sign-in' | 'register';

const EMPTY = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  phoneNumber: '',
};

export function AuthForm({ notice }: { notice: string | null }) {
  const { signIn, register } = useSession();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [values, setValues] = useState(EMPTY);
  const [error, setError] = useState<ApiError | null>(null);
  const [pending, setPending] = useState(false);
  const slow = useSlowHint(pending);
  const id = useId();

  const set = (field: keyof typeof EMPTY) => (value: string) =>
    setValues((v) => ({ ...v, [field]: value }));

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      if (mode === 'sign-in') {
        await signIn(values.email, values.password);
      } else {
        await register(values);
      }
      // The page redirects once the session is signed in.
    } catch (err) {
      setError(
        err instanceof ApiError ? err : new ApiError(0, ['Something went wrong']),
      );
      setPending(false);
    }
  }

  const isRegister = mode === 'register';

  return (
    <div className="card">
      <h1>{isRegister ? 'Create your wallet' : 'Welcome back'}</h1>
      <p className="muted" style={{ margin: '6px 0 0' }}>
        {isRegister
          ? 'Your NGN wallet is created as soon as you sign up.'
          : 'Sign in to send money and see your statement.'}
      </p>

      <div className="segmented" role="tablist" aria-label="Account">
        <button
          type="button"
          role="tab"
          aria-selected={!isRegister}
          onClick={() => switchMode('sign-in')}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isRegister}
          onClick={() => switchMode('register')}
        >
          Create account
        </button>
      </div>

      {notice && !error && <Alert tone="info">{notice}</Alert>}

      <form onSubmit={onSubmit}>
        {isRegister && (
          <div className="field-row">
            <Field id={`${id}-first`} label="First name" autoComplete="given-name"
              value={values.firstName} onChange={set('firstName')} />
            <Field id={`${id}-last`} label="Last name" autoComplete="family-name"
              value={values.lastName} onChange={set('lastName')} />
          </div>
        )}
        <Field id={`${id}-email`} label="Email" type="email" autoComplete="email"
          placeholder="ada@example.com" value={values.email} onChange={set('email')} />
        {isRegister && (
          <Field id={`${id}-phone`} label="Phone number" type="tel"
            autoComplete="tel" placeholder="0803 123 4567"
            value={values.phoneNumber} onChange={set('phoneNumber')}
            hint="Nigerian mobile number" />
        )}
        <Field id={`${id}-password`} label="Password" type="password"
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          value={values.password} onChange={set('password')}
          hint={isRegister ? 'At least 8 characters, with a letter and a digit' : undefined} />

        <button type="submit" className="btn btn-primary btn-full" disabled={pending}>
          {pending
            ? isRegister ? 'Creating your wallet…' : 'Signing in…'
            : isRegister ? 'Create account' : 'Sign in'}
        </button>
      </form>

      {slow && (
        <Alert tone="info">
          Waking up the server. The free host sleeps when idle and can take up
          to a minute to respond.
        </Alert>
      )}
      {error && <ErrorAlert error={error} />}
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  onChange,
  ...input
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input"
        required
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
        {...input}
      />
      {hint && (
        <div id={`${id}-hint`} className="hint">
          {hint}
        </div>
      )}
    </div>
  );
}
