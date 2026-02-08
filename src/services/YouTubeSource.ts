import { MediaSource } from './MediaSource';
import type {
  MediaSourceType,
  MediaContentType,
  MediaItem,
  MediaCollection,
  FetchMediaOptions,
  PaginatedResult,
} from '../types/media';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const DEFAULT_LIMIT = 20;

interface YouTubeThumbnails {
  default?: { url: string };
  medium?: { url: string };
  high?: { url: string };
}

interface YouTubeSubscriptionItem {
  snippet: {
    title: string;
    description: string;
    thumbnails: YouTubeThumbnails;
    resourceId: { channelId: string };
  };
}

interface YouTubeSubscriptionsResponse {
  items: YouTubeSubscriptionItem[];
  nextPageToken?: string;
  pageInfo: { totalResults: number };
}

interface YouTubePlaylistItem {
  id: string;
  snippet: {
    title: string;
    description: string;
    thumbnails: YouTubeThumbnails;
    channelTitle: string;
    publishedAt: string;
    resourceId: { videoId: string };
  };
  contentDetails?: {
    videoId: string;
    videoPublishedAt: string;
  };
}

interface YouTubePlaylistItemsResponse {
  items: YouTubePlaylistItem[];
  nextPageToken?: string;
  pageInfo: { totalResults: number };
}

interface YouTubeChannelResponse {
  items: {
    contentDetails: {
      relatedPlaylists: { uploads: string };
    };
  }[];
}

interface YouTubeSearchResponse {
  items: {
    id: { videoId: string };
    snippet: {
      title: string;
      description: string;
      thumbnails: YouTubeThumbnails;
      channelTitle: string;
      publishedAt: string;
    };
  }[];
  nextPageToken?: string;
  pageInfo: { totalResults: number };
}

/**
 * YouTube media source.
 *
 * Provides access to the user's YouTube subscriptions and their videos
 * via the YouTube Data API v3. Supports update polling for new videos.
 */
export class YouTubeSource extends MediaSource {
  readonly sourceType: MediaSourceType = 'youtube';
  readonly displayName = 'YouTube';
  readonly isUpdateSource = true;
  readonly defaultUpdateIntervalMinutes = 30;
  readonly requiresAuth = true;

  private accessToken: string | null = null;

  /** Cache of channel ID -> uploads playlist ID. */
  private uploadsPlaylistCache = new Map<string, string>();

  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  getAvailableMediaTypes(): MediaContentType[] {
    return ['video', 'channel'];
  }

  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  async getAvailableMedia(
    options?: FetchMediaOptions
  ): Promise<PaginatedResult<MediaCollection>> {
    const limit = options?.limit ?? DEFAULT_LIMIT;
    const params = new URLSearchParams({
      part: 'snippet',
      mine: 'true',
      maxResults: String(limit),
    });
    if (options?.cursor) {
      params.set('pageToken', options.cursor);
    }

    const data = await this.fetchApi<YouTubeSubscriptionsResponse>(
      `/subscriptions?${params}`
    );

    return {
      items: data.items.map((sub) => this.mapSubscription(sub)),
      nextCursor: data.nextPageToken,
      total: data.pageInfo.totalResults,
    };
  }

  async getCollectionItems(
    collectionId: string,
    options?: FetchMediaOptions
  ): Promise<PaginatedResult<MediaItem>> {
    // collectionId is a channel ID — resolve to uploads playlist
    const uploadsPlaylistId = await this.getUploadsPlaylistId(collectionId);

    const limit = options?.limit ?? DEFAULT_LIMIT;
    const params = new URLSearchParams({
      part: 'snippet,contentDetails',
      playlistId: uploadsPlaylistId,
      maxResults: String(limit),
    });
    if (options?.cursor) {
      params.set('pageToken', options.cursor);
    }

    const data = await this.fetchApi<YouTubePlaylistItemsResponse>(
      `/playlistItems?${params}`
    );

    return {
      items: data.items.map((item) => this.mapPlaylistItem(item)),
      nextCursor: data.nextPageToken,
      total: data.pageInfo.totalResults,
    };
  }

