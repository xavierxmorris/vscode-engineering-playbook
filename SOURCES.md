# Source Index

Every `microsoft/vscode` file this playbook cites, pinned to [`7234ef0`](https://github.com/microsoft/vscode/tree/7234ef01c2cace7cfa911d792ce9c5b1f333fca5) (2026-08-01).

**All 75 paths below were verified to exist at that commit.** Each link opens the file as it was when the playbook was validated, so quoted code cannot drift out from under you.

## How citations work

Code blocks in the guides carry a citation line directly above them:

| Marker | Meaning |
|---|---|
| 🔗 **VS Code source:** | The block quotes real VS Code code. The link includes line numbers. |
| 🔗 **Modeled on VS Code:** | The block is adapted for an adopter project. The link shows the upstream file it was modeled on — it is *not* a verbatim copy. |
| 🔗 **VS Code reference:** | Directory or structural reference. |

Grep for `🔗` to find every citation, or for `**VS Code source:**` to find only verbatim quotes.

## Files

Doc key: **A** = ANALYSIS.md · **P** = PLAYBOOK.md · **P1-2** = PLAYBOOK-PHASE-1-2.md · **P3-4** = PLAYBOOK-PHASE-3-4.md · **V** = VALIDATION.md

| File | Lines | What it is | Cited in |
|---|---:|---|---|
| [`.editorconfig`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/.editorconfig) | 15 | Root editor defaults; `[plaintext]` overrides `insert_final_newline` to false | A, P, P1-2 |
| [`.eslint-plugin-local/code-ensure-no-disposables-leak-in-test.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/.eslint-plugin-local/code-ensure-no-disposables-leak-in-test.ts) | 44 | Rule requiring every test suite to call the leak detector | P1-2 |
| [`.eslint-plugin-local/code-import-patterns.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/.eslint-plugin-local/code-import-patterns.ts) | 287 | Rule controlling which paths each layer may import (paths/relative/extensions — not ordering) | P3-4 |
| [`.eslint-plugin-local/code-layering.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/.eslint-plugin-local/code-layering.ts) | 92 | Rule enforcing layer dependency flow; reports `layerbreaker` | P3-4 |
| [`.eslint-plugin-local/code-no-deep-import-of-internal.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/.eslint-plugin-local/code-no-deep-import-of-internal.ts) | 66 | Rule blocking deep imports of `*Internal` modules | P3-4 |
| [`.eslint-plugin-local/code-no-static-node-module-import.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/.eslint-plugin-local/code-no-static-node-module-import.ts) | 79 | Rule banning static imports of **all** third-party packages in startup paths | P3-4 |
| [`.eslint-plugin-local/code-no-test-async-suite.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/.eslint-plugin-local/code-no-test-async-suite.ts) | 35 | Bans `async` suite factories — post-`await` `test()`/`setup()` calls escape the suite | A |
| [`.eslint-plugin-local/index.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/.eslint-plugin-local/index.ts) | 20 | Plugin entrypoint; auto-registers all 48 rule files (no `dist/` build) | A, P1-2, P3-4 |
| [`.eslint-plugin-local/tsconfig.json`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/.eslint-plugin-local/tsconfig.json) | 29 | Compiler config for the local lint plugin itself | P3-4 |
| [`.eslint-plugin-local/utils.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/.eslint-plugin-local/utils.ts) | 41 | Shared helpers for the local rules | P3-4 |
| [`.github/pull_request_template.md`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/.github/pull_request_template.md) | 7 | PR template | A, P3-4 |
| [`.github/workflows/component-fixtures.yml`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/.github/workflows/component-fixtures.yml) | 425 | Visual-regression screenshots + PR comment (renamed from `screenshot-test.yml`, 2026-05-08) | A, P, P3-4 |
| [`.github/workflows/pr-darwin-test.yml`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/.github/workflows/pr-darwin-test.yml) | 252 | macOS reusable test template (`workflow_call`) | A |
| [`.github/workflows/pr-linux-cli-test.yml`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/.github/workflows/pr-linux-cli-test.yml) | 48 | Rust CLI reusable test template — called once | A |
| [`.github/workflows/pr-linux-test.yml`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/.github/workflows/pr-linux-test.yml) | 474 | Reusable Linux test template (Electron / Electron-Smoke / Browser / Remote) | A, P3-4 |
| [`.github/workflows/pr-win32-test.yml`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/.github/workflows/pr-win32-test.yml) | 278 | Windows reusable test template (`workflow_call`) | A |
| [`.github/workflows/pr.yml`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/.github/workflows/pr.yml) | 429 | PR gate — 18 concurrent jobs, cyclic-dependency check, compile fan-out | A, P3-4 |
| [`.vscode/extensions.json`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/.vscode/extensions.json) | 13 | Recommended extensions for contributors | P, P1-2, V |
| [`.vscode/extensions/vscode-selfhost-test-provider/package.json`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/.vscode/extensions/vscode-selfhost-test-provider/package.json) | 89 | Carries a `prettier` config block but no prettier dependency or script | A |
| [`.vscode/settings.json`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/.vscode/settings.json) | 219 | Repo-wide editor settings — format-on-save, `tsfmt` wiring | A, P, P1-2 |
| [`build/azure-pipelines/alpine/product-build-alpine.yml`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/azure-pipelines/alpine/product-build-alpine.yml) | 245 | Alpine build; the npm-install retry loop that `exit 1`s after 5 attempts (L158) | A |
| [`build/azure-pipelines/common/computeNodeModulesCacheKey.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/azure-pipelines/common/computeNodeModulesCacheKey.ts) | 41 | Platform-specific node_modules cache key computation | A |
| [`build/azure-pipelines/dependencies-check.yml`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/azure-pipelines/dependencies-check.yml) | 137 | Installs with `--ignore-scripts`, then fails on any unreviewed dependency install script | A |
| [`build/npm/check-allow-scripts.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/npm/check-allow-scripts.ts) | 91 | Runs `npm approve-scripts --allow-scripts-pending` per manifest; non-zero exit lists unreviewed packages | A |
| [`build/azure-pipelines/github-check-run.js`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/azure-pipelines/github-check-run.js) | 133 | Bridges Azure DevOps status back to GitHub check runs | A |
| [`build/azure-pipelines/product-build-template.yml`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/azure-pipelines/product-build-template.yml) | 679 | Release pipeline template; `VSCODE_STEP_ON_IT` test skip | V |
| [`build/checker/layersChecker.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/checker/layersChecker.ts) | 406 | Type-level verification that a layer doesn't reference out-of-surface types | A, P3-4 |
| [`build/checker/layersTypeCheck.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/checker/layersTypeCheck.ts) | 96 | Per-runtime type-check fan-out; concurrency derived from free RAM, not core count | A |
| [`build/eslint.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/eslint.ts) | 54 | **Warnings-as-errors** — throws if `warningCount > 0 || errorCount > 0` | A, P, P1-2 |
| [`build/filters.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/filters.ts) | 270 | Curated file filter sets per hygiene check | A, P1-2 |
| [`build/gulp-eslint.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/gulp-eslint.ts) | 80 | gulp wrapper around ESLint used by hygiene | P1-2 |
| [`build/hygiene.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/hygiene.ts) | 380 | Hygiene gate: formatting, copyright headers, Unicode, new-`.js` ban, staged-file precommit | A, P1-2 |
| [`build/lib/checkCyclicDependencies.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/lib/checkCyclicDependencies.ts) | 173 | Cyclic dependency gate (run from `pr.yml`) | A |
| [`build/lib/propertyInitOrderChecker.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/lib/propertyInitOrderChecker.ts) | 320 | Traces same-class parameter-property references; flags initializers reached with no unmatched invocation boundary | A |
| [`build/lib/formatter.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/lib/formatter.ts) | 133 | TS language-service formatter; `verifyFormatting` normalises CRLF before comparing | A, P1-2 |
| [`build/stylelint.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/stylelint.ts) | 202 | CSS variable validation | A |
| [`build/tsconfig.json`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/tsconfig.json) | 27 | Build-tooling compiler config | P1-2 |
| [`eslint.config.js`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/eslint.config.js) | 2959 | Flat config; segments rules by codebase area; loads the local plugin from `index.ts` | A, P1-2, P3-4 |
| [`extensions/copilot/package.json`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/extensions/copilot/package.json) | 7316 | The only manifest that actually declares `prettier@^3.6.2` + a script | A |
| [`extensions/debug-auto-launch/package.json`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/extensions/debug-auto-launch/package.json) | 48 | Carries a `prettier` config block but no prettier dependency or script | A |
| [`extensions/json-language-features/package.json`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/extensions/json-language-features/package.json) | 207 | Example built-in extension manifest | P3-4 |
| [`extensions/tsconfig.base.json`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/extensions/tsconfig.base.json) | 21 | Extension compiler base (adds `noUnusedParameters`; omits `noUncheckedSideEffectImports`) | A, P1-2, V |
| [`extensions/tunnel-forwarding/package.json`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/extensions/tunnel-forwarding/package.json) | 59 | Carries a `prettier` config block but no prettier dependency or script | A |
| [`package.json`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/package.json) | 324 | Root manifest — `valid-layers-check`, `tsec-compile-check`, `test-node`, `test-browser`, etc. | A, P1-2, P3-4, V |
| [`product.json`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/product.json) | 241 | Product metadata; hygiene asserts it has no `extensionsGallery` | A |
| [`scripts/chat-simulation/common/utils.js`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/scripts/chat-simulation/common/utils.js) | 846 | `welchTTest` — Welch's t-test; `significant` at p < 0.05; returns `null` for <2 samples or zero standard error | A |
| [`scripts/chat-simulation/test-chat-perf-regression.js`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/scripts/chat-simulation/test-chat-perf-regression.js) | 1945 | Perf gate requiring both an effect-size budget and statistical significance | A |
| [`scripts/test.sh`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/scripts/test.sh) | 43 | Electron unit-test entrypoint | A |
| [`src/tsconfig.base.json`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/tsconfig.base.json) | 26 | Core compiler strictness base (relaxes `exactOptionalPropertyTypes`, `useUnknownInCatchVariables`) | A, P1-2, P3-4, V |
| [`src/tsconfig.defineClassFields.json`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/tsconfig.defineClassFields.json) | 8 | Verifies `useDefineForClassFields: true` compatibility | A |
| [`src/tsconfig.json`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/tsconfig.json) | 39 | Main application compile config | P1-2, P3-4 |
| [`src/tsconfig.monaco.json`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/tsconfig.monaco.json) | 42 | Monaco editor surface subset | A |
| [`src/tsconfig.tsec.json`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/tsconfig.tsec.json) | 18 | Security-oriented type analysis via `tsec` | A, P1-2, P3-4 |
| [`src/tsconfig.vscode-dts.json`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/tsconfig.vscode-dts.json) | 22 | Compiles the stable extension API surface alone | A |
| [`src/tsconfig.vscode-proposed-dts.json`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/tsconfig.vscode-proposed-dts.json) | 7 | Compiles stable + proposed API surfaces together | A |
| [`src/tsec.exemptions.json`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/tsec.exemptions.json) | 45 | tsec exemption allowlist | P1-2, P3-4 |
| [`src/vs/base/common/lifecycle.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/common/lifecycle.ts) | 974 | `IDisposable`, `DisposableStore`, `MutableDisposable` | P1-2 |
| [`src/vs/base/common/severity.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/common/severity.ts) | 56 | Evidence that VS Code *does* use default exports | V |
| [`src/vs/base/test/common/utils.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/test/common/utils.ts) | 107 | `ensureNoDisposablesAreLeakedInTestSuite()` (L53) | A, P1-2 |
| [`src/vs/code/electron-main/main.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/code/electron-main/main.ts) | 724 | `services.set(IFileService, ...)` (L197) — not every service uses `registerSingleton` | A |
| [`src/vs/editor/common/services/languageFeaturesService.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/editor/common/services/languageFeaturesService.ts) | 60 | `registerSingleton(ILanguageFeaturesService, LanguageFeaturesService, InstantiationType.Delayed)` (L60) | A |
| [`src/vs/platform/checksum/node/checksumService.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/platform/checksum/node/checksumService.ts) | 30 | `ChecksumService` consumes `IFileService` by constructor injection (L16) | A |
| [`src/vs/platform/files/common/files.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/platform/files/common/files.ts) | 1658 | `createDecorator<IFileService>('fileService')` (L26) — service contract, not implementation | A |
| [`src/vs/platform/files/common/inMemoryFilesystemProvider.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/platform/files/common/inMemoryFilesystemProvider.ts) | 358 | `InMemoryFileSystemProvider` — zero disk I/O test filesystem | A, P1-2 |
| [`src/vs/platform/instantiation/common/extensions.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/platform/instantiation/common/extensions.ts) | 37 | `registerSingleton` + `InstantiationType` (`Eager = 0`, `Delayed = 1`) | A, P3-4 |
| [`src/vs/platform/instantiation/common/instantiation.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/platform/instantiation/common/instantiation.ts) | 130 | `createDecorator` (L109) — the service-contract primitive | A, P3-4 |
| [`src/vs/platform/instantiation/common/instantiationService.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/platform/instantiation/common/instantiationService.ts) | 475 | DI container with cycle detection | P3-4 |
| [`src/vs/platform/instantiation/common/serviceCollection.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/platform/instantiation/common/serviceCollection.ts) | 32 | Service registry | P3-4 |
| [`src/vs/platform/instantiation/test/common/instantiationServiceMock.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/platform/instantiation/test/common/instantiationServiceMock.ts) | 198 | `TestInstantiationService` — `mock`/`stub`/`stubInstance`/`stubPromise`/`spy` | A, P1-2 |
| [`src/vs/workbench/common/contributions.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/workbench/common/contributions.ts) | 434 | `registerWorkbenchContribution2` + `WorkbenchPhase` (4 members) | P3-4 |
| [`src/vs/workbench/contrib/files/browser/files.contribution.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/workbench/contrib/files/browser/files.contribution.ts) | 685 | Reference contribution entrypoint | P3-4 |
| [`src/vs/workbench/test/browser/workbenchTestServices.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/workbench/test/browser/workbenchTestServices.ts) | 2167 | Workbench test services — 2,167 lines, 56 classes (52 exported) | A, P1-2 |
| [`src/vscode-dts/README.md`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vscode-dts/README.md) | 20 | Proposed-API rules; requires `checkProposedApiEnabled` | P3-4 |
| [`src/vscode-dts/vscode.d.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vscode-dts/vscode.d.ts) | 21235 | Stable public extension API | A, P3-4 |
| [`src/vscode-dts/vscode.proposed.chatParticipantAdditions.d.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vscode-dts/vscode.proposed.chatParticipantAdditions.d.ts) | 1115 | A proposed API file (note: no `// version:` header at this commit) | P3-4 |
| [`test/unit/browser/index.js`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/test/unit/browser/index.js) | 424 | Browser harness; multi-browser `Promise.all` at L399 (local default only) | A, P1-2 |
| [`test/unit/browser/renderer.html`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/test/unit/browser/renderer.html) | 285 | `Mocha.Runner.immediately = setTimeout0` at L75 | A |
| [`test/unit/electron/index.js`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/test/unit/electron/index.js) | 429 | Electron harness CLI; documents `--testSplit <i>/<n>` at L75 | A |
| [`test/unit/electron/renderer.js`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/test/unit/electron/renderer.js) | 514 | postMessage scheduler (L407-448), testSplit (L175), console guards (L224-233) | A, P, P1-2 |
| [`test/unit/node/index.js`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/test/unit/node/index.js) | 254 | Node harness; env exclusion glob at L60 | A, P1-2 |
| [`tsfmt.json`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/tsfmt.json) | 17 | Formatter overrides layered on `formatter.ts` defaults | A, P1-2 |

## Verifying a claim yourself

```bash
git clone --depth 1 --filter=blob:none https://github.com/microsoft/vscode.git
cd vscode
git fetch --depth 1 origin 7234ef01c2cace7cfa911d792ce9c5b1f333fca5
git checkout 7234ef01c2cace7cfa911d792ce9c5b1f333fca5
```

Then compare against any citation above. If a link 404s or a line range no longer matches, the playbook has drifted — please open an issue.

See [VALIDATION.md](VALIDATION.md) for the audit that produced these pins.
