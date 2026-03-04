# Questionnaire Core & Engine

## Overview

The questionnaire system is split into two separate libraries:

- **mp-questionnaire-core-builder** — a Vue 3 library providing questionnaire logic, navigation, scoring, i18n, and UI components. Built as a self-contained JS+CSS bundle and hosted on a CDN.
- **mp-questionnaire-engine-builder** — a full Vue 3 Vite app that downloads core at build time and outputs a single self-contained HTML file. This file is deployed to a CDN and loaded in an `<iframe>` by the host application.

### Why This Architecture Exists

A naive approach would be to bundle the questionnaire UI directly into the mobile app. This creates several hard problems:

- **App store latency**: updating a questionnaire renderer requires a full mobile app release (days to weeks of review).
- **Framework lock-in**: the host app is Nuxt/Vue; clinical partners or research institutions may need to embed questionnaires in React, plain HTML, or a native WebView.
- **CSS interference**: the host app's global styles bleed into questionnaire UI and vice versa when they share a DOM.
- **Version coupling**: rolling out a new questionnaire schema format would force every host to upgrade simultaneously.

The iframe + CDN architecture solves all of these:

- The engine is a **static HTML artifact** — it can be updated and deployed without touching the mobile app.
- The **postMessage API** is framework-agnostic; any host can integrate.
- The `<iframe>` boundary enforces CSS and JS isolation by design.
- The questionnaire payload carries a **reference to the engine version** it needs; the host fetches exactly that version.

The guiding principle: **compile once, run with any payload**.

---

## System Architecture

```
mp-questionnaire-core-builder
        │
        │  npm run build
        ▼
CDN (JS bundle + CSS bundle + manifest.json)
        │
        │  downloaded at engine build time
        ▼
mp-questionnaire-engine-builder
        │
        │  npm run build  (vite-plugin-singlefile inlines everything)
        ▼
dist/questionnaire-engine-X.Y.Z/index.html   ← single self-contained file
        │
        │  uploaded to CDN
        │  loaded via <iframe src="...">
        ▼
Host application  (mp-mobile-app, React app, plain HTML, WebView, …)
        │
        │  window.postMessage  ←──────────────────────────────┐
        ▼                                                      │
QuestionnaireEngineRenderer.vue                                │
  sends:  { type: 'init',    data: { questionnaire, config } } │
  recv:   { type: 'submit',  data: { … } }                     │
  recv:   { type: 'exit' }                                     │
  recv:   { type: 'haptics', data: { type: 'light' | … } }    │
        │                                                      │
        └──────────────────────────────────────────────────────┘
```

---

## Questionnaire Core (`mp-questionnaire-core-builder`)

### What it is

Core is **not an npm package** — it is a Vite-built ESM bundle hosted on a CDN. The engine downloads it at build time so the final HTML file is entirely self-contained.

Build output:

```
dist/
  {ID}-{VERSION}.js       ← ESM bundle (all components, logic, i18n)
  {ID}-{VERSION}.css      ← inlined styles (no external font/icon requests)
  manifest.json           ← { id, version, entry, styles[] }
```

The bundle exposes three public exports:

| Export              | Type          | Purpose                                         |
| ------------------- | ------------- | ----------------------------------------------- |
| `init(config)`      | function      | Bootstrap the Vue app and mount into a DOM node |
| `mount(el, config)` | function      | Mount an already-initialised instance           |
| `QuestionnaireCore` | Vue component | Use directly when embedding in another Vue app  |

All assets — CSS, icons, i18n strings — are inlined. The bundle makes zero network requests at runtime.

### Internal State (`QuestionnaireStore.ts`)

The core maintains all questionnaire state in a Pinia store:

| State slice                    | Description                                                        |
| ------------------------------ | ------------------------------------------------------------------ |
| Navigation stack               | History-based routing — each `next()` pushes, `back()` pops        |
| Answer collection              | Keyed by question ID; updated on every input event                 |
| Submit payload assembly        | Built incrementally; finalised on the last question                |
| Per-question scoring snapshots | Computed at each navigation step and included in the final payload |

### Question Navigation & Transitions

Navigation is history-based (stack push/pop) rather than index-based. This supports non-linear flows where the next question depends on previous answers.

Conditional branching uses trigger/condition expressions evaluated via `new Function()` with an explicit answer context object injected as the only variable. Expressions are authored in the questionnaire JSON schema and have no access to the surrounding application scope.

### Scoring

