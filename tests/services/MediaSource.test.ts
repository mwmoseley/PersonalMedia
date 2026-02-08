import { describe, it, expect } from 'vitest';
import { MediaSource } from '../../src/services/MediaSource';
import type {
  MediaSourceType,
  MediaContentType,
  MediaItem,
  MediaCollection,
  FetchMediaOptions,
  PaginatedResult,
} from '../../src/types/media';

/** Minimal concrete subclass that does NOT support updates. */
class NonUpdateSource extends MediaSource {
  readonly sourceType: MediaSourceType = 'spotify';
  readonly displayName = 'TestNonUpdate';
  readonly isUpdateSource = false;
  readonly defaultUpdateIntervalMinutes = 0;
  readonly requiresAuth = true;

  private authed = false;

  setAuthed(val: boolean) {
    this.authed = val;
  }

  getAvailableMediaTypes(): MediaContentType[] {
    return ['track', 'playlist'];
  }

  isAuthenticated(): boolean {
    return this.authed;
  }

  async getAvailableMedia(
    _options?: FetchMediaOptions
  ): Promise<PaginatedResult<MediaCollection>> {
    return { items: [], total: 0 };
  }

  async getCollectionItems(
    _collectionId: string,
    _options?: FetchMediaOptions
  ): Promise<PaginatedResult<MediaItem>> {
    return { items: [], total: 0 };
  }

  async getRecentMedia(
    _since?: string,
    _options?: FetchMediaOptions
  ): Promise<PaginatedResult<MediaItem>> {
    return { items: [], total: 0 };
  }
}

/** Concrete subclass that DOES support updates. */
class UpdateableSource extends MediaSource {
  readonly sourceType: MediaSourceType = 'youtube';
  readonly displayName = 'TestUpdateable';
  readonly isUpdateSource = true;
  readonly defaultUpdateIntervalMinutes = 15;
  readonly requiresAuth = false;

  public fetchUpdatesCalled = false;
  public lastCollectionId: string | null = null;
  public lastSeenId: string | null = null;
  public mockUpdates: MediaItem[] = [];

  getAvailableMediaTypes(): MediaContentType[] {
    return ['video'];
  }

  isAuthenticated(): boolean {
    return true;
  }

  async getAvailableMedia(): Promise<PaginatedResult<MediaCollection>> {
    return { items: [], total: 0 };
  }

  async getCollectionItems(): Promise<PaginatedResult<MediaItem>> {
    return { items: [], total: 0 };
  }

  async getRecentMedia(): Promise<PaginatedResult<MediaItem>> {
    return { items: [], total: 0 };
  }

  protected override async fetchUpdatesSince(
    collectionId: string,
    lastSeenItemId: string
  ): Promise<MediaItem[]> {
    this.fetchUpdatesCalled = true;
    this.lastCollectionId = collectionId;
    this.lastSeenId = lastSeenItemId;
    return this.mockUpdates;
  }
}

describe('MediaSource (abstract base class)', () => {
  describe('non-update source', () => {
    it('exposes the correct source properties', () => {
      const source = new NonUpdateSource();
      expect(source.sourceType).toBe('spotify');
      expect(source.displayName).toBe('TestNonUpdate');
      expect(source.isUpdateSource).toBe(false);
      expect(source.defaultUpdateIntervalMinutes).toBe(0);
      expect(source.requiresAuth).toBe(true);
    });

    it('returns available media types', () => {
      const source = new NonUpdateSource();
      expect(source.getAvailableMediaTypes()).toEqual(['track', 'playlist']);
    });

    it('tracks authentication state', () => {
      const source = new NonUpdateSource();
      expect(source.isAuthenticated()).toBe(false);
      source.setAuthed(true);
      expect(source.isAuthenticated()).toBe(true);
    });

    it('throws when checkForUpdates is called on a non-update source', async () => {
      const source = new NonUpdateSource();
      await expect(
        source.checkForUpdates('col-1', 'item-1')
      ).rejects.toThrow('does not support update polling');
    });

    it('search returns empty result by default', async () => {
      const source = new NonUpdateSource();
      const result = await source.search('test query');
      expect(result.items).toEqual([]);
    });
  });

  describe('update source', () => {
    it('exposes the correct source properties', () => {
      const source = new UpdateableSource();
      expect(source.sourceType).toBe('youtube');
      expect(source.displayName).toBe('TestUpdateable');
      expect(source.isUpdateSource).toBe(true);
      expect(source.defaultUpdateIntervalMinutes).toBe(15);
      expect(source.requiresAuth).toBe(false);
    });

    it('delegates checkForUpdates to fetchUpdatesSince', async () => {
      const source = new UpdateableSource();
      const mockItem: MediaItem = {
        id: 'new-1',
        source: 'youtube',
        title: 'New Video',
        sourceId: 'vid-123',
      };
      source.mockUpdates = [mockItem];

      const result = await source.checkForUpdates('channel-1', 'last-seen-1');

      expect(source.fetchUpdatesCalled).toBe(true);
      expect(source.lastCollectionId).toBe('channel-1');
      expect(source.lastSeenId).toBe('last-seen-1');
      expect(result).toEqual([mockItem]);
    });

    it('returns empty array when no new updates', async () => {
      const source = new UpdateableSource();
      source.mockUpdates = [];

      const result = await source.checkForUpdates('channel-1', 'latest-item');
      expect(result).toEqual([]);
    });
  });
});
