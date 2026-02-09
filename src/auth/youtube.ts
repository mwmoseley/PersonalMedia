const YOUTUBE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const YOUTUBE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const YOUTUBE_SCOPES = 'https://www.googleapis.com/auth/youtube.readonly';

const STORAGE_KEY_TOKENS = 'youtube_tokens';
const STORAGE_KEY_VERIFIER = 'youtube_code_verifier';

interface StoredTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // epoch ms
}

function getClientId(): string {
  const id = import.meta.env.VITE_YOUTUBE_CLIENT_ID;
  if (!id) {
    throw new Error(
      'VITE_YOUTUBE_CLIENT_ID is not set. Add it to your .env file.'
    );
  }
  return id;
}

function getRedirectUri(): string {
  return `${window.location.origin}/callback`;
}

/** Generate a random string for the PKCE code verifier. */
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Derive the S256 code challenge from a code verifier. */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Redirect the user to Google's OAuth consent screen. */
export async function startYouTubeAuth(): Promise<void> {
  const verifier = generateCodeVerifier();
  sessionStorage.setItem(STORAGE_KEY_VERIFIER, verifier);

  const challenge = await generateCodeChallenge(verifier);

  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: YOUTUBE_SCOPES,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
  });

  window.location.href = `${YOUTUBE_AUTH_ENDPOINT}?${params}`;
}

/** Exchange the authorization code from the callback for tokens. */
export async function handleYouTubeCallback(code: string): Promise<StoredTokens> {
  const verifier = sessionStorage.getItem(STORAGE_KEY_VERIFIER);
  if (!verifier) {
    throw new Error('Missing PKCE code verifier — did the auth flow start correctly?');
  }
  sessionStorage.removeItem(STORAGE_KEY_VERIFIER);

  const response = await fetch(YOUTUBE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: getClientId(),
      code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: getRedirectUri(),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`YouTube token exchange failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  const tokens: StoredTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  localStorage.setItem(STORAGE_KEY_TOKENS, JSON.stringify(tokens));
  return tokens;
}

/** Get a valid access token, refreshing if needed. Returns null if not logged in. */
export async function getYouTubeToken(): Promise<string | null> {
  const raw = localStorage.getItem(STORAGE_KEY_TOKENS);
  if (!raw) return null;

  const tokens: StoredTokens = JSON.parse(raw);

  // If token expires within 5 minutes, refresh it
  if (tokens.expiresAt - Date.now() < 5 * 60 * 1000) {
    if (!tokens.refreshToken) {
      clearYouTubeAuth();
      return null;
    }

    try {
      const response = await fetch(YOUTUBE_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: getClientId(),
          refresh_token: tokens.refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        clearYouTubeAuth();
        return null;
      }

      const data = await response.json();
      tokens.accessToken = data.access_token;
      tokens.expiresAt = Date.now() + data.expires_in * 1000;
      localStorage.setItem(STORAGE_KEY_TOKENS, JSON.stringify(tokens));
    } catch {
      clearYouTubeAuth();
      return null;
    }
  }

  return tokens.accessToken;
}

/** Clear stored YouTube auth tokens. */
export function clearYouTubeAuth(): void {
  localStorage.removeItem(STORAGE_KEY_TOKENS);
}

/** Whether we have stored YouTube tokens (may be expired). */
export function hasYouTubeTokens(): boolean {
  return localStorage.getItem(STORAGE_KEY_TOKENS) !== null;
}
