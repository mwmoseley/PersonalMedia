import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YouTubeSource } from '../../src/services/YouTubeSource';

function mockFetchResponse(data: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(data),
    })
  );
}

function mockFetchSequence(responses: unknown[]): void {
  const mockFn = vi.fn();
  for (let i = 0; i < responses.length; i++) {
    mockFn.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(responses[i]),
    });
  }
  vi.stubGlobal('fetch', mockFn);
}

describe('YouTubeSource', () => {
  let source: YouTubeSource;

  beforeEach(() => {
    source = new YouTubeSource();
    vi.restoreAllMocks();
  });

  describe('properties', () => {
    it('has correct source type and display name', () => {
      expect(source.sourceType).toBe('youtube');
      expect(source.displayName).toBe('YouTube');
    });

    it('is an update source with 30-min default interval', () => {
      expect(source.isUpdateSource).toBe(true);
      expect(source.defaultUpdateIntervalMinutes).toBe(30);
    });

    it('requires auth', () => {
      expect(source.requiresAuth).toBe(true);
    });

    it('returns available media types', () => {
      expect(source.getAvailableMediaTypes()).toEqual(['video', 'channel']);
    });
  });

  describe('authentication', () => {
    it('is not authenticated by default', () => {
      expect(source.isAuthenticated()).toBe(false);
    });

    it('is authenticated after setting a token', () => {
      source.setAccessToken('yt-token');
      expect(source.isAuthenticated()).toBe(true);
    });
  });

  describe('getAvailableMedia', () => {
    it('throws when not authenticated', async () => {
      await expect(source.getAvailableMedia()).rejects.toThrow(
        'not authenticated'
      );
    });

    it('fetches subscriptions and maps them correctly', async () => {
      source.setAccessToken('yt-token');
      mockFetchResponse({
        items: [
          {
            snippet: {
              title: 'Tech Channel',
              description: 'All about tech',
              thumbnails: {
                medium: { url: 'https://yt.com/thumb-med.jpg' },
              },
              resourceId: { channelId: 'UC123' },
            },
          },
        ],
        pageInfo: { totalResults: 1 },
      });

      const result = await source.getAvailableMedia();

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({
        id: 'UC123',
        source: 'youtube',
        title: 'Tech Channel',
        description: 'All about tech',
        thumbnail: 'https://yt.com/thumb-med.jpg',
        contentType: 'channel',
      });
      expect(result.total).toBe(1);
    });

    it('passes page tokens for pagination', async () => {
      source.setAccessToken('yt-token');
      mockFetchResponse({
        items: [],
        nextPageToken: 'page2token',
        pageInfo: { totalResults: 50 },
      });

      const result = await source.getAvailableMedia({ limit: 20 });
      expect(result.nextCursor).toBe('page2token');
    });
  });

  describe('getCollectionItems', () => {
    it('resolves channel to uploads playlist and fetches items', async () => {
      source.setAccessToken('yt-token');

      // First call: resolve channel -> uploads playlist
      // Second call: fetch playlist items
      mockFetchSequence([
        {
          items: [
            {
              contentDetails: {
                relatedPlaylists: { uploads: 'UU123' },
              },
            },
          ],
        },
        {
          items: [
            {
              id: 'pli-1',
              snippet: {
                title: 'Cool Video',
                description: 'A cool video',
                thumbnails: {
                  medium: { url: 'https://yt.com/vid-thumb.jpg' },
                },
                channelTitle: 'Tech Channel',
                publishedAt: '2024-06-01T12:00:00Z',
                resourceId: { videoId: 'vid-1' },
              },
              contentDetails: {
                videoId: 'vid-1',
                videoPublishedAt: '2024-06-01T12:00:00Z',
              },
            },
          ],
          pageInfo: { totalResults: 1 },
        },
      ]);

      const result = await source.getCollectionItems('UC123');

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({
        id: 'vid-1',
        source: 'youtube',
        title: 'Cool Video',
        sourceId: 'vid-1',
        thumbnail: 'https://yt.com/vid-thumb.jpg',
        artist: 'Tech Channel',
        publishedAt: '2024-06-01T12:00:00Z',
      });
    });

    it('caches the uploads playlist ID', async () => {
      source.setAccessToken('yt-token');

      const playlistItemsResponse = {
        items: [],
        pageInfo: { totalResults: 0 },
      };

      mockFetchSequence([
        {
          items: [
            {
              contentDetails: {
                relatedPlaylists: { uploads: 'UU456' },
              },
            },
          ],
        },
        playlistItemsResponse,
        playlistItemsResponse,
      ]);

      // First call: resolves channel + fetches items (2 API calls)
      await source.getCollectionItems('UC456');
      // Second call: should use cached playlist ID (1 API call)
      await source.getCollectionItems('UC456');

      // 3 total fetch calls: channel resolve + 2 playlist fetches
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3);
    });

    it('throws when channel is not found', async () => {
      source.setAccessToken('yt-token');
      mockFetchResponse({ items: [] });

      await expect(
        source.getCollectionItems('UC-nonexistent')
      ).rejects.toThrow('YouTube channel not found');
    });
  });

  describe('search', () => {
    it('searches YouTube and maps results', async () => {
      source.setAccessToken('yt-token');
      mockFetchResponse({
        items: [
          {
            id: { videoId: 'search-vid-1' },
            snippet: {
              title: 'Search Result',
              description: 'A result',
              thumbnails: {
                medium: { url: 'https://yt.com/search-thumb.jpg' },
              },
              channelTitle: 'Some Channel',
              publishedAt: '2024-07-01T00:00:00Z',
            },
          },
        ],
        pageInfo: { totalResults: 1 },
      });

      const result = await source.search('test query');
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({
        id: 'search-vid-1',
        source: 'youtube',
        title: 'Search Result',
        sourceId: 'search-vid-1',
        thumbnail: 'https://yt.com/search-thumb.jpg',
        artist: 'Some Channel',
        publishedAt: '2024-07-01T00:00:00Z',
      });
    });
  });

  describe('checkForUpdates', () => {
    it('returns new items since lastSeenItemId in oldest-first order', async () => {
      source.setAccessToken('yt-token');

      // channel resolve
      // then playlist items: 3 items, middle one is lastSeen
      mockFetchSequence([
        {
          items: [
            {
              contentDetails: {
                relatedPlaylists: { uploads: 'UU789' },
              },
            },
          ],
        },
        {
          items: [
            {
              id: 'pli-new-2',
              snippet: {
                title: 'Newest Video',
                thumbnails: {},
                channelTitle: 'Ch',
                publishedAt: '2024-08-03T00:00:00Z',
                resourceId: { videoId: 'vid-new-2' },
              },
              contentDetails: {
                videoId: 'vid-new-2',
                videoPublishedAt: '2024-08-03T00:00:00Z',
              },
            },
            {
              id: 'pli-new-1',
              snippet: {
                title: 'Newer Video',
                thumbnails: {},
                channelTitle: 'Ch',
                publishedAt: '2024-08-02T00:00:00Z',
                resourceId: { videoId: 'vid-new-1' },
              },
              contentDetails: {
                videoId: 'vid-new-1',
                videoPublishedAt: '2024-08-02T00:00:00Z',
              },
            },
            {
              id: 'pli-last',
              snippet: {
                title: 'Last Seen Video',
                thumbnails: {},
                channelTitle: 'Ch',
                publishedAt: '2024-08-01T00:00:00Z',
                resourceId: { videoId: 'vid-last' },
              },
              contentDetails: {
                videoId: 'vid-last',
                videoPublishedAt: '2024-08-01T00:00:00Z',
              },
            },
          ],
          pageInfo: { totalResults: 3 },
        },
      ]);

      const updates = await source.checkForUpdates('UC789', 'vid-last');

      // Should return the 2 new items, oldest first
      expect(updates).toHaveLength(2);
      expect(updates[0].id).toBe('vid-new-1');
      expect(updates[1].id).toBe('vid-new-2');
    });
  });
});
