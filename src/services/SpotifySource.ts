import { MediaSource } from './MediaSource';
import type {
  MediaSourceType,
  MediaContentType,
  MediaItem,
  MediaCollection,
  FetchMediaOptions,
  PaginatedResult,
} from '../types/media';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const DEFAULT_LIMIT = 20;

interface SpotifyImage {
  url: string;
  width: number;
  height: number;
}

interface SpotifyPlaylistResponse {
  items: SpotifyPlaylistObject[];
  next: string | null;
  total: number;
}

interface SpotifyPlaylistObject {
  id: string;
  name: string;
  description: string;
  images: SpotifyImage[];
  tracks: { total: number };
}

interface SpotifyTrackItem {
  added_at: string;
  track: {
    id: string;
    uri: string;
    name: string;
    duration_ms: number;
    artists: { name: string }[];
    album: {
      images: SpotifyImage[];
    };
  } | null;
}

interface SpotifyPlaylistTracksResponse {
  items: SpotifyTrackItem[];
  next: string | null;
  total: number;
}

/**
 * Spotify media source.
 *
 * Provides access to the user's Spotify playlists and tracks via the
 * Spotify Web API. Authentication is handled externally via OAuth PKCE;
 * this class expects to receive an access token via `setAccessToken`.
 */
export class SpotifySource extends MediaSource {
  readonly sourceType: MediaSourceType = 'spotify';
  readonly displayName = 'Spotify';
  readonly isUpdateSource = false;
  readonly defaultUpdateIntervalMinutes = 0;
  readonly requiresAuth = true;

  private accessToken: string | null = null;

  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  getAvailableMediaTypes(): MediaContentType[] {
    return ['track', 'playlist'];
  }

  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  async getAvailableMedia(
    options?: FetchMediaOptions
  ): Promise<PaginatedResult<MediaCollection>> {
    const limit = options?.limit ?? DEFAULT_LIMIT;
    const offset = options?.cursor ? parseInt(options.cursor, 10) : 0;

    const data = await this.fetchApi<SpotifyPlaylistResponse>(
      `/me/playlists?limit=${limit}&offset=${offset}`
    );

    return {
      items: data.items.map((playlist) => this.mapPlaylist(playlist)),
      nextCursor: data.next
        ? String(offset + limit)
        : undefined,
      total: data.total,
    };
  }

  async getCollectionItems(
    collectionId: string,
    options?: FetchMediaOptions
  ): Promise<PaginatedResult<MediaItem>> {
    const limit = options?.limit ?? DEFAULT_LIMIT;
    const offset = options?.cursor ? parseInt(options.cursor, 10) : 0;

    const data = await this.fetchApi<SpotifyPlaylistTracksResponse>(
      `/playlists/${encodeURIComponent(collectionId)}/tracks?limit=${limit}&offset=${offset}`
    );

    return {
      items: data.items
        .filter((item) => item.track !== null)
        .map((item) => this.mapTrack(item)),
      nextCursor: data.next
        ? String(offset + limit)
        : undefined,
      total: data.total,
    };
  }

  async getRecentMedia(
    _since?: string,
    options?: FetchMediaOptions
  ): Promise<PaginatedResult<MediaItem>> {
    const limit = options?.limit ?? DEFAULT_LIMIT;
    const offset = options?.cursor ? parseInt(options.cursor, 10) : 0;

    const data = await this.fetchApi<{
      items: { track: SpotifyTrackItem['track']; played_at: string }[];
      next: string | null;
    }>(`/me/player/recently-played?limit=${limit}&after=${offset}`);

    return {
      items: data.items
        .filter((item) => item.track !== null)
        .map((item) => this.mapRecentTrack(item.track!)),
      nextCursor: data.next ? String(offset + limit) : undefined,
    };
  }

  override async search(
    query: string,
    options?: FetchMediaOptions
  ): Promise<PaginatedResult<MediaItem>> {
    const limit = options?.limit ?? DEFAULT_LIMIT;
    const offset = options?.cursor ? parseInt(options.cursor, 10) : 0;

    const data = await this.fetchApi<{
      tracks: {
        items: SpotifyTrackItem['track'][];
        next: string | null;
        total: number;
      };
    }>(
      `/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}&offset=${offset}`
    );

    return {
      items: data.tracks.items
        .filter((t): t is NonNullable<typeof t> => t !== null)
        .map((track) => this.mapRecentTrack(track)),
      nextCursor: data.tracks.next
        ? String(offset + limit)
        : undefined,
      total: data.tracks.total,
    };
  }

  private async fetchApi<T>(path: string): Promise<T> {
    if (!this.accessToken) {
      throw new Error('Spotify: not authenticated');
    }

    const response = await fetch(`${SPOTIFY_API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Spotify API error: ${response.status} ${response.statusText}`
      );
    }

    return response.json() as Promise<T>;
  }

  private pickThumbnail(images: SpotifyImage[]): string | undefined {
    if (images.length === 0) return undefined;
    // Prefer a medium-sized image (300px), fall back to first available
    const medium = images.find(
      (img) => img.width >= 200 && img.width <= 400
    );
    return (medium ?? images[0]).url;
  }

  private mapPlaylist(playlist: SpotifyPlaylistObject): MediaCollection {
    return {
      id: playlist.id,
      source: 'spotify',
      title: playlist.name,
      description: playlist.description || undefined,
      thumbnail: this.pickThumbnail(playlist.images),
      contentType: 'playlist',
      itemCount: playlist.tracks.total,
    };
  }

  private mapTrack(item: SpotifyTrackItem): MediaItem {
    const track = item.track!;
    return {
      id: track.id,
      source: 'spotify',
      title: track.name,
      sourceId: track.uri,
      thumbnail: this.pickThumbnail(track.album.images),
      duration: Math.round(track.duration_ms / 1000),
      artist: track.artists.map((a) => a.name).join(', '),
      publishedAt: item.added_at,
    };
  }

  private mapRecentTrack(track: NonNullable<SpotifyTrackItem['track']>): MediaItem {
    return {
      id: track.id,
      source: 'spotify',
      title: track.name,
      sourceId: track.uri,
      thumbnail: this.pickThumbnail(track.album.images),
      duration: Math.round(track.duration_ms / 1000),
      artist: track.artists.map((a) => a.name).join(', '),
    };
  }
}
