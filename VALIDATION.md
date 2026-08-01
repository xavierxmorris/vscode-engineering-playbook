# Validation Report

> **Audit date:** 2026-08-01
> **Ground truth:** [`microsoft/vscode@7234ef0`](https://github.com/microsoft/vscode/commit/7234ef01c2cace7cfa911d792ce9c5b1f333fca5) (2026-08-01)
> **Original authoring date:** 2026-04-09 — approximately four months of upstream drift

This document records the re-validation of every checkable claim in this repository against the VS Code source tree.

> Every VS Code code excerpt in the guides now carries a 🔗 permalink pinned to this commit. See **[SOURCES.md](SOURCES.md)** for the full index of all 75 cited files.

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
| `workbenchTestServices.ts` | "~3000+ lines", "hundreds of mocks" | **2,167 lines, 56 classes** |
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
- **No Prettier in core** — no `prettier` dependency in the root `package.json`. Of the four extension manifests carrying a `prettier` config block, only `extensions/copilot` actually declares the dependency and a script.
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

---

## Run log

Stateless recurring verification passes. Newest last.

### 2026-08-01 - Run 1
- **Verified** 107 permalinks, 38 inline refs, 75 SOURCES rows, 23 YAML / 41 JSON fences against `7234ef0`. **Fixed:** all 53 SOURCES line counts were +1 (phantom `split` tail); `src/tsconfig.base.json#L1-L27` out of bounds (26 lines); "54 classes" -> 56 (52 exported); "10+ CI jobs" -> 18; "3 times per platform" -> 4; four excerpt ranges narrowed to match their quoted text; SOURCES index completed 53 -> 75 paths.
- **Fixed invented code** (marked `VS Code source` but not upstream): the §1.4 leak detector, the §4.11 retry loop (the real loop `exit 1`s on attempt 5), §5.2 `registerSingleton(IFileService, ...)` (does not exist - `src/vs/code/electron-main/main.ts:197` uses `services.set`), and PLAYBOOK §1.1 `results.warningCount` (`results` is an array) which was also remarked `Modeled on VS Code`.
- **Added** ANALYSIS §2.2 `code-no-test-async-suite`. Reproduced on Mocha 10.8.2: in an `async` suite factory a post-`await` `setup()` attached to the enclosing (root) suite and ran before every test in unrelated files; post-`await` `test()` calls escaped their suite, so `mocha --grep "<suite name>"` matched 0 tests. Note `/suite$/` is case-sensitive - it does **not** match `flakySuite` or `describe`.
- **Rejected:** `code-no-static-self-ref` (esbuild workaround, not transferable); `code-limited-top-functions` (notebook-preload product trivia); `code-must-use-result` (same theme as the shipped example - filler); `code-no-in-operator` (mechanism too thin); cataloguing the 29 undocumented lint rules (adoption playbook, not API reference). Adversarial review additionally killed a stale README size column and a false `flakySuite` claim.

### 2026-08-02 - Run 1 refinement
- **Reformatted** ANALYSIS 2.1 and 2.2 into the standard example anatomy (plain-English mechanism heading / **Prevents:** / citation / <=15-line excerpt / **How it works:** / **Adopt it:**). No new examples: zero additions was the right call. Guides now +2,821 bytes vs the pre-Run-1 baseline, inside the 3 KB budget.
- **Coverage-gap inventory** (mechanical, not ad-hoc): 48 lint rules / 16 workflows / 21 `build/*.ts` / 40 `build/lib/*.ts` / 7 `src/tsconfig*.json` / 84 root npm scripts diffed against SOURCES.md -> 28 undocumented rules, 7 workflows, 16+22 build files, 61 scripts. Best candidate `code-no-accessor-after-await` (a `ServicesAccessor` is only valid synchronously; the rule tracks `sawAwait` branch-by-branch) was **rejected**: it duplicates the `await`-invalidates-a-scope concept already shipped in 2.2, and 2.2's table already name-drops the sibling `code-no-reader-after-await`. Also rejected: `require-commit-trailer.yml` (ordinary CI scripting), the transpile/typecheck split (esbuild + `tsc --noEmit` is not non-obvious in 2026), `build/lib/treeshaking.ts` (custom tree-shaker does not transfer).
- **Round 1 (hostile correctness, gpt-5.6-sol)** returned DO-NOT-SHIP and was fully applied: the heading said tests are "unregistered" when they are in fact registered on the wrong suite; "Mocha runs every callback to completion synchronously" was wrong (Mocha invokes the callback but does not await it, then pops the suite immediately); the rule-specific `warn`-on-`**/*.test.ts`-is-fatal link had been dropped; the selector and leaked-hook scope were overstated; 2.1's elision note said "formatter call" when L32-L36 is a formatter/output block.
- **Round 2 (clarity, reviewer denied access to the VS Code source)** forced: removal of the "the lint task above" backward reference so the example stands alone, an explanation that the trailing object literal is an ESLint *selector* binding `hasAsyncSuite` (previously unexplained magic), and **Prevents:** narrowed to a single failure mode. Verified after both rounds: 124 citations, 75 SOURCES rows, 23 YAML fences - 0 problems.
### 2026-08-02 - Run 2 (verification only, no changes to the guides)
- **Independently re-verified** at `bbb2740`: 126 citations (path exists, label matches URL, range in bounds), 75 SOURCES rows with line counts now correct, 24 YAML fences - **0 problems**. Spot-confirmed Run 1's three headline fixes against upstream: `src/tsconfig.base.json` really is 26 lines; `registerSingleton(IFileService` has **0** matches in microsoft/vscode (`src/vs/code/electron-main/main.ts:197` uses `services.set`); the real alpine retry loop really does `exit 1` on attempt 5.
- **No changes warranted.** Run 1's systematic sweep had completed minutes earlier; re-running it would only re-litigate its documented rejections, which the brief forbids without new evidence.
- **Known-benign JSON fences - do NOT "fix" these.** Two fences fail naive validators but are correct as written: (1) the API Extractor config in PLAYBOOK-PHASE-3-4 breaks any checker that strips `//` comments without respecting string literals, because it mangles `"https://developer.microsoft.com/..."`; (2) the npm-script snippet in this file is a deliberate key-value fragment, not a standalone JSON document. Use a JSONC-aware parser, or skip fences that are explicitly fragments.
- **Line counts:** use `splitlines()`, not `split("\n")`. The latter yields a phantom trailing element for newline-terminated files - the exact bug that let `src/tsconfig.base.json#L1-L27` pass validation against a 26-line file.
### 2026-08-02 - Run 3
- **Verified** 131 citations, 77 SOURCES rows, 23 YAML fences at `7234ef0` - 0 problems. Re-derived 48 rules / 99 contrib / 2167 lines / 16 workflows.
- **Added** ANALYSIS 4.8 "Version-scoped approval of dependency install scripts" (`allowScripts` + `npm approve-scripts --allow-scripts-pending`). Note `allowScripts`/`approve-scripts` are **stock npm** (11.16.0 advisory, enforced in npm 12) - not LavaMoat; all 23 root approvals are version-pinned, and every unpinned entry is a denial. +2,063 bytes, inside budget.
- **REJECTED - do not re-propose: "clean-room extracted-library test"** (`.github/workflows/chat-lib-package.yml`). It looks compelling but the headline claim is false: the workflow deletes only `extensions/copilot/node_modules`, never runs `npm pack`, and `chat-lib/package.json` does **not** declare `@azure/core-auth` while its lockfile hoists it - so undeclared imports still resolve. It catches immediate-parent leakage, not self-containment.
- **Queued, not rejected** (strong candidates for a later run, already line-verified): per-runtime tsconfig matrix `build/checker/tsconfig.{node,browser,worker}.json` L1-L13 (narrow `lib`+`types` so shared code cannot compile against the wrong runtime); `build/lib/propertyInitOrderChecker.ts` L110-L134 (field initializer reading a constructor parameter property); `build/checker/layersTypeCheck.ts` L28-L55 (concurrency budgeted by free RAM, not core count); `scripts/chat-simulation/test-chat-perf-regression.js` L1832-L1910 (perf gate requiring both effect size and Welch t-test significance).
- **Also rejected:** `code-no-declare-const-enum` / `code-no-runtime-import` / `code-no-unused-expressions` (esbuild workarounds or forks of upstream rules); `code-no-global-document-listener`, `code-no-untyped-meta-access` (product trivia); `telemetry.yml`, `sessions-e2e.yml`, `copilot-setup-steps.yml` (ordinary CI); `monaco-editor.yml` fresh-consumer typecheck (weaker than what was already rejected above).
### 2026-08-02 - Run 4
- **Verified** 133 citations, 78 SOURCES rows, 23 YAML fences at `7234ef0` - 0 problems. Counts re-derived (48 rules / 99 contrib / 2167 lines / 16 workflows). Skipped fresh discovery sweeps: Run 3 left four line-verified candidates queued below, so this run wrote them up instead of rediscovering.
- **Added** ANALYSIS 4.13 "Parallelism budgeted by free memory, not CPU count alone" (`build/checker/layersTypeCheck.ts` L28-L55). +1,769 bytes, inside budget. Also compressed the redundant 1.6 summary table (its file column duplicated SOURCES.md).
- **QUEUED, fully corrected, ship next run:** the perf-gate example (`test-chat-perf-regression.js` **L1840-L1854** - not L1840-L1851, the chain continues with an `else if` that must be included; `welchTTest` at `common/utils.js` L697-L718; declare "common leading indentation removed", which makes the excerpt byte-exact). It was drafted, twice reviewed and then **cut only for the 3 KB budget**, not on merit. Three corrections are already baked in and must be preserved: (1) a significant-but-within-budget slowdown is **deliberately passed**, so "Prevents" must not claim it catches those; (2) `welchTTest` returns `null` for `seDiff === 0` as well as for <2 samples; (3) inconclusive results **exit 0** - `process.exit(1)` at L1941 fires only for `regressionFound`, so it is a reporting state, not a third CI outcome.
- **Still queued from Run 3:** per-runtime tsconfig matrix `build/checker/tsconfig.{node,browser,worker}.json` L1-L13; `build/lib/propertyInitOrderChecker.ts` L110-L134.
- **Review notes:** Round 1 (`gpt-5.6-sol`) caught that the 4.13 heading overclaimed ("not CPU count" - `availableParallelism()` is also a cap), that "each want ~3.5 GB" misread a source comment about the *largest* project, that "OOM-killed" is not in the source (it says swapping), and that the cited range also contains an unrelated `tscPath` declaration. Round 2 (clarity, no source access) fixed GiB/GB unit mixing and a "six projects" figure absent from the excerpt. **Its suggestion to delete the `seDiff === 0` caveat was rejected** - Round 1 had proved that caveat necessary. As in Run 3, where a clarity reviewer without source access conflicts with a verified correctness finding, correctness wins.