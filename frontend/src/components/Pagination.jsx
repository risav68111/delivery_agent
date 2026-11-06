import { ChevronLeftIcon, ChevronRightIcon } from './Icons.jsx';

function pageItems(page, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const candidates = new Set([1, totalPages, page, page - 1, page + 1]);
  const pages = [...candidates].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);

  const items = [];
  let previous = 0;
  for (const value of pages) {
    if (value - previous > 1) items.push(`gap-${value}`);
    items.push(value);
    previous = value;
  }
  return items;
}

export function Pagination({ meta, onPageChange, onPageSizeChange, disabled }) {
  if (!meta) return null;

  const { page, pageSize, total, totalPages } = meta;
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="pagination">
      <p className="pagination__summary">
        Showing <strong>{first}</strong>–<strong>{last}</strong> of <strong>{total}</strong> agents
      </p>

      <div className="pagination__controls">
        <label className="select select--compact">
          <span className="sr-only">Rows per page</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            disabled={disabled}
          >
            {[10, 25, 50].map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
        </label>

        <nav className="pager" aria-label="Pagination">
          <button
            type="button"
            className="pager__button"
            onClick={() => onPageChange(page - 1)}
            disabled={disabled || page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeftIcon size={16} />
          </button>

          {pageItems(page, totalPages).map((item) =>
            typeof item === 'number' ? (
              <button
                key={item}
                type="button"
                className={`pager__button${item === page ? ' pager__button--current' : ''}`}
                onClick={() => onPageChange(item)}
                disabled={disabled}
                aria-current={item === page ? 'page' : undefined}
                aria-label={`Page ${item}`}
              >
                {item}
              </button>
            ) : (
              <span key={item} className="pager__gap" aria-hidden="true">
                …
              </span>
            ),
          )}

          <button
            type="button"
            className="pager__button"
            onClick={() => onPageChange(page + 1)}
            disabled={disabled || page >= totalPages}
            aria-label="Next page"
          >
            <ChevronRightIcon size={16} />
          </button>
        </nav>
      </div>
    </div>
  );
}
