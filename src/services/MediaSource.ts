import type {
  MediaSourceType,
  MediaContentType,
  MediaItem,
  MediaCollection,
  FetchMediaOptions,
  PaginatedResult,
} from '../types/media';

/**
 * Abstract base class for all media sources.
 *
 * Each media source (Spotify, YouTube, Podcast) extends this class to provide
 * a uniform interface to the rest of the application. The frontend interacts
 * with media sources exclusively through this interface, without needing to
 * know provider-specific details.
 */
export abstract class MediaSource {
  /** The source type identifier. */
  abstract readonly sourceType: MediaSourceType;

  /** Human-readable display name for this source (e.g. "Spotify", "YouTube"). */
  abstract readonly displayName: string;

  /**
   * Whether this source supports being used as an update entry —
   * i.e., it can be polled for new content during playback.
   * Spotify does not support this; YouTube and Podcast do.
   */
  abstract readonly isUpdateSource: boolean;

  /**
   * Default polling interval in minutes for update entries from this source.
   * Only meaningful when `isUpdateSource` is true.
   * Returns 0 for sources that don't support updates.
   */
  abstract readonly defaultUpdateIntervalMinutes: number;

  /**
   * Whether the source requires OAuth authentication.
   * Podcast sources do not; Spotify and YouTube do.
   */
  abstract readonly requiresAuth: boolean;

  /**
   * Returns the content types this source can provide.
   * For example, Spotify might return ['track', 'album', 'playlist'],
   * YouTube might return ['video', 'channel'], etc.
   */
  abstract getAvailableMediaTypes(): MediaContentType[];

  /**
   * Returns whether the user is currently authenticated with this source.
   * For sources that don't require auth (e.g. Podcast), this always returns true.
   */
  abstract isAuthenticated(): boolean;

  /**
   * Returns browsable collections (playlists, subscriptions, feeds)
   * available from this source for the current user.
   */
  abstract getAvailableMedia(
    options?: FetchMediaOptions
  ): Promise<PaginatedResult<MediaCollection>>;

  /**
   * Returns the individual media items within a specific collection.
   *
   * @param collectionId - The ID of the collection to fetch items from.
   *   For Spotify: a playlist ID. For YouTube: a channel or playlist ID.
   *   For Podcast: the RSS feed URL.
   */
  abstract getCollectionItems(
    collectionId: string,
    options?: FetchMediaOptions
  ): Promise<PaginatedResult<MediaItem>>;

  /**
   * Returns recently published or added media items across all of
   * this source's collections. Useful for populating a "what's new" view.
   *
   * @param since - Optional ISO timestamp. If provided, only return items
   *   published/added after this time. If omitted, returns a reasonable
   *   set of recent items (implementation-defined).
   */
  abstract getRecentMedia(
    since?: string,
    options?: FetchMediaOptions
  ): Promise<PaginatedResult<MediaItem>>;

  /**
   * Checks for new content from a specific collection since the given item ID.
   * Used by the update-entry polling system during playback.
   *
   * Returns new items that appeared after `lastSeenItemId`, ordered
   * oldest-first so they can be inserted into the queue in chronological order.
   *
   * Only supported when `isUpdateSource` is true. Throws if called on
   * a source that doesn't support updates.
   *
   * @param collectionId - The collection to check for updates.
   * @param lastSeenItemId - The ID of the last item that was seen.
   */
  async checkForUpdates(
    collectionId: string,
    lastSeenItemId: string
  ): Promise<MediaItem[]> {
    if (!this.isUpdateSource) {
      throw new Error(
        `${this.displayName} does not support update polling`
      );
    }
    return this.fetchUpdatesSince(collectionId, lastSeenItemId);
  }

  /**
   * Internal method that subclasses override to implement update checking.
   * Only needs to be implemented by sources where `isUpdateSource` is true.
   *
   * @param collectionId - The collection to check.
   * @param lastSeenItemId - The last seen item ID.
   * @returns New items since lastSeenItemId, ordered oldest-first.
   */
  protected async fetchUpdatesSince(
    _collectionId: string,
    _lastSeenItemId: string
  ): Promise<MediaItem[]> {
    return [];
  }

  /**
   * Searches within this source for media matching a query string.
   * Not all sources may support search — the default implementation
   * returns an empty result.
   */
  async search(
    _query: string,
    _options?: FetchMediaOptions
  ): Promise<PaginatedResult<MediaItem>> {
    return { items: [] };
  }
}
