# Validation Report

> **Audit date:** 2026-08-01
> **Ground truth:** [`microsoft/vscode@7234ef0`](https://github.com/microsoft/vscode/commit/7234ef01c2cace7cfa911d792ce9c5b1f333fca5) (2026-08-01)
> **Original authoring date:** 2026-04-09 — approximately four months of upstream drift

This document records the re-validation of every checkable claim in this repository against the VS Code source tree.

> Every VS Code code excerpt in the guides now carries a 🔗 permalink pinned to this commit. See **[SOURCES.md](SOURCES.md)** for the full index of all 53 cited files.

---

## Method

The original analysis (April 2026) was assembled from ~300 GitHub API calls. That approach cannot detect deletions, and it samples rather than verifies. This pass replaced it with **direct comparison against a full local clone**:

1. `microsoft/vscode` was cloned locally at `7234ef0` (17,106 tracked files). Every path, identifier, config value and code excerpt was checked against files on disk, not API responses.
2. Two independent auditors worked in parallel at maximum reasoning effort:
   - **Claude Opus 5** — `ANALYSIS.md` + `PLAYBOOK.md`
   - **GPT-5.6 Sol** — `PLAYBOOK-PHASE-1-2.md` + `PLAYBOOK-PHASE-3-4.md` + `examples/`
3. Findings were cross-checked against the clone before any edit was applied. The three most surprising claims were independently re-verified (see [Spot-checks](#spot-checks)).
4. Sample code was **executed or parsed**, not eyeballed: TypeScript samples compiled, ESLint rules loaded and invoked, all YAML parsed, all JSON parsed.

Every claim was classified:

| Verdict | Meaning |
|---|---|
| `CONFIRMED` | Verified true at `7234ef0` |
| `IMPRECISE` | Directionally right but overstated or misleading |
| `STALE` | Was true when written; no longer true |
| `WRONG` | Factually incorrect |
| `BROKEN-CODE` | Sample code/config that will not run for an adopter |

---

## Results

| Verdict | Count |
|---|---|
| CONFIRMED | 80 |
| IMPRECISE | 30 |
| STALE | 13 |
| WRONG | 26 |
| BROKEN-CODE | 47 |
| **Total claims checked** | **~196** |

**Headline:** the core technical insights held up well — the `postMessage` scheduler hack, warnings-as-errors, the TS-language-service formatter, layered architecture and service DI were all confirmed verbatim. What failed was **quantitative precision, CI currency, and the runnability of sample code.**

---

## Critical corrections

### 1. Two documented CI features no longer exist

| Workflow | Status | Evidence |
|---|---|---|
| `.github/workflows/screenshot-test.yml` | **Deleted 2026-05-08** | Commit `94197da9` "Deletes unneeded screenshot-test.yml". Renamed to `component-fixtures.yml` in `66bdcf97` (#315218) |
| `.github/workflows/api-proposal-version-check.yml` | **Deleted 2026-06-16** | Commit `28af4cff` — PR #321391, *"Remove API version concept"* |

The second is the more serious: `ANALYSIS.md` §4.6 described a human-in-the-loop `/api-proposal-change-required` gate as a live practice. The entire API-proposal-version concept was removed from VS Code, and **nothing replaced it**. Proposed API surface is now guarded only by `npm run vscode-dts-compile-check` and code review. Proposal files no longer carry `// version: N` headers.

### 2. Test sharding was never a VS Code CI strategy

`ANALYSIS.md` and `PLAYBOOK-PHASE-1-2.md` presented `--testSplit i/n` as a headline CI speed lever. The flag exists in `test/unit/electron/{index,renderer}.js`, but a repo-wide search finds **zero** uses in `.github/`, `build/` or `scripts/`. No CI job shards. It is available harness tooling, not an active practice.

Similarly, multi-browser `Promise.all` execution is the **local** default only. CI runs exactly one browser per OS job:

| Workflow | Browser |
|---|---|
| `pr-linux-test.yml:337` | `--browser chromium` |
| `pr-win32-test.yml:146` | `--browser chromium` |
| `pr-darwin-test.yml:136` | `--browser webkit` |

### 3. Formatting is not byte-for-byte

Stated three times across two documents. `build/lib/formatter.ts:103-105` normalises line endings on **both sides** before comparing:

```ts
return text.replace(/\r\n/gm, '\n') === formatted.replace(/\r\n/gm, '\n');
```

It is character-exact *modulo line-ending style* — deliberately, so the check passes on Windows and POSIX checkouts alike.

### 4. Quantitative claims were consistently wrong

| Claim | Stated | Actual |
|---|---|---|
| PR pipeline jobs | "11+" | **18** |
| Custom ESLint rules | "20+" / "30+" | **48** |
| `workbenchTestServices.ts` | "~3000+ lines", "hundreds of mocks" | **2,167 lines, 54 classes** |
| `contrib/` features | "~100+" | **99** |
| Repository size | "50,000-file" | **17,106 tracked files** |
| Test-job arithmetic | "3 templates × 3 modes = 9" | **3 × 4 = 12** (+ a 4th CLI template) |
| `postMessage` speed | "40x faster", "microtask" | Unsubstantiated; it is a **task**, not a microtask |

### 5. Invented npm script bodies

`ANALYSIS.md` §5.6 quoted scripts as running `tsgo ...`. `tsgo` appears nowhere in VS Code. Real bodies:

```json
"valid-layers-check": "node build/checker/layersChecker.ts && node build/checker/layersTypeCheck.ts",
"define-class-fields-check": "node build/lib/propertyInitOrderChecker.ts && tsc --project src/tsconfig.defineClassFields.json"
```

### 6. Non-existent upstream files cited

| Cited | Reality |
|---|---|
| `.eslint-plugin-local/code-no-static-heavy-module-import.ts` | Does not exist. Real rule: `code-no-static-node-module-import.ts` — and it bans **all** third-party packages, not a curated "heavy" list |
| `.eslint-plugin-local/tests/code-layering.test.ts` | Does not exist |
| `.eslint-plugin-local/tests/code-import-patterns.test.ts` | Does not exist. Only two test files exist, both using a `-test.ts` suffix |
| `.eslint-plugin-local/dist/` | No dist build. `eslint.config.js:13` imports `index.ts` directly; the plugin tsconfig sets `noEmit: true` |
| `/vscode/extensions.json` | Path is `/.vscode/extensions.json` |

### 7. Other factual errors

- **"VS Code avoids default exports"** — false. No `import/no-default-export` rule exists; `src/vs/base/common/severity.ts` exports `Severity` as default.
- **"VS Code enforces import grouping via `code-import-patterns`"** — false. That rule governs allowed paths, relative imports and extensions. No `import/order` or `sort-imports` rule exists.
- **"Started with strict mode from day one"** — impossible. `--strict` arrived in TypeScript 2.3 (April 2017), after VS Code shipped.
- **"Each test entry point is a custom harness — not a standard Mocha CLI invocation"** — the Node entry point *is* a standard Mocha CLI invocation.
- **`U+200B` in the Unicode allowlist** — VS Code's allowlist (`build/hygiene.ts:125`) does not permit zero-width space.
- **`WorkbenchPhase`** has **four** members; `BlockRestore` was omitted.
- **`no-engineering-system-changes.yml`** guards `.github/workflows/**`, `build/**` *and* any `package.json`, with carve-outs for write-permission collaborators, dependabot and cherry-pick bot PRs — and blocks the Copilot agent unconditionally.

---

## Sample code that did not run

Verified empirically with real toolchains, not by inspection.

| Location | Defect | Result |
|---|---|---|
| `PLAYBOOK.md` §2.4 | `return x ?? throw new Error(...)` — `throw` is a statement, not an expression | `TS1109: Expression expected` |
| `PLAYBOOK.md` §4.1 | `"types": ["dom"]` — `dom` is a **lib**, not an `@types` package | `TS2688: Cannot find type definition file for 'dom'` |
| `PLAYBOOK.md` §3.1 | Flat-config sample used `import/no-restricted-paths` without registering the plugin | `Could not find plugin "import"` |
| `PLAYBOOK.md` §3.1 | Custom rule called `getLayer()`, never defined | `ReferenceError: getLayer is not defined` |
| `PLAYBOOK.md` §2.2 | `strategy:`/`matrix:` placed **above** `jobs:` | Schema-invalid workflow |
| `PLAYBOOK.md` §4.3 | `api-extractor --local` semantics inverted — both scripts *updated* instead of checking | CI would never fail on API drift |
| `PLAYBOOK.md` §2.2 | `--testSplit` excerpt used `start`/`end` without defining them | Not runnable as printed |
| `PLAYBOOK.md` §4.4 | `afterEach(function () { this.currentTest })` untyped | `TS2683: 'this' implicitly has type 'any'` |
| All docs + `examples/` | 4 × `npm ci` retry loops ending on `sleep` | **Silently reported SUCCESS after 3 failed installs** |
| `examples/code-layering.js` | CommonJS, but the playbook's flat config requires `"type": "module"`; also missed re-exports and dynamic imports | Would fail to load |
| `PLAYBOOK-PHASE-3-4.md` + `examples/` | `context.getFilename()` / `context.getSourceCode()` | Deprecated in ESLint 9, slated for removal in 10 |
| All docs + `examples/` | GitHub Action majors 2 generations stale | See below |

### Action versions

VS Code at `7234ef0` uses: `checkout@v6`, `setup-node@v6`, `cache@v5`, `upload-artifact@v7`, `download-artifact@v8`, `github-script@v9`. The playbook pinned `@v4`/`@v7`. All 55 occurrences were bumped.

---

## Spot-checks

The three most counter-intuitive findings were independently re-verified against the clone before edits were applied:

| Claim | Verification |
|---|---|
| `--testSplit` unused in CI | `grep -rn testSplit .github/ build/ scripts/` → zero matches |
| One browser per OS job | `pr-darwin-test.yml:136` → `webkit`; `pr-linux-test.yml:337`, `pr-win32-test.yml:146` → `chromium` |
| Formatting normalises CRLF | `build/lib/formatter.ts:105` |

---

## Confirmed accurate

The following load-bearing claims were verified verbatim and required no change:

- **`Mocha.Runner.immediately = setTimeout0`** — `test/unit/browser/renderer.html:75`, `test/unit/electron/renderer.js:448`
- **Warnings are fatal** — `build/eslint.ts:43-44`
- **Formatter settings** — `newLineCharacter: '\r\n'`, `convertTabsToSpaces: false`, `indentSize: 4`, `tabSize: 4` at `build/lib/formatter.ts:36-40`
- **No Prettier in core** — no `prettier` dependency in the root `package.json` (though `extensions/copilot` and three other sub-packages do use it)
- **All seven claimed `src/tsconfig.base.json` flags** — present and correct
- **`extensions/tsconfig.base.json`** adds `noImplicitAny`, `noUnusedParameters`, `alwaysStrict` — present (though only `noUnusedParameters` is a genuine addition; the other two are implied by `strict`)
- **`VSCODE_STEP_ON_IT`** — `build/azure-pipelines/product-build-template.yml:81,157`
- **5× npm retry** — `product-build-alpine.yml:158-164`
- **`InMemoryFileSystemProvider`**, **`TestInstantiationService`**, **`ensureNoDisposablesAreLeakedInTestSuite`**, **`createDecorator`**, **`registerSingleton`**, **`InstantiationType`**, **`registerWorkbenchContribution2`**, **`checkProposedApiEnabled`** — all exist as described
- **`contrib/sash/browser/sash.contribution.ts`** — exists at that exact path
- **Console-output guards fail tests** — `test/unit/electron/renderer.js:222-235`
- Both referenced external links return HTTP 200

---

## Added: practices the original analysis missed

- **New `.js` files are banned repo-wide.** `build/hygiene.ts:52-79` cross-checks `git ls-files "*.js" "*.cjs" "*.mjs"` against a CODEOWNERS-gated `.eslint-allowed-javascript-files` allowlist, backed by the `local/code-no-new-javascript-files` rule at `error`. Everything new is type-checked.
- **Cyclic-dependency gating.** `node build/lib/checkCyclicDependencies.ts out-build` runs as an explicit PR step (`pr.yml:98`) — arguably the highest-ROI architecture guard available, and absent from the original write-up.
- **The `sessions/` layer** now sits alongside `workbench/` in the layer hierarchy.
- **The PR compile job** fans out via `npm-run-all2 -lp` (`pr.yml:86`); `monaco-compile-check` is *not* part of the PR gate.

---

## Known remaining limitations

The deep-dive guides contain further adopter-facing defects that were catalogued but are larger than surgical edits — chiefly in the illustrative Phase 3–4 reference implementations (DI container, in-memory filesystem, console guard, performance-budget scripts, protected-files gate). Treat those sections as **architectural illustrations, not drop-in production code**. Specifically:

- The `TestContainer` DI sample does not deliver the type safety it claims (`any[]` constructor args, unchecked dependency order).
- The console-guard and leak-detector samples use module-global state and are unsafe under concurrent test execution.
- The notification-view sample interpolates `item.message` directly into HTML (stored XSS) — escape or use DOM APIs.
- The protected-files gate authorises future commits from a stale approval comment; bind approval to the head SHA.
- Several "complete" configs in Phase 3–4 replace rather than extend the Phase 1 configs; merge them rather than copying wholesale.

These are documented here rather than silently left in place.
