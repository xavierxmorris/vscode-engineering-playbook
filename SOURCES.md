# Source Index

Every `microsoft/vscode` file this playbook cites, pinned to [`7234ef0`](https://github.com/microsoft/vscode/tree/7234ef01c2cace7cfa911d792ce9c5b1f333fca5) (2026-08-01).

**All 53 paths below were verified to exist at that commit.** Each link opens the file as it was when the playbook was validated, so quoted code cannot drift out from under you.

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
| [`.eslint-plugin-local/code-ensure-no-disposables-leak-in-test.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/.eslint-plugin-local/code-ensure-no-disposables-leak-in-test.ts) | 45 | Rule requiring every test suite to call the leak detector | P1-2 |
| [`.eslint-plugin-local/code-import-patterns.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/.eslint-plugin-local/code-import-patterns.ts) | 288 | Rule controlling which paths each layer may import (paths/relative/extensions — not ordering) | P3-4 |
| [`.eslint-plugin-local/code-layering.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/.eslint-plugin-local/code-layering.ts) | 93 | Rule enforcing layer dependency flow; reports `layerbreaker` | P3-4 |
| [`.eslint-plugin-local/code-no-deep-import-of-internal.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/.eslint-plugin-local/code-no-deep-import-of-internal.ts) | 67 | Rule blocking deep imports of `*Internal` modules | P3-4 |
| [`.eslint-plugin-local/code-no-static-node-module-import.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/.eslint-plugin-local/code-no-static-node-module-import.ts) | 80 | Rule banning static imports of **all** third-party packages in startup paths | P3-4 |
| [`.eslint-plugin-local/index.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/.eslint-plugin-local/index.ts) | 21 | Plugin entrypoint; auto-registers all 48 rule files (no `dist/` build) | A, P1-2, P3-4 |
| [`.eslint-plugin-local/utils.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/.eslint-plugin-local/utils.ts) | 42 | Shared helpers for the local rules | P3-4 |
| [`.github/workflows/component-fixtures.yml`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/.github/workflows/component-fixtures.yml) | 426 | Visual-regression screenshots + PR comment (renamed from `screenshot-test.yml`, 2026-05-08) | A, P, P3-4 |
| [`.github/workflows/pr-linux-test.yml`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/.github/workflows/pr-linux-test.yml) | 475 | Reusable Linux test template (Electron / Electron-Smoke / Browser / Remote) | A, P3-4 |
| [`.github/workflows/pr.yml`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/.github/workflows/pr.yml) | 430 | PR gate — 18 concurrent jobs, cyclic-dependency check, compile fan-out | A, P3-4 |
| [`build/azure-pipelines/common/computeNodeModulesCacheKey.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/azure-pipelines/common/computeNodeModulesCacheKey.ts) | 42 | Platform-specific node_modules cache key computation | A |
| [`build/azure-pipelines/github-check-run.js`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/azure-pipelines/github-check-run.js) | 134 | Bridges Azure DevOps status back to GitHub check runs | A |
| [`build/checker/layersChecker.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/checker/layersChecker.ts) | 407 | Type-level verification that a layer doesn't reference out-of-surface types | A, P3-4 |
| [`build/eslint.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/eslint.ts) | 55 | **Warnings-as-errors** — throws if `warningCount > 0 || errorCount > 0` | A, P, P1-2 |
| [`build/filters.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/filters.ts) | 271 | Curated file filter sets per hygiene check | A, P1-2 |
| [`build/hygiene.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/hygiene.ts) | 381 | Hygiene gate: formatting, copyright headers, Unicode, new-`.js` ban, staged-file precommit | A, P1-2 |
| [`build/lib/checkCyclicDependencies.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/lib/checkCyclicDependencies.ts) | 174 | Cyclic dependency gate (run from `pr.yml`) | A |
| [`build/lib/formatter.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/lib/formatter.ts) | 134 | TS language-service formatter; `verifyFormatting` normalises CRLF before comparing | A, P1-2 |
| [`build/stylelint.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/stylelint.ts) | 203 | CSS variable validation | A |
| [`build/tsconfig.json`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/build/tsconfig.json) | 28 | Build-tooling compiler config | P1-2 |
| [`eslint.config.js`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/eslint.config.js) | 2960 | Flat config; segments rules by codebase area; loads the local plugin from `index.ts` | A, P1-2, P3-4 |
| [`extensions/json-language-features/package.json`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/extensions/json-language-features/package.json) | 208 | Example built-in extension manifest | P3-4 |
| [`extensions/tsconfig.base.json`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/extensions/tsconfig.base.json) | 22 | Extension compiler base (adds `noUnusedParameters`; omits `noUncheckedSideEffectImports`) | A, P1-2, V |
| [`package.json`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/package.json) | 325 | Root manifest — `valid-layers-check`, `tsec-compile-check`, `test-node`, `test-browser`, etc. | A, P1-2, P3-4, V |
| [`product.json`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/product.json) | 242 | Product metadata; hygiene asserts it has no `extensionsGallery` | A |
| [`scripts/test.sh`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/scripts/test.sh) | 44 | Electron unit-test entrypoint | A |
| [`src/tsconfig.base.json`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/tsconfig.base.json) | 27 | Core compiler strictness base (relaxes `exactOptionalPropertyTypes`, `useUnknownInCatchVariables`) | A, P1-2, P3-4, V |
| [`src/tsconfig.defineClassFields.json`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/tsconfig.defineClassFields.json) | 9 | Verifies `useDefineForClassFields: true` compatibility | A |
| [`src/tsconfig.json`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/tsconfig.json) | 40 | Main application compile config | P1-2, P3-4 |
| [`src/tsconfig.monaco.json`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/tsconfig.monaco.json) | 43 | Monaco editor surface subset | A |
| [`src/tsconfig.tsec.json`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/tsconfig.tsec.json) | 19 | Security-oriented type analysis via `tsec` | A, P1-2, P3-4 |
| [`src/tsec.exemptions.json`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/tsec.exemptions.json) | 46 | tsec exemption allowlist | P1-2, P3-4 |
| [`src/vs/base/common/lifecycle.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/common/lifecycle.ts) | 975 | `IDisposable`, `DisposableStore`, `MutableDisposable` | P1-2 |
| [`src/vs/base/common/severity.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/common/severity.ts) | 57 | Evidence that VS Code *does* use default exports | V |
| [`src/vs/base/test/common/utils.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/base/test/common/utils.ts) | 108 | `ensureNoDisposablesAreLeakedInTestSuite()` (L53) | A, P1-2 |
| [`src/vs/platform/files/common/inMemoryFilesystemProvider.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/platform/files/common/inMemoryFilesystemProvider.ts) | 359 | `InMemoryFileSystemProvider` — zero disk I/O test filesystem | A, P1-2 |
| [`src/vs/platform/instantiation/common/extensions.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/platform/instantiation/common/extensions.ts) | 38 | `registerSingleton` + `InstantiationType` (`Eager = 0`, `Delayed = 1`) | A, P3-4 |
| [`src/vs/platform/instantiation/common/instantiation.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/platform/instantiation/common/instantiation.ts) | 131 | `createDecorator` (L109) — the service-contract primitive | A, P3-4 |
| [`src/vs/platform/instantiation/common/instantiationService.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/platform/instantiation/common/instantiationService.ts) | 476 | DI container with cycle detection | P3-4 |
| [`src/vs/platform/instantiation/common/serviceCollection.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/platform/instantiation/common/serviceCollection.ts) | 33 | Service registry | P3-4 |
| [`src/vs/platform/instantiation/test/common/instantiationServiceMock.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/platform/instantiation/test/common/instantiationServiceMock.ts) | 199 | `TestInstantiationService` — `mock`/`stub`/`stubInstance`/`stubPromise`/`spy` | A, P1-2 |
| [`src/vs/workbench/common/contributions.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/workbench/common/contributions.ts) | 435 | `registerWorkbenchContribution2` + `WorkbenchPhase` (4 members) | P3-4 |
| [`src/vs/workbench/contrib/files/browser/files.contribution.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/workbench/contrib/files/browser/files.contribution.ts) | 686 | Reference contribution entrypoint | P3-4 |
| [`src/vs/workbench/test/browser/workbenchTestServices.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vs/workbench/test/browser/workbenchTestServices.ts) | 2168 | Workbench test services — 2,167 lines, 54 classes | A, P1-2 |
| [`src/vscode-dts/README.md`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vscode-dts/README.md) | 21 | Proposed-API rules; requires `checkProposedApiEnabled` | P3-4 |
| [`src/vscode-dts/vscode.d.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vscode-dts/vscode.d.ts) | 21236 | Stable public extension API | A, P3-4 |
| [`src/vscode-dts/vscode.proposed.chatParticipantAdditions.d.ts`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/src/vscode-dts/vscode.proposed.chatParticipantAdditions.d.ts) | 1116 | A proposed API file (note: no `// version:` header at this commit) | P3-4 |
| [`test/unit/browser/index.js`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/test/unit/browser/index.js) | 425 | Browser harness; multi-browser `Promise.all` at L399 (local default only) | A, P1-2 |
| [`test/unit/browser/renderer.html`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/test/unit/browser/renderer.html) | 286 | `Mocha.Runner.immediately = setTimeout0` at L75 | A |
| [`test/unit/electron/index.js`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/test/unit/electron/index.js) | 430 | Electron harness CLI; documents `--testSplit <i>/<n>` at L75 | A |
| [`test/unit/electron/renderer.js`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/test/unit/electron/renderer.js) | 515 | postMessage scheduler (L407-448), testSplit (L175), console guards (L224-233) | A, P, P1-2 |
| [`test/unit/node/index.js`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/test/unit/node/index.js) | 255 | Node harness; env exclusion glob at L60 | A, P1-2 |
| [`tsfmt.json`](https://github.com/microsoft/vscode/blob/7234ef01c2cace7cfa911d792ce9c5b1f333fca5/tsfmt.json) | 18 | Formatter overrides layered on `formatter.ts` defaults | A, P1-2 |

## Verifying a claim yourself

```bash
git clone --depth 1 --filter=blob:none https://github.com/microsoft/vscode.git
cd vscode
git fetch --depth 1 origin 7234ef01c2cace7cfa911d792ce9c5b1f333fca5
git checkout 7234ef01c2cace7cfa911d792ce9c5b1f333fca5
```

Then compare against any citation above. If a link 404s or a line range no longer matches, the playbook has drifted — please open an issue.

See [VALIDATION.md](VALIDATION.md) for the audit that produced these pins.
