# Adoption Playbook
## Implementing VS Code Engineering Practices in Your Project

> A phased guide to adopting the engineering patterns that make microsoft/vscode one of the most disciplined large-scale TypeScript codebases. Each phase builds on the previous one.

---

# Phase 1: Foundations (Week 1)

**Goal**: Zero-tolerance linting, deterministic formatting, basic CI hygiene.  
**Effort**: Low — mostly configuration.

## 1.1 Make ESLint Warnings Fatal

VS Code's #1 linting insight: **warnings are errors in CI**.

```js
// eslint.config.js or your CI lint script
// Option A: Use --max-warnings 0
// package.json:
{
  "scripts": {
    "lint": "eslint . --max-warnings 0"
  }
}
```

```js
// Option B: Custom check (VS Code's approach in build/eslint.ts)
if (results.warningCount > 0 || results.errorCount > 0) {
    process.exit(1);
}
```

**Why**: Teams accumulate hundreds of warnings that hide real issues. Zero tolerance keeps the signal clean.

## 1.2 Deterministic Formatting

VS Code uses the TS language service formatter, but for most teams **Prettier + editorconfig** achieves the same deterministic outcome more easily.

### `.editorconfig` (copy directly)
```ini
root = true

[*]
indent_style = tab
indent_size = 4
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.{yml,yaml,json}]
indent_style = space
indent_size = 2

[*.md]
trim_trailing_whitespace = false
```

### `.prettierrc`
```json
{
  "useTabs": true,
  "tabWidth": 4,
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 120
}
```

### CI format check
```yaml
- name: Check formatting
  run: npx prettier --check "src/**/*.{ts,tsx,js,json}"
```

**Key principle**: Format-on-save locally + byte-for-byte CI verification = zero formatting PRs.

### `.vscode/settings.json`
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "files.trimTrailingWhitespace": true,
  "files.insertFinalNewline": true
}
```

### `.vscode/extensions.json`
```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "editorconfig.editorconfig"
  ]
}
```

## 1.3 TypeScript Strict Mode

Start strict from day one — it's much harder to add later.

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitReturns": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "forceConsistentCasingInFileNames": true,
    "allowUnreachableCode": false
  }
}
```

## 1.4 CI Quick Wins

### Cancel stale runs
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### Cache node_modules
```yaml
- name: Cache node_modules
  uses: actions/cache@v4
  with:
    path: node_modules
    key: node-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
```

### Retry npm install
```yaml
- name: Install dependencies
  run: |
    for i in 1 2 3; do
      npm ci && break
      echo "Attempt $i failed, retrying..."
      sleep 2
    done
```

### Failure-only artifacts
```yaml
- name: Upload crash logs
  if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: crash-logs-${{ github.run_attempt }}
    path: .build/logs/
```

## 1.5 Pre-Commit Hook

```json
// package.json
{
  "scripts": {
    "precommit": "npx lint-staged"
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --max-warnings 0", "prettier --check"],
    "*.{json,yml,yaml}": ["prettier --check"]
  }
}
```

Install with:
```bash
npx husky init
echo "npm run precommit" > .husky/pre-commit
```

---

# Phase 2: Test Infrastructure (Weeks 2-3)

**Goal**: Fast, reliable, parallelized tests.  
**Effort**: Medium — requires test harness changes.

## 2.1 Separate Test Environments

Follow VS Code's directory convention:

```
src/
  modules/
    auth/
      auth.service.ts
      test/
        common/        ← runs everywhere (pure logic)
          auth.test.ts
        browser/       ← needs DOM
          auth-ui.test.ts
        node/          ← needs Node APIs
          auth-db.test.ts
```

Create separate test commands:
```json
{
  "scripts": {
    "test": "npm run test:unit && npm run test:integration",
    "test:unit": "vitest run --config vitest.unit.config.ts",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "test:e2e": "playwright test"
  }
}
```

## 2.2 Test Sharding in CI

### Simple approach with Vitest/Jest
```yaml
strategy:
  matrix:
    shard: [1, 2, 3, 4]
jobs:
  test:
    steps:
      - run: npx vitest run --shard ${{ matrix.shard }}/4
```

### VS Code's approach (custom harness)
```js
// test runner accepts --testSplit i/n
if (opts.testSplit) {
    const [i, n] = opts.testSplit.split('/').map(Number);
    const chunkSize = Math.floor(modules.length / n);
    modules = modules.slice(start, end);
}
```