After each navigation step the store computes a scoring snapshot for the current state of answers. All snapshots are included in the final `submitPayload` so the backend and host app can inspect both the final score and how it evolved through the session.

### Internationalization

Ten built-in locales:

| Code    | Language     |
| ------- | ------------ |
| `en_US` | English (US) |
| `en_GB` | English (GB) |
| `pl_PL` | Polish       |
| `de_DE` | German       |
| `fr_FR` | French       |
| `es_ES` | Spanish      |
| `pt_PT` | Portuguese   |
| `ar_SA` | Arabic (RTL) |
| `ru_RU` | Russian      |
| `sv_SE` | Swedish      |

RTL layout is applied automatically when an RTL locale is active.

Language resolution chain (first match wins):

1. `questionnaire_preferred` — locale specified in the questionnaire schema
2. `user_preferred` — locale from the host app config passed in the `init` message
3. `secondary` — device secondary language
4. `navigator.language` — browser/WebView language

### postMessage Haptics Bridge

Core has no access to native device APIs. When a haptic event should fire (e.g. answer selected, form submitted), core posts a message to its parent frame:

```ts
window.parent.postMessage({ type: "haptics", data: { type: "light" } }, "*");
```

The host intercepts this and calls `useHaptics()` to trigger the native haptic feedback.

### Config Interface

```ts
interface QuestionnaireCoreConfig {
  questionnaire: QuestionnaireSchema; // the questionnaire definition
  locale?: string; // preferred locale (BCP 47)
  theme?: "light" | "dark" | "auto";
  onSubmit?: (payload: SubmissionPayload) => void;
  onExit?: () => void;
}
```

---

## Questionnaire Engine (`mp-questionnaire-engine-builder`)

### What it is

The engine is a full Vue 3 / Vite application. Its build process:

1. Reads `questionnaire-engine.json` (the manifest — see below)
2. Generates `.vue` renderer files from the JSON strings
3. Downloads the exact core version specified in the manifest from the CDN
4. Runs `vite build` with `vite-plugin-singlefile` — all JS, CSS, and assets are inlined into a single `index.html`
5. Outputs `dist/questionnaire-engine-X.Y.Z/index.html`

The result is a **completely standalone HTML file** with no external dependencies at runtime.

### Manifest-Driven Build (`questionnaire-engine.json`)

The engine's build is driven by a JSON manifest rather than hard-coded source files. The manifest stores renderer component source code as strings. `build.js` reads the manifest, writes `.vue` files to a temporary directory, then invokes Vite.

