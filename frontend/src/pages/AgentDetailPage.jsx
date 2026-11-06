import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError, deleteAgent, updateAgent } from '../api/client.js';
import { AgentFormModal } from '../components/AgentFormModal.jsx';
import { CacheChip } from '../components/CacheChip.jsx';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { ErrorBanner } from '../components/ErrorBanner.jsx';
import {
  ActivityIcon,
  ArrowLeftIcon,
  ClockIcon,
  CopyIcon,
  MailIcon,
  MapPinIcon,
  PencilIcon,
  PhoneIcon,
  RefreshIcon,
  TrashIcon,
} from '../components/Icons.jsx';
import { DetailSkeleton } from '../components/Skeletons.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useToast } from '../components/Toast.jsx';
import { useAgent } from '../hooks/useAgent.js';
import { avatarTone, formatDateTime, initials } from '../utils/format.js';

function DetailItem({ icon: Icon, label, children }) {
  return (
    <div className="detail-item">
      <span className="detail-item__icon">
        <Icon size={17} />
      </span>
      <div className="detail-item__body">
        <dt className="detail-item__label">{label}</dt>
        <dd className="detail-item__value">{children}</dd>
      </div>
    </div>
  );
}

function CopyButton({ value, onCopied }) {
  return (
    <button
      type="button"
      className="copy-button"
      aria-label="Copy agent ID"
      title="Copy agent ID"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          onCopied?.('Agent ID copied');
        } catch {
          onCopied?.('Could not copy the agent ID');
        }
      }}
    >
      <CopyIcon size={14} />
    </button>
  );
}

export function AgentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { status, agent, error, cache, refetch } = useAgent(id);

  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);

  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave(values) {
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    try {
      await updateAgent(agent.id, values);
      toast.push('Agent updated');
      setEditing(false);
      refetch();
    } catch (saveError) {
      if (saveError instanceof ApiError) {
        setFieldErrors(saveError.fieldErrors);
        setFormError(saveError.message);
      } else {
        setFormError('Something went wrong while saving. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteAgent(agent.id);
      toast.push(`${agent.fullName} removed`, 'info');
      navigate('/agents');
    } catch (deleteError) {
      toast.push(deleteError.message ?? 'Could not delete this agent', 'error');
      setDeleting(false);
    }
  }

  return (
    <div className="page">
      <Link to="/agents" className="back-link">
        <ArrowLeftIcon size={16} />
        Back to agents
      </Link>

      {status === 'loading' ? <DetailSkeleton /> : null}

      {status === 'not-found' ? (
        <section className="panel panel--centered">
          <h1 className="empty__title">Agent not found</h1>
          <p className="empty__text">
            This agent may have been deleted, or the link is incorrect.
          </p>
          <Link className="btn btn--primary" to="/agents">
            Back to all agents
          </Link>
        </section>
      ) : null}

      {status === 'error' ? <ErrorBanner error={error} onRetry={refetch} /> : null}

      {status === 'success' && agent ? (
        <>
          <section className="profile">
            <div className="profile__main">
              <span className="avatar avatar--lg" style={avatarTone(agent.fullName)} aria-hidden="true">
                {initials(agent.fullName)}
              </span>
              <div className="profile__text">
                <div className="profile__title-row">
                  <h1>{agent.fullName}</h1>
                  <StatusBadge status={agent.status} />
                </div>
                <p className="profile__area">
                  <MapPinIcon size={15} />
                  {agent.serviceArea}
                </p>
                <p className="profile__id">
                  <span className="profile__id-label">Agent ID</span>
                  <code>{agent.id}</code>
                  <CopyButton value={agent.id} onCopied={(message) => toast.push(message, 'info')} />
                </p>
              </div>
            </div>

            <div className="profile__actions">
              <CacheChip cache={cache} />
              <button type="button" className="btn btn--ghost" onClick={() => setEditing(true)}>
                <PencilIcon size={16} />
                Edit
              </button>
              <button type="button" className="btn btn--danger-ghost" onClick={() => setConfirming(true)}>
                <TrashIcon size={16} />
                Delete
              </button>
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2 className="panel__title">Contact and assignment details</h2>
            </div>
            <dl className="detail-grid">
              <DetailItem icon={MailIcon} label="Email address">
                <a href={`mailto:${agent.email}`}>{agent.email}</a>
              </DetailItem>
              <DetailItem icon={PhoneIcon} label="Phone number">
                <a href={`tel:${agent.phone.replace(/[^\d+]/g, '')}`}>{agent.phone}</a>
              </DetailItem>
              <DetailItem icon={MapPinIcon} label="Service area">
                {agent.serviceArea}
              </DetailItem>
              <DetailItem icon={ActivityIcon} label="Status">
                <StatusBadge status={agent.status} />
              </DetailItem>
              <DetailItem icon={ClockIcon} label="Created">
                {formatDateTime(agent.createdAt)}
              </DetailItem>
              <DetailItem icon={RefreshIcon} label="Last updated">
                {formatDateTime(agent.updatedAt)}
              </DetailItem>
            </dl>
          </section>

          <AgentFormModal
            open={editing}
            mode="edit"
            agent={agent}
            onClose={() => {
              if (submitting) return;
              setEditing(false);
              setFieldErrors({});
              setFormError(null);
            }}
            onSubmit={handleSave}
            submitting={submitting}
            serverErrors={fieldErrors}
            formError={formError}
          />

          <ConfirmDialog
            open={confirming}
            agent={agent}
            busy={deleting}
            onCancel={() => setConfirming(false)}
            onConfirm={handleDelete}
          />
        </>
      ) : null}
    </div>
  );
}
