# Testing

## Unit Tests (Vitest)

Unit tests use **Vitest** with `@nuxt/test-utils` and `happy-dom`.

```bash
npm run test
```

Test files live in `tests/` and follow the `*.spec.ts` naming convention.

### Test Setup

```ts
// vitest.config.mjs
import { defineVitestConfig } from "@nuxt/test-utils/config";

export default defineVitestConfig({
  test: {
    environment: "nuxt",
    // ...
  },
});
```

### Writing Tests

```ts
import { describe, it, expect } from "vitest";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import MyComponent from "@/components/MyComponent.vue";

describe("MyComponent", () => {
  it("renders correctly", async () => {
    const wrapper = await mountSuspended(MyComponent);
    expect(wrapper.text()).toContain("expected text");
  });
});
```

### What to Test

- **Utility functions** — `scheduleToDates`, `isScheduleAvailable`, `urlPayloadDecoder` are the most critical and testable
- **Composables** — pure logic in composables (mock Capacitor plugins)
- **Components** — render, prop handling, emit events

### Mocking Capacitor

Capacitor plugins need to be mocked in tests since they're not available in the test environment:

```ts
vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: vi.fn().mockResolvedValue({ value: null }),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));
```

## No E2E Tests

E2E tests have been moved to a dedicated repository. Do not add Playwright or other E2E test dependencies to this project.

## CI Testing

Tests run automatically in GitHub Actions on pull requests. See `.github/workflows/` for the CI configuration.

## Linting

```bash
npm run lint    # ESLint
npm run format  # Prettier
```

ESLint is configured via `eslint.config.js` using `@nuxt/eslint` flat config. Prettier is integrated via `eslint-plugin-prettier`.

Husky runs `lint` on pre-commit to maintain quality.