## 2.3 In-Memory Mocks (Avoid I/O)

VS Code's `InMemoryFileSystemProvider` is the model. For your project:

```typescript
// test/mocks/in-memory-store.ts
export class InMemoryStore<T> implements IStore<T> {
  private data = new Map<string, T>();

  async get(id: string): Promise<T | undefined> {
    return this.data.get(id);
  }

  async set(id: string, value: T): Promise<void> {
    this.data.set(id, value);
  }

  async delete(id: string): Promise<void> {
    this.data.delete(id);
  }
}
```

**Principle**: Tests that touch disk/network are integration tests. Unit tests use in-memory implementations.

## 2.4 Mock DI Container for Tests

Inspired by VS Code's `TestInstantiationService`:

```typescript
// test/mocks/test-container.ts
export class TestContainer {
  private overrides = new Map<symbol, any>();

  mock<T>(token: symbol, impl: Partial<T>): this {
    this.overrides.set(token, impl);
    return this;
  }

  resolve<T>(token: symbol): T {
    return this.overrides.get(token) ?? throw new Error(`No mock for ${token.toString()}`);
  }
}

// Usage in tests:
const container = new TestContainer()
  .mock<IUserService>(USER_SERVICE, { getUser: async () => mockUser })
  .mock<ILogger>(LOGGER, { info: () => {}, error: () => {} });
```

## 2.5 Disposable/Resource Leak Detection

Adapted from VS Code's `ensureNoDisposablesAreLeakedInTestSuite`:

```typescript
// test/utils/leak-detector.ts
const activeResources = new Set<string>();

export function trackResource(name: string, cleanup: () => void) {
  activeResources.add(name);
  return { dispose: () => { cleanup(); activeResources.delete(name); } };
}

afterEach(() => {
  if (activeResources.size > 0) {
    const leaks = [...activeResources].join(', ');
    activeResources.clear();
    throw new Error(`Resource leaks detected: ${leaks}`);
  }
});
```

## 2.6 CI Test Matrix

```yaml
# .github/workflows/test.yml
jobs:
  unit-tests:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        shard: [1, 2]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx vitest run --shard ${{ matrix.shard }}/2

  integration-tests:
    needs: unit-tests
    runs-on: ubuntu-latest
    steps:
      - run: npm run test:integration

  e2e-tests:
    needs: unit-tests
    runs-on: ubuntu-latest
    steps:
      - run: npx playwright test
```

---

# Phase 3: Architectural Enforcement (Weeks 4-6)

**Goal**: Prevent architectural drift with automated checks.  
**Effort**: High — requires custom rules and structural changes.

## 3.1 Layer Architecture with Import Rules

### Define your layers
```
src/
  core/          ← pure business logic (no framework deps)
    common/      ← shared types/utils
    services/    ← service interfaces
  platform/      ← framework adapters (Express, React, etc.)
  features/      ← feature modules (one folder per feature)
  app/           ← entrypoint/composition root
```

### Enforce with ESLint `import/no-restricted-paths`
```js
// eslint.config.js
{
  rules: {
    'import/no-restricted-paths': ['error', {
      zones: [
        // core/ cannot import from platform/ or features/ or app/
        {
          target: './src/core/**',
          from: './src/platform/**',
          message: 'core/ must not depend on platform/'
        },
        {
          target: './src/core/**',
          from: './src/features/**',
          message: 'core/ must not depend on features/'
        },
        {
          target: './src/core/**',
          from: './src/app/**',
          message: 'core/ must not depend on app/'
        },
        // features/ cannot import from app/
        {
          target: './src/features/**',
          from: './src/app/**',
          message: 'features/ must not depend on app/'
        },
        // features cannot import from other features (enforce isolation)
        // Use dependency-cruiser for this level of granularity
      ]
    }]
  }
}
```

### Advanced: Custom ESLint Rule (VS Code-style)

```js
// .eslint-plugin-local/code-layering.js
module.exports = {
  meta: {
    type: 'problem',
    messages: {
      badLayering: 'Bad layering: {{source}} cannot import from {{target}}'
    }
  },
  create(context) {
    const LAYER_ORDER = ['core', 'platform', 'features', 'app'];

    return {
      ImportDeclaration(node) {
        const currentFile = context.getFilename();
        const importPath = node.source.value;

        const currentLayer = getLayer(currentFile);
        const importLayer = getLayer(importPath);

        if (LAYER_ORDER.indexOf(currentLayer) < LAYER_ORDER.indexOf(importLayer)) {
          context.report({
            node,
            messageId: 'badLayering',
            data: { source: currentLayer, target: importLayer }
          });
        }
      }
    };
  }
};
```

