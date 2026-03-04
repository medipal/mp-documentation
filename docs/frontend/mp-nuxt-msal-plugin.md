# MSAL Plugin

::: info
This section is under development.
:::

The `mp-nuxt-msal-plugin` provides Azure AD authentication via the Microsoft Authentication Library (MSAL) for Nuxt applications.

## Purpose

This plugin handles the OAuth 2.0 / OpenID Connect flow for enterprise single sign-on with Azure Active Directory.

## Configuration

The plugin is configured with Azure AD tenant and client details via environment variables.

## Authentication Flow

1. User clicks "Sign in with Azure AD"
2. MSAL redirects to Microsoft login
3. On success, tokens are acquired and stored
4. API requests include the access token automatically
