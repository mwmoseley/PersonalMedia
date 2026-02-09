# PersonalMedia

A personal one-stop-shop for consuming media, running entirely in the browser with no server required.

## Supported Media Sources

- **Spotify** — Playlists and playback via Spotify Web Playback SDK
- **YouTube** — Subscriptions and playback via YouTube IFrame Player API
- **Podcasts** — Episode discovery and playback via RSS feeds

## Features

### Unified Media Interface

Authenticate once with Spotify and YouTube, and PersonalMedia pulls in your playlists and subscriptions. Podcast feeds are added by RSS URL. From there, browse and queue media from a single interface.

### Playback Queue

Select media to build a playback queue. Media plays in order, with controls to skip, reorder, or clear the queue.

### Update Entries

Designate any podcast feed or YouTube subscription as an **update entry** with a configurable interval (e.g., every 30 minutes). While playing media:

1. Once per interval, the app checks each update entry for new content
2. If new content is found, it is inserted as the **next item** in the queue
3. After the update content finishes, the original queue resumes

This lets you stay current on fast-moving feeds without manually checking for new episodes or videos.

## Quick Start (no local setup)

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/mwmoseley/PersonalMedia)

Click the badge above to open the project in StackBlitz. It runs a full Node.js environment in your browser — no local install needed. Dependencies install automatically and the dev server starts on open.

Once it's running, add your API keys to `.env` in the StackBlitz file explorer (the template is created for you).

## Getting Started (local)

### Prerequisites

You need API credentials for Spotify and YouTube:

1. **Spotify** — Create an app at the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and note the Client ID. Add your local URL (e.g., `http://localhost:5173/callback`) as a redirect URI.
2. **YouTube** — Create a project in the [Google Cloud Console](https://console.cloud.google.com/), enable the YouTube Data API v3, and create OAuth 2.0 credentials (Web application type). Add the same local URL as an authorized redirect URI.

### Configuration

Create a `.env` file at the project root (never commit this):

```env
VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id
VITE_YOUTUBE_CLIENT_ID=your_google_client_id
```

### Install and Run

The setup script handles everything, including installing Node.js if needed:

```bash
./setup.sh
```

Or manually:

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (typically `http://localhost:5173`).

### Build for Production

```bash
npm run build
npm run preview   # preview the production build locally
```

The output in `dist/` is a static site that can be deployed to any static hosting provider (GitHub Pages, Netlify, Vercel, etc.) with no server component.

## Authentication

Both Spotify and YouTube use **OAuth 2.0 with PKCE** (Proof Key for Code Exchange), which is the standard for browser-based apps that cannot securely store a client secret. Tokens are stored in the browser's local storage and refreshed automatically.

## Technology

- TypeScript, React, Vite
- Spotify Web API and Web Playback SDK
- YouTube Data API v3 and IFrame Player API
- Browser-native audio (`HTMLAudioElement`) for podcast playback
- localStorage / IndexedDB for persisting state

## License

Private — not currently licensed for redistribution.
