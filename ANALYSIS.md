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

### A targeted bundler warning promoted to an error

**Prevents:** a build succeeding despite esbuild reporting that a named import will always be `undefined` — a binding that then fails whenever that code path runs.

> 🔗 **VS Code source:** [`extensions/esbuild-extension-common.mts` L17-L29](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/extensions/esbuild-extension-common.mts#L17-L29) · same override at [`extensions/esbuild-webview-common.mts` L12-L22](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/extensions/esbuild-webview-common.mts#L12-L22) @ `7234ef0` — the other option keys are elided

```ts
	const options: esbuild.BuildOptions = {
		// ...platform, bundle, minify, treeShaking, sourcemap, target, external, format...
		logOverride: {
			'import-is-undefined': 'error',
		},
	};
```

**How it works:** esbuild emits `import-is-undefined` when it can prove a named import will always be `undefined` because the file it resolves to exports nothing. It is narrower than general ESM/CommonJS export checking — a missing *ESM* export is already a hard `No matching export` error, and a missing *CommonJS* property produces no diagnostic at all. At its default level the warning is printed but the build still resolves with `errors: 0` and exits 0, so nothing stops the broken binding shipping. Promoting it to `error` makes the build reject instead. It is declared in the shared extension option factory and the webview base options, and all 59 consumer scripts currently route through one of those — though per-script options are spread afterwards, so a script could still override it.

**Adopt it:** Treat diagnostic severity as a deliberate policy rather than accepting your bundler's defaults, and make the decision *per diagnostic*. VS Code raises this one to `error` while elsewhere silencing `unsupported-require-call` outright — the point is not blanket strictness but having read the list and chosen. Do that once for your bundler and your compiler.

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

# 6. 🛡️ RUNTIME SELF-DEFENCE

The earlier dimensions are dominated by pre-ship checks and architectural constraints. This one is about guards that run inside shipped code, preventing or surfacing slow, silent degradation.

### An event emitter that refuses listeners once a leak is obvious

**Prevents:** a forgotten `dispose()` in a hot path quietly accumulating listeners — growing memory and duplicating work — with no signal beyond a gradually slower app.

> 🔗 **VS Code source:** refusal tier at [`src/vs/base/common/event.ts` L1244-L1255](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/common/event.ts#L1244-L1255) · warning tier at [L1013-L1040](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/common/event.ts#L1013-L1040) · monitor activation at [L1196-L1200](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/common/event.ts#L1196-L1200) · stack capture at [L1270-L1273](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/common/event.ts#L1270-L1273) · production threshold at [`src/vs/workbench/browser/workbench.ts` L131-L135](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/workbench/browser/workbench.ts#L131-L135) @ `7234ef0`

```ts
			if (this._leakageMon && this._size > this._leakageMon.threshold ** 2) {
				const message = `[${this._leakageMon.name}] REFUSES to accept new listeners because it exceeded its threshold by far (${this._size} vs ${this._leakageMon.threshold})`;
				console.warn(message);

				const tuple = this._leakageMon.getMostFrequentStack() ?? ['UNKNOWN stack', -1];
				const kind = tuple[1] / this._size > 0.3 ? 'dominated' : 'popular';
				const error = new ListenerRefusalError(kind, `${message}. HINT: Stack shows most frequent listener (${tuple[1]}-times)`, tuple[0], this._size, this._options?.leakWarningName);
				const errorHandler = this._options?.onListenerError || onUnexpectedError;
				errorHandler(error);

				return Disposable.None;
			}
```

**How it works:** An emitter has no leak monitor unless one is configured (`_leakageMon` above). When there is one, it starts recording a call stack per subscription only once the live count reaches `Math.ceil(threshold * 0.2)` — a stack on every subscription would be far too expensive to leave on. The first addition at or above the threshold warns, and further warnings follow roughly every additional 50%. The excerpt is the second tier: once the live count already exceeds `threshold ** 2`, the *next* registration is refused. It reports a `ListenerRefusalError` naming the most frequent stack and, if the error handler returns, hands back `Disposable.None` — a do-nothing disposable — so the caller still gets a valid object, just without its listener registered. `dominated` means one call site holds over 30% of the listeners, usually a single runaway loop; `popular` means the growth is spread across many. Disposal lowers the count, so registration resumes if it falls back under the limit. VS Code arms this in shipped builds via `setGlobalLeakWarningThreshold(175)`, called unconditionally during workbench startup.

**Adopt it:** Count subscriptions per caller stack so you learn *where* a leak comes from, not merely that you have one — but start capturing only past a first threshold, because a stack trace per subscription is ruinously expensive. Then pick two lines: one warning at a plausibly high subscriber count, and a far higher one at which refusing new subscriptions beats running out of memory.

### Disposing a resource that arrives after its request was cancelled

**Prevents:** a disposable result being orphaned when cancellation wins the race, leaving nothing able to deliver it — or close it.

> 🔗 **VS Code source:** fulfillment handler at [`src/vs/base/common/async.ts` L47-L58](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/common/async.ts#L47-L58) (the rejection handler follows at L59) · cancellation handler at [L42-L46](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/common/async.ts#L42-L46) · documented contract at [L27-L29](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/common/async.ts#L27-L29) · `isDisposable` at [`src/vs/base/common/lifecycle.ts` L319-L321](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/common/lifecycle.ts#L319-L321) @ `7234ef0`

```ts
		Promise.resolve(thenable).then(value => {
			subscription.dispose();
			source.dispose();

			if (!isCancelled) {
				resolve(value);

			} else if (isDisposable(value)) {
				// promise has been cancelled, result is disposable and will
				// be cleaned up
				value.dispose();
			}
```

**How it works:** Calling `cancel()` while the work is pending fires the cancellation token and synchronously calls `reject(new CancellationError())`, though the caller's `.catch` runs later. The callback is handed that token, so cooperative work *can* stop early — but work that ignores cancellation, or that finishes during the race, still fulfills. The first two lines simply tear down the wrapper's own token subscription. Then comes the decision this example is about: rejection has already won, so the late value can no longer be delivered to anyone — calling `resolve` at that point would be a no-op. `isDisposable` tests for a non-null object whose `dispose` is a zero-argument function, and when it matches, the value is disposed rather than dropped. Real fulfillments that reach this path include a `SignatureHelpResult` and a `ReferencesModel`.

**Adopt it:** Whenever you wrap an abortable operation that can yield a resource, don't stop at rejecting on abort — decide what happens to a result that arrives *afterwards*. If it owns anything, dispose it on that late path; otherwise non-cooperative work that later fulfills with an owned resource may leave it undisposed.

### Loudly closing a registration window instead of dropping late arrivals

**Prevents:** async work registered too late being silently dropped, so an event completes before the work it was supposed to wait for.

> 🔗 **VS Code source:** `AsyncEmitter.fireAsync` — `waitUntil` and its guard at [`src/vs/base/common/event.ts` L1483-L1491](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/common/event.ts#L1483-L1491), freeze and await at [L1501-L1505](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/common/event.ts#L1501-L1505) · surrounding delivery loop at [L1474-L1512](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/common/event.ts#L1474-L1512) @ `7234ef0` — two verbatim ranges joined; the optional `promiseJoin` wrapping inside `waitUntil`, and L1492-L1500 (the event-object close, the listener invocation and its catch/continue path), are elided

```ts
				waitUntil: (p: Promise<unknown>): void => {
					if (Object.isFrozen(thenables)) {
						throw new Error('waitUntil can NOT be called asynchronous');
					}
					// ...optional promiseJoin wrapping elided...
					thenables.push(p);
				}

// --- later, after the listener has been invoked synchronously ---

			// freeze thenables-collection to enforce sync-calls to
			// wait until and then wait for all thenables to resolve
			Object.freeze(thenables);

			await Promise.allSettled(thenables).then(values => {
```

**How it works:** Each queued listener that actually runs — the loop stops early if cancellation is requested — receives a fresh event carrying `waitUntil`, which it may call to register work the emitter should await. Until the listener returns normally, `waitUntil` can be called from any synchronously invoked code, including nested helpers. After a normal return the array is frozen and the emitter awaits everything registered before invoking the next listener, so delivery is sequential rather than concurrent. The guard is the point: a `waitUntil` called later, from a timer or after an `await`, hits the frozen array and throws to *its own* caller, since `fireAsync` is no longer inside a `try` by then. One asymmetry worth knowing — if the listener **throws**, `fireAsync` skips both the freeze and the await, so promises it had already registered are never waited on.

**Adopt it:** If you give plugins or hooks a "register work I should wait for" callback, define exactly when registration closes and enforce it — pair a frozen collection with an explicit frozen-state check, so a late attempt fails visibly instead of being silently omitted. Note the choice of `Promise.allSettled` here: one listener's rejection is reported rather than aborting the rest of the delivery.

---

### Cleaning up a lock only if you still own it

**Prevents:** A finishing task deleting the map entry that now belongs to a *newer* queued task, which lets the next caller skip the queue and run concurrently with it.

> 🔗 **VS Code source:** [`src/vs/base/common/async.ts` L342-L354](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/common/async.ts#L342-L354) @ `7234ef0` — the complete `queue` method, unedited. The `SequencerByKey` class and its `promiseMap` field are at [L338-L340](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/common/async.ts#L338-L340); the test at [L1147-L1163](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/test/common/async.test.ts#L1147-L1163) covers a rejection reaching its own caller and the key being reusable afterwards, but *not* a task already queued behind the rejection; a representative consumer declares its sequencer at [`secrets.ts` L107](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/platform/secrets/common/secrets.ts#L107-L107) and uses it at [L139-L140](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/platform/secrets/common/secrets.ts#L139-L140).

```ts
	queue<T>(key: TKey, promiseTask: ITask<Promise<T>>): Promise<T> {
		const runningPromise = this.promiseMap.get(key) ?? Promise.resolve();
		const newPromise = runningPromise
			.catch(() => { })
			.then(promiseTask)
			.finally(() => {
				if (this.promiseMap.get(key) === newPromise) {
					this.promiseMap.delete(key);
				}
			});
		this.promiseMap.set(key, newPromise);
		return newPromise;
	}
```

**How it works:** `SequencerByKey` runs tasks that share a key one at a time by storing a single promise per key — the *tail* of that key's chain. Each call chains onto whatever tail it finds (or onto a resolved promise when the key is idle), then installs its own promise as the new tail. The `finally` handler deletes the map entry **only when the entry is still the promise that handler installed**; if a later call has already overwritten the tail, the older task leaves it alone. The `.catch(() => { })` stops one task's failure from breaking the chain for the tasks behind it — that rejection is still delivered to its own caller through the returned promise.

**Why the identity test is load-bearing:** an unconditional `delete(key)` looks equivalent and is not. Suppose task A is running and task B is queued behind it: the map now holds **B's** promise, because B overwrote the tail when it queued. A's `finally` runs before B begins, so a bare delete would remove B's entry. Task C would then find no tail, chain onto a fresh `Promise.resolve()`, and start while B is still outstanding — losing exactly the mutual exclusion the class exists to provide. The comparison also stops settled keys accumulating: when the current tail settles and no later call has replaced it, the entry matches itself and the key is removed. A tail that never settles is never cleaned up — the guard bounds *idle* keys, not stuck ones.

**Adopt it:** In a per-key serialiser that replaces the map entry with a distinct promise on every enqueue — per-file writes, per-session updates, per-record mutations — make cleanup a compare-and-delete rather than a bare delete: remove the entry only if it is still the exact promise you stored. For that shape, promise reference identity is sufficient and no version counter is needed; a design that reuses one long-lived entry per key does need a token.

---

### Yielding with a timer so batched work does not block I/O

**Prevents:** A long batched computation monopolising the process. If it yields only to the microtask queue, the runtime drains that queue completely before returning to the event loop, so queued socket and filesystem callbacks wait until that chain ends.

> 🔗 **VS Code source:** [`src/vs/base/common/arrays.ts` L323-L336](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/common/arrays.ts#L323-L336) @ `7234ef0` — the promise-executor portion of `topAsync`, declared at [L318](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/common/arrays.ts#L318-L318). Omitted: the `n === 0` fast path at L319-L321, and L337-L339, which close the IIFE and settle the outer promise via `.then(resolve, reject)`. Its one production caller is [`rawSearchService.ts` L264-L265](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/workbench/services/search/node/rawSearchService.ts#L264-L265), which ranks file-search results in batches of 10,000.

```ts
	return new Promise((resolve, reject) => {
		(async () => {
			const o = array.length;
			const result = array.slice(0, n).sort(compare);
			for (let i = n, m = Math.min(n + batch, o); i < o; i = m, m = Math.min(m + batch, o)) {
				if (i > n) {
					await new Promise(resolve => setTimeout(resolve)); // any other delay function would starve I/O
				}
				if (token && token.isCancellationRequested) {
					throw new CancellationError();
				}
				topStep(array, compare, result, i, m);
			}
			return result;
```

**How it works:** `topAsync` returns the top `n` elements of a large array without sorting all of it, processing `batch` elements per pass. Between passes it awaits a `setTimeout`. That matters because a timer callback is a **task**: scheduling one puts the continuation in a later event-loop turn, giving ready I/O an opportunity to run before the next pass. It is an opportunity, not a guarantee of ordering. Awaiting an already-resolved promise or `queueMicrotask` looks like the same "let others go first" gesture, but it only queues a **microtask** — and the runtime drains the entire microtask queue before returning to the event loop, so a `for` loop that yields that way lets no I/O through until it finishes.

**Why the comment overstates it:** the distinction it draws is real. Measured on Node v24.13.0 — 400 passes of ~3 ms work with an `fs.readFile` queued beforehand — `await Promise.resolve()` and `queueMicrotask` both left the read callback **unserved until the whole run finished**, while `setTimeout` let it land mid-run. But "*any* other delay function" is too strong: `setImmediate` also lets the read through, and per hop it is far cheaper. Exact timings are host-dependent and should not be quoted as constants — the per-hop cost of a timer is dominated by platform scheduling and timer resolution (on this Windows host it measured the same with no delay argument, `0` and `1`). Note also that Node applies a **1 ms default threshold** to an omitted timeout; the browser's nested-timer 4 ms clamp is a different mechanism and is not what is being paid here.

**Why `setImmediate` is not used here:** this module sits in the `common` layer and must also run in a browser, where `setImmediate` does not exist — so this is runtime correctness, not merely house style. [`build/checker/tsconfig.browser.json` L4-L10](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/checker/tsconfig.browser.json#L4-L10) type-checks production `common/` and `browser/` sources with `"types": []` and libraries `ES2024`, `ESNext.Disposable`, `DOM` and `DOM.Iterable`: `setTimeout` is declared by the DOM typings, `setImmediate` is not. [`layersTypeCheck.ts` L19-L26](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/checker/layersTypeCheck.ts#L19-L26) runs that project, and CI invokes it as `valid-layers-check` at [`pr.yml` L86](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/.github/workflows/pr.yml#L86-L86) — that type-check, not a lint rule, is what enforces it.

This complements the test-runner discussion in **PLAYBOOK-PHASE-1-2**, which replaces `setTimeout(0)` with `postMessage` to dodge the browser's nested-timer clamp. Both reach for a **task** rather than a microtask; they differ only in which task source is cheapest on the surface they target.

**Adopt it:** When you chunk CPU-bound work in a server or UI process, yield with a **task**, not a microtask — `await new Promise(r => setTimeout(r))` in portable code, or `setImmediate` where you are Node-only and want the cheaper hop. `await Promise.resolve()` between chunks looks like cooperative scheduling while giving the event loop no opening at all. Balance chunk duration against responsiveness rather than overhead alone — prefer a cheaper task source before making chunks bigger.

---

### Not mistaking your own busy event loop for a dead peer

**Prevents:** A watchdog tearing down a healthy connection because the local process was too busy to read from it, turning a burst of local CPU work into a needless reconnect.

> 🔗 **VS Code source:** [`src/vs/base/parts/ipc/common/ipc.net.ts` L1145-L1155](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/parts/ipc/common/ipc.net.ts#L1145-L1155) @ `7234ef0` — the unacknowledged-message timeout check, cut at the comment; the body that follows at [L1156-L1163](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/parts/ipc/common/ipc.net.ts#L1156-L1163) records the time and fires `onSocketTimeout`. `ProtocolConstants.TimeoutTime` is 20 s at [L300](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/parts/ipc/common/ipc.net.ts#L300-L300); the early returns that guard entry are at [L1123-L1138](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/parts/ipc/common/ipc.net.ts#L1123-L1138). The estimator is [`LoadEstimator` L742-L787](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/parts/ipc/common/ipc.net.ts#L742-L787), wired in by default at [L865](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/parts/ipc/common/ipc.net.ts#L865-L865), and it also gates the separate keep-alive path at [L1196-L1201](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/parts/ipc/common/ipc.net.ts#L1196-L1201).

```ts
		if (
			timeSinceOldestUnacknowledgedMsg >= ProtocolConstants.TimeoutTime
			&& timeSinceLastReceivedSomeData >= ProtocolConstants.TimeoutTime
			&& timeSinceLastTimeout >= ProtocolConstants.TimeoutTime
		) {
			// It's been a long time since our sent message was acknowledged
			// and a long time since we received some data

			// But this might be caused by the event loop being busy and failing to read messages
			if (!this._loadEstimator.hasHighLoad()) {
				// Trash the socket
```

**How it works:** On the unacknowledged-message path, `_recvAckCheck` returns early if nothing is outstanding, another check is already scheduled, or a reconnection is under way. Past those, three clocks must *each* be at least 20 seconds old: the write time of the oldest still-unacknowledged message, the last time any data arrived, and the last time a timeout was declared. Only then is the estimator consulted — and even then this code does not close the socket itself; it fires `onSocketTimeout`, and the connection layer responds by reconnecting. The keep-alive path is separate and tests only two clocks, but gates on the same estimator. That gate is the interesting part: a silent socket may mean the peer is gone, or merely that we were too busy to read it, and elapsed time alone cannot tell those apart.

**How the load estimate is derived:** `LoadEstimator` reads no CPU or memory counters. It seeds ten timestamps one second apart, so it starts at load zero, then a one-second `setInterval` shifts `Date.now()` in at the front. `load()` counts how many of those ten stamps are no more than ~11 seconds old — on a healthy event loop all ten are — and `hasHighLoad()` becomes true once five or fewer qualify. In other words it measures **how late its own timer has been running**. That is relevant here because a blocked event loop also delays JavaScript processing of socket data, so the signal and the fault share a cause. It is a heuristic, not a diagnosis: sleep, process suspension, timer throttling and wall-clock changes can stale the stamps too, so it identifies recent local delay rather than its origin.

**Adopt it:** Before a heartbeat or watchdog declares a remote peer dead, ask whether your own callback scheduling recently fell behind. A fixed-interval timer whose observed lateness you can query is enough — but treat a positive as a reason to defer and re-check, not as proof that the peer is healthy. Calibrate the interval, history length, window and threshold to your runtime, and measure both false positives and false negatives. Sharing one estimator across connections reduces, without eliminating, the risk that a single local stall makes every connection reconnect at once.

---

### Draining the interrupted dispatch before starting a new one

**Prevents:** A listener that fires during an in-progress dispatch either re-running the listener still on the stack, or having its new event overtake the remaining listeners of the current one.

> 🔗 **VS Code source:** [`src/vs/base/common/event.ts` L1371-L1378](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/common/event.ts#L1371-L1378) and [L1384-L1386](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/common/event.ts#L1384-L1386) @ `7234ef0` — two ranges, joined below by a marker line that is **not** in the source; the rest of `fire()` continues at [L1387-L1399](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/common/event.ts#L1387-L1399). The cursor class is [`EventDeliveryQueuePrivate` L1416-L1450](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/common/event.ts#L1416-L1450), whose [`reset()` L1445-L1449](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/common/event.ts#L1445-L1449) sets `i = end`. The single-listener fast path that bypasses all of this is at [L1392-L1399](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/common/event.ts#L1392-L1399). Ordering is asserted by [`event.test.ts` L191-L208](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/test/common/event.test.ts#L191-L208).

```ts
	private _deliverQueue(dq: EventDeliveryQueuePrivate) {
		const listeners = dq.current!._listeners! as (ListenerContainer<T> | undefined)[];
		while (dq.i < dq.end) {
			// important: dq.i is incremented before calling deliver() because it might reenter deliverQueue()
			this._deliver(listeners[dq.i++], dq.value as T);
		}
		dq.reset();
	}

// ——— separate range: the first lines of fire() ———

	fire(event: T): void {
		if (this._deliveryQueue?.current) {
			this._deliverQueue(this._deliveryQueue);
```

**How it works:** An emitter whose listeners are stored as an array dispatches through a cursor object, `dq`. It holds the emitter currently being dispatched on (`current`, from which the listener array is read), the next index `i`, and `end` — an **exclusive** upper bound, since the loop tests `i < end`. The loop advances `i` *before* invoking each listener, so a re-entered drain picks the next slot rather than the one already running. `fire()` first checks whether a dispatch is in progress and drains it. Note what "drains" means precisely: the remaining listener *slots* of the current event are invoked, but the callback that called `fire()` is still on the stack and has not returned.

**Why advancing before invocation matters:** written the other way round — deliver, then advance — the re-entered drain would reselect the slot already executing. Unguarded that recurses until the stack overflows (a reproduction reached roughly 3,100 nested calls); with a one-shot guard in the listener it degrades to a silent duplicate delivery. The ordering needs two further pieces: `fire()` draining an existing dispatch *before* enqueueing the new event, and `reset()` leaving `i === end`, which is what tells the suspended outer loop to stop. Each emitter lazily creates its own cursor when a second listener converts its storage to an array — a single-listener emitter is delivered directly and never marks the queue as current, even if a shared queue was supplied. Callers can create a cursor explicitly and share it, which extends the ordering across emitters; that is what the cited test pins down, asserting `['1a', '1b', '2c', '2d']`.

**Adopt it:** Decide the semantics first, because both are defensible. A plain `for...of` gives depth-first interleaving — the nested event is fully delivered in the middle of the outer one — and nothing is dropped or duplicated. If instead you want the current event's remaining callbacks invoked before the nested event begins, keep the iteration state outside the loop, advance it before invoking user code, and have a new dispatch drain the in-flight one before enqueueing. Handle listener removal separately; it needs its own index fix-ups. Re-entrancy through user callbacks is a routine possibility that an event system has to define deliberately rather than discover in production.

---

### Buffering producer calls until a deferred stream writer exists

**Prevents:** Early values and errors being silently dropped before a stream's internal writer has been created.

> 🔗 **VS Code source:** [`src/vs/base/common/async.ts` L2320-L2330](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/common/async.ts#L2320-L2330) @ `7234ef0` — the tail of the executor passed to `AsyncIterableObject` inside the `AsyncIterableSource` constructor; the executor opens at L2318 and closes at L2331. The buffer variables are declared at [L2333-L2334](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/common/async.ts#L2333-L2334) and the temporary handlers at [L2337-L2354](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/common/async.ts#L2337-L2354). The executor is deferred, and its `writer` built, inside a `queueMicrotask` at [L2120-L2127](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/common/async.ts#L2120-L2127). The producer-facing methods are at [L2365-L2376](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/common/async.ts#L2365-L2376). The buffering path is exercised by the test at [`async.test.ts` L1804-L1816](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/test/common/async.test.ts#L1804-L1816).

```ts
			if (earlyError) {
				emitter.reject(earlyError);
				return;
			}
			if (earlyItems) {
				emitter.emitMany(earlyItems);
			}
			this._errorFn = (error: Error) => emitter.reject(error);
			this._emitOneFn = (item: T) => emitter.emitOne(item);
			this._emitManyFn = (items: T[]) => emitter.emitMany(items);
			return this._deferred.p;
```

**How it works:** `AsyncIterableSource` gives its owner `emitOne`, `emitMany` and `reject` the moment it is constructed, but `emitOne` and `emitMany` only call through mutable function fields, and `reject` calls through its field and then completes an internal deferred promise. The internal `writer` those fields will eventually forward to is not constructed until a queued microtask runs, so a producer calling synchronously cannot reach it — temporary handlers capture the calls into closure variables instead. **If no early error was buffered**, the callback then flushes `earlyItems` and replaces the three fields with writer-forwarding versions.

**The early-error path deliberately does less:** if *any* error was buffered before the callback runs — items may well have arrived first — it forwards the first such error and **returns before both the item flush and the three field assignments**. Buffered items are therefore not delivered, and the fields are never swapped — the handlers stay in buffering mode for the rest of the object's life. The buffering error handler also keeps only the first error it is given. These are lifecycle decisions a naive no-op implementation can conceal.

**The part that will bite you if you copy it:** the buffer variables at L2333-L2334 are declared *after* the `AsyncIterableObject` construction that closes over them. That is safe only because the executor is deferred. Reproducing the pattern with a synchronous executor throws a temporal-dead-zone `ReferenceError`: the callback's first access is `earlyError`, and neither `let` binding is initialised yet. Declare buffer state *before* the object that captures it, unless deferred execution is a guaranteed invariant of the thing you are constructing.

**Adopt it:** When an object must be exposed before its consumer-side wiring exists — a lazily-started stream, a connection that dials on first use, an emitter whose consumer attaches later — *and* early calls must be preserved rather than rejected, swappable handler fields are one option: capture into them until the consumer is ready, then either apply your chosen terminal-error policy or, if no error occurred, flush and swap. Failing fast or exposing a readiness signal are equally valid alternatives. If you do buffer, make sure the capture state is initialised before any closure that captures it can *execute* — creating the closure over an uninitialised binding is safe; running it is not.

---

# 7. 🎯 KEY PATTERNS TO ADOPT

This checklist now lives in one place: **[PLAYBOOK.md → Checklist Summary](PLAYBOOK.md#checklist-summary)**, phased Quick Wins → Advanced.
