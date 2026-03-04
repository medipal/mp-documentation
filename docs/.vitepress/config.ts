import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Medipal Documentation",
  description: "Developer documentation for the Medipal platform",
  head: [["link", { rel: "icon", type: "image/png", href: "/logo-icon.png" }]],

  themeConfig: {
    logo: {
      light: "/logo.svg",
      dark: "/logo-dark.svg",
      height: 32,
    },
    siteTitle: false,

    nav: [
      { text: "Overview", link: "/overview/" },
      { text: "Schema", link: "/schema/" },
      { text: "Backend", link: "/backend/" },
      { text: "Frontend", link: "/frontend/" },
      { text: "Mobile", link: "/mobile/" },
      { text: "Testing", link: "/testing/" },
    ],

    sidebar: {
      "/overview/": [
        {
          text: "Overview",
          items: [
            { text: "Platform Overview", link: "/overview/" },
            { text: "Platform Architecture", link: "/overview/platform" },
            { text: "Repository Map", link: "/overview/repo-map" },
            { text: "Tech Stack", link: "/overview/tech-stack" },
            { text: "Development Setup", link: "/overview/development-setup" },
            { text: "CI/CD Pipeline", link: "/overview/ci-cd" },
          ],
        },
      ],

      "/schema/": [
        {
          text: "Schema",
          items: [
            { text: "Overview", link: "/schema/" },
            { text: "Entity Model", link: "/schema/entity-model" },
            {
              text: "JSON Schema Conventions",
              link: "/schema/json-schema",
            },
            {
              text: "OpenAPI Specifications",
              link: "/schema/openapi",
            },
            { text: "Table Mappings", link: "/schema/table-mappings" },
            {
              text: "Code Generation Pipeline",
              link: "/schema/code-generation",
            },
            { text: "Contributing", link: "/schema/contributing" },
          ],
        },
      ],

      "/backend/": [
        {
          text: "Backend",
          items: [
            { text: "Overview", link: "/backend/" },
            {
              text: "Project Structure",
              link: "/backend/project-structure",
            },
          ],
        },
        {
          text: "API",
          items: [
            { text: "API Routes", link: "/backend/api-routes" },
            { text: "List Endpoints", link: "/backend/list-endpoints" },
            { text: "Services", link: "/backend/services" },
            { text: "Repositories", link: "/backend/repositories" },
            {
              text: "Generated Modules",
              link: "/backend/generated-modules",
            },
          ],
        },
        {
          text: "Auth & Security",
          items: [
            { text: "Authentication & RBAC", link: "/backend/auth" },
            { text: "API Keys", link: "/backend/api-keys" },
            { text: "Scopes", link: "/backend/scopes" },
          ],
        },
        {
          text: "Features",
          items: [
            { text: "Events & Outbox", link: "/backend/events" },
            { text: "Plugins", link: "/backend/plugins" },
            { text: "Scheduler", link: "/backend/scheduler" },
            { text: "Seeder", link: "/backend/seeder" },
            { text: "Workflows", link: "/backend/workflows" },
            { text: "Vault", link: "/backend/vault" },
            { text: "Webhooks", link: "/backend/webhooks" },
          ],
        },
        {
          text: "Infrastructure",
          items: [
            {
              text: "Database & Migrations",
              link: "/backend/database",
            },
          ],
        },
        {
          text: "History",
          items: [{ text: "Changelog", link: "/backend/changelog" }],
        },
      ],

      "/frontend/": [
        {
          text: "Frontend",
          items: [{ text: "Overview", link: "/frontend/" }],
        },
        {
          text: "Getting Started",
          items: [
            { text: "Introduction", link: "/frontend/introduction" },
            { text: "Setup", link: "/frontend/setup" },
            {
              text: "Architecture Overview",
              link: "/frontend/architecture",
            },
            { text: "Security", link: "/frontend/security" },
          ],
        },
        {
          text: "Standards",
          items: [
            { text: "Code Quality", link: "/frontend/code-quality" },
            {
              text: "TypeScript Conventions",
              link: "/frontend/typescript-conventions",
            },
            { text: "Coding Standards", link: "/frontend/coding-standards" },
            { text: "Testing", link: "/frontend/testing" },
          ],
        },
        {
          text: "Architecture",
          items: [
            {
              text: "System Architecture",
              link: "/frontend/overview",
            },
            { text: "API Client", link: "/frontend/api-client" },
            { text: "Routing", link: "/frontend/routing" },
            { text: "Data Flow", link: "/frontend/data-flow" },
            {
              text: "State Management",
              link: "/frontend/state-management",
            },
            {
              text: "Plugins Architecture",
              link: "/frontend/plugins-architecture",
            },
            { text: "Deployment", link: "/frontend/deployment" },
          ],
        },
        {
          text: "Features",
          items: [
            {
              text: "Questionnaire Designer",
              link: "/frontend/questionnaire-designer",
            },
            {
              text: "Questionnaire Engine",
              link: "/frontend/questionnaire-engine",
            },
            {
              text: "Questionnaire Submission",
              link: "/frontend/questionnaire-submission",
            },
            { text: "AI Designer", link: "/frontend/ai-designer" },
            {
              text: "Authentication",
              link: "/frontend/authentication",
            },
            {
              text: "Workflow Editor",
              link: "/frontend/workflow-editor",
            },
            {
              text: "Device Management",
              link: "/frontend/device-management",
            },
            {
              text: "Vault Management",
              link: "/frontend/vault-management",
            },
            {
              text: "Plugin Management",
              link: "/frontend/plugin-management",
            },
            {
              text: "Shared Documents",
              link: "/frontend/shared-documents",
            },
            {
              text: "Role Management",
              link: "/frontend/role-management",
            },
            {
              text: "Internationalization",
              link: "/frontend/internationalization",
            },
          ],
        },
        {
          text: "Reference",
          items: [
            { text: "Components", link: "/frontend/components" },
            { text: "Composables", link: "/frontend/composables" },
            { text: "Utilities", link: "/frontend/utils" },
          ],
        },
        {
          text: "Shared Libraries",
          items: [
            {
              text: "Nuxt API Layer",
              link: "/frontend/mp-nuxt-api-layer",
            },
            {
              text: "MSAL Plugin",
              link: "/frontend/mp-nuxt-msal-plugin",
            },
            {
              text: "API Generator",
              link: "/frontend/api-generator",
            },
            {
              text: "API Validation",
              link: "/frontend/api-validation",
            },
          ],
        },
        {
          text: "History",
          items: [{ text: "Changelog", link: "/frontend/changelog" }],
        },
      ],

      "/mobile/": [
        {
          text: "Mobile",
          items: [{ text: "Overview", link: "/mobile/" }],
        },
        {
          text: "Getting Started",
          items: [
            {
              text: "Getting Started",
              link: "/mobile/getting-started",
            },
            { text: "Architecture", link: "/mobile/architecture" },
            {
              text: "Mobile App Overview",
              link: "/mobile/mobile-app-overview",
            },
          ],
        },
        {
          text: "Core",
          items: [
            {
              text: "Database & SQLite",
              link: "/mobile/database",
            },
            {
              text: "State Management",
              link: "/mobile/state-management",
            },
            { text: "API Layer", link: "/mobile/api-layer" },
            { text: "Components", link: "/mobile/components" },
            { text: "Routing", link: "/mobile/routing" },
            {
              text: "Internationalization",
              link: "/mobile/i18n",
            },
          ],
        },
        {
          text: "Build & Deploy",
          items: [
            {
              text: "Mobile App Builder",
              link: "/mobile/mobile-app-builder",
            },
            { text: "iOS Build", link: "/mobile/ios-build" },
            {
              text: "Android Build",
              link: "/mobile/android-build",
            },
            { text: "Deployment", link: "/mobile/deployment" },
            { text: "Live Update", link: "/mobile/live-update" },
            {
              text: "Native Submodules",
              link: "/mobile/native-submodules",
            },
          ],
        },
        {
          text: "Cross-cutting",
          items: [
            {
              text: "Shared Layers",
              link: "/mobile/shared-layers",
            },
            { text: "Testing", link: "/mobile/testing" },
          ],
        },
      ],

      "/testing/": [
        {
          text: "Testing",
          items: [
            { text: "Overview", link: "/testing/" },
            {
              text: "E2E Tests (Playwright)",
              link: "/testing/e2e-tests",
            },
            { text: "API Tests", link: "/testing/api-tests" },
          ],
        },
      ],
    },

    search: {
      provider: "local",
    },

    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/medipal/mp-documentation",
      },
    ],

    footer: {
      message:
        'Medipal Documentation &nbsp;|&nbsp; <a href="https://docs.medipal.dev" target="_blank">https://docs.medipal.dev</a>',
    },
  },

  markdown: {
    theme: {
      light: "github-light",
      dark: "github-dark",
    },
  },
});
