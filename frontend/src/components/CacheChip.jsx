import { DatabaseIcon } from './Icons.jsx';

/**
 * Surfaces the API's X-Cache header so the Redis read-through behaviour is
 * visible while using the app.
 */
export function CacheChip({ cache }) {
  if (!cache) return null;

  const hit = cache === 'HIT';
  return (
    <span
      className={`chip chip--${hit ? 'hit' : 'fresh'}`}
      title={
        hit
          ? 'This response was served from Redis without querying PostgreSQL'
          : 'This response was read from PostgreSQL and written to Redis'
      }
    >
      <DatabaseIcon size={14} />
      {hit ? 'Redis cache hit' : 'Read from database'}
    </span>
  );
}
