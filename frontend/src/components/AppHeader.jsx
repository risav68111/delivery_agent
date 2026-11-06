import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { avatarTone, initials } from '../utils/format.js';
import { BoxIcon, LogOutIcon } from './Icons.jsx';

export function AppHeader() {
  const { status, admin, logout } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  const isAuthenticated = status === 'authenticated' && admin;

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      /* the auth provider still clears local state */
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <header className="header">
      <div className="header__inner">
        <Link to="/agents" className="brand" aria-label="Dispatch home">
          <span className="brand__mark">
            <BoxIcon size={20} />
          </span>
          <span className="brand__text">
            <span className="brand__name">Dispatch</span>
            <span className="brand__tagline">Delivery agent management</span>
          </span>
        </Link>

        {isAuthenticated ? (
          <div className="header__right">
            <nav className="header__nav" aria-label="Primary">
              <NavLink
                to="/agents"
                className={({ isActive }) =>
                  `header__link${isActive ? ' header__link--active' : ''}`
                }
              >
                Agents
              </NavLink>
              <a
                className="header__link header__link--health"
                href="/api/v1/health"
                target="_blank"
                rel="noreferrer"
              >
                API health
              </a>
            </nav>

            <div className="account">
              <span
                className="avatar avatar--sm"
                style={avatarTone(admin.fullName)}
                aria-hidden="true"
              >
                {initials(admin.fullName)}
              </span>
              <span className="account__text">
                <span className="account__name">{admin.fullName}</span>
                <span className="account__email">{admin.email}</span>
              </span>
              <button
                type="button"
                className="icon-button"
                onClick={handleSignOut}
                disabled={signingOut}
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOutIcon size={17} />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
