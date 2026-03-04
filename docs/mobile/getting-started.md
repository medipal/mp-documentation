# Getting Started

## Prerequisites

| Requirement    | Version | Notes                |
| -------------- | ------- | -------------------- |
| Node.js        | ≥ 20    | Required by Nuxt 4   |
| npm            | ≥ 11    | Bundled with Node.js |
| Xcode          | latest  | iOS builds only      |
| Android Studio | latest  | Android builds only  |

### GitHub Packages Access

Private `@medipal` npm packages are hosted on GitHub Packages. You need a GitHub Classic PAT with `read:packages` scope.

**Create `.npmrc` in the project root** (do not commit):

```ini
@medipal:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
```

Set `NPM_TOKEN` in your shell profile or `.env`.

## Installation

```bash
git clone https://github.com/medipal/mp-mobile-app.git
cd mp-mobile-app
npm install
```

## Environment Variables

Create a `.env` file at the project root (never committed):

```ini
# Backend API
API_URL=https://api.example.com

# Live update server
LIVE_UPDATE_API_URL=https://live-updates.example.com

# Analytics
TRACKER_API_URL=https://tracker.example.com
TRACKER_API_KEY=your-tracker-api-key

# Deep link payload decryption
CRYPTO_KEY=your-aes-key

# GitHub PAT for fetching the Nuxt layer (github:medipal/mp-nuxt-api-layer)
GIGET_AUTH=ghp_xxxxxxxxxxxx
```

| Variable              | Purpose                                                          |
| --------------------- | ---------------------------------------------------------------- |
| `API_URL`             | Main backend base URL                                            |
| `LIVE_UPDATE_API_URL` | Live update server URL                                           |
| `TRACKER_API_URL`     | Analytics API base URL                                           |
| `TRACKER_API_KEY`     | Analytics API authentication key                                 |
| `CRYPTO_KEY`          | AES key for decrypting deep link payloads                        |
| `GIGET_AUTH`          | GitHub PAT for fetching the private Nuxt layer at dev/build time |

## Development Commands

```bash
# Start dev server (localhost)
npm run dev

# Start dev server accessible on local network
npm run dev-host

# Start dev server with HTTPS (requires local cert in /cert/)
npm run dev-host-https

# Type-check and lint
npm run lint

# Format code
npm run format

# Run unit tests
npm run test
```

## HTTPS Local Development

Some Capacitor features require a secure context (notifications, service worker). Set up a local certificate using `mkcert`:

```bash
# macOS
brew install mkcert nss
mkcert -install

# Generate cert for your local IP
mkcert 192.168.1.x
# Rename outputs to cert.pem and cert-key.pem and place in /cert/
```

Then run `npm run dev-host-https` and configure `capacitor.config.ts` to point to your HTTPS dev server.

## Project Structure

The project uses **Nuxt 4's `app/` directory convention**. All application source lives under `app/`:

```
mp-mobile-app/
├── app/                        # All application source (Nuxt 4 srcDir)
│   ├── app.vue                 # Root component
│   ├── app.config.ts           # App runtime config (UI theme)
│   ├── api.config.ts           # Main API client setup
│   ├── tracker_api.config.ts   # Tracker API client setup
│   ├── assets/css/             # Global CSS + Tailwind @theme tokens
│   ├── components/             # Vue components (auto-imported)
│   ├── composables/            # Composables (auto-imported)
│   ├── database/               # Kysely instance + migrations
│   ├── layouts/                # Nuxt layouts
│   ├── pages/                  # Route pages (file-based routing)
│   ├── plugins/                # Nuxt plugins (boot sequence)
│   ├── stores/                 # Pinia stores (auto-imported)
│   ├── types/                  # TypeScript types
│   └── utils/                  # Utility functions (auto-imported)
│
├── i18n/locales/               # Translation JSON files (10 languages)
├── public/                     # Static assets (served as-is)
│   └── runners/background.js   # Background sync runner
├── scripts/                    # Build/generate scripts
├── capacitor.config.ts         # Capacitor configuration
├── nuxt.config.ts              # Nuxt configuration
└── docs/                       # This documentation (VitePress)
```

### Import Aliases

| Alias          | Resolves to  | Use for                                      |
| -------------- | ------------ | -------------------------------------------- |
| `@/` or `~/`   | `app/`       | Components, composables, stores, utils, etc. |
| `@@/` or `~~/` | project root | Files in `public/`, root-level configs       |

```ts
// Importing from app/
import { useSql } from "@/composables/useSql";

// Importing from project root (e.g., public/)
import data from "@@/public/assets/demo.json";
```

## Capacitor Development

```bash
# Build web assets, then sync to native projects
npm run generate
npx cap sync

# Open in native IDE
npx cap open ios      # Xcode
npx cap open android  # Android Studio

# Live reload on device (configure capacitor.config.ts server.url first)
npm run dev-host-https
npx cap run ios
```

## Common Issues

### `GIGET_AUTH` not set

```
Error: Failed to download template from https://codeload.github.com/...
```

Set `GIGET_AUTH` in your shell or `.env` file. The app fetches `github:medipal/mp-nuxt-api-layer` at dev/build time.

### SQLite not initializing in browser

`<jeep-sqlite>` requires IndexedDB + WASM. Use Chrome for development. Check the browser console for `jeep-sqlite` init errors.

### Deep links not working in browser

`medipal://` deep links require the native app (iOS/Android). Test them using the Capacitor simulator or a physical device.
