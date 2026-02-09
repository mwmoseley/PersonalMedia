import { useMemo } from 'react';
import { YouTubeSource } from './services/YouTubeSource';
import { useYouTubeAuth } from './hooks/useYouTubeAuth';
import { useRecentMedia } from './hooks/useMediaSource';
import { RecentVideos } from './components/RecentVideos';

export default function App() {
  const { token, isAuthenticated, isLoading: authLoading, login, logout } =
    useYouTubeAuth();

  const youtubeSource = useMemo(() => {
    const source = new YouTubeSource();
    source.setAccessToken(token);
    return source;
  }, [token]);

  const {
    items: recentVideos,
    isLoading: videosLoading,
    error: videosError,
    hasMore,
    loadMore,
  } = useRecentMedia(isAuthenticated ? youtubeSource : null);

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <h1 style={styles.title}>PersonalMedia</h1>
        <div>
          {authLoading ? null : isAuthenticated ? (
            <button onClick={logout} style={styles.button}>
              Sign out
            </button>
          ) : (
            <button onClick={login} style={styles.buttonPrimary}>
              Sign in with YouTube
            </button>
          )}
        </div>
      </header>

      <main style={styles.main}>
        {!isAuthenticated && !authLoading && (
          <div style={styles.hero}>
            <p style={styles.heroText}>
              Sign in with YouTube to see your recent subscription videos.
            </p>
          </div>
        )}

        {isAuthenticated && (
          <section>
            <h2 style={styles.sectionTitle}>Recent Videos</h2>
            <RecentVideos
              items={recentVideos}
              isLoading={videosLoading}
              error={videosError}
              hasMore={hasMore}
              onLoadMore={loadMore}
            />
          </section>
        )}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    minHeight: '100vh',
    backgroundColor: '#0f0f23',
    color: '#e0e0e0',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    borderBottom: '1px solid #1a1a2e',
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 600,
  },
  button: {
    padding: '8px 16px',
    background: 'none',
    border: '1px solid #444',
    borderRadius: '4px',
    color: '#e0e0e0',
    cursor: 'pointer',
    fontSize: '14px',
  },
  buttonPrimary: {
    padding: '8px 16px',
    backgroundColor: '#ff0000',
    border: 'none',
    borderRadius: '4px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
  },
  main: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '24px',
  },
  hero: {
    textAlign: 'center' as const,
    padding: '64px 24px',
  },
  heroText: {
    fontSize: '18px',
    color: '#888',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 600,
    marginBottom: '16px',
  },
};
