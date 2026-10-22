import Link from 'next/link';
import { Logo } from '@/components/ui';

export default function NotFound() {
  return (
    <main className="auth">
      <div className="auth-inner">
        <Logo />
        <div className="card">
          <h1>Page not found</h1>
          <p className="muted">That page doesn&apos;t exist in the wallet.</p>
          <Link href="/wallet/" className="btn btn-primary btn-full">
            Go to your wallet
          </Link>
        </div>
      </div>
    </main>
  );
}
