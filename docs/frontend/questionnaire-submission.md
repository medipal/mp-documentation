# Questionnaire Submission (Web)

This document covers how patients fill in questionnaires directly from the `mp-frontend` web panel — from enrollment through submission. For the questionnaire engine itself, see [Questionnaire Core & Engine](./questionnaire-engine).

---

## Overview

Patients enrolled in a questionnaire can answer it without the mobile app. The complete flow is:

```
Enrollment created by clinician
  └─ Patient opens User Profile → "My Questionnaires" tab
       └─ Enrollment appears with status ENROLLED
            └─ Patient clicks "Answer Now"
                 └─ AnswerQuestionnaireModal opens (fullscreen)
                      └─ Questionnaire engine renders inside iframe
                           └─ Patient submits answers
                                └─ API call: questionnaireSubmit (source: "WEB_APP")
                                     └─ Enrollment status updated to COMPLETED
```

---

## User Profile: My Questionnaires Tab

**Route:** `/user-profile` → tab "My Questionnaires"
**Component:** `app/pages/user-profile/_partial/my-questionnaires.vue`

The tab is split into two sections.

### Enrollments Section

Lists all enrollment records for the currently logged-in user. Data is loaded by joining:

- `api.enrollmentUserList({ user_id })` — returns `enrollment_users[]` with `enrollment_id`, `enrollment_user_status_id`, `enrollment_user_type_id`, `enrollment_start_date`, `enrollment_end_date`
- `api.enrollmentList()` — all enrollments (to resolve `questionnaire_id`)
- `questionnaireStore.questionnaireList` — to resolve questionnaire name

#### Enrollment Status Values

| Status                   | Meaning                                                |
| ------------------------ | ------------------------------------------------------ |
| `PENDING_CONSENT`        | Patient has been enrolled but not yet accepted consent |
| `ENROLLED`               | Active — patient can submit answers                    |
| `COMPLETED`              | All required submissions have been received            |
| `TERMINATED_BY_PROVIDER` | Clinician cancelled the enrollment                     |
| `TERMINATED_BY_PATIENT`  | Patient cancelled the enrollment                       |

#### Enrollment User Type Values

The `enrollment_user_type_id` field indicates the patient's role in the enrollment (e.g. primary respondent, proxy). Labels and icons are sourced from i18n key `@pages.patient.id.tabs.enrollments.table.cell.user_type_id.{type}`.

#### Available Actions (per row)

| Action         | Condition                                         | API Call                                |
| -------------- | ------------------------------------------------- | --------------------------------------- |
| Accept Consent | `enrollment_user_status_id === "PENDING_CONSENT"` | `userStore.showAcceptConsentModal()`    |
| Answer Now     | `enrollment_user_status_id === "ENROLLED"`        | Opens `AnswerQuestionnaireModal`        |
| Cancel         | Status is not already terminated                  | `userStore.showCancelEnrollmentModal()` |

The **Answer Now** button only appears inline in the table row (not in the dropdown) when status is `ENROLLED`.

#### Filtering

Enrollment status filter persists in `localStorage` under key `table-settings-my-enrollments-status-filter`. Column visibility persists under `table-settings-my-enrollments-column-visibility`.

### Submissions Section

Lists all questionnaire submissions made by the current user.

**API call:** `api.questionnaireSubmissionList({ user_id })` — returns `questionnaire_submissions[]`

Each submission row displays:

- **Questionnaire** — name (fetched lazily via `api.questionnaireDetail` per unique `questionnaire_id`)
- **Submitted At** — formatted with user's `date_locale`
- **Score** — extracted from `payload.scoring.variables`; shows the variable with `type === "total"` or `name === "total"`, or `"—"` if none
- **View** — opens `SubmissionPreviewModal` with the submission payload

Submission enrollment filter persists in `localStorage` under key `table-settings-my-submissions-enrollment-filter`.

---

## AnswerQuestionnaireModal

**Component:** `app/components/Modals/AnswerQuestionnaireModal.vue`

This modal renders the questionnaire engine in an `<iframe>` and handles the full submit cycle.

### Props

```ts
defineProps<{
  questionnaireId: string;
  enrollmentId: string;
}>();
```

### Lifecycle

1. **Mount:** `api.questionnaireDetail(questionnaireId)` is called. If it fails, an error toast is shown and the modal closes.
2. **iframe loads:** The engine HTML is loaded from `${engine.baseUrl}${engine.packageName}/index.html` (from `questionnaire.payload.definitions.engine`).
3. **Init message:** Once the iframe fires its `load` event, the modal sends a `postMessage` of type `"init"` with the full questionnaire object and a `config` block:

```ts
{
  type: "init",
  questionnaire: { /* full questionnaire object */ },
  config: {
    questionnaire_preferred_language: "en",
    user_preferred_language: "en",
    sections: ["section-id-1", "section-id-2", ...],
    scoring: { /* scoring definition */ },
  }
}
```

