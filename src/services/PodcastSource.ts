import { MediaSource } from './MediaSource';
import type {
  MediaSourceType,
  MediaContentType,
  MediaItem,
  MediaCollection,
  FetchMediaOptions,
  PaginatedResult,
} from '../types/media';

/** Parsed representation of a podcast feed. */
export interface PodcastFeed {
  url: string;
  title: string;
  description?: string;
  imageUrl?: string;
  episodes: PodcastEpisode[];
}

/** A single episode parsed from an RSS feed. */
export interface PodcastEpisode {
  guid: string;
  title: string;
  description?: string;
  audioUrl: string;
  imageUrl?: string;
  publishedAt?: string;
  duration?: number; // seconds
}

/**
 * Podcast media source.
 *
 * Manages a set of user-added RSS feeds. Fetches and parses feed XML
 * to extract episode metadata. Does not require OAuth — feeds are
 * public (though some may need a CORS proxy).
 */
export class PodcastSource extends MediaSource {
  readonly sourceType: MediaSourceType = 'podcast';
  readonly displayName = 'Podcasts';
  readonly isUpdateSource = true;
  readonly defaultUpdateIntervalMinutes = 30;
  readonly requiresAuth = false;

  private feeds = new Map<string, PodcastFeed>();
  private corsProxyUrl: string | null = null;

  constructor(corsProxyUrl?: string) {
    super();
    this.corsProxyUrl = corsProxyUrl ?? null;
  }

  setCorsProxyUrl(url: string | null): void {
    this.corsProxyUrl = url;
  }

  /** Add an RSS feed by URL. Fetches and parses the feed immediately. */
  async addFeed(feedUrl: string): Promise<PodcastFeed> {
    const feed = await this.fetchAndParseFeed(feedUrl);
    this.feeds.set(feedUrl, feed);
    return feed;
  }

  /** Remove a previously added feed. */
  removeFeed(feedUrl: string): boolean {
    return this.feeds.delete(feedUrl);
  }

  /** Refresh a single feed from its RSS URL. */
  async refreshFeed(feedUrl: string): Promise<PodcastFeed> {
    const feed = await this.fetchAndParseFeed(feedUrl);
    this.feeds.set(feedUrl, feed);
    return feed;
  }

  /** Restore feeds from persisted data (e.g. localStorage) without re-fetching. */
  restoreFeeds(feeds: PodcastFeed[]): void {
    for (const feed of feeds) {
      this.feeds.set(feed.url, feed);
    }
  }

  /** Get the current set of feeds for persistence. */
  getFeeds(): PodcastFeed[] {
    return Array.from(this.feeds.values());
  }

  getAvailableMediaTypes(): MediaContentType[] {
    return ['episode', 'feed'];
  }

  isAuthenticated(): boolean {
    // Podcasts don't require auth
    return true;
  }

  async getAvailableMedia(
    options?: FetchMediaOptions
  ): Promise<PaginatedResult<MediaCollection>> {
    const allFeeds = Array.from(this.feeds.values());
    const limit = options?.limit ?? allFeeds.length;
    const offset = options?.cursor ? parseInt(options.cursor, 10) : 0;

    const page = allFeeds.slice(offset, offset + limit);
    const hasMore = offset + limit < allFeeds.length;

    return {
      items: page.map((feed) => this.mapFeedToCollection(feed)),
      nextCursor: hasMore ? String(offset + limit) : undefined,
      total: allFeeds.length,
    };
  }

  async getCollectionItems(
    collectionId: string,
    options?: FetchMediaOptions
  ): Promise<PaginatedResult<MediaItem>> {
    // collectionId is the feed URL
    let feed = this.feeds.get(collectionId);
    if (!feed) {
      // Try fetching it fresh
      feed = await this.fetchAndParseFeed(collectionId);
      this.feeds.set(collectionId, feed);
    }

    const limit = options?.limit ?? 20;
    const offset = options?.cursor ? parseInt(options.cursor, 10) : 0;

    const page = feed.episodes.slice(offset, offset + limit);
    const hasMore = offset + limit < feed.episodes.length;

    return {
      items: page.map((ep) => this.mapEpisode(ep, feed)),
      nextCursor: hasMore ? String(offset + limit) : undefined,
      total: feed.episodes.length,
    };
  }

  async getRecentMedia(
    since?: string,
    options?: FetchMediaOptions
  ): Promise<PaginatedResult<MediaItem>> {
    // Collect recent episodes across all feeds
    const allEpisodes: { episode: PodcastEpisode; feed: PodcastFeed }[] = [];

    for (const feed of this.feeds.values()) {
      for (const ep of feed.episodes) {
        if (since && ep.publishedAt && ep.publishedAt <= since) {
          continue;
        }
        allEpisodes.push({ episode: ep, feed });
      }
    }

    // Sort newest first
    allEpisodes.sort((a, b) => {
      const aDate = a.episode.publishedAt ?? '';
      const bDate = b.episode.publishedAt ?? '';
      return bDate.localeCompare(aDate);
    });

    const limit = options?.limit ?? 20;
    const offset = options?.cursor ? parseInt(options.cursor, 10) : 0;
    const page = allEpisodes.slice(offset, offset + limit);
    const hasMore = offset + limit < allEpisodes.length;

    return {
      items: page.map(({ episode, feed }) => this.mapEpisode(episode, feed)),
      nextCursor: hasMore ? String(offset + limit) : undefined,
      total: allEpisodes.length,
    };
  }

