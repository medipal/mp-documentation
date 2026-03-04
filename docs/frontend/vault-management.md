# Vault Management

Vault management provides a secure storage for secrets (API keys, credentials, tokens) used by plugin configurations in workflows.

---

## Overview

| Property     | Value                                                           |
| ------------ | --------------------------------------------------------------- |
| Route        | `/admin-panel/system` → **Vault** tab                           |
| Feature flag | None (always visible in the System tab)                         |
| Page partial | `app/pages/admin-panel/system/_partial/vault.vue`               |
| Renderer     | `app/components/JsonForms/renderers/VaultReferenceRenderer.vue` |

---

## Vault References

Vault entries are referenced in plugin `input_mapping` configurations using the format:

```
@vault/{id}
```

The `VaultReferenceRenderer` is a custom JsonForms renderer that displays vault reference fields with a **copy-to-clipboard** button. Clicking it copies the reference string and shows a toast notification confirming the copy.

### Renderer registration

`VaultReferenceRenderer` is registered in `app/utils/jsonFormRenderer.ts` alongside the other 14 custom renderers.

---

## i18n Keys

- `@pages.adminPanel.tabs.system.vault.*` — table headers, actions, empty state
- `@modals.vault.*` — create / edit modals
- `@toasts.vault.*` — success / error toasts
- `@components.vaultRenderer.aria.*` — accessibility labels for the copy button
