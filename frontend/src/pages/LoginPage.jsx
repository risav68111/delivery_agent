import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { AlertTriangleIcon } from '../components/Icons.jsx';
import { AuthSplash } from '../components/ProtectedRoute.jsx';
import { useToast } from '../components/Toast.jsx';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

export function LoginPage() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'loading') return <AuthSplash />;
  if (status === 'authenticated') {
    const destination = location.state?.from?.pathname ?? '/agents';
    return <Navigate to={destination} replace />;
  }

  const change = (field) => (event) => {
    const { value } = event.target;
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors = {};
    const email = values.email.trim();
    if (!email) nextErrors.email = 'Email address is required';
    else if (!EMAIL_PATTERN.test(email)) nextErrors.email = 'Enter a valid email address';
    if (!values.password) nextErrors.password = 'Password is required';

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const admin = await login({ email, password: values.password });
      toast.push(`Signed in as ${admin.fullName}`);
      navigate(location.state?.from?.pathname ?? '/agents', { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        setFormError(error.message);
      } else {
        setFormError('Unable to sign in right now. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login">
      <div className="login__card">
        <h1 className="login__title">Sign in to your workspace</h1>
        <p className="login__subtitle">Admin access is required to manage delivery agents.</p>

        {formError ? (
          <div className="login__error" role="alert">
            <AlertTriangleIcon size={17} />
            <span>{formError}</span>
          </div>
        ) : null}

        <form className="login__form" onSubmit={handleSubmit} noValidate>
          <div className={`field${errors.email ? ' field--invalid' : ''}`}>
            <label htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              name="email"
              type="email"
              value={values.email}
              onChange={change('email')}
              placeholder="you@company.com"
              autoComplete="username"
              autoFocus
              disabled={submitting}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'login-email-error' : undefined}
            />
            {errors.email ? (
              <p className="field__error" id="login-email-error">
                {errors.email}
              </p>
            ) : null}
          </div>

          <div className={`field${errors.password ? ' field--invalid' : ''}`}>
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              name="password"
              type="password"
              value={values.password}
              onChange={change('password')}
              placeholder="Enter your password"
              autoComplete="current-password"
              disabled={submitting}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'login-password-error' : undefined}
            />
            {errors.password ? (
              <p className="field__error" id="login-password-error">
                {errors.password}
              </p>
            ) : null}
          </div>

          <button type="submit" className="btn btn--primary login__submit" disabled={submitting}>
            {submitting ? (
              <>
                <span className="spinner" aria-hidden="true" />
                Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        {import.meta.env.DEV ? (
          <div className="login__demo">
            <p className="login__demo-title">Demo account</p>
            <p>
              <code>admin@dispatch.local</code> · <code>Admin@12345</code>
            </p>
          </div>
        ) : null}
      </div>

      <p className="login__footer">
        Sessions are stored in Redis, sent as HttpOnly cookies and expire after a period of
        inactivity.
      </p>
    </div>
  );
}