### postMessage Protocol (inbound, from engine)

| `data.type` | Meaning                             | Action                                                               |
| ----------- | ----------------------------------- | -------------------------------------------------------------------- |
| `"submit"`  | Patient completed the questionnaire | Call `api.questionnaireSubmit(...)`, show success toast, close modal |
| `"exit"`    | Patient tapped the exit/back button | Close modal (no submission)                                          |
| `"error"`   | Engine runtime error                | Show error toast with `data.payload.message`                         |

After a successful `"submit"`, the flag `hasSubmitted` is set to `true`. All further messages from the engine are ignored — this prevents duplicate toasts during the modal's close animation.

### Submission API Call

```ts
api.questionnaireSubmit({
  questionnaire_id: props.questionnaireId,
  enrollment_id: props.enrollmentId,
  submitted_at: new Date().toISOString(),
  payload: data.payload ?? {},
  source: "WEB_APP",
});
```

The `source: "WEB_APP"` field distinguishes web submissions from mobile app submissions (`"MOBILE_APP"`) and anonymous link submissions (`"OTHER"`).

### Responsive Sizing

The iframe container uses `useResizeObserver` from `@vueuse/core`. On every container resize the modal scales the phone-frame dimensions (base: 430×932 px) to fit the available space while preserving the aspect ratio:

```ts
const scale = Math.min(containerW / phoneWidth, containerH / phoneHeight, 1);
```

The iframe itself uses `sandbox="allow-scripts"` — no forms, popups, or top-level navigation are permitted.

---

## Anonymous Questionnaire Links

In addition to enrolled-user submissions, `mp-frontend` supports generating **anonymous public links** — shareable HTML pages that anyone can open without logging in. These are stored in S3 and optionally served via CloudFront CDN.

### Feature Flag

The `FEATURE_ANONYMOUS_QUESTIONNAIRES` flag controls visibility of anonymous questionnaire functionality across the UI:

| Setting                                                 | Default | Override                                            |
| ------------------------------------------------------- | ------- | --------------------------------------------------- |
| `runtimeConfig.public.FEATURE_ANONYMOUS_QUESTIONNAIRES` | `false` | `NUXT_PUBLIC_FEATURE_ANONYMOUS_QUESTIONNAIRES=true` |

When **enabled**, the flag:

- Adds the `ANONYMOUS` option in `CreateQuestionnaireModal.vue` (questionnaire creation)
- Adds the `ANONYMOUS` option in `general.vue` (questionnaire editing)
- Shows the anonymous links panel on the enrollments page

When **disabled**, users cannot create anonymous questionnaires and the anonymous links panel is hidden — but existing anonymous links remain accessible via their URLs.

### "Not Configured" Fallback

When `S3_ANONYMOUS_BUCKET` is not set, the server routes degrade gracefully:

| Route                     | Behavior                                                                                     |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| GET `/anonymous-links`    | Returns `{ configured: false, links: [] }` (no error)                                        |
| POST `/anonymous-build`   | Returns `503` with message "Anonymous questionnaires are not configured in this environment" |
| DELETE `/anonymous-links` | Returns `503` with same message                                                              |

The enrollments page UI reads the `configured` flag from the GET response. When `configured === false`, it shows an informational alert instead of the generate form.

### Server Routes

All three routes live under `server/api/questionnaire/[id]/` and require:

- A valid `Authorization` header (forwarded from the frontend)
- The questionnaire must be `PUBLISHED` and have `questionnaire_identity_policy_id === "ANONYMOUS"`

#### POST `/api/questionnaire/[id]/anonymous-build`

Builds and uploads an anonymous HTML page.

**Request body:**

```ts
{ locale: string; title?: string }
```

**What it does:**

1. Fetches questionnaire via `api.questionnaireDetail(id)`
2. Validates status (`PUBLISHED`) and identity policy (`ANONYMOUS`)
3. Fetches the engine HTML from CDN (`engineDef.baseUrl + engineDef.packageName + /index.html`)
4. Fetches questionnaire config via `api.questionnaireConfig(id)` (optional, failures silently ignored)
5. Calls `buildAnonymousQuestionnaire()` from `@medipal/mp-anonymous-questionnaire-builder` with:
   - `engineHtml`, `questionnaire` (full questionnaire object), `questionnaireConfig`, `locale`, `title`
   - `submission.apiUrl = ${API_URL}/api/v1/questionnaire_submission/anonymous`
   - `submission.source = "OTHER"`
6. Uploads the resulting HTML to S3 at key `anonymous/{id}/{sanitizedTitle}_{locale}_{timestamp}.html`
   - `ContentType: "text/html; charset=utf-8"`, `CacheControl: "public, max-age=31536000"`
7. Constructs the public URL — prefers CloudFront CDN if `S3_ANONYMOUS_CDN_URL` is set, otherwise falls back to direct S3 URL

