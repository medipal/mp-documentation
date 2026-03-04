# Repository Map

::: info
This section is under development.
:::

All Medipal source code is organised into focused repositories under the [`medipal`](https://github.com/medipal) GitHub organisation.

## Core

| Repository                                                      | Description                             | Tech              |
| --------------------------------------------------------------- | --------------------------------------- | ----------------- |
| [mp-schema](https://github.com/medipal/mp-schema)               | JSON Schema definitions & OpenAPI specs | YAML, JSON Schema |
| [mp-server](https://github.com/medipal/mp-server)               | Backend API                             | Python, FastAPI   |
| [mp-documentation](https://github.com/medipal/mp-documentation) | This documentation site                 | VitePress         |

## Frontend

| Repository                                                                    | Description                                | Tech                      |
| ----------------------------------------------------------------------------- | ------------------------------------------ | ------------------------- |
| [mp-frontend](https://github.com/medipal/mp-frontend)                         | Web application                            | Nuxt 3, Vue 3, TypeScript |
| [mp-frontend-api](https://github.com/medipal/mp-frontend-api)                 | Generated TypeScript API client (frontend) | TypeScript                |
| [mp-nuxt-api-layer](https://github.com/medipal/mp-nuxt-api-layer)             | Shared Nuxt API layer                      | Nuxt 3                    |
| [mp-nuxt-msal-plugin](https://github.com/medipal/mp-nuxt-msal-plugin)         | Azure AD MSAL authentication plugin        | Nuxt 3                    |
| [mp-frontend-nginx-proxy](https://github.com/medipal/mp-frontend-nginx-proxy) | Nginx reverse proxy                        | Nginx                     |

## Mobile

| Repository                                                                              | Description                              | Tech                      |
| --------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------- |
| [mp-mobile-app](https://github.com/medipal/mp-mobile-app)                               | Mobile application                       | Nuxt 3, Capacitor 7       |
| [mp-mobile-app-api](https://github.com/medipal/mp-mobile-app-api)                       | Generated TypeScript API client (mobile) | TypeScript                |
| [mp-mobile-app-live-update](https://github.com/medipal/mp-mobile-app-live-update)       | OTA live-update Capacitor plugin         | TypeScript, Swift, Kotlin |
| [mp-mobile-app-builder](https://github.com/medipal/mp-mobile-app-builder)               | Mobile app builder                       | Node.js                   |
| [mp-mobile-app-ios-native](https://github.com/medipal/mp-mobile-app-ios-native)         | Native iOS project                       | Swift                     |
| [mp-mobile-app-android-native](https://github.com/medipal/mp-mobile-app-android-native) | Native Android project                   | Kotlin                    |

## Schema & Generation

| Repository                                                                                                | Description              | Tech       |
| --------------------------------------------------------------------------------------------------------- | ------------------------ | ---------- |
| [mp-typescript-api-generator](https://github.com/medipal/mp-typescript-api-generator)                     | TypeScript API generator | TypeScript |
| [mp-typescript-api-generator-templates](https://github.com/medipal/mp-typescript-api-generator-templates) | API generator templates  | ETA        |
| [mp-typescript-api-validation](https://github.com/medipal/mp-typescript-api-validation)                   | API validation (AJV)     | TypeScript |

## Questionnaires

| Repository                                                                                          | Description                     | Tech       |
| --------------------------------------------------------------------------------------------------- | ------------------------------- | ---------- |
| [mp-questionnaire-core-builder](https://github.com/medipal/mp-questionnaire-core-builder)           | Questionnaire core builder      | TypeScript |
| [mp-questionnaire-engine-builder](https://github.com/medipal/mp-questionnaire-engine-builder)       | Questionnaire engine builder    | TypeScript |
| [mp-anonymous-questionnaire-builder](https://github.com/medipal/mp-anonymous-questionnaire-builder) | Anonymous questionnaire builder | TypeScript |

## Plugins

| Repository                                                                            | Description              | Tech       |
| ------------------------------------------------------------------------------------- | ------------------------ | ---------- |
| [mp-server-plugin-sdk](https://github.com/medipal/mp-server-plugin-sdk)               | Server plugin SDK        | Python     |
| [mp-server-plugin-smtp-email](https://github.com/medipal/mp-server-plugin-smtp-email) | SMTP email plugin        | Python     |
| [mp-frontend-plugin-template](https://github.com/medipal/mp-frontend-plugin-template) | Frontend plugin template | TypeScript |

## Infrastructure

| Repository                                                              | Description              | Tech |
| ----------------------------------------------------------------------- | ------------------------ | ---- |
| [mp-github-actions](https://github.com/medipal/mp-github-actions)       | Shared GitHub Actions    | YAML |
| [mp-tf-infrastructure](https://github.com/medipal/mp-tf-infrastructure) | Terraform infrastructure | HCL  |

## Testing

| Repository                                              | Description           | Tech           |
| ------------------------------------------------------- | --------------------- | -------------- |
| [mp-e2e-tests](https://github.com/medipal/mp-e2e-tests) | End-to-end test suite | Playwright     |
| [mp-api-tests](https://github.com/medipal/mp-api-tests) | API integration tests | Python, pytest |

## Libraries

| Repository                                        | Description              | Tech   |
| ------------------------------------------------- | ------------------------ | ------ |
| [genma](https://github.com/medipal/genma)         | Code generation engine   | Python |
| [confirion](https://github.com/medipal/confirion) | Configuration management | Python |
| [yamser](https://github.com/medipal/yamser)       | YAML serialisation       | Python |
| [fyler](https://github.com/medipal/fyler)         | File utilities           | Python |
| [structo](https://github.com/medipal/structo)     | Data structures          | Python |
| [pylog](https://github.com/medipal/pylog)         | Logging                  | Python |
| [storiel](https://github.com/medipal/storiel)     | Storage abstraction      | Python |

## Dependency Graph

The [mp-schema](https://github.com/medipal/mp-schema) repository sits at the root of the dependency graph. CI pipelines generate typed clients that are consumed by the server, frontend, and mobile app.
