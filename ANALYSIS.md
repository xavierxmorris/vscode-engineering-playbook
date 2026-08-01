# VS Code Engineering Deep Analysis
## How microsoft/vscode achieves faster tests, stricter linters, deterministic formatting, better CI feedback loops, and smaller verifiable units of work

> Analysis performed 2026-04-09 using Opus 4.6 + GPT-5.4 against https://github.com/microsoft/vscode
> **Re-validated 2026-08-01** against commit [`7234ef0`](https://github.com/microsoft/vscode/commit/7234ef01c2cace7cfa911d792ce9c5b1f333fca5) using Claude Opus 5 + GPT-5.6 Sol at max reasoning effort, working from a local clone rather than API calls. See [VALIDATION.md](VALIDATION.md) for the full audit trail and every correction applied.

---

# 1. 🧪 FASTER TESTS

## 1.1 Test Framework & Architecture

VS Code uses **Mocha** (not Jest) in TDD mode with **three distinct test entry points**:

| Environment | Entry Point | Command |
|---|---|---|
| **Electron** | `test/unit/electron/index.js` | `scripts/test.sh` |
| **Node.js** | `test/unit/node/index.js` | `npm run test-node` |
| **Browser** | `test/unit/browser/index.js` | `npm run test-browser` |

The Electron and Browser entry points are **custom harnesses**; the Node entry point is a standard Mocha CLI invocation over a custom loader file (`package.json`: `"test-node": "mocha test/unit/node/index.js --delay --ui=tdd --timeout=5000 --exit"`). All three run Mocha in TDD mode and control module loading themselves.

## 1.2 The `postMessage` Hack — Eliminating Browser Timer Throttling

**The single most impactful test speed optimization.** Found in `test/unit/browser/renderer.html` and `test/unit/electron/renderer.js`:

> 🔗 **VS Code source:** [`test/unit/electron/renderer.js` L407-L448](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/test/unit/electron/renderer.js#L407-L448) · [`test/unit/browser/renderer.html` L38-L75](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/test/unit/browser/renderer.html#L38-L75) @ `7234ef0` — excerpt condensed; the real IIFE keeps a `pending` array and a `message` listener

```js
// Browsers throttle setTimeout(0) to 4ms after nesting level > 5.
// Mocha calls setTimeout(0) between EVERY test.
// With thousands of tests, that's thousands × 4ms = seconds of pure waste.
//
// VS Code overrides Mocha's scheduler with postMessage, which has NO throttling:
const setTimeout0 = (() => {
    if (setTimeout0IsFaster) {
        // posts a message to self and resolves the callback in the 'message' handler
        // (a macrotask, but one the browser does NOT clamp to 4ms)
    }
    return (callback) => setTimeout(callback);
})();

Mocha.Runner.immediately = setTimeout0;  // Patch Mocha's scheduler!
```

**Impact**: Eliminates seconds of artificial delay across large test suites.

## 1.3 Test Parallelization

### CI-Level Sharding (`--testSplit i/n`)
`test/unit/electron/renderer.js`:
> 🔗 **VS Code source:** [`test/unit/electron/renderer.js` L175-L181](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/test/unit/electron/renderer.js#L175-L181) @ `7234ef0`

```js
if (opts.testSplit) {
    const [i, n] = opts.testSplit.split('/').map(Number);
    const chunkSize = Math.floor(modules.length / n);
    modules = modules.slice(start, end);
}
```
The Electron harness supports splitting (`test/unit/electron/index.js:75` documents `--testSplit <i>/<n>`), but **no VS Code CI job currently passes it** — a repo-wide search finds `testSplit` only under `test/unit/electron/`. It is available tooling, not an active CI strategy.

### Multi-Browser Parallel Execution (local default only)
`test/unit/browser/index.js` defaults to `['chromium', 'firefox', 'webkit']` and runs them **simultaneously** via Playwright (`--sequential` opts out). Note that CI does **not** use this: `pr-linux-test.yml:337` and `pr-win32-test.yml:146` pass `--browser chromium`, and `pr-darwin-test.yml:136` passes `--browser webkit` — one browser per OS job.
> 🔗 **VS Code source:** [`test/unit/browser/index.js` L399-L402](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/test/unit/browser/index.js#L399-L402) @ `7234ef0` — default browser list at L46

```js
// Default: all browsers in parallel
messages = await Promise.all(browsers.map(async browser => {
    return await runTestsInBrowser(modules, browserType, browserChannel);
}));
```

### CI Matrix: 18 Parallel Jobs
`.github/workflows/pr.yml` defines **18** top-level jobs, all concurrent with no `needs:` between them:
- Linux/macOS/Windows × Electron / Electron-Smoke / Browser / Remote (12 jobs)
- Plus: Compile & Hygiene, Linux CLI tests, and four Copilot jobs (check test cache, check telemetry, Linux tests, Windows tests)

## 1.4 Test Performance Optimizations

### In-Memory File System
`src/vs/platform/files/common/inMemoryFilesystemProvider.ts` — a complete `IFileSystemProvider` with zero disk I/O, used extensively in tests.

### Mock DI System
`src/vs/platform/instantiation/test/common/instantiationServiceMock.ts`:
> 🔗 **VS Code source:** [`src/vs/platform/instantiation/test/common/instantiationServiceMock.ts` L20-L70](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/platform/instantiation/test/common/instantiationServiceMock.ts#L20-L70) @ `7234ef0` — also provides `stubInstance`, `stubPromise`, `spy`

```typescript
export class TestInstantiationService extends InstantiationService {
    public mock<T>(service: ServiceIdentifier<T>): T | sinon.SinonMock { ... }
    public stub<T>(service: ServiceIdentifier<T>, obj: Partial<T>): T { ... }
}
```
Tests never bootstrap the full VS Code application.

### Massive Test Services Layer
`src/vs/workbench/test/browser/workbenchTestServices.ts` (2,167 lines, 56 classes) contains dozens of mock service implementations. Tests compose only what they need.

### Disposable Leak Detection (Enforced by ESLint)
`src/vs/base/test/common/utils.ts`:
> 🔗 **VS Code source:** [`src/vs/base/test/common/utils.ts` L53-L59](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/test/common/utils.ts#L53-L59) @ `7234ef0`

```typescript
export function ensureNoDisposablesAreLeakedInTestSuite(): Pick<DisposableStore, 'add'> {
	let tracker: DisposableTracker | undefined;
	let store: DisposableStore;
	setup(() => {
		store = new DisposableStore();
		tracker = new DisposableTracker();
		setDisposableTracker(tracker);
```
Non-excluded top-level `suite(...)` calls must call this — enforced by the `code-ensure-no-disposables-leak-in-test` rule. It prevents leaked handles from accumulating and slowing later suites.

### Console Output Guards
Tests that produce unexpected `console.log/error/warn` **fail** — catching performance-degrading logging.

## 1.5 Environment-Based Test Routing

Tests live alongside source and are routed by **directory convention**:

| Directory | Runs In |
|---|---|
| `**/test/common/**` | All environments |
| `**/test/browser/**` | Browser + Electron |
| `**/test/node/**` | Node.js + Electron |
| `**/test/electron-browser/**` | Electron harness only |
| `**/test/electron-utility/**` | Electron harness only |
| `**/test/electron-main/**` | Electron harness only (these run in the Electron *renderer*; there is no separate electron-main runner under `test/unit/`) |

Routing is done by **exclusion**, and only in two of the three harnesses: `test/unit/browser/index.js:118` excludes `**/{node,electron-browser,electron-main,electron-utility}/**/*.test.js`, and `test/unit/node/index.js:60` excludes `**/{browser,electron-browser,electron-main,electron-utility}/**/*.test.js`. The Electron harness globs `**/test/**/*.test.js` with no exclusions, so it runs everything.

## 1.6 Test Speed Summary

| Strategy | Impact |
|---|---|
| `postMessage` replacing `setTimeout(0)` | 🔥🔥🔥 |
| 18 parallel CI jobs | 🔥🔥🔥 |
| InMemoryFileSystemProvider · TestInstantiationService | 🔥🔥 |
| node_modules caching | 🔥🔥 |
| Disposable leak detection | 🔥 |
| `--testSplit i/n` sharding | — (exists, **unused in CI**) |
| Multi-browser parallel | — (**local default only**; CI runs one browser per job) |

---

# 2. 🔍 STRICTER LINTERS

## 2.1 ESLint: Warnings Are Errors

### Warnings fail the build, not just the console

**Prevents:** the slow accumulation of hundreds of ignored warnings that hide real defects.

> 🔗 **VS Code source:** [`build/eslint.ts` L31-L45](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/eslint.ts#L31-L45) @ `7234ef0` — `// ...` elides the formatter/output block at L32-L36

```ts
const results = await linter.lintFiles(getEslintFilePatterns(args));
// ...
let warningCount = 0;
let errorCount = 0;
for (const r of results) {
    warningCount += r.warningCount;
    errorCount += r.errorCount;
}
if (warningCount > 0 || errorCount > 0) {
    throw new Error(`eslint failed with ${warningCount + errorCount} warnings and/or errors`);
}
```

**How it works:** The lint task sums `warningCount` and `errorCount` across every linted file, then throws if either is non-zero. There is no severity distinction at the CI boundary — a rule configured as `warn` still fails the build, which lets rules be authored as `warn` for editor ergonomics while staying fatal in CI.

**Adopt it:** Run `eslint . --max-warnings 0` in CI. Keep noisy new rules at `warn` so editors don't scream, and let the zero-tolerance gate enforce them.

## 2.2 Custom ESLint Plugin (`.eslint-plugin-local/`)

VS Code maintains **48 custom ESLint rules** (`.eslint-plugin-local/index.ts` auto-registers every `*.ts` in that folder except `index.ts` and `utils.ts`). The most architecturally significant:

### Architectural Boundary Rules
| Rule | Purpose |
|---|---|
| `code-layering` | Enforces layer dependency flow (common → browser → electron-browser, etc.) |
| `code-import-patterns` | Controls which paths each layer may import; requires relative imports |
| `code-no-deep-import-of-internal` | Prevents deep imports of `*Internal` modules |
| `code-no-static-node-module-import` | **error** in `electron-main`/`node` startup paths: bans static imports of *any* `node_modules` package (Node built-ins, `electron` and relative imports are allowed); requires `await import(...)` or `import type` |
| `code-no-http-import` | Blocks runtime HTTP imports (type-only allowed) |

### Codebase Convention Rules
| Rule | Purpose |
|---|---|
| `code-no-unexternalized-strings` | Enforces localization discipline |
| `code-no-localization-template-literals` | Bans template literals in localization calls (**error**) |
| `code-declare-service-brand` | Auto-fixes any `_serviceBrand` property that has a value into `declare _serviceBrand: undefined;` (it does not require services to declare one) |
| `code-no-any-casts` | Bans `as any` |
| `code-no-dangerous-type-assertions` | Bans object-literal assertions like `{...} as T` |
| `code-no-potentially-unsafe-disposables` | Catches leak-prone disposable patterns |
| `code-no-test-only` | Prevents `.only()` from shipping (**error**) |
| `code-no-reader-after-await` | Protects reactive reader usage across async boundaries |

### API-Specific Rules (for `vscode.d.ts`)
- `vscode-dts-use-thenable` — Use `Thenable` not `Promise`
- `vscode-dts-interface-naming` / `provider-naming` / `event-naming`

### An `async` test-suite callback silently registers tests outside their suite

**Prevents:** tests that silently detach from their named suite — vanishing from a filtered CI run while the build still reports green.

> 🔗 **VS Code source:** [`.eslint-plugin-local/code-no-test-async-suite.ts` L21-L33](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/.eslint-plugin-local/code-no-test-async-suite.ts#L21-L33) · wired at [`eslint.config.js` L828-L842](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/eslint.config.js#L828-L842) @ `7234ef0` — de-dented

```ts
function hasAsyncSuite(node: ESTree.Node) {
	const tsNode = node as TSESTree.Node;
	if (isCallExpression(tsNode) && tsNode.arguments.length >= 2 && isFunctionExpression(tsNode.arguments[1]) && tsNode.arguments[1].async) {
		return context.report({
			node: tsNode,
			message: 'suite factory function should never be async'
		});
	}
}

return {
	['CallExpression[callee.name=/suite$/][arguments]']: hasAsyncSuite,
};
```

**How it works:** The last three lines are an ESLint *selector* — they ask ESLint to run `hasAsyncSuite` on every function call whose callee name matches `/suite$/`, which then reports the call when its second argument is an `async` function. The target is Mocha's `suite(name, callback)`, the same declaration shape as Jest's `describe`. Mocha invokes that callback synchronously to collect the suite's contents but does *not* await the Promise an `async` callback returns — it pops the suite the moment the callback returns, so every `test()` after the first `await` runs later and attaches to whatever suite is current by then, usually the root. Reproduced on Mocha 10.8.2: the late test's parent was `<root>`, the named suite held zero tests, `mocha --grep "<suite name>"` matched **0 tests**, and the run still exited green.

**Adopt it:** Never mark a `suite`/`describe` callback `async`; put asynchronous preparation in a hook — Mocha's `before`/`suiteSetup` (once per suite) or `beforeEach`/`setup` (before each test), or Jest's `beforeAll`/`beforeEach` — because hooks *are* awaited. VS Code sets this rule to `warn` on `**/*.test.ts`; because their CI fails the build on any warning, that `warn` is still fatal. If you copy the rule, widen `/suite$/`: it matches neither `describe` nor `flakySuite`.


## 2.3 Segmented Configs by Codebase Area

`eslint.config.js` applies different rules to different areas:
- **browser/electron-browser**: Bans fragile DOM/global usage
- **electron-main/node**: Blocks static imports of heavy modules
- **tests**: Bans `test.only`
- **API d.ts files**: API-contract-specific rules
- **notebook renderer preloads**: Restricts runtime imports and top-level functions
- **specific extensions** (git, markdown-language-features): Tailored configs

## 2.4 TypeScript Strictness — Multiple Compiler Gates

### Core (`src/tsconfig.base.json`):
> 🔗 **VS Code source:** [`src/tsconfig.base.json` L1-L26](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/tsconfig.base.json#L1-L26) @ `7234ef0`

```json
{
  "strict": true,
  "noImplicitReturns": true,
  "noImplicitOverride": true,
  "noUnusedLocals": true,
  "noUncheckedSideEffectImports": true,
  "allowUnreachableCode": false,
  "forceConsistentCasingInFileNames": true,

  // ...but two strict-family checks are deliberately relaxed:
  "exactOptionalPropertyTypes": false,
  "useUnknownInCatchVariables": false
}
```

### Extensions differ (`extensions/tsconfig.base.json`):
Explicitly lists `noImplicitAny` and `alwaysStrict` — but both are already implied by `strict: true`, which `src/tsconfig.base.json` also sets, so the only *real* addition is `noUnusedParameters`. Extensions are simultaneously **looser** than core: they omit `noUncheckedSideEffectImports` and `allowUnreachableCode: false`.

### Multiple Targeted Compiler Checks
| Config | Purpose |
|---|---|
| `src/tsconfig.tsec.json` | Security-oriented type analysis via `tsec` |
| `src/tsconfig.defineClassFields.json` | Tests `useDefineForClassFields: true` compatibility |
| `src/tsconfig.vscode-dts.json` | Strict checking of public API declarations |
| `src/tsconfig.monaco.json` | Monaco editor surface subset |
| `src/tsconfig.vscode-proposed-dts.json` | Strict checking of proposed API declarations |
| `build/checker/tsconfig.{browser,node,electron-browser,electron-main,electron-utility,worker}.json` | Six per-surface type subsets, driven by `npm run valid-layers-check` |

### Catching field initializers that read a constructor parameter — through a method call

**Prevents:** a future migration to native class-field semantics from silently changing initialization results, with no compiler error to warn you.

> 🔗 **VS Code source:** [`build/lib/propertyInitOrderChecker.ts` L120-L130](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/lib/propertyInitOrderChecker.ts#L120-L130) @ `7234ef0` — contiguous excerpt from `collectReferences`; common indentation removed and remaining tabs expanded to four spaces. The enclosing function and loop, the `seen` guard and the recursive call (L110-L119, L131-L134) and the helper predicates (L136-L150) are omitted.

```ts
let nextRequiresInvocationDepth = requiresInvocationDepth;
if (isInvocation(use) && nextRequiresInvocationDepth > 0) {
    nextRequiresInvocationDepth--;
}

if (ts.isPropertyDeclaration(container) && nextRequiresInvocationDepth === 0) {
    yield { stack: nextStack, container };
}
else if (requiresInvocation(container)) {
    nextRequiresInvocationDepth++;
}
```

**How it works:** When TypeScript emits native class fields (`target: ES2022` or newer *and* `useDefineForClassFields: true`), fields initialize **before** the constructor body runs — so a parameter property such as `constructor(private logger: ILogger)` has not been assigned yet. A direct read in an initializer gets `TS2729`. An indirect one gets **no diagnostic at all**: verified on TypeScript 5.9.3, `private readonly prefix = this.computePrefix()` compiled clean and produced a value derived from `undefined`. The checker therefore traces references itself. In the excerpt, `use` is one reference to the parameter property and `container` is the declaration enclosing it; when that container is a method, function or arrow, the walk records an unmatched *invocation boundary*, and a later reference that is an actual call removes one. A property initializer reached with zero unmatched boundaries is reported. That identifies a syntactic path to the read — it does not prove control flow executes it.

**Adopt it:** If you use constructor parameter properties and are moving to native class-field emit, move dependent initialization into the constructor body — `tsc` will not warn you about the indirect case. Worth knowing before you copy this: VS Code still compiles with `useDefineForClassFields: false` and runs the checker plus a `true` compile as a **migration-readiness gate**, not as protection for an already-enabled state.

### Layer Checker (`build/checker/layersChecker.ts`)
Type-level verification that browser/common code doesn't reference native-only types.

### Cyclic Dependency Gate
`build/lib/checkCyclicDependencies.ts` runs as an explicit PR step (`.github/workflows/pr.yml:98`) and as `npm run check-cyclic-dependencies`. A cycle check is one of the highest-ROI architecture guards available — it prevents the slow accretion of tangles that make every unit of work larger.

### New `.js` Files Are Banned Repo-Wide
`build/hygiene.ts:52-79` (`checkNoNewJavaScriptFiles()`) cross-checks `git ls-files "*.js" "*.cjs" "*.mjs"` against a committed `.eslint-allowed-javascript-files` allowlist that requires CODEOWNERS review to extend. The `local/code-no-new-javascript-files` ESLint rule (`eslint.config.js`, severity `error`) enforces the same policy at lint time. Net effect: every new file is type-checked.

---

# 3. 📐 DETERMINISTIC FORMATTING

## 3.1 No Prettier — Custom TypeScript Formatter

VS Code's **core** (`src/`, `build/`, hygiene) does **NOT** use Prettier — there is no `.prettierrc` and no `prettier` dependency in the root `package.json`. (Only `extensions/copilot` actually runs it: `prettier@^3.6.2` plus a script. Three other manifests carry a `"prettier"` *config* block but declare no dependency and no script.) For the core, instead:

**`build/lib/formatter.ts`** uses the **TypeScript language service formatter** with pinned settings:
> 🔗 **VS Code source:** [`build/lib/formatter.ts` L36-L40](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/lib/formatter.ts#L36-L40) @ `7234ef0`

```ts
indentSize: 4,
tabSize: 4,
indentStyle: ts.IndentStyle.Smart,
newLineCharacter: '\r\n',
convertTabsToSpaces: false,
```

The nearest ancestor **`tsfmt.json`** then *overrides* those defaults (`build/lib/formatter.ts:88`: `{ ...defaults, ...getOverrides(fileName) }`) — e.g. the root `tsfmt.json` flips `insertSpaceAfterFunctionKeywordForAnonymousFunctions` to `true`.

## 3.2 Line-Ending-Normalised Verification

`build/hygiene.ts:174-181` reformats each file and compares, delegating to `formatter.verifyFormatting`:
> 🔗 **VS Code source:** [`build/hygiene.ts` L175-L181](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/hygiene.ts#L175-L181) @ `7234ef0`

```ts
const rawInput = file.contents!.toString('utf8');
if (!formatter.verifyFormatting(file.path, rawInput)) {
    console.error(
        `File not formatted. Run the 'Format Document' command to fix it:`,
        file.relative
    );
    errorCount++;
```
`verifyFormatting` (`build/lib/formatter.ts:103-106`) normalises CRLF to LF on both sides before comparing:
> 🔗 **VS Code source:** [`build/lib/formatter.ts` L105-L105](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/lib/formatter.ts#L105-L105) @ `7234ef0`

```ts
return text.replace(/\r\n/gm, '\n') === formatted.replace(/\r\n/gm, '\n');
```
So it is character-exact **modulo line endings** — deliberately, so the check passes on both Windows and POSIX checkouts.

## 3.3 `.editorconfig` + VS Code Settings

`.editorconfig` (`indent_style = tab` everywhere, `space`/`indent_size = 2` for `*.yml`, `*.yaml` and `package.json`) plus `.vscode/settings.json`:
- `editor.insertSpaces: false`
- `editor.formatOnSave: true` (per-language, for TS/JS/Rust)
- `files.trimTrailingWhitespace: true`
- `files.insertFinalNewline: true` (overridden to `false` for `[plaintext]`)

## 3.4 Hygiene Pipeline (`build/hygiene.ts`)

Beyond formatting, the hygiene check enforces:
- **Copyright headers** — must exactly match Microsoft license block
- **Unicode restrictions** — rejected unless explicitly allowed
- **Tab-based indentation**
- **CSS variable validation** (`build/stylelint.ts`)
- **`product.json` sanity** — must not contain `extensionsGallery`

File selection is curated via **`build/filters.ts`** with explicit filter sets per check type.

---

# 4. 🔄 BETTER CI FEEDBACK LOOPS

## 4.1 Dual CI System

| System | Purpose | Trigger |
|---|---|---|
| **GitHub Actions** | PR checks (open-source) | Pull requests |
| **Azure Pipelines** | Product builds, releases, signing | Push to main, schedules |

## 4.2 PR Pipeline Architecture (`.github/workflows/pr.yml`)

**18 parallel jobs** — all independent, no `needs:` between them:

```
compile (Compile & Hygiene)
linux-cli-tests
linux-electron-tests            macos-electron-tests            windows-electron-tests
linux-electron-smoke-tests      macos-electron-smoke-tests      windows-electron-smoke-tests
linux-browser-tests             macos-browser-tests             windows-browser-tests
linux-remote-tests              macos-remote-tests              windows-remote-tests
copilot-check-test-cache
copilot-check-telemetry
copilot-linux-tests
copilot-windows-tests
```

**Wall-clock time ≈ longest single job**, not sum of all jobs.

## 4.3 Reusable Workflow Templates (DRY)

Three platform templates called with boolean flags:
> 🔗 **VS Code source:** [`.github/workflows/pr.yml` L107-L113](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/.github/workflows/pr.yml#L107-L113) @ `7234ef0`

```yaml
  linux-electron-tests:
    name: Linux
    uses: ./.github/workflows/pr-linux-test.yml
    with:
      job_name: Electron
      electron_tests: true
      smoke_tests: false
```

Each OS template is invoked **4 times** — 3 OS templates (`pr-linux-test.yml`, `pr-darwin-test.yml`, `pr-win32-test.yml`) × 4 modes (Electron, Electron-Smoke, Browser, Remote) = **12 test jobs from 3 workflow files**, plus a 4th template `pr-linux-cli-test.yml` called once.

## 4.4 Multi-Layer Caching

### Custom Cache Key Computation
`build/azure-pipelines/common/computeNodeModulesCacheKey.ts` creates platform-specific keys from:
- `build/.cachesalt` + **three** `.npmrc` files (root, `build/`, `remote/`) + each dir's `{dependencies, devDependencies, optionalDependencies, resolutions, distro}` + each dir's `package-lock.json`
- Platform args: `linux x64`, `darwin arm64`, `windows x64`

### Two-Tier Cache
1. **node_modules** — zstd-compressed tar (`node-modules.tzst`) on Linux/macOS, 7-Zip (`cache.7z`) on Windows, via `.github/workflows/node_modules_cache/cache.{sh,ps1}`
2. **Built-in extensions** — cross-OS sharing enabled

### Cache Warming
`pr-node-modules.yml` runs on every push to `main` to ensure PRs always hit warm caches.

### Fingerprint only the parts of a manifest that can change the install

**Prevents:** a version-only metadata bump from defeating the install fast path and rerunning Electron-header setup plus every per-directory npm install.

> 🔗 **VS Code source:** [`build/npm/installStateHash.ts` L58-L73](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/npm/installStateHash.ts#L58-L73) · key sets at [L39-L53](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/npm/installStateHash.ts#L39-L53) · [`isUpToDate` L124-L132](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/npm/installStateHash.ts#L124-L132) @ `7234ef0` — dedented; an `eslint-disable` comment at L62 omitted

```ts
if (basename === 'package.json') {
	const json = JSON.parse(raw);
	const filtered: Record<string, unknown> = {};
	for (const key of packageJsonRelevantKeys) {
		if (key in json) {
			filtered[key] = json[key];
		}
	}
	return JSON.stringify(filtered, null, '\t') + '\n';
}
if (basename === 'package-lock.json') {
	const json = JSON.parse(raw);
	for (const key of packageLockJsonIgnoredKeys) {
		delete json[key];
	}
```

**How it works:** The two file types are filtered in *opposite* directions, and the reason is who writes them. `package.json` is hand-edited, so unknown keys are usually noise: it is rebuilt from an allowlist (`dependencies`, `overrides`, `engines`, `name` and a few more), and anything outside that — `scripts`, `description`, `version` — cannot move the fingerprint. The lockfile is machine-generated, so unknown keys usually matter: it keeps everything and deletes only `version`, at the top level and again under `packages['']`, which is the lockfile's entry for the project itself.

For each directory the script SHA-256-hashes every existing `package.json`, `package-lock.json` and `.npmrc`, plus the root `.nvmrc` — `.npmrc` and `.nvmrc` hashed raw. `process.versions.node` is stored alongside. `isUpToDate()` then returns false when no saved state can be read, the Node version differs, or the file-hash map differs, and gates the fast paths in `preinstall`, `postinstall` and `fast-install`.

**Adopt it:** If you skip reinstalls or key a CI cache on a lockfile hash, normalise before hashing — allowlist the hand-edited manifest, denylist the generated lockfile — and fold the runtime version in, so a Node upgrade invalidates the fast path. Note the trade-off: an allowlist silently ignores any future install-affecting key until someone updates it.

### `npm ci` exits 0 even when a native optional dependency was skipped

**Prevents:** a CI job caching a `node_modules` tree whose platform binary silently failed to download, so every later job restoring that cache gets a package that cannot run.

> 🔗 **VS Code source:** [`build/azure-pipelines/common/checkNativeOptionalDeps.ts` L44-L53](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/azure-pipelines/common/checkNativeOptionalDeps.ts#L44-L53) · wired at [`.github/workflows/pr-node-modules.yml` L138-L144](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/.github/workflows/pr-node-modules.yml#L138-L144) @ `7234ef0`

```ts
export function findMissingNativeOptionalDep(nodeModulesDir: string, basePackage: string, target: string): string | undefined {
	if (!fs.existsSync(path.join(nodeModulesDir, basePackage))) {
		return undefined;
	}
	const platformPackage = `${basePackage}-${target}`;
	if (!fs.existsSync(path.join(nodeModulesDir, platformPackage))) {
		return platformPackage;
	}
	return undefined;
}
```

**How it works:** Some packages ship their native binary in a separate package per target — by OS and architecture, sometimes also libc — declared as `optionalDependencies` so that installing on a different target is not an error. The trap is that a network hiccup dropping the target package you actually *need* is also not an error: `npm ci` exits 0 and leaves you a base package with no binary. The file's own failure message says exactly this — "npm does not fail when an optional dependency cannot be installed". The detector restores the missing invariant with at most two `existsSync` calls per package: if the base package is absent it returns `undefined`, since nothing was requested here and there is nothing to verify; if the base is present but its target sibling is not, it returns the missing sibling's name so the caller can fail the build. Around that, the CLI selects which packages to check, derives the host target, skips unsupported OS/arch pairs, and exits non-zero. It runs in the Linux, macOS and Windows cache-warming jobs immediately before each saves its cache — the other cache-saving jobs in that workflow do not run it.

**Adopt it:** If you cache `node_modules` in CI and depend on anything using this per-target optional-dependency layout, assert after `npm ci` that each base package's target sibling is actually present. Run that assertion *before* your cache-save step — run it after, and you have already persisted the poisoned tree, so the check achieves nothing.

## 4.5 Visual Regression Feedback

`.github/workflows/component-fixtures.yml` provides **visual diffs directly on PRs** (this workflow was renamed from `screenshot-test.yml` on 2026-05-08; the old file no longer exists):
> 🔗 **VS Code source:** [`.github/workflows/component-fixtures.yml`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/.github/workflows/component-fixtures.yml) @ `7234ef0` — renamed from `screenshot-test.yml` on 2026-05-08

```yaml
# Posts/updates a PR comment with screenshot comparison
const marker = '<!-- screenshot-diff-report -->';
const existing = comments.find(c => c.body?.startsWith(marker));
if (existing) { updateComment(...) } else { createComment(...) }
```

## 4.6 API Version Break Protection — REMOVED

`.github/workflows/api-proposal-version-check.yml` was a human-in-the-loop gate on `vscode.proposed.*.d.ts` version bumps. It was deleted in `28af4cff` ("Remove API version concept", #321391, 2026-06-16) and **nothing replaced it** — proposed-API surface is now guarded only by `npm run vscode-dts-compile-check` and code review.

## 4.7 Azure Pipelines → GitHub Bridge

`build/azure-pipelines/github-check-run.js` bridges Azure DevOps status back to GitHub using GitHub App JWT auth, so all results appear as unified status checks.

## 4.8 Engineering System Protection

`no-engineering-system-changes.yml` fails any PR that touches `.github/workflows/**`, `build/**`, or **any** `package.json`, unless the author has `admin`/`maintain`/`write` permission. Exceptions: `dependabot[bot]` is skipped entirely; `vs-code-engineering[bot]` may change only the `distro`/`version` fields (or `@github/copilot*` dependency versions) plus the matching lock files; bot cherry-pick PRs carrying the `cherry-pick-artifact` label are allowed. The `Copilot` coding agent is blocked unconditionally.

### Version-scoped approval of dependency install scripts

**Prevents:** a routine dependency bump silently inheriting permission to run arbitrary code during `npm install`.

> 🔗 **VS Code source:** [`package.json` L293-L323](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/package.json#L293-L323) · checked by [`build/npm/check-allow-scripts.ts` L24-L91](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/npm/check-allow-scripts.ts#L24-L91) · CI wiring [`build/azure-pipelines/dependencies-check.yml` L117-L119](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/azure-pipelines/dependencies-check.yml#L117-L119) @ `7234ef0` — 4 of 29 allowlist entries shown

```json
"allowScripts": {
  "bufferutil@4.1.0": true,
  "cpu-features": false,
  "kerberos@2.1.1": true,
  "node-pty@1.2.0-beta.13": true
}
```

**How it works:** npm can run a dependency's `preinstall`, `install` and `postinstall` hooks — including hooks from transitive packages nobody chose deliberately. `allowScripts` is npm's own allowlist for this (added in npm 11.16.0, enforced from npm 12), and every approval names an exact version: `bufferutil@4.1.0` grants nothing to `4.1.1`, so a bump demands fresh human review. A `false` entry uses a bare package name and therefore refuses every version — security-conservative, at the cost of breaking a package that genuinely needs its install hook. VS Code's checker shells out to `npm approve-scripts --allow-scripts-pending` for each of its package directories and sets a non-zero exit code listing anything still unreviewed.

**Adopt it:** Put the gate in CI rather than on developers — a dependency-validation job that installs with `--ignore-scripts`, runs the pending-approval check, and fails the PR on anything unreviewed, so an unapproved script never merges to `main` and never reaches a laptop. Pin approvals to exact versions; an allowlist keyed on bare package names trusts every future release of that package.

## 4.9 Concurrency Controls

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true  # Cancels stale runs on new push
```

### Start the wait early, join it late

**Prevents:** a job's total time becoming *intervening work + wait* instead of *max(intervening work, wait)*, because the step that blocks on another job's output runs after that work rather than alongside it.

> 🔗 **VS Code source:** [`build/azure-pipelines/linux/steps/product-build-linux-compile.yml` L174-L178](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/azure-pipelines/linux/steps/product-build-linux-compile.yml#L174-L178) and [L261-L265](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/azure-pipelines/linux/steps/product-build-linux-compile.yml#L261-L265) @ `7234ef0` — selected lines; conditional wrappers and token `env:` blocks omitted, the artifact identifier shortened to `<artifact>` and the architecture expression rendered as `X64`

```yaml
- script: npx deemon --detach --wait -- node build/azure-pipelines/common/waitForArtifacts.ts "--producer=<artifact>=Linux CLI (X64)" <artifact>
  displayName: Wait for CLI artifact (background)

# ...~85 lines of other work: distro mixin, compile, telemetry and test
# compilation, conditional policy generation, "Build client"...

- script: npx deemon --attach -- node build/azure-pipelines/common/waitForArtifacts.ts "--producer=<artifact>=Linux CLI (X64)" <artifact>
  displayName: Wait for CLI artifact
```

**How it works:** `deemon` is a small npm tool that runs a command as a background daemon. `--detach` spawns it and exits immediately, with no readiness handshake, so that pipeline step finishes at once and the build carries on. `--wait` tells the daemon to hold its buffered output and exit status if the command finishes before anything attaches. Later, `--attach` joins that same daemon, replays the buffered output into the current step's log, and propagates its exit code. Deemon identifies a daemon by command path, parsed arguments and working directory — so the two payloads after `--` must agree; when nothing matches, `--attach` exits non-zero rather than quietly starting a second copy. Failure policy is chosen per use: this CLI join is unguarded and fails the job, while an optional NOTICE join a few steps earlier sets `continueOnError: true`.

**Adopt it:** Any step that blocks on something external — a sibling job's artifact, a signing service, a slow download — can usually begin long before its result is consumed. Use your CI's native fork/join for it: on GitHub Actions, give the step an `id` and `background: true`, then `wait: <id>` at the point you need it. Do not reach for `nohup … & wait $pid` across steps — each step is a separate shell, and bash `wait` only accepts children of the current one.

## 4.10 "Step On It" Mode

Azure Pipelines product build has `VSCODE_STEP_ON_IT` to skip all tests for emergency releases.

## 4.11 Retry Resilience

The Alpine npm install makes **5** attempts — and the loop must `exit 1` on the last one, or a failed install silently reports success:
> 🔗 **VS Code source:** [`build/azure-pipelines/alpine/product-build-alpine.yml` L158-L165](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/azure-pipelines/alpine/product-build-alpine.yml#L158-L165) @ `7234ef0`

```bash
for i in {1..5}; do # try 5 times
  npm ci && break
  if [ $i -eq 5 ]; then
    echo "Npm install failed too many times" >&2
    exit 1
  fi
  echo "Npm install failed $i, trying again..."
done
```

### A retried job is not a failed job

**Prevents:** aborting a wait for a sibling job's output because one earlier attempt failed, while a retry of that same job is still running and may yet succeed.

> 🔗 **VS Code source:** [`build/azure-pipelines/common/waitForArtifacts.ts` L39-L53](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/azure-pipelines/common/waitForArtifacts.ts#L39-L53) @ `7234ef0`

```ts
function findFailedProducer(timeline: Timeline, producer: string): TimelineRecord | undefined {
	const records = timeline.records.filter(r =>
		r.type === 'Job' && (r.name === producer || r.identifier === producer));

	if (records.length === 0) {
		return undefined;
	}

	// A still-running or successful attempt means the artifact may still be uploaded.
	if (records.some(r => r.state !== 'completed' || r.result === 'succeeded' || r.result === 'succeededWithIssues')) {
		return undefined;
	}

	return records[0];
}
```

**How it works:** One job waits for a file another job uploads, making up to 120 passes with a 30-second sleep between them — 60 minutes of configured waiting. A timeout alone would spend all of it on output that can never arrive, so a caller may opt in by declaring which job produces which file; only those get the check below. `timeline` is the CI's job history: a flat list of records, which a job may appear in more than once because a retry appends a new record beside the old one, matched here by either display name or identifier. That is what makes the naive test wrong — `records.some(r => r.result === 'failed')` aborts the moment it sees a failed first attempt. So the logic is inverted: given at least one matching record, the producer is declared dead only when *every* record has completed and none finished `succeeded` or `succeededWithIssues`. Returning a record means "stop waiting"; returning `undefined` means "keep polling".

**Adopt it:** When you poll for something another job produces, pair the timeout with a liveness check on the producer. If your status source is append-only — CI attempts, deployment revisions, retried webhooks — decide from *all* matching records, never from a single failed one in isolation, or a healthy retry will read as a terminal failure.

## 4.12 Failure-Only Artifacts

```yaml
- name: Publish Crash Reports
  if: failure()         # only on failure
- name: Publish Log Files
  if: always()          # always for debugging
```

## 4.13 Parallelism Budgets

### Parallelism budgeted by free memory, not CPU count alone

**Prevents:** avoidable swap thrashing from launching every type-check process at once — the source budgets 4 GiB (`4 * 1024 * 1024 * 1024` bytes) per concurrent check, noting that its largest project peaks at around 3.5 GB.

> 🔗 **VS Code source:** [`build/checker/layersTypeCheck.ts` L28-L55](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/checker/layersTypeCheck.ts#L28-L55) @ `7234ef0` — selected lines; comments, blank lines and an unrelated `tscPath` declaration at L42 omitted

```ts
const MEMORY_PER_CHECK = 4 * 1024 * 1024 * 1024;
const MEMORY_HEADROOM = 0.25;

function getConcurrency(): number {
	const affordableChecks = Math.floor(freemem() * (1 - MEMORY_HEADROOM) / MEMORY_PER_CHECK);

	return Math.max(1, Math.min(PROJECTS.length, availableParallelism(), affordableChecks));
}
```

**How it works:** Each target project (six of them, held in `PROJECTS`) runs in its own child process invoking the TypeScript compiler. Node's `freemem()` returns free system memory in bytes, and `availableParallelism()` is its estimate of how much parallelism a program should use. The scheduler works out how many 4 GiB budgets fit inside 75% of currently free memory, takes the minimum of that number, the count of target projects and available parallelism, then clamps the result to at least one. The memory limit only wins when it is the smallest of the three — which is precisely when it matters, because swapping costs far more wall-clock time than checking the projects one after another.

**Adopt it:** Measure the *heaviest* worker's peak memory, then cap concurrency by both `availableParallelism()` and a memory-derived limit. On containerised runners, confirm that `freemem()` reflects the job's own memory limit rather than the host's.

## 4.14 Performance Gates

### A confirmed regression must breach the budget *and* be statistically significant

**Prevents:** failing a build on a performance change that is not a real, meaningful regression.

> 🔗 **VS Code source:** [`scripts/chat-simulation/test-chat-perf-regression.js` L1840-L1854](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/scripts/chat-simulation/test-chat-perf-regression.js#L1840-L1854) · `welchTTest` at [`scripts/chat-simulation/common/utils.js` L697-L718](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/scripts/chat-simulation/common/utils.js#L697-L718) @ `7234ef0` — common leading indentation removed; remaining tabs expanded to four spaces

```js
if (exceedsThreshold(metricThreshold, change, absoluteDelta)) {
    if (!ttest) {
        flag = ' ← possible regression (n too small for significance test)';
        inconclusiveFound = true;
    } else if (ttest.significant) {
        flag = ` ← REGRESSION (p=${ttest.pValue}, ${ttest.confidence} confidence)`;
        scenarioRegression = true;
        regressionFound = true;
    } else {
        flag = ` (likely noise — p=${ttest.pValue}, not significant)`;
        inconclusiveFound = true;
    }
} else if (ttest && change > 0 && ttest.significant && ttest.confidence === 'high') {
    flag = ` (significant increase, p=${ttest.pValue})`;
}
```

**How it works:** Two separate checks must both hold before anything counts as a regression. `exceedsThreshold` asks whether the median delta breaches a configured fractional or absolute budget — is it big enough to matter? `welchTTest` then asks whether it is real, applying Welch's t-test: a comparison of two sample means that tolerates *unequal variances*, which matters for benchmarks because a new build's spread often differs from the baseline's. It runs over each side's raw per-run values and reports `significant` at p < 0.05. In the excerpt, `flag` is only an annotation for the printed report, while `regressionFound` is what drives a non-zero exit code. The trailing branch is the instructive half: when a gated metric shows a highly significant increase (`change > 0` and `confidence === 'high'`) but does not exceed its budget, it is annotated and deliberately allowed to pass. `welchTTest` returns `null` when either side has fewer than two valid samples **or** the computed standard error is zero; if the budget was breached, that null is reported as a possible regression.

**Adopt it:** Keep every raw benchmark sample rather than just the median, and require *breaches budget* **and** *p < 0.05* before failing a build. For inconclusive results, follow this script's lead and warn while asking for more runs rather than failing: a gate that fails on noise simply gets re-run until green, which teaches the team to ignore it.

---

# 5. 📦 SMALLER, MORE VERIFIABLE UNITS OF WORK

## 5.1 Layered Architecture

`src/vs/` has a strict hierarchy:

> 🔗 **VS Code reference:** [`src/vs`](https://github.com/microsoft/vscode/tree/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs) @ `7234ef0`

```
base/          → generic utilities, UI primitives (NO dependencies up)
  ├── common/
  ├── browser/
  ├── node/
  ├── parts/
  └── test/
platform/      → DI + shared services (depends on base only)
editor/        → Monaco editor core (depends on base + platform)
workbench/     → product shell + features (depends on all above)
sessions/      → agent sessions window; sits alongside workbench, may import
                 from it but not vice versa
code/          → desktop/CLI entrypoints
server/        → remote server entrypoints
```

### Runtime Sub-Layers (environment folders):
| Folder | Available APIs |
|---|---|
| `common/` | All runtimes (no DOM, no Node) |
| `browser/` | DOM/Web APIs |
| `node/` | Node.js APIs |
| `electron-browser/` | Electron renderer |
| `electron-utility/` | Electron utility process |
| `electron-main/` | Electron main process |

### Enforcement
- **ESLint `code-layering` rule** — blocks imports that violate layer flow
- **ESLint `code-import-patterns` rule** — controls which paths each layer may import
- **`build/checker/layersChecker.ts`** — type-level verification per surface
- **Per-surface tsconfigs** — separate compilation for browser, node, monaco surfaces

## 5.2 Service-Oriented DI

`createDecorator` lives in `src/vs/platform/instantiation/common/instantiation.ts:109`; `registerSingleton` and the `InstantiationType` enum (`Eager = 0`, `Delayed = 1`) live in `src/vs/platform/instantiation/common/extensions.ts:11-33`.

> 🔗 **VS Code source:** [`src/vs/platform/files/common/files.ts` L26-L26](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/platform/files/common/files.ts#L26-L26) · [`src/vs/editor/common/services/languageFeaturesService.ts` L60-L60](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/editor/common/services/languageFeaturesService.ts#L60-L60) · [`src/vs/platform/checksum/node/checksumService.ts` L16-L16](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/platform/checksum/node/checksumService.ts#L16-L16) @ `7234ef0` — three verbatim lines from three files

```typescript
// Define a service contract:
export const IFileService = createDecorator<IFileService>('fileService');

// Register an implementation:
registerSingleton(ILanguageFeaturesService, LanguageFeaturesService, InstantiationType.Delayed);

// Consume via constructor injection:
constructor(@IFileService private readonly fileService: IFileService) { }
```

Note that not every service uses `registerSingleton`: process-level services such as `IFileService` are placed directly into the `ServiceCollection` at startup (`src/vs/code/electron-main/main.ts:197`).

Benefits:
- Explicit contracts (interface + decorator)
- Replaceable implementations (swap in tests)
- Cycle detection built into the instantiation service
- `InstantiationType.Delayed` — lazy creation reduces startup coupling

## 5.3 Contribution Pattern — Self-Contained Features

`src/vs/workbench/contrib/` contains **one folder per feature**:

> 🔗 **VS Code reference:** [`src/vs/workbench/contrib`](https://github.com/microsoft/vscode/tree/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/workbench/contrib) @ `7234ef0` — 99 folders at this commit

```
contrib/
  ├── files/           ← file explorer
  │   ├── common/
  │   ├── browser/
  │   ├── electron-browser/
  │   └── test/
  ├── sash/
  │   └── browser/
  │       └── sash.contribution.ts   ← single entrypoint
  ├── terminal/
  ├── search/
  └── ... (99 feature folders at HEAD)
```

Each contribution:
- Has a `.contribution.ts` entrypoint
- Registers via `registerWorkbenchContribution2(...)` with a **phase** (`src/vs/workbench/common/contributions.ts:31-61` — four members):
  - `WorkbenchPhase.BlockStartup`
  - `WorkbenchPhase.BlockRestore`
  - `WorkbenchPhase.AfterRestored`
  - `WorkbenchPhase.Eventually`
- ...or with a lazy/on-editor descriptor instead of a phase (`ILazyWorkbenchContributionInstantiation`, `IOnEditorWorkbenchContributionInstantiation`)
- Is locally owned, phase-loaded, testable in isolation

## 5.4 Extension API Boundaries

| Surface | File | Purpose |
|---|---|---|
| Stable API | `src/vscode-dts/vscode.d.ts` | Published, versioned, backwards-compatible |
| Proposed APIs | `src/vscode-dts/vscode.proposed.*.d.ts` | One file per proposal, cannot be published |
| API validation | `extensionValidator.ts` | Checks `engines.vscode` compatibility |
| Runtime gating | `checkProposedApiEnabled(...)` | Enforces proposal activation |

Small, auditable public surface with graduated promotion path.

## 5.5 PR Discipline

- **`.github/pull_request_template.md`** is a single HTML comment *asking* contributors to link an issue, stay current with `main`, and describe the change plus how to test it. Nothing enforces it.
- No enforced size limit, but architecture naturally constrains scope

## 5.6 Build System Modularity

Individual surfaces can be checked independently:
> 🔗 **VS Code source:** [`package.json`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/package.json) @ `7234ef0` — script bodies quoted verbatim from the root manifest

```json
{
  "valid-layers-check": "node build/checker/layersChecker.ts && node build/checker/layersTypeCheck.ts",
  "define-class-fields-check": "node build/lib/propertyInitOrderChecker.ts && tsc --project src/tsconfig.defineClassFields.json",
  "vscode-dts-compile-check": "tsc --project src/tsconfig.vscode-dts.json && tsc --project src/tsconfig.vscode-proposed-dts.json",
  "tsec-compile-check": "node --max-old-space-size=8192 node_modules/tsec/bin/tsec -p src/tsconfig.tsec.json",
  "monaco-compile-check": "tsc --project src/tsconfig.monaco.json --noEmit"
}
```
The PR `compile` job fans these out in parallel (`.github/workflows/pr.yml:86`):
`npm exec -- npm-run-all2 -lp core-ci hygiene eslint valid-layers-check define-class-fields-check vscode-dts-compile-check tsec-compile-check test-build-scripts`. Note `monaco-compile-check` is *not* part of the PR gate.

It also runs a **cyclic-dependency gate** (`pr.yml:98`): `node build/lib/checkCyclicDependencies.ts out-build`.

## 5.7 The Core Insight

VS Code's secret is **not** a "small PR policy." It is:

1. **Partition the codebase into narrow seams** — layers, env folders, services, contributions, extensions
2. **Make each seam explicit in files and entrypoints** — `.contribution.ts`, `createDecorator`, directory conventions
3. **Verify each seam with targeted checks** — custom lint rules, layer checkers, per-surface tsconfigs, focused scripts

Changes are naturally smaller because the architecture constrains what you can touch.

---

# 6. 🎯 KEY PATTERNS TO ADOPT

This checklist now lives in one place: **[PLAYBOOK.md → Checklist Summary](PLAYBOOK.md#checklist-summary)**, phased Quick Wins → Advanced.
