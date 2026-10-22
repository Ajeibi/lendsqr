'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSignedIn } from './session-provider';
import { Logo } from './ui';

export function TopBar() {
  const { profile, signOut } = useSignedIn();
  const pathname = usePathname();
  const { user } = profile;
  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase();

  const links = [{ href: '/wallet/', label: 'Wallet' }];

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Logo />
        <nav className="nav" aria-label="Main">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? 'page' : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="who">
          <span className="avatar" aria-hidden="true">
            {initials}
          </span>
          <span className="who-name">
            {user.firstName} {user.lastName}
          </span>
          {user.role === 'ADMIN' && <span className="badge badge-info">Admin</span>}
          <button type="button" className="btn btn-sm" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
