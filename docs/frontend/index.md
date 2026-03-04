# Frontend Ecosystem

The Medipal frontend ecosystem spans multiple repositories that work together to deliver the web application experience.

## Repositories

| Repository                                                                                                | Description                                           |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| [mp-frontend](https://github.com/medipal/mp-frontend)                                                     | Main Nuxt 4 web application                           |
| [mp-frontend-api](https://github.com/medipal/mp-frontend-api)                                             | Auto-generated TypeScript API client                  |
| [mp-nuxt-api-layer](https://github.com/medipal/mp-nuxt-api-layer)                                         | Shared Nuxt API layer (extended by frontend & mobile) |
| [mp-nuxt-msal-plugin](https://github.com/medipal/mp-nuxt-msal-plugin)                                     | Azure AD MSAL authentication plugin                   |
| [mp-typescript-api-generator](https://github.com/medipal/mp-typescript-api-generator)                     | TypeScript API generator                              |
| [mp-typescript-api-generator-templates](https://github.com/medipal/mp-typescript-api-generator-templates) | API generator templates                               |
| [mp-typescript-api-validation](https://github.com/medipal/mp-typescript-api-validation)                   | API validation (AJV)                                  |
| [mp-questionnaire-core-builder](https://github.com/medipal/mp-questionnaire-core-builder)                 | Questionnaire core builder                            |
| [mp-questionnaire-engine-builder](https://github.com/medipal/mp-questionnaire-engine-builder)             | Questionnaire engine builder                          |
| [mp-anonymous-questionnaire-builder](https://github.com/medipal/mp-anonymous-questionnaire-builder)       | Anonymous questionnaire builder                       |
| [mp-frontend-plugin-template](https://github.com/medipal/mp-frontend-plugin-template)                     | Frontend plugin template                              |

## Architecture

The frontend is built with Nuxt 4, Vue 3, and TypeScript. It uses Pinia for state management, Tailwind CSS for styling, and auto-generated API clients for type-safe backend communication.

## Getting Started

Start with the [Introduction](/frontend/introduction) and [Setup](/frontend/setup) guides to get the development environment running.