## 3.2 Dependency Cruiser (Automated Architecture Validation)

For projects that want VS Code-level enforcement without writing custom ESLint rules:

```js
// .dependency-cruiser.cjs
module.exports = {
  forbidden: [
    {
      name: 'no-core-to-platform',
      severity: 'error',
      from: { path: '^src/core' },
      to: { path: '^src/platform' }
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true }
    },
    {
      name: 'no-cross-feature-imports',
      severity: 'warn',
      from: { path: '^src/features/([^/]+)/' },
      to: { path: '^src/features/([^/]+)/', pathNot: '$1' }
    }
  ]
};
```

```json
{
  "scripts": {
    "validate-architecture": "depcruise src --config .dependency-cruiser.cjs"
  }
}
```

## 3.3 Service Interfaces + DI

Inspired by VS Code's `createDecorator` pattern:

```typescript
// src/core/services/interfaces.ts
export interface IUserService {
  getUser(id: string): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User>;
}

export interface INotificationService {
  send(userId: string, message: string): Promise<void>;
}

// src/core/services/tokens.ts
export const USER_SERVICE = Symbol('IUserService');
export const NOTIFICATION_SERVICE = Symbol('INotificationService');
```

```typescript
// src/platform/services/user.service.ts (real implementation)
export class UserService implements IUserService { ... }

// test/mocks/user.service.mock.ts (test implementation)
export class MockUserService implements IUserService { ... }
```

**Why**: Explicit interfaces make it trivial to swap implementations for testing, and enforce that consumers depend on contracts, not implementations.

## 3.4 Feature Contribution Pattern

Adapted from VS Code's `registerWorkbenchContribution2`:

```typescript
// src/features/registry.ts
type FeaturePhase = 'startup' | 'idle' | 'on-demand';

interface FeatureRegistration {
  id: string;
  phase: FeaturePhase;
  activate: () => Promise<void> | void;
}

const features: FeatureRegistration[] = [];

export function registerFeature(registration: FeatureRegistration) {
  features.push(registration);
}

export async function activateFeatures(phase: FeaturePhase) {
  const batch = features.filter(f => f.phase === phase);
  await Promise.all(batch.map(f => f.activate()));
}
```

```typescript
// src/features/notifications/notifications.contribution.ts
import { registerFeature } from '../registry';

registerFeature({
  id: 'notifications',
  phase: 'idle',
  activate: () => {
    // Set up notification listeners, UI, etc.
  }
});
```

**Why**: Features are self-contained, phase-loaded, and discoverable. Adding a feature = adding one folder + one registration.

## 3.5 PR Template

```markdown
<!-- .github/pull_request_template.md -->
## Description
<!-- What does this PR do? -->

## Related Issue
<!-- Link the issue: Fixes #123 -->

## How to Test
<!-- Step-by-step instructions for reviewers -->

## Checklist
- [ ] Tests added/updated
- [ ] Lint passes (`npm run lint`)
- [ ] No layer violations (`npm run validate-architecture`)
- [ ] Documentation updated (if applicable)
```

## 3.6 Reusable CI Workflow Template

```yaml
# .github/workflows/reusable-test.yml
name: Reusable Test Workflow
on:
  workflow_call:
    inputs:
      os:
        type: string
        required: true
      node-version:
        type: string
        default: '20'
      test-type:
        type: string
        required: true  # 'unit', 'integration', 'e2e'

jobs:
  test:
    runs-on: ${{ inputs.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ inputs.node-version }}
          cache: 'npm'
      - run: npm ci
      - run: npm run test:${{ inputs.test-type }}
```

```yaml
# .github/workflows/pr.yml
name: PR Checks
on:
  pull_request:
    branches: [main]

concurrency:
  group: pr-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { cache: 'npm' }
      - run: npm ci
      - run: |
          npm run lint
          npm run format:check
          npm run validate-architecture

  unit-linux:
    uses: ./.github/workflows/reusable-test.yml
    with: { os: ubuntu-latest, test-type: unit }

  unit-windows:
    uses: ./.github/workflows/reusable-test.yml
    with: { os: windows-latest, test-type: unit }

  unit-macos:
    uses: ./.github/workflows/reusable-test.yml
    with: { os: macos-latest, test-type: unit }

  integration:
    needs: [unit-linux]
    uses: ./.github/workflows/reusable-test.yml
    with: { os: ubuntu-latest, test-type: integration }
```

