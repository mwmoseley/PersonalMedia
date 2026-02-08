# CLAUDE.md — PersonalMedia

## Project Overview

PersonalMedia is a browser-only SPA for consuming media from Spotify, YouTube, and podcast RSS feeds. There is **no server component** — the app runs entirely as static files served by a dev server or static host.

- **Author**: mwmoseley (Mark Moseley)
- **Repository**: `mwmoseley/PersonalMedia`

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript |
| Framework | React |
| Build | Vite |
| Package manager | npm |
| Spotify | Web API + Web Playback SDK |
| YouTube | Data API v3 + IFrame Player API |
| Podcasts | RSS feed parsing, `HTMLAudioElement` for playback |
| Auth | OAuth 2.0 with PKCE (no client secret) |
| Persistence | localStorage / IndexedDB |
| Testing | Vitest + React Testing Library |

## Build & Run Commands

```bash
npm install          # install dependencies
npm run dev          # start Vite dev server (typically http://localhost:5173)
npm run build        # production build to dist/
npm run preview      # preview production build locally
npm test             # run tests via Vitest
npm run lint         # lint with ESLint
```

## Project Structure

```
PersonalMedia/
├── src/
│   ├── main.tsx                 # app entry point
│   ├── App.tsx                  # root component, routing
│   ├── auth/                    # OAuth PKCE flows for Spotify and YouTube
│   ├── services/                # API clients
│   │   ├── spotify.ts           # Spotify Web API wrapper
│   │   ├── youtube.ts           # YouTube Data API wrapper
│   │   └── podcast.ts           # RSS feed fetching and parsing
│   ├── player/                  # playback engines
│   │   ├── SpotifyPlayer.ts     # Spotify Web Playback SDK integration
│   │   ├── YouTubePlayer.ts     # YouTube IFrame Player API integration
│   │   └── PodcastPlayer.ts     # HTMLAudioElement wrapper
│   ├── queue/                   # playback queue and update-entry logic
│   ├── components/              # React UI components
│   ├── hooks/                   # custom React hooks
│   ├── types/                   # shared TypeScript type definitions
│   └── utils/                   # general utilities
├── public/                      # static assets
├── tests/                       # test files (mirrors src/ structure)
├── index.html                   # Vite HTML entry point
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .env                         # local secrets (NEVER commit)
├── .gitignore
├── README.md
└── CLAUDE.md
```

## Architecture

### No Server Requirement

The entire app is static files. All API communication happens directly from the browser:

