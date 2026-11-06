import { InboxIcon, PlusIcon } from './Icons.jsx';

export function EmptyState({ filtered, onCreate, onClear }) {
  return (
    <div className="empty">
      <span className="empty__art" aria-hidden="true">
        <InboxIcon size={30} />
      </span>
      <h2 className="empty__title">{filtered ? 'No agents match these filters' : 'No delivery agents yet'}</h2>
      <p className="empty__text">
        {filtered
          ? 'Try a different search term, service area or status filter.'
          : 'Create your first agent to start assigning deliveries and tracking availability.'}
      </p>
      <div className="empty__actions">
        {filtered ? (
          <button type="button" className="btn btn--ghost" onClick={onClear}>
            Clear filters
          </button>
        ) : null}
        <button type="button" className="btn btn--primary" onClick={onCreate}>
          <PlusIcon size={16} />
          New agent
        </button>
      </div>
    </div>
  );
}
