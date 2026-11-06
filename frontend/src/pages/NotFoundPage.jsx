import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="page page--centered">
      <p className="eyebrow">404</p>
      <h1>Page not found</h1>
      <p className="page__subtitle">The page you are looking for does not exist.</p>
      <Link className="btn btn--primary" to="/agents">
        Go to agents
      </Link>
    </div>
  );
}
