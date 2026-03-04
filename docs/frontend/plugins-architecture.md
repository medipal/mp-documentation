# Plugin Architecture

Medipal Frontend uses **Nuxt Layers** as a plugin system. Each plugin is a standalone npm package that extends `mp-frontend` with new composables, components, pages, middleware, server routes, translations, and UI injections — without modifying the host app's code.

## How It Works

[Nuxt Layers](https://nuxt.com/docs/getting-started/layers) allow a Nuxt app to inherit configuration, components, composables, pages, and more from external packages. When a layer is listed in `nuxt.config.ts` → `extends`, Nuxt merges everything automatically.

```ts
// mp-frontend/nuxt.config.ts
export default defineNuxtConfig({
  extends: [
    "@medipal/mp-nuxt-api-layer", // API client composables
    "@medipal/mp-nuxt-msal-plugin", // Azure AD authentication
  ],
});
```

## Current Plugins

| Plugin      | Package                        | Purpose                                            |
| ----------- | ------------------------------ | -------------------------------------------------- |
| API Layer   | `@medipal/mp-nuxt-api-layer`   | Provides `useApi()` composable for typed API calls |
| MSAL Plugin | `@medipal/mp-nuxt-msal-plugin` | Azure AD OAuth login, token management             |

## Plugin Capabilities

A plugin can provide any of the following. All follow standard Nuxt conventions — files in the right directories are auto-imported or auto-registered.

| Capability     | Directory        | Auto-imported? | Description                             |
| -------------- | ---------------- | -------------- | --------------------------------------- |
| Composables    | `composables/`   | Yes            | Reactive functions (`use*` prefix)      |
| Components     | `components/`    | Yes            | Vue SFCs (PascalCase naming)            |
| Pages          | `pages/`         | Yes (routes)   | File-based routes merged into the app   |
| Plugins        | `plugins/`       | Yes (executed) | Initialization logic, slot registration |
| Middleware     | `middleware/`    | Yes            | Named or global route guards            |
| Server Routes  | `server/`        | Yes (routes)   | Nitro API endpoints                     |
| Utilities      | `utils/`         | Yes            | Pure functions                          |
| Translations   | `i18n/locales/`  | No (explicit)  | Merged via `i18n-merge` plugin          |
| CSS            | `assets/css/`    | No (explicit)  | Custom properties, styles               |
| Types          | `types/`         | No (import)    | Shared TypeScript interfaces            |
| Runtime Config | `nuxt.config.ts` | Merged         | `runtimeConfig.public` keys             |

## ExtendableSlot System

The ExtendableSlot system allows plugins to inject UI into specific locations in the host app without modifying its templates.

### How It Works

1. The host app defines **named slots** using the `<ExtendableSlot>` component:

```vue
<!-- mp-frontend/app/pages/login.vue -->
<ExtendableSlot
  name="login-actions"
  wrapper-class="flex gap-4 justify-between"
/>
```

2. Plugins **register components** into those slots at startup:

```ts
// plugins/extend.ts
import { useExtendableSlotStore } from "@/stores/extendableSlots";

export default defineNuxtPlugin(() => {
  const slots = useExtendableSlotStore();

  slots.register(
    "login-actions",
    defineComponent({
      setup() {
        return () =>
          h(UButton, {
            label: "Sign In with Microsoft",
            onClick: msAuth.signIn,
          });
      },
    }),
  );
});
```

### Store API

| Method     | Signature                               | Description                                  |
| ---------- | --------------------------------------- | -------------------------------------------- |
| `register` | `(key: string, component: any) => void` | Registers a component into a named slot      |
| `get`      | `(key: string) => any[]`                | Returns all components registered for a slot |

### Available Slots

| Slot Name       | Location              | Wrapper Class                | Purpose                                                |
| --------------- | --------------------- | ---------------------------- | ------------------------------------------------------ |
| `login-actions` | `app/pages/login.vue` | `flex gap-4 justify-between` | Alternative sign-in methods below the credentials form |

::: tip Adding New Slots
To expose a new injection point, add `<ExtendableSlot name="your-slot-name" />` in any template. Plugins can then register components into it.
:::

## Creating a New Plugin

Use the **[mp-frontend-plugin-template](https://github.com/medipal/mp-frontend-plugin-template)** as a starting point:

1. Fork or copy the template repository
2. Rename the package in `package.json`
3. Replace example code with your implementation
4. Delete unused directories
5. Publish via the included CI/CD workflows
6. Add to `mp-frontend/nuxt.config.ts` → `extends`

### Plugin Entry Point

Every plugin must have `nuxt.config.ts` as its main entry point:

```json
{
  "name": "@medipal/mp-nuxt-your-plugin",
  "main": "./nuxt.config.ts"
}
```

### i18n Integration

Plugins ship their own translation files and merge them at startup:

```ts
// plugins/i18n-merge.ts
import en_GB from "~/i18n/locales/en_GB.json";

export default defineNuxtPlugin(() => {
  const { $i18n } = useNuxtApp();
  $i18n.mergeLocaleMessage("en_GB", en_GB);
});
```

Namespace translation keys with `@pluginName` to avoid collisions:

```json
{
  "@myPlugin": {
    "button": { "label": "Click me" }
  }
}
```

### Runtime Configuration

Define plugin-specific config in `nuxt.config.ts`. The host app provides values via environment variables:

```ts
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      myPluginApiUrl: process.env.MY_PLUGIN_API_URL,
    },
  },
});
```

### Publishing

All plugins use the same CI/CD pattern — GitHub Actions workflows that delegate to `medipal/mp-github-actions`:

- Tag push (`v*`) → GitHub Release → Publish to GitHub Packages
- Push to `staging` → Pre-release → Publish staging package
