import { useEffect, useState } from 'react';
import { Modal } from './Modal.jsx';
import { normalizeAgent, validateAgent } from '../utils/validation.js';
import { AlertTriangleIcon } from './Icons.jsx';

const EMPTY_VALUES = {
  fullName: '',
  email: '',
  phone: '',
  serviceArea: '',
  status: 'active',
};

function FieldError({ message, id }) {
  if (!message) return null;
  return (
    <p className="field__error" id={id}>
      {message}
    </p>
  );
}

export function AgentFormModal({
  open,
  mode = 'create',
  agent = null,
  onClose,
  onSubmit,
  submitting = false,
  serverErrors = {},
  formError = null,
}) {
  const [values, setValues] = useState(EMPTY_VALUES);
  const [clientErrors, setClientErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setClientErrors({});
    setValues(
      agent
        ? {
            fullName: agent.fullName,
            email: agent.email,
            phone: agent.phone,
            serviceArea: agent.serviceArea,
            status: agent.status,
          }
        : EMPTY_VALUES,
    );
  }, [open, agent]);

  const errors = { ...clientErrors, ...serverErrors };
  const isEdit = mode === 'edit';

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setClientErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors = validateAgent(values);
    if (Object.keys(nextErrors).length > 0) {
      setClientErrors(nextErrors);
      return;
    }
    onSubmit(normalizeAgent(values));
  }

  return (
    <Modal
      open={open}
      title={isEdit ? 'Edit delivery agent' : 'New delivery agent'}
      description={
        isEdit
          ? 'Update the agent’s contact details, service area or availability.'
          : 'Add an agent to your delivery team. Required fields are marked with an asterisk.'
      }
      onClose={submitting ? () => {} : onClose}
      size="md"
    >
      <form className="form" onSubmit={handleSubmit} noValidate>
        {formError ? (
          <div className="form__banner" role="alert">
            <AlertTriangleIcon size={17} />
            <span>{formError}</span>
          </div>
        ) : null}

        <div className="form__grid">
          <div className={`field field--full${errors.fullName ? ' field--invalid' : ''}`}>
            <label htmlFor="agent-fullName">
              Full name <span className="field__required">*</span>
            </label>
            <input
              id="agent-fullName"
              name="fullName"
              type="text"
              value={values.fullName}
              onChange={handleChange}
              placeholder="e.g. Aarav Sharma"
              autoComplete="name"
              data-autofocus
              aria-invalid={Boolean(errors.fullName)}
              aria-describedby={errors.fullName ? 'error-fullName' : undefined}
              disabled={submitting}
              required
            />
            <FieldError id="error-fullName" message={errors.fullName} />
          </div>

          <div className={`field field--full${errors.email ? ' field--invalid' : ''}`}>
            <label htmlFor="agent-email">
              Email address <span className="field__required">*</span>
            </label>
            <input
              id="agent-email"
              name="email"
              type="email"
              value={values.email}
              onChange={handleChange}
              placeholder="agent@example.com"
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'error-email' : undefined}
              disabled={submitting}
              required
            />
            <FieldError id="error-email" message={errors.email} />
          </div>

          <div className={`field${errors.phone ? ' field--invalid' : ''}`}>
            <label htmlFor="agent-phone">
              Phone number <span className="field__required">*</span>
            </label>
            <input
              id="agent-phone"
              name="phone"
              type="tel"
              value={values.phone}
              onChange={handleChange}
              placeholder="+91 98765 43210"
              autoComplete="tel"
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? 'error-phone' : 'hint-phone'}
              disabled={submitting}
              required
            />
            {errors.phone ? (
              <FieldError id="error-phone" message={errors.phone} />
            ) : (
              <p className="field__hint" id="hint-phone">
                Include the country code where possible.
              </p>
            )}
          </div>

          <div className={`field${errors.serviceArea ? ' field--invalid' : ''}`}>
            <label htmlFor="agent-serviceArea">
              Service area <span className="field__required">*</span>
            </label>
            <input
              id="agent-serviceArea"
              name="serviceArea"
              type="text"
              value={values.serviceArea}
              onChange={handleChange}
              placeholder="e.g. Andheri East, Mumbai"
              aria-invalid={Boolean(errors.serviceArea)}
              aria-describedby={errors.serviceArea ? 'error-serviceArea' : 'hint-serviceArea'}
              disabled={submitting}
              required
            />
            {errors.serviceArea ? (
              <FieldError id="error-serviceArea" message={errors.serviceArea} />
            ) : (
              <p className="field__hint" id="hint-serviceArea">
                City or zone the agent delivers in.
              </p>
            )}
          </div>

          <fieldset className="field field--full status-picker">
            <legend>
              Status <span className="field__required">*</span>
            </legend>
            <div className="status-picker__options">
              {[
                { value: 'active', label: 'Active', hint: 'Available for deliveries' },
                { value: 'inactive', label: 'Inactive', hint: 'Not taking new deliveries' },
              ].map((option) => (
                <label
                  key={option.value}
                  className={`status-option${values.status === option.value ? ' status-option--selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="status"
                    value={option.value}
                    checked={values.status === option.value}
                    onChange={handleChange}
                    disabled={submitting}
                  />
                  <span className="status-option__dot" aria-hidden="true" />
                  <span className="status-option__text">
                    <span className="status-option__label">{option.label}</span>
                    <span className="status-option__hint">{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="form__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? (
              <>
                <span className="spinner" aria-hidden="true" />
                {isEdit ? 'Saving…' : 'Creating…'}
              </>
            ) : isEdit ? (
              'Save changes'
            ) : (
              'Create agent'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