  async getRecentMedia(
    since?: string,
    options?: FetchMediaOptions
  ): Promise<PaginatedResult<MediaItem>> {
    // Use the YouTube activities endpoint or search for recent subscription videos
    const limit = options?.limit ?? DEFAULT_LIMIT;
    const params = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      order: 'date',
      maxResults: String(limit),
      forMine: 'true',
    });
    if (since) {
      params.set('publishedAfter', since);
    }
    if (options?.cursor) {
      params.set('pageToken', options.cursor);
    }

    const data = await this.fetchApi<YouTubeSearchResponse>(
      `/search?${params}`
    );

    return {
      items: data.items.map((item) => this.mapSearchResult(item)),
      nextCursor: data.nextPageToken,
      total: data.pageInfo.totalResults,
    };
  }

  override async search(
    query: string,
    options?: FetchMediaOptions
  ): Promise<PaginatedResult<MediaItem>> {
    const limit = options?.limit ?? DEFAULT_LIMIT;
    const params = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      q: query,
      maxResults: String(limit),
    });
    if (options?.cursor) {
      params.set('pageToken', options.cursor);
    }

    const data = await this.fetchApi<YouTubeSearchResponse>(
      `/search?${params}`
    );

    return {
      items: data.items.map((item) => this.mapSearchResult(item)),
      nextCursor: data.nextPageToken,
      total: data.pageInfo.totalResults,
    };
  }

  protected override async fetchUpdatesSince(
    collectionId: string,
    lastSeenItemId: string
  ): Promise<MediaItem[]> {
    const allNew: MediaItem[] = [];
    let cursor: string | undefined;
    let found = false;

    // Page through the uploads until we find the lastSeenItemId
    while (!found) {
      const page = await this.getCollectionItems(collectionId, {
        limit: 20,
        cursor,
      });

      for (const item of page.items) {
        if (item.id === lastSeenItemId) {
          found = true;
          break;
        }
        allNew.push(item);
      }

      if (!found && page.nextCursor) {
        cursor = page.nextCursor;
      } else {
        break;
      }
    }

    // Return oldest-first for queue insertion order
    return allNew.reverse();
  }

  private async getUploadsPlaylistId(channelId: string): Promise<string> {
    const cached = this.uploadsPlaylistCache.get(channelId);
    if (cached) return cached;

    const data = await this.fetchApi<YouTubeChannelResponse>(
      `/channels?part=contentDetails&id=${encodeURIComponent(channelId)}`
    );

    if (data.items.length === 0) {
      throw new Error(`YouTube channel not found: ${channelId}`);
    }

    const uploadsId = data.items[0].contentDetails.relatedPlaylists.uploads;
    this.uploadsPlaylistCache.set(channelId, uploadsId);
    return uploadsId;
  }

  private async fetchApi<T>(path: string): Promise<T> {
    if (!this.accessToken) {
      throw new Error('YouTube: not authenticated');
    }

    const response = await fetch(`${YOUTUBE_API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(
        `YouTube API error: ${response.status} ${response.statusText}`
      );
    }

    return response.json() as Promise<T>;
  }

  private pickThumbnail(thumbnails: YouTubeThumbnails): string | undefined {
    return thumbnails.medium?.url ?? thumbnails.high?.url ?? thumbnails.default?.url;
  }

  private mapSubscription(sub: YouTubeSubscriptionItem): MediaCollection {
    return {
      id: sub.snippet.resourceId.channelId,
      source: 'youtube',
      title: sub.snippet.title,
      description: sub.snippet.description || undefined,
      thumbnail: this.pickThumbnail(sub.snippet.thumbnails),
      contentType: 'channel',
    };
  }

  private mapPlaylistItem(item: YouTubePlaylistItem): MediaItem {
    const videoId = item.contentDetails?.videoId ?? item.snippet.resourceId.videoId;
    return {
      id: videoId,
      source: 'youtube',
      title: item.snippet.title,
      sourceId: videoId,
      thumbnail: this.pickThumbnail(item.snippet.thumbnails),
      artist: item.snippet.channelTitle,
      publishedAt: item.contentDetails?.videoPublishedAt ?? item.snippet.publishedAt,
    };
  }

  private mapSearchResult(item: YouTubeSearchResponse['items'][number]): MediaItem {
    return {
      id: item.id.videoId,
      source: 'youtube',
      title: item.snippet.title,
      sourceId: item.id.videoId,
      thumbnail: this.pickThumbnail(item.snippet.thumbnails),
      artist: item.snippet.channelTitle,
      publishedAt: item.snippet.publishedAt,
    };
  }
}
