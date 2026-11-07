export default function SkeletonCards({ count = 4 }: { count?: number }) {
  const stages = [
    "Reading your location",
    "Searching provider records",
    "Preparing nearby results",
  ];

  return (
    <div
      className="search-skeleton"
      role="status"
      aria-live="polite"
      aria-label="Searching nearby providers"
    >
      <div className="search-skeleton-status">
        <span />
        <div>
          <strong>Searching nearby providers</strong>
          <p>Looking up official provider records and office locations.</p>
        </div>
      </div>
      <ol className="search-skeleton-stages" aria-hidden="true">
        {stages.map((stage) => (
          <li key={stage}>
            <span />
            {stage}
          </li>
        ))}
      </ol>
      <div className="search-skeleton-map">
        <span />
        <span />
      </div>
      {Array.from({ length: count }).map((_, i) => (
        <div className="card doctor-card search-skeleton-card" key={i}>
          <div className="search-skeleton-row">
            <div className="skeleton search-skeleton-avatar" />
            <div className="search-skeleton-lines">
              <div className="skeleton search-skeleton-title" />
              <div className="skeleton search-skeleton-line" />
              <div className="skeleton search-skeleton-chip" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
