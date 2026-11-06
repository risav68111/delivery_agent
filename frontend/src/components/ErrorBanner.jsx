import { AlertTriangleIcon, RefreshIcon } from './Icons.jsx';

function titleFor(error) {
  if (!error) return 'Something went wrong';
  if (error.code === 'NETWORK_ERROR') return 'Cannot reach the API';
  if (error.status === 404) return 'Agent not found';
  if (error.status === 503) return 'Service unavailable';
  return 'Something went wrong';
}

export function ErrorBanner({ error, onRetry }) {
  return (
    <div className="error-banner" role="alert">
      <span className="error-banner__icon">
        <AlertTriangleIcon size={20} />
      </span>
      <div className="error-banner__body">
        <p className="error-banner__title">{titleFor(error)}</p>
        <p className="error-banner__message">{error?.message ?? 'Please try again.'}</p>
        {error?.code === 'NETWORK_ERROR' ? (
          <p className="error-banner__hint">
            Start it with <code>npm run dev</code> from the project root, then retry.
          </p>
        ) : null}
      </div>
      {onRetry ? (
        <button type="button" className="btn btn--ghost btn--sm" onClick={onRetry}>
          <RefreshIcon size={15} />
          Retry
        </button>
      ) : null}
    </div>
  );
}
