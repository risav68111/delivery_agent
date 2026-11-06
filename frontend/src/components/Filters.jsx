import { SearchIcon, XIcon } from './Icons.jsx';

const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
  { value: 'updatedAt:desc', label: 'Recently updated' },
  { value: 'updatedAt:asc', label: 'Least recently updated' },
  { value: 'fullName:asc', label: 'Name A–Z' },
  { value: 'fullName:desc', label: 'Name Z–A' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export function Filters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  serviceArea,
  onServiceAreaChange,
  serviceAreas = [],
  sortValue,
  onSortChange,
  isFiltered,
  onReset,
}) {
  return (
    <div className="filters">
      <div className="search">
        <SearchIcon size={17} className="search__icon" />
        <input
          type="search"
          className="search__input"
          value={search}
          placeholder="Search name, email, phone or area"
          aria-label="Search agents"
          onChange={(event) => onSearchChange(event.target.value)}
        />
        {search ? (
          <button
            type="button"
            className="search__clear"
            onClick={() => onSearchChange('')}
            aria-label="Clear search"
          >
            <XIcon size={14} />
          </button>
        ) : null}
      </div>

      <div className="segmented" role="group" aria-label="Filter by status">
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option.value || 'all'}
            type="button"
            className={`segmented__item${status === option.value ? ' segmented__item--active' : ''}`}
            onClick={() => onStatusChange(option.value)}
            aria-pressed={status === option.value}
          >
            {option.label}
          </button>
        ))}
      </div>

      <label className="select">
        <span className="sr-only">Filter by service area</span>
        <select value={serviceArea} onChange={(event) => onServiceAreaChange(event.target.value)}>
          <option value="">All service areas</option>
          {serviceAreas.map((area) => (
            <option key={area} value={area}>
              {area}
            </option>
          ))}
        </select>
      </label>

      <label className="select">
        <span className="sr-only">Sort agents</span>
        <select value={sortValue} onChange={(event) => onSortChange(event.target.value)}>
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {isFiltered ? (
        <button type="button" className="btn btn--ghost btn--sm" onClick={onReset}>
          Reset filters
        </button>
      ) : null}
    </div>
  );
}
