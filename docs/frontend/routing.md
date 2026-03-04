# Routing

## File-Based Routing

Routes are derived from the `app/pages/` directory structure using Nuxt's file-based routing. Dynamic segments use `[param]` naming. `_partial/` subdirectories contain sub-page view fragments that are not standalone routes.

## Route Map

```
/                                     pages/index/index.vue              Dashboard
  /_partial/dashboard.vue             — dashboard sub-view
  /_partial/folders.vue               — folders sub-view
  /_partial/questionnaires.vue        — questionnaires sub-view

/login                                pages/login.vue
/forgot-password                      pages/forgot-password.vue
/reset-password                       pages/reset-password.vue
/change-password                      pages/change-password.vue
/mfa-setup                            pages/mfa-setup.vue
/mfa-verify                           pages/mfa-verify.vue
/mfa-setup-success                    pages/mfa-setup-success.vue
/oauth/callback                       (handled by plugin)

/settings                             pages/settings.vue
/enrollments                          pages/enrollments/index.vue
/patients                             pages/patients/index.vue

/[id]                                 pages/[id].vue                     Folder wrapper (NuxtPage)
/[id]/                                pages/[id]/index.vue               Folder content
/[id]/config                          pages/[id]/config.vue              Folder config wrapper
/[id]/config/access                   _partial/access.vue
/[id]/config/advanced                 _partial/advanced.vue
/[id]/config/general                  _partial/general.vue

/questionnaire/[id]                   pages/questionnaire/[id].vue       Questionnaire wrapper (NuxtPage)
/questionnaire/[id]/config            pages/questionnaire/[id]/config.vue
/questionnaire/[id]/config/access     _partial/access.vue
/questionnaire/[id]/config/engine     _partial/engine.vue
/questionnaire/[id]/config/general    _partial/general.vue
/questionnaire/[id]/config/languages  _partial/languages.vue
/questionnaire/[id]/config/legal      _partial/legal.vue
/questionnaire/[id]/designer          pages/questionnaire/[id]/designer.vue
/questionnaire/[id]/enrollments       pages/questionnaire/[id]/enrollments.vue
/questionnaire/[id]/results           pages/questionnaire/[id]/results.vue
/questionnaire/[id]/scheduling        pages/questionnaire/[id]/scheduling.vue

/patient/[id]                         pages/patient/[id].vue             Patient wrapper (NuxtPage)
/patient/[id]/                        pages/patient/[id]/index.vue
/patient/[id]/enrollments             pages/patient/[id]/enrollments.vue
/patient/[id]/results                 pages/patient/[id]/results.vue
/patient/[id]/submissions             pages/patient/[id]/submissions/index.vue
/patient/[id]/submissions/[submission_id]  pages/patient/[id]/submissions/[submission_id].vue

/user/[id]                            pages/user/[id].vue                User wrapper (NuxtPage)
/user/[id]/config                     pages/user/[id]/config.vue
/user/[id]/config/access              pages/user/[id]/config/_partial/access.vue

/admin-panel                          pages/admin-panel.vue
/admin-panel/engines                  pages/admin-panel/engines.vue
/admin-panel/system                   pages/admin-panel/system.vue
/admin-panel/users                    pages/admin-panel/users.vue
```

::: tip Wrapper Pages
`[id].vue` and `questionnaire/[id].vue` are wrapper pages that use `<NuxtPage>` to render child routes within a shared layout shell. The `_partial/` subdirectories contain sub-views embedded by the parent page — they are not independently navigable.
:::

## Layouts

### `default.vue` — Authenticated Shell

Used by all pages that require authentication. Provides:

- `<Sidepanel>` — collapsible left navigation
- `<NaviBar>` — top bar
- `<PageHeader>` — contextual title, breadcrumbs, tabs
- `<slot>` — page content

Props passed from pages to `default.vue`:

```typescript
{
  data: Object; // entity data (questionnaire, folder, patient, etc.)
  tabs: Array; // navigation tabs for PageHeader
  icon: String;
  title: String;
  subtitle: String;
  label: Object;
  backPath: String;
  loading: Boolean;
}
```

RTL support: `default.vue` sets `<html dir="rtl">` for Arabic (`ar_SA`) and other RTL locales.

### `empty.vue` — Unauthenticated Shell

Used by login, register, forgot-password, and MFA pages. Features an SVG wave background and no navigation chrome.

## `useRouting()` Composable

`app/composables/useRouting.ts` — typed wrapper around Vue Router:

```typescript
const { navigateTo, route, router } = useRouting();

// Navigate with type-safe route names:
navigateTo("questionnaire-id-designer", { id: "abc-123" });
navigateTo("index", {});
navigateTo("patient-id", { id: patientId });
```

Route names follow Nuxt's auto-generated convention from the file path structure (e.g., `questionnaire-id-designer`, `patient-id`, etc.).

## Global Middleware

`app/middleware/auth.global.ts` runs before every client-side navigation. See [Authentication](./authentication) for the full middleware logic.

## Sidepanel Navigation

The sidepanel menu is defined in `app/config/` as a static JSON structure provided via `nuxtApp.$definitions.sidepanel`. Navigation is handled in `default.vue`:

```typescript
const handleSelect = (item: any) => {
  if (item.action) {
    item.action();
    return;
  }
  router.replace({
    name: item.path,
    params: item.id ? { id: item.id } : null,
  });
};
```

## Experimental: `restoreState`

```typescript
// nuxt.config.ts
experimental: {
  restoreState: true,
}
```

Nuxt will attempt to restore page component state on back navigation. Keep this in mind when designing page-level state that should not persist across navigations.
