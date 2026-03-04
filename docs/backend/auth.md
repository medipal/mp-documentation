# Authentication & RBAC

::: info
This section is under development.
:::

Medipal supports multiple authentication methods and role-based access control.

## Authentication Methods

- **Credentials** — username and password authentication with JWT tokens
- **Azure AD** — enterprise SSO via MSAL (Microsoft Authentication Library)
- **API Keys** — service-to-service authentication

## Role-Based Access Control

Access to API endpoints is controlled by roles and scopes. Each route declares the required scopes, and the authentication middleware verifies the user's permissions.

## Token Management

JWT tokens are issued on login and validated on every request. Token refresh is handled transparently.
