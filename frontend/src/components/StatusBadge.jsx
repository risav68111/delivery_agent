export function StatusBadge({ status }) {
  const isActive = status === 'active';
  return (
    <span className={`status status--${isActive ? 'active' : 'inactive'}`}>
      <span className="status__dot" aria-hidden="true" />
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}
