# Device Management

This document covers how mobile devices are registered and managed from the `mp-frontend` web panel — the Devices tab inside User Profile.

For the patient-side of the authentication flow (what happens on the device after the link is tapped), see [Mobile App Architecture](/mobile/mobile-app-overview).

---

## Overview

`mp-frontend` and `mp-mobile-app` are connected through a **device registration flow** initiated from the web panel. A clinician (or the patient themselves, if they have panel access) registers a mobile device so the patient can log in via the deep-link AES-encrypted token.

```
User Profile → Devices tab
  └─ Shows registered devices for the current user
       └─ "Authenticate Device" button
            └─ patientStore.showAuthenticateDeviceModal()
                 └─ api.deviceRegister(...)
                      └─ Returns AES-encrypted deep link
                           └─ Patient taps link on device
                                └─ mp-mobile-app handles authentication
```

---

## User Profile: Devices Tab

**Route:** `/user-profile` → tab "Devices"
**Component:** `app/pages/user-profile/_partial/devices.vue`

### Data Loading

On mount, the tab calls:

```ts
api.deviceList({ user_id: userStore.profile.id });
```

The response contains `devices[]`, each representing one registered mobile device.

### Device Table Columns

| Column        | Field              | Notes                                              |
| ------------- | ------------------ | -------------------------------------------------- |
| Name          | `name`             | User-assigned device name                          |
| Model         | `model`            | Device model string (e.g. "iPhone 15 Pro")         |
| Type          | `device_type_id`   | Device type identifier                             |
| Phone Number  | `phone_number`     | Associated phone number                            |
| OS            | `os`               | Operating system (e.g. "iOS 17.4")                 |
| App Version   | `app_version`      | Version of `mp-mobile-app` installed on the device |
| Registered At | `created_at`       | Formatted with the user's `date_locale`            |
| Status        | `device_status_id` | Badge (see status values below)                    |

Column visibility persists in `localStorage` under key `table-settings-devices-column-visibility`.

### Device Status Values

Status badges use i18n key `@pages.patient.id.tabs.overview.table.cell.device_status_id.{status}`.

| Status     | Meaning                                   |
| ---------- | ----------------------------------------- |
| `ACTIVE`   | Device is registered and can authenticate |
| `INACTIVE` | Device registration is disabled           |

---

## Authenticate Device Flow

Clicking the **Authenticate Device** button in the table header toolbar calls:

```ts
patientStore.showAuthenticateDeviceModal({
  patient: {
    id: userStore.profile.id,
    first_name: userStore.profile.first_name,
    last_name: userStore.profile.last_name,
    phone_number: userStore.profile.phone_number,
  },
  onSuccess: fetchMyDevices,
});
```

The modal calls `api.deviceRegister(...)` to create a new device entry on the backend and receive the AES-encrypted deep-link URL. The URL uses the `medipal://` scheme:

```
medipal://authenticate?payload=<AES-encrypted-token>
```

The encrypted payload contains:

```json
{
  "token": "<device_registration_token>",
  "tenant_id": "<API_TENANT_ID>",
  "instance_id": "<API_INSTANCE_ID>",
  "api_key": "<API_KEY>",
  "consent_url": "<SHARED_DOCUMENTS_CDN_URL>",
  "consent_locales": ["en_GB", "pl_PL", "de_DE"]
}
```

`consent_url` and `consent_locales` are included only when `SHARED_DOCUMENTS_CDN_URL` and `SHARED_DOCUMENTS_CONSENT_LOCALES` environment variables are configured. The mobile app uses these to fetch and display a consent document before completing authentication. See [Shared Documents](./shared-documents) for details.

After the modal closes successfully, `fetchMyDevices()` is called to refresh the device list.

::: info Self-service vs. clinician flow
The Devices tab in User Profile uses the same underlying modal as the patient overview page in the admin section — but passes the current user's own profile data. This lets patients register their own devices if they have web panel access, without requiring a clinician.
:::

---

## Relationship with Mobile App

Once a device is registered from the web panel:

1. The patient receives the `medipal://` deep link (shared via email, SMS, or QR code — handled outside the frontend)
2. Tapping the link opens `mp-mobile-app`, which decrypts the AES token using the shared `CRYPTO_KEY`
3. The app calls `POST /api/device-login` to exchange the token for `access_token` + `refresh_token`
4. The device authenticates and begins syncing enrollments and questionnaires

The device row in the Devices tab will show `ACTIVE` once the authentication is complete on the mobile side.

::: warning CRYPTO_KEY must match
The AES key used to encrypt the deep-link token in the backend must match the `CRYPTO_KEY` environment variable in `mp-mobile-app`. A mismatch causes a silent decryption failure — the patient sees a generic error. See [Mobile App Architecture](/mobile/mobile-app-overview#authentication-flow) for details.
:::

---

## See Also

- [Mobile App Architecture](/mobile/mobile-app-overview) — deep-link auth flow, SQLite tenant storage, background sync
- [Authentication](./authentication) — standard web panel authentication (credentials, Azure AD, TOTP)
- [Questionnaire Submission (Web)](./questionnaire-submission) — how patients fill in questionnaires from the web panel
