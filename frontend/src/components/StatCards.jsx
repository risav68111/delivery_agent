import { ActivityIcon, ClockIcon, MapPinIcon, UsersIcon } from './Icons.jsx';
import { StatCardsSkeleton } from './Skeletons.jsx';

export function StatCards({ stats, loading, selectedStatus = '', onSelectStatus }) {
  if (loading && !stats) return <StatCardsSkeleton />;

  const cards = [
    {
      key: 'total',
      label: 'Total agents',
      value: stats?.total ?? 0,
      icon: UsersIcon,
      tone: 'ink',
      filter: '',
    },
    {
      key: 'active',
      label: 'Active now',
      value: stats?.active ?? 0,
      icon: ActivityIcon,
      tone: 'green',
      filter: 'active',
    },
    {
      key: 'inactive',
      label: 'Inactive',
      value: stats?.inactive ?? 0,
      icon: ClockIcon,
      tone: 'neutral',
      filter: 'inactive',
    },
    {
      key: 'areas',
      label: 'Service areas',
      value: stats?.serviceAreas?.length ?? 0,
      icon: MapPinIcon,
      tone: 'blue',
      filter: null,
    },
  ];

  return (
    <section className="stats" aria-label="Agent overview">
      {cards.map((card) => {
        const Icon = card.icon;
        const selected =
          card.filter !== null && card.filter !== '' && selectedStatus === card.filter;
        const className = `stat stat--${card.tone}${selected ? ' stat--selected' : ''}${
          card.filter !== null ? ' stat--interactive' : ''
        }`;

        const content = (
          <>
            <span className="stat__icon">
              <Icon size={18} />
            </span>
            <span className="stat__text">
              <span className="stat__value">{card.value}</span>
              <span className="stat__label">{card.label}</span>
            </span>
          </>
        );

        if (card.filter === null) {
          return (
            <div key={card.key} className={className}>
              {content}
            </div>
          );
        }

        return (
          <button
            key={card.key}
            type="button"
            className={className}
            onClick={() => onSelectStatus(card.filter)}
            aria-pressed={selected}
            title={`Show ${card.label.toLowerCase()}`}
          >
            {content}
          </button>
        );
      })}
    </section>
  );
}