**Response:**

```ts
{
  url: string;
  key: string;
  title: string;
  locale: string;
  createdAt: string;
}
```

**Required environment variables:**

| Variable                | Purpose                                                                      |
| ----------------------- | ---------------------------------------------------------------------------- |
| `S3_ANONYMOUS_BUCKET`   | S3 bucket name (required)                                                    |
| `S3_ANONYMOUS_REGION`   | AWS region (default: `eu-central-1`)                                         |
| `S3_ANONYMOUS_CDN_URL`  | CloudFront CDN base URL (e.g. `https://cdn.medipal.dev`) — no trailing slash |
| `AWS_ACCESS_KEY_ID`     | AWS credentials                                                              |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials                                                              |

**URL construction:**

```ts
// Prefer CloudFront CDN, fallback to direct S3
const publicUrl = cdnUrl
  ? `${cdnUrl.replace(/\/$/, "")}/${s3Key}`
  : `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`;
```

::: tip
For production, configure a CloudFront distribution with Origin Access Control (OAC) pointing to the S3 bucket. Set `S3_ANONYMOUS_CDN_URL` to the distribution domain (e.g. `https://cdn.medipal.dev`). This provides caching, HTTPS, and avoids exposing the S3 bucket directly.
:::

#### GET `/api/questionnaire/[id]/anonymous-links`

Lists all previously generated anonymous links for this questionnaire.

Queries S3 with prefix `anonymous/{id}/` and returns parsed metadata extracted from the filename pattern `{title}_{locale}_{timestamp}.html`. Results are sorted newest-first. URLs use the same CDN/S3 fallback logic as the build endpoint.

**Response:**

```ts
{
  links: Array<{
    key: string;
    url: string;
    title: string;
    locale: string;
    createdAt: string;
    size: number;
  }>;
}
```

If `S3_ANONYMOUS_BUCKET` is not configured, returns `{ configured: false, links: [] }` (no error).

#### DELETE `/api/questionnaire/[id]/anonymous-links`

Deletes a specific anonymous link from S3.

**Request body:**

```ts
{
  key: string;
}
```

The `key` must start with `anonymous/{id}/` — the server validates ownership before deleting. Returns `503` if S3 is not configured.

### Enrollments Page UI

**Component:** `app/pages/questionnaire/[id]/enrollments.vue`

When a questionnaire has `questionnaire_identity_policy_id === "ANONYMOUS"`, the enrollments page replaces the standard enrollment table with an anonymous links panel.

**Behavior:**

1. The page reads `FEATURE_ANONYMOUS_QUESTIONNAIRES` from `runtimeConfig.public`
2. Computes `isAnonymous` from the questionnaire's identity policy
3. If `isAnonymous === true`, renders the anonymous links panel instead of the enrollment table
4. Calls `GET /api/questionnaire/[id]/anonymous-links` via `useFrontendApi()` to load existing links

**Generate form** (shown when `configured === true` and feature flag enabled):

- **Locale select** — dropdown of available locales
- **Custom title** — optional text input (defaults to questionnaire name)
- Submits via `POST /api/questionnaire/[id]/anonymous-build`

**Links list** — each link displays title, locale, and creation date, with actions:

- **Copy URL** — copies the anonymous link to clipboard
- **QR Code** — opens a modal with a QR code rendered via `qrcode-vue3`
- **Open** — opens the link in a new tab
- **Delete** — calls `DELETE /api/questionnaire/[id]/anonymous-links` after confirmation

### Builder Library (`@medipal/mp-anonymous-questionnaire-builder`)

The `@medipal/mp-anonymous-questionnaire-builder` package transforms a questionnaire engine HTML bundle into a standalone anonymous submission page.

**`buildAnonymousQuestionnaire(options: BuildOptions)`** accepts:

```ts
interface BuildOptions {
  engineHtml: string; // Engine HTML bundle
  questionnaire: Record<string, any>; // Full questionnaire object
  questionnaireConfig?: Record<string, any>;
  locale: string;
  title?: string;
  submission: SubmissionConfig; // API URL, key, source, etc.
}
```

**What it does:**

1. Injects a wrapper `<script>` before `</body>` in the engine HTML
2. The wrapper embeds the questionnaire, config, and submission settings as inline JSON variables
3. On `DOMContentLoaded`, sends `postMessage({ type: "init", questionnaire, config })` to the engine
   - `config` includes `sections` (all section IDs) and `scoring` from the questionnaire payload
4. Listens for `submit` postMessage from the engine and POSTs the payload to the anonymous submission API
5. Shows an overlay UI during submission with submitting/success/error states

---

## See Also

- [Questionnaire Core & Engine](./questionnaire-engine) — postMessage protocol, engine versioning
- [Device Management](./device-management) — registering mobile devices from User Profile
- [Mobile App Architecture](/mobile/mobile-app-overview) — how the mobile app handles submissions offline