This design allows the manifest to be edited from outside the repository (e.g. via the mp-frontend Vue REPL — see [Runtime Authoring](#runtime-authoring-via-mp-frontend-vue-repl)) and triggers a new engine build without any developer needing to touch source files locally.

### Built-in Renderers

Six renderers are included in the default engine:

| Renderer                 | Input type                           |
| ------------------------ | ------------------------------------ |
| `NumericRenderer`        | Numeric entry (integer or decimal)   |
| `SingleChoiceRenderer`   | Single-select from a list of options |
| `MultipleChoiceRenderer` | Multi-select from a list of options  |
| `SliderRenderer`         | Continuous range slider              |
| `DateRenderer`           | Date/time picker                     |
| `TextRenderer`           | Free-text input                      |

### postMessage Communication Protocol

**Host → Engine (init)**

Sent immediately after the iframe's `load` event fires.

```ts
iframe.contentWindow.postMessage({
  type: 'init',
  data: {
    questionnaire: QuestionnaireSchema,
    config: {
      locale?: string,
      theme?: 'light' | 'dark' | 'auto',
    }
  }
}, '*');
```

**Engine → Host (submit)**

Sent when the user completes the final question and confirms submission.

```ts
window.parent.postMessage({
  type: 'submit',
  data: {
    questionnaire: QuestionnaireSchema,  // original schema echoed back
    answers: Record<string, AnswerValue>,
    scoring: ScoringSnapshot[],
    submittedAt: string,                 // ISO 8601
  }
}, '*');
```

**Engine → Host (exit)**

Sent when the user explicitly closes/exits the questionnaire without completing it.

```ts
window.parent.postMessage({ type: "exit" }, "*");
```

**Core → Host (haptics)**

Sent by core through the engine frame to the host.

```ts
window.parent.postMessage(
  {
    type: "haptics",
    data: {
      type: "light" | "medium" | "heavy" | "success" | "warning" | "error",
    },
  },
  "*",
);
```

### Preview / Test Harness

During development, `vite dev` serves a preview harness at `http://localhost:5173/preview.html`. It provides:

- A live JSON editor for the questionnaire schema
- A phone-frame toggle to simulate mobile viewport dimensions
- Real-time reload when the engine source changes

---

## Why iframe Isolation Solves Key Problems

### 1. Compile Once, Run With Any Payload

The engine HTML file is a static artifact. It contains no questionnaire data. At runtime the host sends an `init` postMessage with the questionnaire JSON. The same engine file can render any questionnaire — a patient intake form, a clinical assessment, a satisfaction survey — without rebuilding.

A new questionnaire is created in the Designer, deployed to the backend, and immediately available to all users. No engine rebuild, no app release.

### 2. Universal Embeddability

The only integration requirement is the ability to render an `<iframe>` and listen for `message` events. This works in:

- Nuxt / Vue SPA (mp-mobile-app)
- React or Angular web apps
- Plain HTML pages
- Native WebViews (iOS WKWebView, Android WebView)
- Third-party clinical portals

No framework coupling, no shared dependency graph.

### 3. CSS and JS Isolation

The `<iframe>` boundary is enforced by the browser. Global styles from the host cannot bleed into the engine, and the engine's styles cannot affect the host. The engine can use its own version of `@nuxt/ui` without conflicting with whatever CSS framework the host uses.

### 4. Security Sandbox

Questionnaire logic (including conditional branch expressions evaluated via `new Function()`) runs in the engine's isolated context. The host controls exactly what data it passes in the `init` message. The engine has no direct DOM access to the host page.

---

## Pluggable Engine Architecture

### Different Cores for Different Needs

The architecture does not assume a single questionnaire core. Multiple cores can be built — each with its own UI, interaction model, and business logic. Examples:

- Standard clinical assessments (current core)
- Gamified questionnaires for paediatric patients
- Accessibility-focused variants with screen-reader-optimised markup
- Research-grade scoring engines with blinded answer collection

The only contract any core must fulfil is producing a valid `SubmissionPayload` (defined in `submission.ts`). As long as the final postMessage matches that shape, any new core is compatible with the existing mobile app and backend — no changes required on either side.

### Self-Selecting Engines

The questionnaire payload itself carries a reference to which engine version it requires. `QuestionnaireEngineRenderer.vue` reads this reference and fetches the correct engine HTML from the CDN.

The mobile app does **not** hardcode which engine to load. The data drives the decision. This means:

- New engine versions can be deployed and activated for specific questionnaires without releasing a new version of the app.
- Entirely new engine types can be introduced by registering them in the system and referencing them from questionnaire payloads.
- A/B testing different engines for the same questionnaire type is possible by varying the engine reference in the payload.

### Summary of Benefits

| Concern                  | How it is addressed                                                    |
| ------------------------ | ---------------------------------------------------------------------- |
| App release cycle        | Engine deploys independently; app just fetches the referenced version  |
| UI/UX evolution          | New engine = new HTML file; old questionnaires stay on old engine      |
| Third-party integration  | Any host that can render an iframe integrates with zero code changes   |
| A/B testing engines      | Questionnaire payload carries the engine reference; vary it per cohort |
| Multiple renderer styles | Each core is independent; all share the same submission contract       |

---

## Runtime Authoring via mp-frontend Vue REPL

### Browser-Based Engine Editor

The mp-frontend admin panel contains a runtime Vue REPL. Developers — including third parties outside Medipal — can create and edit questionnaire engine renderer components directly in the browser. No local build toolchain, no repository access, and no npm setup are required.

Changes are persisted back to the `questionnaire-engine.json` manifest and can trigger a new engine build via CI.

### Third-Party Authoring

The `SubmissionPayload` data structure is the only API surface external authors must respect. Third parties can build entirely custom renderers, or even full alternative engine variants, through the REPL without access to any internal repository.

This makes the questionnaire system extensible by the wider Medipal ecosystem — clinical partners, research institutions, and independent developers — without compromising the core platform.

### Components as Building Blocks for the Designer

Components created via the REPL (or included in any engine build) become available as building blocks inside the Questionnaire Designer. Questionnaire authors in the Designer can compose questions using any registered renderer — whether built-in or custom.

The authoring flow:

```
Vue REPL (browser)
        │
        │  save to questionnaire-engine.json
        ▼
Engine build (CI)
        │
        │  outputs new index.html → CDN
        ▼
Engine registered in the system
        │
        │  components appear as drag-and-drop blocks
        ▼
Questionnaire Designer
        │
        │  author drags in custom renderer block
        ▼
Questionnaire payload references those component types
        │
        │  postMessage init → engine renders them at runtime
        ▼
End user
```

---

## Engine Management (Admin Panel)

The admin panel provides a dedicated UI for managing questionnaire engines and their published versions at `/admin-panel/engines`.

### Available Engines

The first tab lists all registered questionnaire engines in a table with columns for name, version, core, and status (draft/published). From here administrators can:

- **Create** a new engine — opens a modal with fields for name, ID, version, icon, core selection, description, and changelog. The core dropdown displays the core name with its version (e.g. "Questionnaire Core (v0.21.3)"). Core selection is required.
- **Open** an engine — switches to the Engine Editor tab with the selected engine loaded in the Vue REPL.
- **Delete** an engine.

### Published Versions

Below the engines table, a "Published Versions" section lists all engine versions that have been built and uploaded to S3/CDN. This section is only visible when the `FEATURE_ENGINE_BUILDER` feature flag is enabled and the S3 bucket is configured.

Each published version displays the engine name, version badge, and base URL. Actions per version:

| Action       | Description                                       |
| ------------ | ------------------------------------------------- |
| **Copy URL** | Copies the engine's base CDN URL to the clipboard |
| **Open**     | Opens the engine's `manifest.json` in a new tab   |
| **Delete**   | Removes the version and all its files from S3     |

### Folder Configuration Requirement

A published engine is **not** automatically available to users. It must be explicitly added to a folder's configuration. The engine of an existing questionnaire can also be changed in the questionnaire's settings, provided the questionnaire has not been published yet.

### Publishing from the Editor

The Engine Editor tab contains a "Publish to CDN" action. When triggered, it sends the full engine manifest (including all component source code) to `POST /api/engine/build`, which:

1. Validates the manifest — checks that `id`, `version`, `core` (with subfields `id`, `version`, `baseUrl`, `main`, `style`), and `components` are present.
2. Builds the engine via `mp-questionnaire-engine-builder`.
3. Uploads all output files to S3 with immutable cache headers.
4. Returns the public CDN URL.

---

## Integration in mp-mobile-app

### `QuestionnaireEngineRenderer.vue`

This component is the host-side integration point. It:

1. Constructs the CDN URL for the engine version referenced in the questionnaire payload
2. Renders `<iframe :src="engineUrl" sandbox="allow-scripts allow-same-origin">`
3. On the iframe `load` event, sends the `init` postMessage with the questionnaire and config
4. Listens for `message` events on `window`:
   - `submit` → builds a `submissionRequest`, stores it in SQLite, triggers sync
   - `exit` → navigates back to the previous page
   - `haptics` → calls `useHaptics()` for native feedback

### Questionnaire Submission Flow

```
Engine  ──► { type: 'submit', data: SubmissionPayload }
                │
                ▼
QuestionnaireEngineRenderer.vue
  builds submissionRequest
                │
                ▼
sql.addPendingSubmit()   (SQLite — source of truth)
                │
                ▼
syncPendingSubmissionsToKV()   (copy to @capacitor/preferences for background runner)
                │
                ├── online  ──► useTenantApi.post('/submissions')  ──► sql.removePendingSubmit()
                │
                └── offline ──► left in pending_submits
                                retried by foreground setInterval (10s)
                                retried by background runner (~15 min)
```

### Version Pinning

The engine version is embedded in the questionnaire payload returned by the backend. `QuestionnaireEngineRenderer.vue` reads this version string and fetches `https://cdn.medipal.com/engine/questionnaire-engine-{VERSION}/index.html`.

The mobile app can be released with no engine changes; a new engine version becomes available to all existing app installs the moment the CDN file is uploaded and the backend starts referencing the new version in questionnaire payloads.

---

## Versioning & Release

Both packages follow semantic versioning. See their respective `package.json` files for current versions.

The engine specifies an exact core version in `questionnaire-engine.json`. At engine build time `build.js` downloads that exact core version from the CDN and inlines it. The output HTML is therefore **deterministic** — the same manifest always produces byte-for-byte identical output given the same Vite version.

Release checklist:

1. Build and publish a new core version → CDN
2. Update `coreVersion` in `questionnaire-engine.json`
3. Run `npm run build` in the engine repo → new `index.html`
4. Upload `index.html` to CDN at the new engine version path
5. Update the backend to reference the new engine version in questionnaire payloads
6. No mobile app release required unless `QuestionnaireEngineRenderer.vue` itself changed
