export function StatCardsSkeleton() {
  return (
    <div className="stats" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="stat stat--skeleton">
          <span className="skeleton skeleton--icon" />
          <span className="skeleton skeleton--value" />
          <span className="skeleton skeleton--label" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6 }) {
  return (
    <div className="skeleton-rows" aria-label="Loading agents" role="status">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="skeleton-row">
          <span className="skeleton skeleton--avatar" />
          <span className="skeleton skeleton--name" />
          <span className="skeleton skeleton--meta" />
          <span className="skeleton skeleton--pill" />
          <span className="skeleton skeleton--meta" />
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="detail-skeleton" aria-label="Loading agent" role="status">
      <div className="skeleton skeleton--hero" />
      <div className="detail-skeleton__grid">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="skeleton skeleton--field" />
        ))}
      </div>
    </div>
  );
}
