import { Modal } from './Modal.jsx';

export function ConfirmDialog({ open, agent, busy, onCancel, onConfirm }) {
  return (
    <Modal
      open={open}
      title="Delete delivery agent"
      description="This action cannot be undone."
      onClose={busy ? () => {} : onCancel}
      size="sm"
    >
      <p className="confirm__text">
        Remove <strong>{agent?.fullName}</strong> from your delivery team? Their record, contact details and
        assignment history will be permanently deleted.
      </p>
      <div className="form__actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="btn btn--danger" onClick={onConfirm} disabled={busy}>
          {busy ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Deleting…
            </>
          ) : (
            'Delete agent'
          )}
        </button>
      </div>
    </Modal>
  );
}
