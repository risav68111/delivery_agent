const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

function formatContext(context) {
  if (!context || Object.keys(context).length === 0) return '';
  try {
    return ` ${JSON.stringify(context)}`;
  } catch {
    return '';
  }
}

/**
 * Minimal structured logger. Pretty output for local development, one JSON
 * object per line for production log collectors.
 */
export function createLogger({ level = 'info', pretty = true } = {}) {
  const threshold = LEVELS[level] ?? LEVELS.info;

  const write = (lvl, message, context) => {
    if ((LEVELS[lvl] ?? 0) < threshold) return;
    const timestamp = new Date().toISOString();
    const sink = lvl === 'debug' ? console.log : console[lvl];
    if (pretty) {
      sink(`${timestamp} ${lvl.toUpperCase().padEnd(5)} ${message}${formatContext(context)}`);
      return;
    }
    sink(JSON.stringify({ timestamp, level: lvl, message, ...(context ?? {}) }));
  };

  return {
    debug: (message, context) => write('debug', message, context),
    info: (message, context) => write('info', message, context),
    warn: (message, context) => write('warn', message, context),
    error: (message, context) => write('error', message, context),
  };
}
