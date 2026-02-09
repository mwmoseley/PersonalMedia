import { useState, useEffect, useCallback, useRef } from 'react';
import type { MediaItem, PaginatedResult } from '../types/media';
import type { MediaSource } from '../services/MediaSource';

interface UseRecentMedia {
  items: MediaItem[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
}

export function useRecentMedia(
  source: MediaSource | null,
  limit = 20
): UseRecentMedia {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const lastSourceRef = useRef<MediaSource | null>(null);

  // Fetch initial page when source becomes available/changes
  useEffect(() => {
    if (source === lastSourceRef.current) return;
    lastSourceRef.current = source;

    if (!source || !source.isAuthenticated()) {
      setItems([]);
      setError(null);
      setNextCursor(undefined);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    source
      .getRecentMedia(undefined, { limit })
      .then((result: PaginatedResult<MediaItem>) => {
        if (!cancelled) {
          setItems(result.items);
          setNextCursor(result.nextCursor);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [source, limit]);

  const loadMore = useCallback(async () => {
    if (!source || !nextCursor || isLoading) return;

    setIsLoading(true);
    try {
      const result = await source.getRecentMedia(undefined, {
        limit,
        cursor: nextCursor,
      });
      setItems((prev) => [...prev, ...result.items]);
      setNextCursor(result.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more');
    } finally {
      setIsLoading(false);
    }
  }, [source, nextCursor, isLoading, limit]);

  return {
    items,
    isLoading,
    error,
    hasMore: nextCursor !== undefined,
    loadMore,
  };
}
