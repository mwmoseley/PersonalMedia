/** The supported media source types. */
export type MediaSourceType = 'spotify' | 'youtube' | 'podcast';

/** The kinds of browsable content a media source can provide. */
export type MediaContentType =
  | 'track'
  | 'album'
  | 'playlist'
  | 'video'
  | 'channel'
  | 'episode'
  | 'feed';

/** A media item that can be queued for playback. */
export interface MediaItem {
  id: string;
  source: MediaSourceType;
  title: string;
  /** Spotify track URI, YouTube video ID, or podcast audio URL. */
  sourceId: string;
  thumbnail?: string;
  /** Duration in seconds. */
  duration?: number;
  /** Artist, channel name, or podcast name. */
  artist?: string;
  /** When this item was published or added. */
  publishedAt?: string;
}

/** A browsable collection of media (playlist, channel, feed, etc). */
export interface MediaCollection {
  id: string;
  source: MediaSourceType;
  title: string;
  description?: string;
  thumbnail?: string;
  contentType: MediaContentType;
  /** Total number of items in this collection, if known. */
  itemCount?: number;
}

/** A source that is polled for new content during playback. */
export interface UpdateEntry {
  id: string;
  source: 'youtube' | 'podcast';
  /** YouTube channel/playlist ID or RSS feed URL. */
  sourceId: string;
  label: string;
  intervalMinutes: number;
  /** ISO timestamp of last check. */
  lastChecked: string;
  /** ID of the most recent item seen, to detect new content. */
  lastSeenItemId: string;
}

/** Options for fetching media lists. */
export interface FetchMediaOptions {
  /** Maximum number of items to return. */
  limit?: number;
  /** Pagination cursor or page token. */
  cursor?: string;
}

/** A paginated response containing media items. */
export interface PaginatedResult<T> {
  items: T[];
  /** Cursor for the next page, or undefined if no more pages. */
  nextCursor?: string;
  /** Total number of items, if known. */
  total?: number;
}
