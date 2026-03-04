# Testing

This page documents the testing strategy, tooling, and patterns used in the mp-frontend codebase.

## Testing Stack

| Tool               | Purpose                          | Config                                               |
| ------------------ | -------------------------------- | ---------------------------------------------------- |
| **Vitest**         | Unit & component tests           | `vitest.config.ts`                                   |
| **Vue Test Utils** | Component mounting & interaction | Used with Vitest                                     |
| **Playwright**     | End-to-end tests                 | See [E2E Tests](/testing/e2e-tests) (platform-level) |

### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.test.ts"],
  },
});
```

Test files must use the `.test.ts` extension and can be co-located with the source code or placed in a dedicated `__tests__/` directory.

---

## Unit Tests

### What to Unit Test

| Target              | Priority   | Examples                                        |
| ------------------- | ---------- | ----------------------------------------------- |
| Utility functions   | **High**   | `formatAxiosError`, date formatters, validators |
| Composables         | **High**   | `useFormatAxiosError`, `usePluginData`          |
| Store actions       | **Medium** | API call logic, state mutations, error handling |
| Type guards         | **Medium** | `isQuestionnaire`, `isPluginAction`             |
| Computed properties | **Low**    | Derived state in stores                         |

### Utility Function Tests

Utility functions are pure functions — easy to test:

```typescript
// app/utils/__tests__/formatAxiosError.test.ts
import { describe, it, expect } from "vitest";
import { formatAxiosError } from "../formatAxiosError";

describe("formatAxiosError", () => {
  it("should extract message from axios error response", () => {
    const error = {
      response: {
        data: { message: "Not found" },
        status: 404,
      },
    };

    const result = formatAxiosError({
      error,
      t: (key: string, fallback: string) => fallback,
    });

    expect(result).toBe("Not found");
  });

  it("should return fallback for network errors", () => {
    const error = new Error("Network Error");

    const result = formatAxiosError({
      error,
      t: (key: string, fallback: string) => fallback,
    });

    expect(result).toContain("Network");
  });
});
```

### Composable Tests

Test composables by calling them within a Vue component context:

```typescript
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { defineComponent } from "vue";

describe("useCounter", () => {
  it("should increment count", () => {
    const TestComponent = defineComponent({
      setup() {
        const { count, increment } = useCounter();
        return { count, increment };
      },
      template: "<div />",
    });

    const wrapper = mount(TestComponent);
    expect(wrapper.vm.count).toBe(0);

    wrapper.vm.increment();
    expect(wrapper.vm.count).toBe(1);
  });
});
```

---

## Component Tests

### Mounting Components

Use Vue Test Utils to mount components with required dependencies:

```typescript
import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import MyComponent from "../MyComponent.vue";

describe("MyComponent", () => {
  it("should render with props", () => {
    const wrapper = mount(MyComponent, {
      props: {
        title: "Test Title",
        isPublished: false,
      },
    });

    expect(wrapper.text()).toContain("Test Title");
  });

  it("should emit close event", async () => {
    const wrapper = mount(MyComponent, {
      props: { title: "Test" },
    });

    await wrapper.find("[data-testid='close-button']").trigger("click");
    expect(wrapper.emitted("close")).toHaveLength(1);
  });
});
```

### Providing Dependencies

Components that use stores, i18n, or other plugins need them provided in the test:

```typescript
import { createTestingPinia } from "@pinia/testing";
import { createI18n } from "vue-i18n";

const wrapper = mount(MyComponent, {
  global: {
    plugins: [
      createTestingPinia({
        initialState: {
          questionnaire: {
            questionnaire: { id: "1", name: "Test" },
          },
        },
      }),
      createI18n({
        locale: "en_GB",
        messages: { en_GB: {} },
        missingWarn: false,
        fallbackWarn: false,
      }),
    ],
  },
});
```

---

## E2E Tests

End-to-end tests are managed at the platform level using **Playwright**. See the dedicated [E2E Tests](/testing/e2e-tests) documentation for setup, configuration, and test patterns.

Frontend-specific E2E considerations:

- Tests run against a fully built Nuxt application
- Authentication is handled via MSAL mock or test tokens
- API responses can be intercepted and mocked at the network level
- Visual regression testing for critical UI components

---

## What to Test

### Must Test

- **Boundary cases**: Empty arrays, null values, maximum lengths
- **Error paths**: API failures, network errors, invalid input
- **Scope checks**: Verify that `scopeStore.hasScope()` gates actions correctly
- **State transitions**: DRAFT → PUBLISHED → ARCHIVED workflows
- **User input validation**: Form validation rules, required fields

### Should Test

- **Computed properties**: Derived state correctness
- **Event emissions**: Component emits correct events with correct payloads
- **Conditional rendering**: Elements show/hide based on state
- **Toast notifications**: Correct messages on success/failure

### Don't Test

- **Framework behavior**: Vue reactivity, Pinia store internals, Nuxt routing
- **Third-party libraries**: Assume `@nuxt/ui` components work correctly
- **Implementation details**: Don't test internal state that isn't exposed
- **Styling**: CSS class presence (use visual regression tests instead)

---

## Mocking Patterns

### API Mocking

Mock the API client to avoid network calls in tests:

```typescript
import { vi } from "vitest";

// Mock useApi composable
vi.mock("~/composables/useApi", () => ({
  useApi: () => ({
    api: {
      questionnaireList: vi.fn().mockResolvedValue({
        data: [{ id: "1", name: "Test Questionnaire" }],
      }),
      questionnaireDetail: vi.fn().mockResolvedValue({
        data: { id: "1", name: "Test", status: "DRAFT" },
      }),
      questionnaireCreate: vi.fn().mockResolvedValue({
        data: { id: "2", name: "New" },
      }),
    },
  }),
}));
```

### Store Mocking

Use `@pinia/testing` for store mocking:

```typescript
import { createTestingPinia } from "@pinia/testing";

// Auto-stubs all actions
const pinia = createTestingPinia({
  createSpy: vi.fn,
  initialState: {
    scope: {
      scopes: ["questionnaire:read", "questionnaire:write"],
    },
  },
});

// Access mocked store
const store = useQuestionnaireStore();
store.fetchQuestionnaires = vi.fn();
```

### i18n Mocking

Provide a minimal i18n instance that returns keys as-is:

```typescript
import { createI18n } from "vue-i18n";

const i18n = createI18n({
  locale: "en_GB",
  messages: { en_GB: {} },
  missingWarn: false,
  fallbackWarn: false,
});

// In mount options
const wrapper = mount(Component, {
  global: {
    plugins: [i18n],
  },
});
```

### Toast Mocking

Mock the toast composable to verify notifications:

```typescript
const mockToast = { add: vi.fn() };

vi.mock("#imports", () => ({
  useToast: () => mockToast,
}));

// After action
expect(mockToast.add).toHaveBeenCalledWith(
  expect.objectContaining({
    color: "error",
    icon: "lucide:x-circle",
  }),
);
```

---

## Running Tests

```bash
# Run all tests
npx vitest

# Run tests in watch mode
npx vitest --watch

# Run specific test file
npx vitest app/utils/__tests__/formatAxiosError.test.ts

# Run with coverage
npx vitest --coverage

# Type checking (not tests, but part of CI quality gates)
npm run check-types
```