---

# Phase 4: Advanced Patterns (Ongoing)

**Goal**: VS Code-grade engineering at scale.

## 4.1 Multiple tsconfig Targets

Verify different compilation surfaces independently:

```json
// tsconfig.browser.json — verify no Node APIs leak into browser code
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "types": ["dom"] },
  "include": ["src/**/common/**", "src/**/browser/**"]
}
```

```json
// tsconfig.node.json — verify no DOM APIs leak into server code
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["src/**/common/**", "src/**/node/**"]
}
```

```json
{
  "scripts": {
    "typecheck:browser": "tsc --noEmit -p tsconfig.browser.json",
    "typecheck:node": "tsc --noEmit -p tsconfig.node.json",
    "typecheck:all": "npm-run-all -p typecheck:browser typecheck:node"
  }
}
```

## 4.2 Visual Regression Testing

Adapted from VS Code's screenshot workflow:

```yaml
# .github/workflows/screenshots.yml
- name: Run visual regression tests
  run: npx playwright test --project=screenshots

- name: Post visual diff to PR
  if: failure() && github.event_name == 'pull_request'
  uses: actions/github-script@v7
  with:
    script: |
      const marker = '<!-- visual-regression-report -->';
      const body = `${marker}\n## 📸 Visual Regression Detected\nScreenshot diffs uploaded as artifacts.`;
      // Create or update PR comment (idempotent)
```

## 4.3 API Break Detection

If your project exposes a public API:

```json
{
  "scripts": {
    "api:check": "api-extractor run --local",
    "api:update": "api-extractor run --local --diagnostics"
  }
}
```

Use `@microsoft/api-extractor` to detect breaking changes in your public API surface.

## 4.4 Console Output Guards in Tests

Prevent noisy logging from hiding real issues:

```typescript
// test/setup.ts
const originalConsole = { ...console };
let unexpectedOutput = false;

beforeEach(() => {
  console.log = (...args: any[]) => {
    unexpectedOutput = true;
    originalConsole.log('[UNEXPECTED]', ...args);
  };
});

afterEach(function () {
  if (unexpectedOutput && this.currentTest?.state !== 'failed') {
    throw new Error('Test produced unexpected console output');
  }
  unexpectedOutput = false;
  Object.assign(console, originalConsole);
});
```

---

# Checklist Summary

## Phase 1 ✅ Foundations
- [ ] ESLint `--max-warnings 0` in CI
- [ ] `.editorconfig` committed
- [ ] Formatter config + format-on-save
- [ ] CI format check (byte-for-byte)
- [ ] `tsconfig.json` with `strict: true`
- [ ] CI concurrency + cancel-in-progress
- [ ] node_modules caching
- [ ] npm install retry logic
- [ ] Failure-only artifact uploads
- [ ] Pre-commit hook with lint-staged

## Phase 2 ✅ Test Infrastructure
- [ ] Separate test commands (unit/integration/e2e)
- [ ] Test sharding in CI
- [ ] In-memory mocks for I/O-heavy services
- [ ] Mock DI container for tests
- [ ] Resource leak detection in test teardown
- [ ] Cross-platform CI matrix

## Phase 3 ✅ Architecture
- [ ] Defined layer hierarchy with import rules
- [ ] `validate-architecture` script in CI
- [ ] Service interfaces + DI tokens
- [ ] Feature contribution/registration pattern
- [ ] PR template with testing instructions
- [ ] Reusable CI workflow templates

## Phase 4 ✅ Advanced
- [ ] Multiple tsconfig targets (browser/node)
- [ ] Visual regression testing
- [ ] API break detection
- [ ] Console output guards in tests

---

# References

- [VS Code Source Organization](https://github.com/microsoft/vscode/wiki/Source-Code-Organization)
- [VS Code Contributing Guide](https://github.com/microsoft/vscode/blob/main/CONTRIBUTING.md)
- [Full Technical Analysis](ANALYSIS.md) — detailed findings with file paths and code snippets
