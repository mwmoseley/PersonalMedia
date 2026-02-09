import type { MediaItem } from '../types/media';

interface RecentVideosProps {
  items: MediaItem[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
}

function formatTimeAgo(isoDate: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(isoDate).getTime()) / 1000
  );

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return new Date(isoDate).toLocaleDateString();
}

export function RecentVideos({
  items,
  isLoading,
  error,
  hasMore,
  onLoadMore,
}: RecentVideosProps) {
  if (error) {
    return (
      <div style={styles.error}>
        <p>Failed to load recent videos: {error}</p>
      </div>
    );
  }

  if (!isLoading && items.length === 0) {
    return (
      <div style={styles.empty}>
        <p>No recent videos found.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={styles.grid}>
        {items.map((item) => (
          <VideoCard key={item.id} item={item} />
        ))}
      </div>
      {isLoading && <p style={styles.loading}>Loading...</p>}
      {hasMore && !isLoading && (
        <button onClick={onLoadMore} style={styles.loadMore}>
          Load more
        </button>
      )}
    </div>
  );
}

function VideoCard({ item }: { item: MediaItem }) {
  return (
    <div style={styles.card}>
      {item.thumbnail ? (
        <img
          src={item.thumbnail}
          alt={item.title}
          style={styles.thumbnail}
        />
      ) : (
        <div style={styles.placeholderThumb} />
      )}
      <div style={styles.cardBody}>
        <p style={styles.title}>{item.title}</p>
        <p style={styles.meta}>
          {item.artist}
          {item.publishedAt && (
            <span style={styles.time}>
              {' \u00b7 '}
              {formatTimeAgo(item.publishedAt)}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '16px',
  },
  card: {
    borderRadius: '8px',
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
    cursor: 'pointer',
  },
  thumbnail: {
    width: '100%',
    aspectRatio: '16 / 9',
    objectFit: 'cover',
    display: 'block',
  },
  placeholderThumb: {
    width: '100%',
    aspectRatio: '16 / 9',
    backgroundColor: '#2a2a4a',
  },
  cardBody: {
    padding: '10px 12px',
  },
  title: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 500,
    lineHeight: '1.3',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    color: '#e0e0e0',
  },
  meta: {
    margin: '4px 0 0',
    fontSize: '12px',
    color: '#888',
  },
  time: {
    color: '#666',
  },
  loading: {
    textAlign: 'center' as const,
    color: '#888',
    padding: '16px',
  },
  loadMore: {
    display: 'block',
    margin: '16px auto',
    padding: '8px 24px',
    background: 'none',
    border: '1px solid #444',
    borderRadius: '4px',
    color: '#e0e0e0',
    cursor: 'pointer',
    fontSize: '14px',
  },
  error: {
    color: '#ff6b6b',
    padding: '16px',
    textAlign: 'center' as const,
  },
  empty: {
    color: '#888',
    padding: '32px',
    textAlign: 'center' as const,
  },
};
