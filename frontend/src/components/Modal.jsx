import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { XIcon } from './Icons.jsx';

export function Modal({ open, title, description, onClose, children, size = 'md' }) {
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeRef.current();
    };

    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = setTimeout(() => {
      const target =
        panelRef.current?.querySelector('[data-autofocus]') ??
        panelRef.current?.querySelector('input, select, textarea, button');
      target?.focus();
    }, 30);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      clearTimeout(focusTimer);
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeRef.current();
      }}
    >
      <div
        ref={panelRef}
        className={`modal__panel modal__panel--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={description ? 'modal-description' : undefined}
      >
        <header className="modal__header">
          <div className="modal__heading">
            <h2 id="modal-title" className="modal__title">
              {title}
            </h2>
            {description ? (
              <p id="modal-description" className="modal__description">
                {description}
              </p>
            ) : null}
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog">
            <XIcon size={18} />
          </button>
        </header>
        <div className="modal__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
