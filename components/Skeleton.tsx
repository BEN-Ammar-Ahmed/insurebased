// Still placeholders while results load. Nothing moves.
export default function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="search-skeleton" role="status" aria-live="polite">
      <p className="search-skeleton-status">Searching for doctors…</p>
      {Array.from({ length: count }).map((_, i) => (
        <div className="card search-skeleton-card" key={i} aria-hidden="true">
          <div className="skeleton search-skeleton-title" />
          <div className="skeleton search-skeleton-line" />
          <div className="skeleton search-skeleton-line short" />
        </div>
      ))}
    </div>
  );
}
