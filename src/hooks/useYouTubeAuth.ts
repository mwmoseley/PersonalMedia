import { useState, useEffect, useCallback } from 'react';
import {
  startYouTubeAuth,
  handleYouTubeCallback,
  getYouTubeToken,
  clearYouTubeAuth,
  hasYouTubeTokens,
} from '../auth/youtube';

interface UseYouTubeAuth {
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => void;
}

export function useYouTubeAuth(): UseYouTubeAuth {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Check for OAuth callback
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');

      if (code) {
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
        try {
          const tokens = await handleYouTubeCallback(code);
          if (!cancelled) setToken(tokens.accessToken);
        } catch (err) {
          console.error('YouTube auth callback failed:', err);
        }
      } else if (hasYouTubeTokens()) {
        const t = await getYouTubeToken();
        if (!cancelled) setToken(t);
      }

      if (!cancelled) setIsLoading(false);
    }

    init();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async () => {
    await startYouTubeAuth();
  }, []);

  const logout = useCallback(() => {
    clearYouTubeAuth();
    setToken(null);
  }, []);

  return {
    token,
    isAuthenticated: token !== null,
    isLoading,
    login,
    logout,
  };
}
