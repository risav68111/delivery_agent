import { ApiError } from '../errors.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

export function parseLoginPayload(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw ApiError.badRequest('Request body must be a JSON object');
  }

  const errors = [];

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email) {
    errors.push({ field: 'email', message: 'Email address is required' });
  } else if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    errors.push({ field: 'email', message: 'Enter a valid email address' });
  }

  const password = typeof body.password === 'string' ? body.password : '';
  if (!password) {
    errors.push({ field: 'password', message: 'Password is required' });
  } else if (password.length > 200) {
    errors.push({ field: 'password', message: 'Password is too long' });
  }

  if (errors.length > 0) {
    throw ApiError.validation(errors, 'Sign-in details are invalid');
  }

  return { email, password };
}
