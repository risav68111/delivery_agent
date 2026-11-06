import express from 'express';
import { parseCookies } from './cookies.js';
import { parseLoginPayload } from './validation.js';

export function createAuthRouter({ authService, requireAuth, config }) {
  const router = express.Router();
  const { cookieName, ttlSeconds, secure } = config.session;

  const baseCookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
  };

  // POST /api/v1/auth/login
  router.post('/login', async (req, res) => {
    const { email, password } = parseLoginPayload(req.body);
    const { token, admin } = await authService.login({ email, password, ip: req.ip });

    res.cookie(cookieName, token, { ...baseCookieOptions, maxAge: ttlSeconds * 1000 });
    res.set('Cache-Control', 'no-store');
    res.json({ data: admin });
  });

  // POST /api/v1/auth/logout — idempotent, always clears the cookie
  router.post('/logout', async (req, res) => {
    const token = parseCookies(req.headers.cookie)[cookieName];
    await authService.logout(token);
    res.clearCookie(cookieName, baseCookieOptions);
    res.set('Cache-Control', 'no-store');
    res.status(204).end();
  });

  // GET /api/v1/auth/me
  router.get('/me', requireAuth, (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ data: req.admin });
  });

  return router;
}
