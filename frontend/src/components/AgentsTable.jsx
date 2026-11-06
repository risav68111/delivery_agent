import { Link } from 'react-router-dom';
import { EyeIcon, PencilIcon, TrashIcon } from './Icons.jsx';
import { StatusBadge } from './StatusBadge.jsx';
import { avatarTone, formatDateTime, initials, timeAgo } from '../utils/format.js';

function SortHeader({ label, field, sort, order, onSort }) {
  const active = sort === field;
  const arrow = active ? (order === 'asc' ? '↑' : '↓') : '↕';

  return (
    <button
      type="button"
      className={`th-sort${active ? ' th-sort--active' : ''}`}
      onClick={() => onSort(field)}
      aria-label={`Sort by ${label}${active ? ` (currently ${order === 'asc' ? 'ascending' : 'descending'})` : ''}`}
    >
      {label}
      <span className={`th-sort__arrow${active ? ' th-sort__arrow--active' : ''}`} aria-hidden="true">
        {arrow}
      </span>
    </button>
  );
}

function AgentIdentity({ agent }) {
  return (
    <div className="agent-cell">
      <span className="avatar" style={avatarTone(agent.fullName)} aria-hidden="true">
        {initials(agent.fullName)}
      </span>
      <span className="agent-cell__text">
        <span className="agent-cell__name">{agent.fullName}</span>
        <span className="agent-cell__email">{agent.email}</span>
      </span>
    </div>
  );
}

function RowActions({ agent, onEdit, onDelete }) {
  return (
    <div className="row-actions" onClick={(event) => event.stopPropagation()}>
      <Link
        to={`/agents/${agent.id}`}
        className="icon-button"
        aria-label={`View ${agent.fullName}`}
        title="View details"
      >
        <EyeIcon size={17} />
      </Link>
      <button
        type="button"
        className="icon-button"
        onClick={() => onEdit(agent)}
        aria-label={`Edit ${agent.fullName}`}
        title="Edit agent"
      >
        <PencilIcon size={17} />
      </button>
      <button
        type="button"
        className="icon-button icon-button--danger"
        onClick={() => onDelete(agent)}
        aria-label={`Delete ${agent.fullName}`}
        title="Delete agent"
      >
        <TrashIcon size={17} />
      </button>
    </div>
  );
}

export function AgentsTable({ agents, sort, order, onSort, onOpen, onEdit, onDelete }) {
  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">
                <SortHeader label="Agent" field="fullName" sort={sort} order={order} onSort={onSort} />
              </th>
              <th scope="col" className="table__col-phone">
                Phone
              </th>
              <th scope="col">Service area</th>
              <th scope="col">Status</th>
              <th scope="col">
                <SortHeader label="Updated" field="updatedAt" sort={sort} order={order} onSort={onSort} />
              </th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr key={agent.id} className="table__row" onClick={() => onOpen(agent)}>
                <td>
                  <AgentIdentity agent={agent} />
                </td>
                <td className="table__phone table__col-phone">{agent.phone}</td>
                <td className="table__area">{agent.serviceArea}</td>
                <td>
                  <StatusBadge status={agent.status} />
                </td>
                <td className="table__updated">
                  <span title={formatDateTime(agent.updatedAt)}>{timeAgo(agent.updatedAt)}</span>
                </td>
                <td className="table__actions">
                  <RowActions agent={agent} onEdit={onEdit} onDelete={onDelete} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="agent-cards">
        {agents.map((agent) => (
          <article key={agent.id} className="agent-card">
            <div className="agent-card__top">
              <AgentIdentity agent={agent} />
              <StatusBadge status={agent.status} />
            </div>
            <dl className="agent-card__meta">
              <div>
                <dt>Phone</dt>
                <dd>{agent.phone}</dd>
              </div>
              <div>
                <dt>Service area</dt>
                <dd>{agent.serviceArea}</dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{timeAgo(agent.updatedAt)}</dd>
              </div>
            </dl>
            <div className="agent-card__actions">
              <Link className="btn btn--ghost btn--sm" to={`/agents/${agent.id}`}>
                View details
              </Link>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => onEdit(agent)}>
                Edit
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm btn--danger-text"
                onClick={() => onDelete(agent)}
              >
                Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