- Spotify and YouTube APIs are called with OAuth tokens obtained via PKCE
- Podcast RSS feeds are fetched directly (may require a CORS proxy for feeds that don't set permissive headers)
- All state (tokens, queue, preferences) persists in the browser via localStorage or IndexedDB

### Authentication

Both Spotify and YouTube use **OAuth 2.0 Authorization Code with PKCE**. This is the correct flow for public clients (browser apps) that cannot store a client secret.

Flow:
1. Generate a random `code_verifier` and derive `code_challenge` (SHA-256)
2. Redirect user to provider's authorize endpoint with `code_challenge`
3. On callback, exchange the authorization code + `code_verifier` for tokens
4. Store tokens in localStorage; refresh before expiry

**Spotify specifics:**
- Auth endpoint: `https://accounts.spotify.com/authorize`
- Token endpoint: `https://accounts.spotify.com/api/token`
- Scopes needed: `streaming`, `user-read-email`, `user-read-private`, `playlist-read-private`, `playlist-read-collaborative`
- Web Playback SDK requires a Spotify Premium account

**YouTube/Google specifics:**
- Auth endpoint: `https://accounts.google.com/o/oauth2/v2/auth`
- Token endpoint: `https://oauth2.googleapis.com/token`
- Scopes needed: `https://www.googleapis.com/auth/youtube.readonly`

### Media Sources

**Spotify** — After auth, fetch the user's playlists via the Web API. Playback uses the Web Playback SDK, which registers the browser as a Spotify Connect device.

**YouTube** — After auth, fetch the user's subscriptions and their uploaded-videos playlists via the Data API. Playback uses the IFrame Player API (no additional auth needed for playback).

**Podcasts** — User adds feeds by RSS URL. The app fetches and parses the feed XML to extract episode metadata and audio URLs. Playback uses a standard `HTMLAudioElement`. CORS may require routing fetches through a public proxy (e.g., a configurable CORS proxy URL stored in settings).

### Playback Queue

The queue is an ordered list of media items, each of which knows its source type (Spotify / YouTube / Podcast). When an item finishes, the queue advances and hands off to the appropriate player engine.

### Update Entries

A podcast feed or YouTube subscription can be designated as an **update entry** with a time interval (e.g., 30 minutes).

Behavior during playback:
1. A timer fires once per interval
2. On each tick, the app checks all update entries for content newer than the last-seen timestamp
3. If new content is found, it is inserted immediately after the currently playing item in the queue
4. Once the current item finishes, the update content plays next
5. After the update content completes, the original queue resumes from where it left off

The last-seen timestamp for each update entry is persisted so checks survive page reloads.

## Key Domain Types

```typescript
// A media item that can be queued for playback
interface MediaItem {
  id: string;
  source: 'spotify' | 'youtube' | 'podcast';
  title: string;
  sourceId: string;       // Spotify track URI, YouTube video ID, or audio URL
  thumbnail?: string;
  duration?: number;       // seconds
}

// A source that is polled for new content during playback
interface UpdateEntry {
  id: string;
  source: 'youtube' | 'podcast';
  sourceId: string;        // YouTube channel/playlist ID or RSS feed URL
  label: string;
  intervalMinutes: number;
  lastChecked: string;     // ISO timestamp
  lastSeenItemId: string;  // to detect new content
}
```

## Development Workflow

### Git Conventions

- Feature branches: `claude/<description>-<id>`
- Commit messages should be clear and descriptive

### Environment Variables

Required in `.env` (never committed):

```env
VITE_SPOTIFY_CLIENT_ID=...
VITE_YOUTUBE_CLIENT_ID=...
```

Optional:

```env
VITE_CORS_PROXY_URL=...   # proxy for podcast RSS feeds if needed
```

All env vars accessed by the app must be prefixed with `VITE_` (Vite convention).

### VS Code Integration

The .gitignore allows these VS Code files to be committed:
- `.vscode/settings.json`
- `.vscode/tasks.json`
- `.vscode/launch.json`
- `.vscode/extensions.json`
- `.vscode/*.code-snippets`

## Conventions for AI Assistants

### Code style

- TypeScript strict mode — no `any` unless absolutely unavoidable
- Functional React components with hooks; no class components
- Named exports (not default exports) for all modules except page-level route components
- Use `camelCase` for variables/functions, `PascalCase` for components/types/interfaces
- Keep components focused — split when a file exceeds ~200 lines
- Colocate component-specific hooks and types with the component; shared ones go in `hooks/` or `types/`

### State management

- React Context for auth state and player state
- Keep queue state in a dedicated context or reducer
- Avoid external state management libraries unless complexity demands it

### API calls

- Wrap each external API in a service module under `services/`
- All API functions should be `async` and return typed results
- Handle token refresh transparently inside service modules

### Testing

- Test files live in `tests/`, mirroring the `src/` directory structure
- Name test files `<module>.test.ts` or `<Component>.test.tsx`
- Use descriptive test names: `should <expected behavior> when <condition>`
- Test business logic (queue manipulation, update-entry polling, auth flows) thoroughly
- Use mocks for external API calls — never hit real Spotify/YouTube/RSS endpoints in tests

### Security

- Never commit `.env`, OAuth tokens, or API keys
- Use PKCE for all OAuth flows — never embed client secrets in browser code
- Validate and sanitize RSS feed content before rendering (XSS risk from feed HTML)
- Store tokens in localStorage with appropriate expiry handling
- CSP headers should be configured at the hosting level for production deploys
