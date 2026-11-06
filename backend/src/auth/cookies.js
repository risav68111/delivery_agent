/**
 * Minimal Cookie header parsing. Express can set cookies without a parser, but
 * reading them only needs this small helper (no extra dependency).
 */
export function parseCookies(header = '') {
  const cookies = {};
  if (typeof header !== 'string' || !header) return cookies;

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (!name) continue;
    const raw = part.slice(separator + 1).trim();
    try {
      cookies[name] = decodeURIComponent(raw);
    } catch {
      cookies[name] = raw;
    }
  }
  return cookies;
}
