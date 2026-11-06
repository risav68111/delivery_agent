import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangleIcon, CheckCircleIcon, InfoIcon, XIcon } from './Icons.jsx';

const ToastContext = createContext(null);
let sequence = 0;

function ToastIcon({ type }) {
  if (type === 'error') return <AlertTriangleIcon size={18} />;
  if (type === 'info') return <InfoIcon size={18} />;
  return <CheckCircleIcon size={18} />;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (message, type = 'success') => {
      const id = `toast-${(sequence += 1)}`;
      setToasts((current) => [...current.slice(-3), { id, message, type }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), 4500),
      );
    },
    [dismiss],
  );

  useEffect(
    () => () => {
      timers.current.forEach((timer) => clearTimeout(timer));
      timers.current.clear();
    },
    [],
  );

  const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="toasts" role="status" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast toast--${toast.type}`}>
              <span className="toast__icon">
                <ToastIcon type={toast.type} />
              </span>
              <p className="toast__message">{toast.message}</p>
              <button
                type="button"
                className="toast__close"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
              >
                <XIcon size={14} />
              </button>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
