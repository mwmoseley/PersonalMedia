import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PodcastSource } from '../../src/services/PodcastSource';

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>Test Podcast</title>
    <description>A test podcast feed</description>
    <image>
      <url>https://example.com/podcast-art.jpg</url>
    </image>
    <item>
      <title>Episode 3 — Latest</title>
      <guid>ep-3</guid>
      <pubDate>Wed, 03 Jul 2024 12:00:00 GMT</pubDate>
      <enclosure url="https://example.com/ep3.mp3" type="audio/mpeg" length="12345678"/>
      <itunes:duration>1:30:00</itunes:duration>
    </item>
    <item>
      <title>Episode 2</title>
      <guid>ep-2</guid>
      <pubDate>Tue, 02 Jul 2024 12:00:00 GMT</pubDate>
      <enclosure url="https://example.com/ep2.mp3" type="audio/mpeg" length="9876543"/>
      <itunes:duration>45:30</itunes:duration>
    </item>
    <item>
      <title>Episode 1 — Oldest</title>
      <guid>ep-1</guid>
      <pubDate>Mon, 01 Jul 2024 12:00:00 GMT</pubDate>
      <enclosure url="https://example.com/ep1.mp3" type="audio/mpeg" length="5432100"/>
      <itunes:duration>3600</itunes:duration>
    </item>
  </channel>
</rss>`;

const MINIMAL_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Minimal Feed</title>
    <item>
      <title>Just Audio</title>
      <enclosure url="https://example.com/audio.mp3" type="audio/mpeg"/>
    </item>
    <item>
      <title>No Audio Item</title>
    </item>
  </channel>
</rss>`;

function mockFetchXml(xml: string): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(xml),
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

