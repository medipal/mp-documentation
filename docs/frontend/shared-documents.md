# Shared Documents

Shared Documents is a system for managing multilingual Markdown documents stored on S3 and served via CDN. The first use case is the **device authentication consent** — a legal document shown to patients during mobile app onboarding.

**Feature flag:** `FEATURE_SHARED_DOCUMENTS`

---

## Overview

```
Admin Panel → System → Shared Documents
  └─ Select document type (e.g. "Device Authentication Consent")
       └─ Add language tabs → edit Markdown via RTEditor
            └─ Save → uploads to S3 → served via CDN
```

Documents are stored on S3 with the following key structure:

```
{locale}/
  {document-type}.md

Example:
  en_GB/device-authentication-consent.md
  pl_PL/device-authentication-consent.md
  de_DE/device-authentication-consent.md
```

**URL pattern:** `{S3_SHARED_DOCUMENTS_CDN_URL}/{locale}/{document-type}.md`

**Cache:** `max-age=300` (5 minutes) — documents may be updated frequently, unlike engine builds which use `max-age=31536000`.

---

## Configuration

### S3 Storage (server-only)

| Variable                      | Required | Description                                        |
| ----------------------------- | -------- | -------------------------------------------------- |
| `S3_SHARED_DOCUMENTS_BUCKET`  | Yes      | S3 bucket name for shared documents                |
| `S3_SHARED_DOCUMENTS_REGION`  | No       | AWS region (default: `eu-central-1`)               |
| `S3_SHARED_DOCUMENTS_CDN_URL` | No       | CloudFront CDN base URL for public document access |

AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) are shared with the engine and anonymous questionnaire S3 configuration.

### Device Authentication Consent (public)

| Variable                           | Required | Description                                             |
| ---------------------------------- | -------- | ------------------------------------------------------- |
| `SHARED_DOCUMENTS_CDN_URL`         | No       | CDN base URL embedded in the QR code deep link payload  |
| `SHARED_DOCUMENTS_CONSENT_LOCALES` | No       | Comma-separated locale codes (e.g. `en_GB,pl_PL,de_DE`) |

When both are set, the device authentication QR code payload includes `consent_url` and `consent_locales`, allowing `mp-mobile-app` to fetch and display the consent document in the patient's language.

### Feature Flag

| Variable                   | Description                                         |
| -------------------------- | --------------------------------------------------- |
| `FEATURE_SHARED_DOCUMENTS` | Show "Shared Documents" tab in Admin Panel → System |

---

## Server Endpoints

All endpoints require JWT authentication (enforced by global auth middleware).

| Endpoint                                | Method | Description                       |
| --------------------------------------- | ------ | --------------------------------- |
| `/api/shared-documents/locales`         | GET    | List locales with documents on S3 |
| `/api/shared-documents/[locale]/[type]` | GET    | Fetch document content + CDN URL  |
| `/api/shared-documents/[locale]/[type]` | PUT    | Upload/update document on S3      |
| `/api/shared-documents/[locale]/[type]` | DELETE | Delete document from S3           |

The `type` parameter is validated against a whitelist: `["device-authentication-consent"]`. New document types can be added by extending this array.

---

## Admin UI

**Location:** Admin Panel → System → Shared Documents (visible when `FEATURE_SHARED_DOCUMENTS=true`)

**Component:** `app/pages/admin-panel/system/_partial/shared-documents.vue`

**Store:** `app/stores/sharedDocuments.ts` (`useSharedDocumentsStore`)

### Features

- **Document type selector** — `USelectMenu` for choosing the document type
- **Language tabs** — one tab per locale, following the pattern from `legal.vue`
- **Add Language** dropdown — adds a new locale tab with empty content
- **Remove Language** — `x` button on tab, with confirmation dialog
- **RTEditor** — TipTap WYSIWYG editor with `contentType="markdown"` output
- **CDN URL display** — shows the public URL with a copy-to-clipboard button
- **PanelChangesFooter** — Save/Discard bar when content is modified

---

## Device Authentication Integration

**Component:** `app/components/Modals/AuthenticateDevice/AuthenticateDevice.vue`

When `SHARED_DOCUMENTS_CDN_URL` and `SHARED_DOCUMENTS_CONSENT_LOCALES` are configured, the encrypted QR code payload includes:

```json
{
  "token": "...",
  "tenant_id": "...",
  "instance_id": "...",
  "api_key": "...",
  "consent_url": "https://cdn.example.com",
  "consent_locales": ["en_GB", "pl_PL", "de_DE"]
}
```

The mobile app constructs the full document URL as:

```
{consent_url}/{locale}/device-authentication-consent.md
```

A locale selector is shown in the modal when multiple consent locales are available, allowing the clinician to choose the language before generating the QR code. The selector is disabled after the link is generated.

---

## Document Type Whitelist

Currently supported types:

| Type                            | Description                               |
| ------------------------------- | ----------------------------------------- |
| `device-authentication-consent` | Consent document shown during device auth |

To add a new document type, update the `ALLOWED_TYPES` array in all four server endpoint files under `server/api/shared-documents/`.

---

## See Also

- [Device Management](./device-management) — device registration and authentication flow
- [Vault Management](./vault-management) — similar admin panel tab pattern
- [Authentication](./authentication) — web panel authentication and AES deep link flow
