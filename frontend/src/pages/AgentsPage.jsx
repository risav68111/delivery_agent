import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, createAgent, deleteAgent, updateAgent } from '../api/client.js';
import { AgentFormModal } from '../components/AgentFormModal.jsx';
import { AgentsTable } from '../components/AgentsTable.jsx';
import { CacheChip } from '../components/CacheChip.jsx';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { ErrorBanner } from '../components/ErrorBanner.jsx';
import { Filters } from '../components/Filters.jsx';
import { PlusIcon } from '../components/Icons.jsx';
import { Pagination } from '../components/Pagination.jsx';
import { StatCards } from '../components/StatCards.jsx';
import { TableSkeleton } from '../components/Skeletons.jsx';
import { useToast } from '../components/Toast.jsx';
import { useAgentsQuery } from '../hooks/useAgentsQuery.js';
import { useStats } from '../hooks/useStats.js';

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export function AgentsPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [serviceArea, setServiceArea] = useState('');
  const [sort, setSort] = useState('createdAt');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

  const [statsToken, setStatsToken] = useState(0);
  const { stats, loading: statsLoading } = useStats(statsToken);

  const [dialog, setDialog] = useState({ open: false, mode: 'create', agent: null });
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);

  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Debounce typing so the list does not refetch on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const filters = useMemo(
    () => ({ page, pageSize, search, status, serviceArea, sort, order }),
    [page, pageSize, search, status, serviceArea, sort, order],
  );

  const { status: queryStatus, items, meta, error, cache, refetch } = useAgentsQuery(filters);

  const isFiltered = Boolean(search || status || serviceArea);
  const sortValue = `${sort}:${order}`;

  const refreshStats = () => setStatsToken((token) => token + 1);

  function resetFilters() {
    setSearchInput('');
    setSearch('');
    setStatus('');
    setServiceArea('');
    setSort('createdAt');
    setOrder('desc');
    setPage(1);
  }

  function openCreate() {
    setFieldErrors({});
    setFormError(null);
    setDialog({ open: true, mode: 'create', agent: null });
  }

  function openEdit(agent) {
    setFieldErrors({});
    setFormError(null);
    setDialog({ open: true, mode: 'edit', agent });
  }

  function closeDialog() {
    if (submitting) return;
    setDialog({ open: false, mode: 'create', agent: null });
    setFieldErrors({});
    setFormError(null);
  }

  async function handleSubmit(values) {
    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    try {
      if (dialog.mode === 'edit' && dialog.agent) {
        const result = await updateAgent(dialog.agent.id, values);
        toast.push(`${result.data.fullName} updated`);
      } else {
        const result = await createAgent(values);
        toast.push(`${result.data.fullName} added to the team`);
        setPage(1);
      }
      setDialog({ open: false, mode: 'create', agent: null });
      refetch();
      refreshStats();
    } catch (submitError) {
      if (submitError instanceof ApiError) {
        setFieldErrors(submitError.fieldErrors);
        setFormError(submitError.message);
      } else {
        setFormError('Something went wrong while saving. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;

    setDeleting(true);
    try {
      await deleteAgent(pendingDelete.id);
      toast.push(`${pendingDelete.fullName} removed`, 'info');
      setPendingDelete(null);
      refetch();
      refreshStats();
      if (items.length === 1 && page > 1) setPage(page - 1);
    } catch (deleteError) {
      toast.push(deleteError.message ?? 'Could not delete this agent', 'error');
    } finally {
      setDeleting(false);
    }
  }

  const handleSort = useCallback(
    (field) => {
      setSort(field);
      setOrder((currentOrder) => (field === sort ? (currentOrder === 'asc' ? 'desc' : 'asc') : field === 'fullName' ? 'asc' : 'desc'));
      setPage(1);
    },
    [sort],
  );

  function handleSortValue(value) {
    const [nextSort, nextOrder] = value.split(':');
    setSort(nextSort);
    setOrder(nextOrder);
    setPage(1);
  }

  return (
    <div className="page">
      <header className="page__header">
        <div className="page__heading">
          <p className="eyebrow">Operations</p>
          <h1>Delivery agents</h1>
          <p className="page__subtitle">
            Manage your fleet, service areas and availability in one place.
          </p>
        </div>
        <div className="page__actions">
          <CacheChip cache={cache} />
          <button type="button" className="btn btn--primary" onClick={openCreate}>
            <PlusIcon size={16} />
            New agent
          </button>
        </div>
      </header>

      <StatCards
        stats={stats}
        loading={statsLoading}
        selectedStatus={status}
        onSelectStatus={(value) => {
          setStatus(value);
          setPage(1);
        }}
      />

      <section className={`panel${queryStatus === 'refreshing' ? ' panel--busy' : ''}`} aria-busy={queryStatus === 'refreshing'}>
        <div className="panel__header">
          <h2 className="panel__title">
            All agents
            {meta ? <span className="panel__count">{meta.total}</span> : null}
          </h2>
          {meta ? (
            <span className="panel__hint">
              Sorted by {meta.sort === 'createdAt' ? 'created' : meta.sort}, {meta.order === 'asc' ? 'ascending' : 'descending'}
            </span>
          ) : null}
        </div>

        <Filters
          search={searchInput}
          onSearchChange={setSearchInput}
          status={status}
          onStatusChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          serviceArea={serviceArea}
          onServiceAreaChange={(value) => {
            setServiceArea(value);
            setPage(1);
          }}
          serviceAreas={stats?.serviceAreas ?? []}
          sortValue={sortValue}
          onSortChange={handleSortValue}
          isFiltered={isFiltered}
          onReset={resetFilters}
        />

        {error ? <ErrorBanner error={error} onRetry={refetch} /> : null}

        {!error && queryStatus === 'loading' ? (
          <TableSkeleton rows={Math.min(pageSize, 7)} />
        ) : !error && items.length === 0 ? (
          <EmptyState filtered={isFiltered} onCreate={openCreate} onClear={resetFilters} />
        ) : !error ? (
          <>
            <AgentsTable
              agents={items}
              sort={sort}
              order={order}
              onSort={handleSort}
              onOpen={(agent) => navigate(`/agents/${agent.id}`)}
              onEdit={openEdit}
              onDelete={setPendingDelete}
            />
            <Pagination
              meta={meta}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              disabled={queryStatus === 'refreshing'}
            />
          </>
        ) : null}
      </section>

      <AgentFormModal
        open={dialog.open}
        mode={dialog.mode}
        agent={dialog.agent}
        onClose={closeDialog}
        onSubmit={handleSubmit}
        submitting={submitting}
        serverErrors={fieldErrors}
        formError={formError}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        agent={pendingDelete}
        busy={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