describe('PodcastSource', () => {
  let source: PodcastSource;

  beforeEach(() => {
    source = new PodcastSource();
    vi.restoreAllMocks();
  });

  describe('properties', () => {
    it('has correct source type and display name', () => {
      expect(source.sourceType).toBe('podcast');
      expect(source.displayName).toBe('Podcasts');
    });

    it('is an update source with 30-min default interval', () => {
      expect(source.isUpdateSource).toBe(true);
      expect(source.defaultUpdateIntervalMinutes).toBe(30);
    });

    it('does not require auth', () => {
      expect(source.requiresAuth).toBe(false);
    });

    it('is always authenticated', () => {
      expect(source.isAuthenticated()).toBe(true);
    });

    it('returns available media types', () => {
      expect(source.getAvailableMediaTypes()).toEqual(['episode', 'feed']);
    });
  });

  describe('feed management', () => {
    it('adds a feed by URL', async () => {
      mockFetchXml(SAMPLE_RSS);
      const feed = await source.addFeed('https://example.com/feed.xml');

      expect(feed.title).toBe('Test Podcast');
      expect(feed.description).toBe('A test podcast feed');
      expect(feed.url).toBe('https://example.com/feed.xml');
      expect(feed.episodes).toHaveLength(3);
    });

    it('removes a previously added feed', async () => {
      mockFetchXml(SAMPLE_RSS);
      await source.addFeed('https://example.com/feed.xml');

      const removed = source.removeFeed('https://example.com/feed.xml');
      expect(removed).toBe(true);
      expect(source.getFeeds()).toHaveLength(0);
    });

    it('returns false when removing a non-existent feed', () => {
      expect(source.removeFeed('https://nonexistent.com/feed.xml')).toBe(false);
    });

    it('restores feeds from persisted data', () => {
      source.restoreFeeds([
        {
          url: 'https://example.com/feed.xml',
          title: 'Restored Podcast',
          episodes: [],
        },
      ]);

      const feeds = source.getFeeds();
      expect(feeds).toHaveLength(1);
      expect(feeds[0].title).toBe('Restored Podcast');
    });

    it('refreshes a feed', async () => {
      mockFetchXml(SAMPLE_RSS);
      const feed = await source.refreshFeed('https://example.com/feed.xml');

      expect(feed.title).toBe('Test Podcast');
      expect(feed.episodes).toHaveLength(3);
    });
  });

  describe('RSS parsing', () => {
    it('parses episode metadata correctly', async () => {
      mockFetchXml(SAMPLE_RSS);
      const feed = await source.addFeed('https://example.com/feed.xml');

      const ep1 = feed.episodes[0];
      expect(ep1.guid).toBe('ep-3');
      expect(ep1.title).toBe('Episode 3 — Latest');
      expect(ep1.audioUrl).toBe('https://example.com/ep3.mp3');
      expect(ep1.duration).toBe(5400); // 1:30:00 = 5400s
    });

    it('parses MM:SS duration format', async () => {
      mockFetchXml(SAMPLE_RSS);
      const feed = await source.addFeed('https://example.com/feed.xml');

      const ep2 = feed.episodes[1];
      expect(ep2.duration).toBe(2730); // 45:30 = 2730s
    });

    it('parses plain seconds duration format', async () => {
      mockFetchXml(SAMPLE_RSS);
      const feed = await source.addFeed('https://example.com/feed.xml');

      const ep3 = feed.episodes[2];
      expect(ep3.duration).toBe(3600);
    });

    it('handles items without enclosures by skipping them', async () => {
      mockFetchXml(MINIMAL_RSS);
      const feed = await source.addFeed('https://example.com/minimal.xml');

      expect(feed.episodes).toHaveLength(1);
      expect(feed.episodes[0].title).toBe('Just Audio');
    });

    it('uses audio URL as guid when no guid element exists', async () => {
      mockFetchXml(MINIMAL_RSS);
      const feed = await source.addFeed('https://example.com/minimal.xml');

      expect(feed.episodes[0].guid).toBe('https://example.com/audio.mp3');
    });

    it('throws on invalid RSS (no channel element)', async () => {
      mockFetchXml('<rss></rss>');
      await expect(
        source.addFeed('https://example.com/bad.xml')
      ).rejects.toThrow('no <channel> element');
    });
  });

  describe('CORS proxy', () => {
    it('uses CORS proxy URL when set via constructor', async () => {
      const proxied = new PodcastSource('https://proxy.example.com/?url=');
      mockFetchXml(SAMPLE_RSS);

      await proxied.addFeed('https://example.com/feed.xml');

      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        'https://proxy.example.com/?url=https%3A%2F%2Fexample.com%2Ffeed.xml'
      );
    });

    it('uses CORS proxy URL when set via setter', async () => {
      source.setCorsProxyUrl('https://proxy2.example.com/?url=');
      mockFetchXml(SAMPLE_RSS);

      await source.addFeed('https://example.com/feed.xml');

      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        'https://proxy2.example.com/?url=https%3A%2F%2Fexample.com%2Ffeed.xml'
      );
    });

    it('fetches directly when no CORS proxy is set', async () => {
      mockFetchXml(SAMPLE_RSS);
      await source.addFeed('https://example.com/feed.xml');

      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        'https://example.com/feed.xml'
      );
    });
  });

  describe('getAvailableMedia', () => {
    it('returns all feeds as collections', async () => {
      mockFetchXml(SAMPLE_RSS);
      await source.addFeed('https://example.com/feed.xml');

      const result = await source.getAvailableMedia();

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({
        id: 'https://example.com/feed.xml',
        source: 'podcast',
        title: 'Test Podcast',
        description: 'A test podcast feed',
        thumbnail: 'https://example.com/podcast-art.jpg',
        contentType: 'feed',
        itemCount: 3,
      });
    });
  });

  describe('getCollectionItems', () => {
    it('returns episodes from a feed', async () => {
      mockFetchXml(SAMPLE_RSS);
      await source.addFeed('https://example.com/feed.xml');

      // Reset the mock so getCollectionItems doesn't fetch again
      vi.restoreAllMocks();

      const result = await source.getCollectionItems(
        'https://example.com/feed.xml'
      );

      expect(result.items).toHaveLength(3);
      expect(result.items[0]).toMatchObject({
        id: 'ep-3',
        source: 'podcast',
        title: 'Episode 3 — Latest',
        sourceId: 'https://example.com/ep3.mp3',
        artist: 'Test Podcast',
      });
    });

    it('supports pagination', async () => {
      mockFetchXml(SAMPLE_RSS);
      await source.addFeed('https://example.com/feed.xml');
      vi.restoreAllMocks();

      const page1 = await source.getCollectionItems(
        'https://example.com/feed.xml',
        { limit: 2 }
      );
      expect(page1.items).toHaveLength(2);
      expect(page1.nextCursor).toBe('2');
      expect(page1.total).toBe(3);

      const page2 = await source.getCollectionItems(
        'https://example.com/feed.xml',
        { limit: 2, cursor: '2' }
      );
      expect(page2.items).toHaveLength(1);
      expect(page2.nextCursor).toBeUndefined();
    });
  });

  describe('getRecentMedia', () => {
    it('returns episodes from all feeds sorted newest first', async () => {
      mockFetchXml(SAMPLE_RSS);
      await source.addFeed('https://example.com/feed.xml');
      vi.restoreAllMocks();

      const result = await source.getRecentMedia();

      expect(result.items).toHaveLength(3);
      // Should be newest first
      expect(result.items[0].id).toBe('ep-3');
      expect(result.items[2].id).toBe('ep-1');
    });

    it('filters by since timestamp', async () => {
      mockFetchXml(SAMPLE_RSS);
      await source.addFeed('https://example.com/feed.xml');
      vi.restoreAllMocks();

      // Only items after July 2
      const result = await source.getRecentMedia('2024-07-02T12:00:00.000Z');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('ep-3');
    });
  });

  describe('checkForUpdates', () => {
    it('returns new episodes since lastSeenItemId in oldest-first order', async () => {
      // First call: addFeed
      mockFetchXml(SAMPLE_RSS);
      await source.addFeed('https://example.com/feed.xml');

      // Second call: refreshFeed during checkForUpdates
      mockFetchXml(SAMPLE_RSS);

      const updates = await source.checkForUpdates(
        'https://example.com/feed.xml',
        'ep-2'
      );

      // Only ep-3 is newer than ep-2, returned oldest-first
      expect(updates).toHaveLength(1);
      expect(updates[0].id).toBe('ep-3');
    });
  });

  describe('error handling', () => {
    it('throws on fetch failure', async () => {
      mockFetchError(404, 'Not Found');

      await expect(
        source.addFeed('https://example.com/missing.xml')
      ).rejects.toThrow('Failed to fetch podcast feed: 404 Not Found');
    });
  });
});
