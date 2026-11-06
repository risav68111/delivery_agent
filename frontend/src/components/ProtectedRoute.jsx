import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { BoxIcon } from './Icons.jsx';

export function AuthSplash() {
  return (
    <div className="splash" role="status" aria-live="polite">
      <span className="brand__mark">
        <BoxIcon size={20} />
      </span>
      <span className="splash__text">Checking your session…</span>
    </div>
  );
}

export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <AuthSplash />;
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}
