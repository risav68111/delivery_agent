import { parseCookies } from './cookies.js';

/**
 * Resolves the session cookie into `req.admin` / `req.sessionToken` or throws a
 * 401/503 through the shared error handler.
 */
export function createRequireAuth({ authService, cookieName }) {
  return async (req, _res, next) => {
    try {
      const token = parseCookies(req.headers.cookie)[cookieName];
      const { admin } = await authService.authenticate(token);
      req.admin = admin;
      req.sessionToken = token;
      next();
    } catch (error) {
      next(error);
    }
  };
}