  protected override async fetchUpdatesSince(
    collectionId: string,
    lastSeenItemId: string
  ): Promise<MediaItem[]> {
    // Refresh the feed to get latest episodes
    const feed = await this.refreshFeed(collectionId);

    const newItems: MediaItem[] = [];
    for (const ep of feed.episodes) {
      if (ep.guid === lastSeenItemId) {
        break;
      }
      newItems.push(this.mapEpisode(ep, feed));
    }

    // Return oldest-first for queue insertion
    return newItems.reverse();
  }

  private async fetchAndParseFeed(feedUrl: string): Promise<PodcastFeed> {
    const fetchUrl = this.corsProxyUrl
      ? `${this.corsProxyUrl}${encodeURIComponent(feedUrl)}`
      : feedUrl;

    const response = await fetch(fetchUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch podcast feed: ${response.status} ${response.statusText}`
      );
    }

    const xml = await response.text();
    return this.parseRssFeed(xml, feedUrl);
  }

  /** Parse RSS XML into a PodcastFeed structure. */
  private parseRssFeed(xml: string, feedUrl: string): PodcastFeed {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');

    const channel = doc.querySelector('channel');
    if (!channel) {
      throw new Error('Invalid RSS feed: no <channel> element');
    }

    const title = channel.querySelector('title')?.textContent ?? 'Unknown Podcast';
    const description = channel.querySelector('description')?.textContent ?? undefined;

    // Try itunes:image first, then regular image
    const imageUrl =
      channel.querySelector('image > url')?.textContent ??
      channel.querySelector('[href]')?.getAttribute('href') ??
      undefined;

    const itemElements = channel.querySelectorAll('item');
    const episodes: PodcastEpisode[] = [];

    itemElements.forEach((item) => {
      const enclosure = item.querySelector('enclosure');
      const audioUrl = enclosure?.getAttribute('url');

      // Skip items without audio
      if (!audioUrl) return;

      const guid =
        item.querySelector('guid')?.textContent ?? audioUrl;
      const epTitle =
        item.querySelector('title')?.textContent ?? 'Untitled Episode';
      const epDescription =
        item.querySelector('description')?.textContent ?? undefined;
      const pubDate = item.querySelector('pubDate')?.textContent ?? undefined;
      const epImageUrl =
        item.querySelector('[href]')?.getAttribute('href') ?? undefined;

      // Parse duration from itunes:duration (can be HH:MM:SS, MM:SS, or seconds)
      const durationStr =
        this.getElementByTagNameNS(item, 'duration')?.textContent ?? undefined;
      const duration = durationStr ? this.parseDuration(durationStr) : undefined;

      episodes.push({
        guid,
        title: epTitle,
        description: epDescription,
        audioUrl,
        imageUrl: epImageUrl,
        publishedAt: pubDate ? new Date(pubDate).toISOString() : undefined,
        duration,
      });
    });

    return {
      url: feedUrl,
      title,
      description: description || undefined,
      imageUrl: imageUrl || undefined,
      episodes,
    };
  }

  private getElementByTagNameNS(
    parent: Element,
    localName: string
  ): Element | null {
    // Look for itunes:duration or just duration
    const elements = parent.getElementsByTagName(`itunes:${localName}`);
    if (elements.length > 0) return elements[0];
    return parent.getElementsByTagName(localName)[0] ?? null;
  }

  /** Parse an itunes:duration string to seconds. */
  private parseDuration(raw: string): number {
    const trimmed = raw.trim();

    // Plain seconds
    if (/^\d+$/.test(trimmed)) {
      return parseInt(trimmed, 10);
    }

    // HH:MM:SS or MM:SS
    const parts = trimmed.split(':').map(Number);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }

    return 0;
  }

  private mapFeedToCollection(feed: PodcastFeed): MediaCollection {
    return {
      id: feed.url,
      source: 'podcast',
      title: feed.title,
      description: feed.description,
      thumbnail: feed.imageUrl,
      contentType: 'feed',
      itemCount: feed.episodes.length,
    };
  }

  private mapEpisode(episode: PodcastEpisode, feed: PodcastFeed): MediaItem {
    return {
      id: episode.guid,
      source: 'podcast',
      title: episode.title,
      sourceId: episode.audioUrl,
      thumbnail: episode.imageUrl ?? feed.imageUrl,
      duration: episode.duration,
      artist: feed.title,
      publishedAt: episode.publishedAt,
    };
  }
}
