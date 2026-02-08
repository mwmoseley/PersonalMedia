import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpotifySource } from '../../src/services/SpotifySource';

function mockFetchResponse(data: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(data),
    })
  );
}

function mockFetchError(status: number, statusText: string): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status,
      statusText,
    })
  );
}

describe('SpotifySource', () => {
  let source: SpotifySource;

  beforeEach(() => {
    source = new SpotifySource();
    vi.restoreAllMocks();
  });

  describe('properties', () => {
    it('has correct source type and display name', () => {
      expect(source.sourceType).toBe('spotify');
      expect(source.displayName).toBe('Spotify');
    });

    it('is not an update source', () => {
      expect(source.isUpdateSource).toBe(false);
      expect(source.defaultUpdateIntervalMinutes).toBe(0);
    });

    it('requires auth', () => {
      expect(source.requiresAuth).toBe(true);
    });

    it('returns available media types', () => {
      expect(source.getAvailableMediaTypes()).toEqual(['track', 'playlist']);
    });
  });

  describe('authentication', () => {
    it('is not authenticated by default', () => {
      expect(source.isAuthenticated()).toBe(false);
    });

    it('is authenticated after setting a token', () => {
      source.setAccessToken('test-token');
      expect(source.isAuthenticated()).toBe(true);
    });

    it('is not authenticated after clearing the token', () => {
      source.setAccessToken('test-token');
      source.setAccessToken(null);
      expect(source.isAuthenticated()).toBe(false);
    });
  });

  describe('getAvailableMedia', () => {
    it('throws when not authenticated', async () => {
      await expect(source.getAvailableMedia()).rejects.toThrow(
        'not authenticated'
      );
    });

    it('fetches playlists and maps them correctly', async () => {
      source.setAccessToken('token-123');
      mockFetchResponse({
        items: [
          {
            id: 'pl-1',
            name: 'My Playlist',
            description: 'A great playlist',
            images: [{ url: 'https://img.spotify.com/pl1.jpg', width: 300, height: 300 }],
            tracks: { total: 42 },
          },
        ],
        next: null,
        total: 1,
      });

      const result = await source.getAvailableMedia();

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({
        id: 'pl-1',
        source: 'spotify',
        title: 'My Playlist',
        description: 'A great playlist',
        thumbnail: 'https://img.spotify.com/pl1.jpg',
        contentType: 'playlist',
        itemCount: 42,
      });
      expect(result.total).toBe(1);
      expect(result.nextCursor).toBeUndefined();
    });

    it('sets nextCursor when more pages are available', async () => {
      source.setAccessToken('token-123');
      mockFetchResponse({
        items: [],
        next: 'https://api.spotify.com/v1/me/playlists?offset=20',
        total: 50,
      });

      const result = await source.getAvailableMedia({ limit: 20 });
      expect(result.nextCursor).toBe('20');
    });

    it('passes pagination parameters to the API', async () => {
      source.setAccessToken('token-123');
      mockFetchResponse({ items: [], next: null, total: 0 });

      await source.getAvailableMedia({ limit: 10, cursor: '30' });

      const fetchCall = vi.mocked(fetch).mock.calls[0];
      expect(fetchCall[0]).toContain('limit=10');
      expect(fetchCall[0]).toContain('offset=30');
    });
  });

  describe('getCollectionItems', () => {
    it('fetches playlist tracks and maps them correctly', async () => {
      source.setAccessToken('token-123');
      mockFetchResponse({
        items: [
          {
            added_at: '2024-01-15T10:00:00Z',
            track: {
              id: 'track-1',
              uri: 'spotify:track:track-1',
              name: 'Great Song',
              duration_ms: 210000,
              artists: [{ name: 'Artist A' }, { name: 'Artist B' }],
              album: {
                images: [{ url: 'https://img.spotify.com/t1.jpg', width: 300, height: 300 }],
              },
            },
          },
        ],
        next: null,
        total: 1,
      });

      const result = await source.getCollectionItems('pl-1');

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({
        id: 'track-1',
        source: 'spotify',
        title: 'Great Song',
        sourceId: 'spotify:track:track-1',
        thumbnail: 'https://img.spotify.com/t1.jpg',
        duration: 210,
        artist: 'Artist A, Artist B',
        publishedAt: '2024-01-15T10:00:00Z',
      });
    });

    it('filters out null tracks', async () => {
      source.setAccessToken('token-123');
      mockFetchResponse({
        items: [
          { added_at: '2024-01-15T10:00:00Z', track: null },
          {
            added_at: '2024-01-16T10:00:00Z',
            track: {
              id: 'track-2',
              uri: 'spotify:track:track-2',
              name: 'Another Song',
              duration_ms: 180000,
              artists: [{ name: 'Artist C' }],
              album: { images: [] },
            },
          },
        ],
        next: null,
        total: 2,
      });

      const result = await source.getCollectionItems('pl-1');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('track-2');
    });
  });

  describe('search', () => {
    it('searches for tracks and maps results', async () => {
      source.setAccessToken('token-123');
      mockFetchResponse({
        tracks: {
          items: [
            {
              id: 'search-1',
              uri: 'spotify:track:search-1',
              name: 'Found Song',
              duration_ms: 240000,
              artists: [{ name: 'Found Artist' }],
              album: {
                images: [{ url: 'https://img.spotify.com/s1.jpg', width: 300, height: 300 }],
              },
            },
          ],
          next: null,
          total: 1,
        },
      });

      const result = await source.search('found');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe('Found Song');
    });
  });

  describe('error handling', () => {
    it('throws on API errors', async () => {
      source.setAccessToken('token-123');
      mockFetchError(401, 'Unauthorized');

      await expect(source.getAvailableMedia()).rejects.toThrow(
        'Spotify API error: 401 Unauthorized'
      );
    });
  });

  describe('checkForUpdates', () => {
    it('throws because Spotify is not an update source', async () => {
      await expect(
        source.checkForUpdates('pl-1', 'item-1')
      ).rejects.toThrow('does not support update polling');
    });
  });
});
