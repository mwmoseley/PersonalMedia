import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RecentVideos } from '../../src/components/RecentVideos';
import type { MediaItem } from '../../src/types/media';

const sampleVideos: MediaItem[] = [
  {
    id: 'vid-1',
    source: 'youtube',
    title: 'First Video',
    sourceId: 'vid-1',
    thumbnail: 'https://example.com/thumb1.jpg',
    artist: 'Channel A',
    publishedAt: new Date(Date.now() - 3600 * 1000).toISOString(), // 1h ago
  },
  {
    id: 'vid-2',
    source: 'youtube',
    title: 'Second Video',
    sourceId: 'vid-2',
    artist: 'Channel B',
    publishedAt: new Date(Date.now() - 2 * 86400 * 1000).toISOString(), // 2d ago
  },
];

describe('RecentVideos', () => {
  it('renders video cards with titles and channel names', () => {
    render(
      <RecentVideos
        items={sampleVideos}
        isLoading={false}
        error={null}
        hasMore={false}
        onLoadMore={() => {}}
      />
    );

    expect(screen.getByText('First Video')).toBeDefined();
    expect(screen.getByText('Second Video')).toBeDefined();
    expect(screen.getByAltText('First Video')).toBeDefined();
  });

  it('shows loading state', () => {
    render(
      <RecentVideos
        items={[]}
        isLoading={true}
        error={null}
        hasMore={false}
        onLoadMore={() => {}}
      />
    );

    expect(screen.getByText('Loading...')).toBeDefined();
  });

  it('shows error message', () => {
    render(
      <RecentVideos
        items={[]}
        isLoading={false}
        error="API rate limit exceeded"
        hasMore={false}
        onLoadMore={() => {}}
      />
    );

    expect(
      screen.getByText(/API rate limit exceeded/)
    ).toBeDefined();
  });

  it('shows empty state when no items', () => {
    render(
      <RecentVideos
        items={[]}
        isLoading={false}
        error={null}
        hasMore={false}
        onLoadMore={() => {}}
      />
    );

    expect(screen.getByText(/No recent videos found/)).toBeDefined();
  });

  it('shows load more button when hasMore is true', () => {
    const onLoadMore = vi.fn();
    render(
      <RecentVideos
        items={sampleVideos}
        isLoading={false}
        error={null}
        hasMore={true}
        onLoadMore={onLoadMore}
      />
    );

    const button = screen.getByText('Load more');
    fireEvent.click(button);
    expect(onLoadMore).toHaveBeenCalledOnce();
  });

  it('hides load more button when loading', () => {
    render(
      <RecentVideos
        items={sampleVideos}
        isLoading={true}
        error={null}
        hasMore={true}
        onLoadMore={() => {}}
      />
    );

    expect(screen.queryByText('Load more')).toBeNull();
  });

  it('renders relative timestamps', () => {
    render(
      <RecentVideos
        items={sampleVideos}
        isLoading={false}
        error={null}
        hasMore={false}
        onLoadMore={() => {}}
      />
    );

    // First video was 1h ago
    expect(screen.getByText(/1h ago/)).toBeDefined();
    // Second video was 2d ago
    expect(screen.getByText(/2d ago/)).toBeDefined();
  });
});
