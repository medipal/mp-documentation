# Pages & Routing

## Route Structure

```
app/pages/
├── index.vue                    # Root layout wrapper (tab container)
├── index/
│   ├── index.vue                # Home tab (/)
│   ├── records.vue              # Records tab (/records)
│   └── settings.vue             # Settings tab (/settings)
├── authenticate/
│   └── [token].vue              # Deep link authentication
└── enrollment/
    └── [id].vue                 # Enrollment consent flow
```

## Pages

### `app/pages/index.vue` — Root Layout

Wraps all tab pages. Responsible for:

- Tab slide transitions (slide-left / slide-right based on tab index comparison)
- `<keep-alive>` to preserve scroll state across tab switches
- Syncing `device.userLocale` from Pinia to the `@nuxtjs/i18n` plugin

### `app/pages/index/index.vue` — Home Tab

Displays enrollment cards (`QuestionnaireBlock`) for all active enrollments. Shows a notification permission banner if permissions are not granted. This is the entry point for starting questionnaires.

### `app/pages/index/records.vue` — Records Tab

Device authentication management (login/logout), tenant list, policy/terms viewer, and submission history.

### `app/pages/index/settings.vue` — Settings Tab

User preferences: locale selection, color mode (light/dark/system), and accessibility zoom level.

### `app/pages/authenticate/[token].vue` — Authentication

Handles deep link authentication:

1. Receives the AES-encrypted `token` from the deep link URL
2. Displays terms and conditions
3. On user acceptance: calls `device.authenticate()` to register device with tenant

### `app/pages/enrollment/[id].vue` — Enrollment Consent

Consent flow for a specific enrollment. Shows enrollment details and calls `device.acceptEnrollment()` on confirmation.

## Special Pages

### Debug Page

Not a registered route. Accessible via **Easter egg**: tap `Logo.vue` 6 times. Shows `PendingSubmissionsTable` and `SqlTable` debug components.

## Navigation

### Bottom Tab Bar

The `NavMenu` component renders three tabs. Tab order is significant — it determines the slide transition direction:

| Index | Tab      | Route       |
| ----- | -------- | ----------- |
| 0     | Home     | `/`         |
| 1     | Records  | `/records`  |
| 2     | Settings | `/settings` |

Navigating to a higher-index tab → slides left. Navigating to a lower-index tab → slides right.

### Programmatic Navigation

Use `useRouting()` composable instead of calling `useRouter()` directly:

```ts
const { navigateTo } = useRouting();
navigateTo("/settings");
```

## i18n Routing

- **Strategy: `no_prefix`** — locale is NOT included in the URL path (`/` not `/en/`)
- Current locale is stored in Pinia (`device.userLocale`) and synced to the i18n plugin in `app/pages/index.vue`

## Deep Links

Deep links (`medipal://`) bypass the Nuxt router entirely. They are handled by `app/plugins/deepLink.ts`:

```
medipal://authenticate?payload=<encrypted>
    → app/plugins/deepLink.ts
    → useHandleAuthenticationLink()
    → navigates to app/pages/authenticate/[token].vue
```
