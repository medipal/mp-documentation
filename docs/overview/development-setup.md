# Development Setup

General prerequisites and setup instructions for working with the Medipal platform.

## Prerequisites

- Node.js 20+
- Python 3.12+
- Docker & Docker Compose
- PostgreSQL 16+
- Git

## Clone the Repositories

Clone the repositories you need to work with from the `medipal` GitHub organisation.

For repositories that use git submodules (`mp-mobile-app`, `mp-mobile-app-builder`), initialise submodules after cloning:

```bash
git clone <repo-url>
cd <repo-name>
git submodule update --init --recursive
```

This pulls the native iOS (`mp-mobile-app-ios-native`) and Android (`mp-mobile-app-android-native`) projects into the `ios/` and `android/` directories.

## GitHub Packages

Many `@medipal/*` npm packages are published to GitHub Packages. To install them, configure your npm registry:

1. Create a GitHub personal access token (classic) with `read:packages` scope
2. Add the following to your project-level `.npmrc`:

```
@medipal:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_TOKEN
```

This is required for packages like `@medipal/mp-frontend-api`, `@medipal/mp-mobile-app-api`, `@medipal/mp-typescript-api-validation`, and others.

## Environment Variables

Each service has its own `.env` file. Refer to the `.env.example` in each repository for the required variables.

## Running Locally

Refer to the individual service documentation for running each component:

- [Backend](/backend/) — FastAPI server
- [Frontend](/frontend/setup) — Nuxt web application
- [Mobile](/mobile/getting-started) — Capacitor mobile app
