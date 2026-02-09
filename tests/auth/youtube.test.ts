import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleYouTubeCallback,
  getYouTubeToken,
  clearYouTubeAuth,
  hasYouTubeTokens,
} from '../../src/auth/youtube';

// Mock import.meta.env
vi.stubEnv('VITE_YOUTUBE_CLIENT_ID', 'test-client-id');

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('YouTube Auth', () => {
  describe('handleYouTubeCallback', () => {
    it('exchanges code for tokens and stores them', async () => {
      sessionStorage.setItem('youtube_code_verifier', 'test-verifier');

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'yt-access-token',
          refresh_token: 'yt-refresh-token',
          expires_in: 3600,
        }),
      }));

      const tokens = await handleYouTubeCallback('auth-code-123');

      expect(tokens.accessToken).toBe('yt-access-token');
      expect(tokens.refreshToken).toBe('yt-refresh-token');
      expect(hasYouTubeTokens()).toBe(true);

      // Verifier should be cleaned up
      expect(sessionStorage.getItem('youtube_code_verifier')).toBeNull();
    });

    it('throws if code verifier is missing', async () => {
      await expect(
        handleYouTubeCallback('auth-code-123')
      ).rejects.toThrow('Missing PKCE code verifier');
    });

    it('throws on token exchange failure', async () => {
      sessionStorage.setItem('youtube_code_verifier', 'test-verifier');

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('invalid_grant'),
      }));

      await expect(
        handleYouTubeCallback('bad-code')
      ).rejects.toThrow('token exchange failed');
    });
  });

  describe('getYouTubeToken', () => {
    it('returns null when no tokens are stored', async () => {
      const token = await getYouTubeToken();
      expect(token).toBeNull();
    });

    it('returns the stored access token if not expired', async () => {
      localStorage.setItem('youtube_tokens', JSON.stringify({
        accessToken: 'valid-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 30 * 60 * 1000, // 30 min from now
      }));

      const token = await getYouTubeToken();
      expect(token).toBe('valid-token');
    });

    it('refreshes the token if expiring within 5 minutes', async () => {
      localStorage.setItem('youtube_tokens', JSON.stringify({
        accessToken: 'old-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 2 * 60 * 1000, // 2 min from now
      }));

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          access_token: 'new-token',
          expires_in: 3600,
        }),
      }));

      const token = await getYouTubeToken();
      expect(token).toBe('new-token');
    });

    it('clears auth if refresh fails', async () => {
      localStorage.setItem('youtube_tokens', JSON.stringify({
        accessToken: 'old-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 2 * 60 * 1000,
      }));

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      }));

      const token = await getYouTubeToken();
      expect(token).toBeNull();
      expect(hasYouTubeTokens()).toBe(false);
    });

    it('clears auth if no refresh token available and token expired', async () => {
      localStorage.setItem('youtube_tokens', JSON.stringify({
        accessToken: 'old-token',
        expiresAt: Date.now() + 2 * 60 * 1000,
      }));

      const token = await getYouTubeToken();
      expect(token).toBeNull();
      expect(hasYouTubeTokens()).toBe(false);
    });
  });

  describe('clearYouTubeAuth', () => {
    it('removes stored tokens', () => {
      localStorage.setItem('youtube_tokens', '{}');
      clearYouTubeAuth();
      expect(hasYouTubeTokens()).toBe(false);
    });
  });
});
