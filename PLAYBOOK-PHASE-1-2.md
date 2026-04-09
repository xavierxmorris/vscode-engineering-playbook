# VS Code Engineering Practices Adoption Playbook

## Phase 1: Foundations · Phase 2: Test Infrastructure

> **What this is**: A production-ready, copy-paste-able guide for engineering teams adopting microsoft/vscode's battle-tested engineering practices in their own TypeScript/Node.js projects. Every config file is complete. Every pattern is explained with *why*, *how*, and *gotchas*.
>
> **Source of truth**: All recommendations are grounded in actual files from [`microsoft/vscode`](https://github.com/microsoft/vscode) on the `main` branch. File paths are referenced inline.

---

# PHASE 1: FOUNDATIONS

---

## 1.1 ESLint Configuration — Zero-Tolerance Linting

### Why

VS Code uses a **zero-tolerance linting policy**: warnings are treated identically to errors. In their build pipeline (`build/eslint.ts`), any file that produces even a single warning causes the entire build to fail:

```typescript
// From build/eslint.ts — the key enforcement mechanism
function eslint(): NodeJS.ReadWriteStream {
  return vfs
    .src(Array.from(eslintFilter), { base: '.', follow: true, allowEmpty: true })
    .pipe(
      gulpEslint((results) => {
        if (results.warningCount > 0 || results.errorCount > 0) {
          throw new Error(
            `eslint failed with ${results.warningCount + results.errorCount} warnings and/or errors`
          );
        }
      })
    );
}
```

This is critical. Most teams configure rules as "warn" with good intentions but never fix the warnings. VS Code eliminates this by *treating warnings as errors at the CI level*.

VS Code's ESLint config lives at `/eslint.config.js` (flat config format, ESLint 9+). They use `typescript-eslint`, `@stylistic/eslint-plugin-ts`, `eslint-plugin-jsdoc`, `eslint-plugin-header`, and a substantial custom local plugin (`.eslint-plugin-local/index.ts`) that implements 30+ project-specific rules including layer enforcement (`code-layering`, `code-import-patterns`), disposable safety (`code-no-potentially-unsafe-disposables`, `code-must-use-super-dispose`), and localization hygiene.

### How — Complete `eslint.config.js`

Below is a complete flat config adapted for a general TypeScript/Node.js project. It captures the *spirit* of VS Code's config while being immediately usable without their custom plugin infrastructure.

```javascript
// eslint.config.js
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import headerPlugin from 'eslint-plugin-header';

// Configure the header plugin for flat config
headerPlugin.rules.header.meta.schema = false;

export default tseslint.config(
  // ─── Global ignores ───────────────────────────────────────────────
  {
    ignores: [
      'out/**',
      'dist/**',
      'coverage/**',
      'node_modules/**',
      '**/*.d.ts',
      '**/*.js.map',
    ],
  },

  // ─── Base: ESLint recommended ─────────────────────────────────────
  eslint.configs.recommended,

  // ─── TypeScript-aware rules ───────────────────────────────────────
  ...tseslint.configs.strictTypeChecked,

  // ─── All source files ─────────────────────────────────────────────
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],

    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },

    plugins: {
      import: importPlugin,
      header: headerPlugin,
    },

    rules: {
      // ── VS Code "zero tolerance" rules (all errors) ──────────────

      // Curly braces required for all control flow — prevents bugs from
      // single-statement if/else that later gets a second statement added.
      // VS Code enforces this globally.
      'curly': 'error',

      // Triple-equals only. VS Code does not allow == or != anywhere.
      'eqeqeq': ['error', 'always'],

      // Const by default. If a variable is never reassigned, it must be const.
      // Matches VS Code's strict preference for immutability signals.
      'prefer-const': ['error', { destructuring: 'all' }],

      // No debugger statements in committed code.
      'no-debugger': 'error',

      // No duplicate imports from the same module.
      'no-duplicate-imports': 'error',

      // Ban eval() — VS Code bans this and also uses tsec to enforce it.
      'no-eval': 'error',

      // No sparse arrays — [1, , 3] is almost always a bug.
      'no-sparse-arrays': 'error',

      // No throw of non-Error objects.
      'no-throw-literal': 'error',

      // Prevent accidental use of globals that shadow common variable names.
      // Directly from VS Code's eslint.config.js.
      'no-restricted-globals': [
        'error',
        'name',
        'length',
        'event',
        'closed',
        'external',
        'status',
        'origin',
        'orientation',
        'context',
      ],

      // ── TypeScript-specific rules ────────────────────────────────

      // Ban explicit `any`. VS Code warns on this (but treats warnings as
      // errors in CI). We go straight to error.
      '@typescript-eslint/no-explicit-any': 'error',

      // Unused variables are errors. Allow underscore-prefixed params.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // Enforce `import type` for type-only imports. This improves tree-shaking
      // and makes the dependency graph clearer.
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'inline-type-imports',
          disallowTypeAnnotations: true,
        },
      ],

      // No non-null assertions (!) — forces proper null checking.
      '@typescript-eslint/no-non-null-assertion': 'error',

      // Prevent floating promises (promises that are not awaited or returned).
      '@typescript-eslint/no-floating-promises': 'error',

      // No misused promises (e.g., passing async function where sync is expected).
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: false },
      ],

      // ── Import organization ──────────────────────────────────────

      // Sort imports into groups: builtin → external → internal → relative.
      'import/order': [
        'error',
        {
          'groups': [
            'builtin',
            'external',
            'internal',
            ['parent', 'sibling', 'index'],
          ],
          'newlines-between': 'always',
          'alphabetize': { order: 'asc', caseInsensitive: true },
        },
      ],

      // No default exports — VS Code avoids them; named exports are greppable.
      'import/no-default-export': 'error',

      // ── Copyright header ─────────────────────────────────────────
      // VS Code checks this in build/hygiene.ts. We use eslint-plugin-header
      // for the same enforcement with auto-fix support.
      'header/header': [
        'error',
        'block',
        [
          '---------------------------------------------------------------------------------------------',
          ' *  Copyright (c) Your Company. All rights reserved.',
          ' *  Licensed under the MIT License. See LICENSE in the project root for license information.',
          ' *--------------------------------------------------------------------------------------------',
        ],
      ],
    },
  },

  // ─── Layer enforcement via no-restricted-imports ───────────────────
  //
  // VS Code uses a custom `local/code-import-patterns` rule with template
  // placeholders for sophisticated layer enforcement. For most projects,
  // `import/no-restricted-paths` achieves the same goal.
  //
  // This example enforces: common → (no deps) | node → common | browser → common
  {
    files: ['src/common/**/*.ts'],
    plugins: { import: importPlugin },
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './src/common',
              from: './src/node',
              message: 'common/ must not import from node/ (platform-specific code).',
            },
            {
              target: './src/common',
              from: './src/browser',
              message: 'common/ must not import from browser/ (platform-specific code).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/browser/**/*.ts'],
    plugins: { import: importPlugin },
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './src/browser',
              from: './src/node',
              message: 'browser/ must not import from node/ (server-side code).',
            },
          ],
        },
      ],
    },
  },

  // ─── Test file overrides ──────────────────────────────────────────
  {
    files: ['**/*.test.ts', '**/test/**/*.ts'],
    rules: {
      // Allow any in tests for mock/stub flexibility
      '@typescript-eslint/no-explicit-any': 'off',
      // Allow non-null assertions in tests (asserting known state)
      '@typescript-eslint/no-non-null-assertion': 'off',
      // No default export rule relaxed for test fixtures
      'import/no-default-export': 'off',
    },
  },
);
```

### How — Treat Warnings as Errors in Your Build

Create a build script that replicates VS Code's zero-tolerance approach:

```json
{
  "scripts": {
    "lint": "eslint --max-warnings 0 'src/**/*.{ts,tsx}'",
    "lint:fix": "eslint --fix 'src/**/*.{ts,tsx}'"
  }
}
```

The `--max-warnings 0` flag is the key. Any warning becomes a non-zero exit code. This is the npm-script equivalent of what VS Code does in `build/eslint.ts`.

### How — `lint-staged` Config for Pre-Commit

```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --max-warnings 0 --fix",
      "prettier --write"
    ]
  }
}
```

### How — VS Code Editor Integration

`.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "never"
  },
  "eslint.validate": ["typescript", "typescriptreact"],
  "eslint.useFlatConfig": true,
  "files.trimTrailingWhitespace": true,
  "files.insertFinalNewline": true,
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

`.vscode/extensions.json` (adapted from VS Code's own `/vscode/extensions.json`):
```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "editorconfig.editorconfig",
    "esbenp.prettier-vscode"
  ]
}
```

### Gotchas

| Pitfall | Solution |
|---------|----------|
| **Existing codebase has 2000+ lint errors** | Use the *baseline suppression* strategy: run `eslint --fix` first to auto-fix what's possible, then use `/* eslint-disable */` with a `// TODO(TICKET-123): Fix this` comment for the rest. Track a ticket per suppression category. |
| **`no-explicit-any` breaks half the codebase** | Start with `warn` in `eslint.config.js` but keep `--max-warnings 0` in CI disabled for this rule initially. Use `@typescript-eslint/no-unsafe-*` rules as stepping stones. |
| **Import order rule conflicts with IDE auto-import** | Disable VS Code's built-in `source.organizeImports` (set to `"never"` above) and let ESLint handle it via `eslint-plugin-import`. They use different sorting algorithms. |
| **Flat config is new and plugins don't all support it** | Check each plugin's docs for flat config support. `eslint-plugin-import` requires the `eslint-plugin-import` v2.29+ or the `eslint-plugin-import-x` fork. |
| **CI is slow because ESLint runs on all files** | Use `--cache` flag and cache `.eslintcache` in CI. VS Code uses file filtering via `build/filters.ts` to only lint relevant file types. |
| **Gradual rollout strategy** | 1) Enable rules as `warn` locally, 2) Fix file-by-file or team-by-team, 3) Flip to `error` once under threshold, 4) Enable `--max-warnings 0` last. VS Code never had to do this (they started strict), but this is the pragmatic path for existing codebases. |

---

## 1.2 TypeScript Strict Mode — Multi-Surface Compilation

### Why

VS Code enables `"strict": true` in every single tsconfig across the project. They compile the same codebase for multiple targets: the main VS Code application (`src/tsconfig.json`), the build tools (`build/tsconfig.json`), and all extensions (`extensions/tsconfig.base.json`). Each has different module systems, lib targets, and plugin configurations — but they ALL share strict mode.

The multi-tsconfig approach serves several purposes:
1. **Different module systems**: The main app uses `"module": "nodenext"`, extensions use `"module": "commonjs"`
2. **Different lib targets**: The main app includes DOM types; the build tools do not
3. **Different plugin sets**: The main app enables `tsec` (security checker); build tools do not
4. **Different include/exclude patterns**: Tests are excluded from production builds

### How VS Code Organizes Their tsconfigs

| File | Purpose | Module | Target |
|------|---------|--------|--------|
| `src/tsconfig.base.json` | Shared strict settings for all source | `nodenext` | `ES2024` |
| `src/tsconfig.json` | Main app — extends base, adds types, plugins | `nodenext` | `ES2024` |
| `src/tsconfig.tsec.json` | Security scanning — extends tsconfig.json, excludes tests | `nodenext` | `ES2024` |
| `build/tsconfig.json` | Build tools — standalone strict config | `nodenext` | `ES2024` |
| `extensions/tsconfig.base.json` | Extension base — separate strict config | `commonjs` | `ES2024` |

### How — `tsconfig.base.json` (Shared Foundation)

This is your project-wide base. Every other tsconfig extends it.

```json
{
  "compilerOptions": {
    // ─── Strict Type Checking ─────────────────────────────────────
    // "strict": true enables ALL of these:
    //   - strictNullChecks: null/undefined are distinct types
    //   - strictFunctionTypes: contravariant function parameter checking
    //   - strictBindCallApply: type-check bind/call/apply
    //   - strictPropertyInitialization: class props must be initialized
    //   - noImplicitAny: error on inferred 'any'
    //   - noImplicitThis: error on 'this' with type 'any'
    //   - alwaysStrict: emit "use strict" in every file
    //   - useUnknownInCatchVariables: catch variables are 'unknown' not 'any'
    "strict": true,

    // VS Code explicitly disables these two even with strict: true.
    // exactOptionalPropertyTypes: prevents assigning undefined to optional
    // properties. Too noisy for most codebases — many libraries violate this.
    "exactOptionalPropertyTypes": false,

    // VS Code disables this for ergonomic catch handling. With it enabled,
    // every catch block requires `if (err instanceof Error)` checks.
    // Recommended: leave false until your error handling is well-established.
    "useUnknownInCatchVariables": false,

    // ─── Additional Safety Checks ─────────────────────────────────
    // Every function path must return a value (if return type isn't void).
    "noImplicitReturns": true,

    // Override methods must use the 'override' keyword. Catches typos
    // and accidental overrides. Used by VS Code in src/tsconfig.base.json.
    "noImplicitOverride": true,

    // Flag unused local variables. VS Code enables this everywhere.
    "noUnusedLocals": true,

    // Flag imports that only have side effects but are unchecked.
    // New in TS 5.5 — VS Code recently adopted this.
    "noUncheckedSideEffectImports": true,

    // Dead code detection.
    "allowUnreachableCode": false,

    // ─── Module System ────────────────────────────────────────────
    "module": "nodenext",
    "moduleResolution": "nodenext",

    // Legacy module detection means every file is a module only if it
    // has import/export. VS Code uses this for compatibility.
    "moduleDetection": "legacy",

    // ─── Emit & Compatibility ─────────────────────────────────────
    "target": "ES2022",

    // CRITICAL: VS Code sets this to FALSE. When true (the TS default for
    // ES2022+), class fields use [[Define]] semantics instead of
    // [[Set]]. This breaks patterns that rely on setters in base classes
    // being called during initialization.
    //
    // Set to false if:
    // - You use decorators (experimentalDecorators)
    // - You have base class setters that should trigger on init
    // - You use dependency injection that hooks into property assignment
    "useDefineForClassFields": false,

    // For projects using decorators (VS Code uses them for DI).
    "experimentalDecorators": true,

    // ─── Path & Casing ────────────────────────────────────────────
    // Prevents import case mismatches between macOS (case-insensitive)
    // and Linux (case-sensitive). Catches real bugs in CI.
    "forceConsistentCasingInFileNames": true,

    // ─── Lib ──────────────────────────────────────────────────────
    "lib": ["ES2022"]
  }
}
```

### How — `tsconfig.app.json` (Main Application)

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "sourceMap": true,
    "declaration": true,
    "declarationMap": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts", "src/**/test/**"]
}
```

### How — `tsconfig.test.json` (Test Compilation)

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist-test",
    "rootDir": ".",
    "sourceMap": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    // Tests are allowed to be looser
    "noUnusedLocals": false,
    "noUnusedParameters": false
  },
  "include": [
    "src/**/*.ts",
    "test/**/*.ts"
  ]
}
```

### How — `tsconfig.node.json` (Node-Only Code / Build Tools)

Modeled after VS Code's `build/tsconfig.json`:

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "noEmit": true,
    "verbatimModuleSyntax": true,
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "noUnusedParameters": true,
    "lib": ["ES2022"]
  },
  "include": ["scripts/**/*.ts", "build/**/*.ts"],
  "exclude": ["node_modules/**"]
}
```

### How — `tsconfig.browser.json` (Browser-Only Code)

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist-browser",
    "rootDir": "./src",
    "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"],
    // No Node.js types available
    "types": []
  },
  "include": [
    "src/common/**/*.ts",
    "src/browser/**/*.ts"
  ],
  "exclude": [
    "src/node/**/*.ts",
    "src/**/*.test.ts"
  ]
}
```

### How — `tsec` (TypeScript Security Checker)

VS Code uses `tsec` as a TypeScript compiler plugin (see `src/tsconfig.json` and `src/tsconfig.tsec.json`). It's a static analysis tool from Google that detects security-sensitive API usage like `eval()`, `document.execCommand()`, `innerHTML`, `DOMParser.parseFromString()`, and more.

**Installation:**
```bash
npm install --save-dev tsec
```

**Add to your tsconfig (create a dedicated one like VS Code does):**

```json
{
  "extends": "./tsconfig.app.json",
  "compilerOptions": {
    "noEmit": true,
    "skipLibCheck": true,
    "plugins": [
      {
        "name": "tsec",
        "exemptionConfig": "./tsec.exemptions.json"
      }
    ]
  },
  "exclude": ["**/*.test.ts", "**/test/**"]
}
```

**Exemptions file (`tsec.exemptions.json`)**, modeled after VS Code's `src/tsec.exemptions.json`:
```json
{
  "ban-eval-calls": [],
  "ban-function-calls": [],
  "ban-element-setattribute": ["**/*.ts"],
  "ban-domparser-parsefromstring": [],
  "ban-element-insertadjacenthtml": [],
  "ban-script-content-assignments": [],
  "ban-trustedtypes-createpolicy": [],
  "ban-worker-calls": [],
  "ban-worker-importscripts": [],
  "ban-document-execcommand": []
}
```

**Run tsec as a CI step:**
```bash
npx tsec -p tsconfig.tsec.json
```

### The `useDefineForClassFields` Check — When It Matters

VS Code explicitly sets `"useDefineForClassFields": false`. Here's why this matters:

```typescript
class Base {
  private _name = '';
  get name() { return this._name; }
  set name(value: string) {
    console.log('setter called!'); // Side effect
    this._name = value;
  }
}

class Derived extends Base {
  name = 'default'; // Does this call the setter?
}
```

- With `useDefineForClassFields: false` (VS Code's setting): **YES** — `name = 'default'` calls the setter. This uses `[[Set]]` semantics.
- With `useDefineForClassFields: true` (TS default for ES2022+): **NO** — `name = 'default'` creates a new own property, bypassing the setter. This uses `[[Define]]` semantics.

**Rule of thumb**: Set to `false` if you use `experimentalDecorators`, dependency injection, or have base class property setters. Set to `true` for new greenfield projects that don't use decorators.

### Gotchas — Migrating to Strict Mode

| Phase | Strategy | Duration |
|-------|----------|----------|
| **1. Enable `strict` with escape hatches** | Turn on `"strict": true` but add `// @ts-expect-error` with tracking comments on every error. Run `tsc --noEmit` to find all errors. Use a script to auto-insert suppressions. | 1-2 days |
| **2. Fix `strictNullChecks` errors (biggest batch)** | These are 70%+ of strict mode errors. Fix file-by-file. Prioritize shared libraries first. | 2-6 weeks |
| **3. Fix `noImplicitAny` errors** | Add explicit types to function parameters and return types. Use `unknown` instead of `any` where possible. | 1-3 weeks |
| **4. Remove suppressions** | Track suppressions in a dashboard. Set a team goal (e.g., reduce by 20% per sprint). | Ongoing |

> **Note**: VS Code never had to migrate — they started with strict mode from day one. The best time to enable it is at project creation. The second best time is now, using the phased approach above.

---

## 1.3 Deterministic Formatting

### Why

VS Code uses the TypeScript language service's built-in formatter, configured via `tsfmt.json`. Their `build/hygiene.ts` script performs **byte-for-byte comparison** of each file against its formatted version. If even one character differs, the build fails.

From VS Code's `tsfmt.json`:
```json
{
  "tabSize": 4,
  "indentSize": 4,
  "convertTabsToSpaces": false,
  "insertSpaceAfterCommaDelimiter": true,
  "insertSpaceAfterSemicolonInForStatements": true,
  "insertSpaceBeforeAndAfterBinaryOperators": true,
  "insertSpaceAfterKeywordsInControlFlowStatements": true,
  "insertSpaceAfterFunctionKeywordForAnonymousFunctions": true,
  "insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis": false,
  "insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets": false,
  "insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces": false,
  "insertSpaceAfterOpeningAndBeforeClosingEmptyBraces": true,
  "insertSpaceBeforeFunctionParenthesis": false,
  "placeOpenBraceOnNewLineForFunctions": false,
  "placeOpenBraceOnNewLineForControlBlocks": false
}
```

Their `build/lib/formatter.ts` uses the TypeScript Language Service API to format files, loading settings from this file and applying `\r\n` line endings, then comparing the result byte-for-byte.

**For most teams, Prettier achieves the same determinism with less friction.** The TS formatter is powerful but requires custom tooling to run as a CLI check. Prettier is a drop-in replacement.

### How — Complete `.prettierrc`

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 120,
  "tabWidth": 4,
  "useTabs": true,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf",
  "quoteProps": "as-needed"
}
```

> **Note**: VS Code uses tabs (see `.editorconfig`). The Prettier config above matches their style. Change `useTabs: false` and `tabWidth: 2` if you prefer spaces — the important thing is consistency, not the specific style.

### How — Complete `.prettierignore`

```gitignore
# Build outputs
dist/
out/
coverage/

# Dependencies
node_modules/

# Generated files
*.d.ts
*.js.map
*.min.js

# Package manager lockfiles
package-lock.json
yarn.lock
pnpm-lock.yaml

# CI/CD
.github/

# Assets
*.png
*.ico
*.svg
*.woff
*.woff2
```

### How — Complete `.editorconfig`

Adapted from VS Code's own `/.editorconfig`:

```ini
# EditorConfig — https://EditorConfig.org
# This is the top-level config; stop searching parent directories.
root = true

# Default for all files: tab indentation, trim whitespace
[*]
indent_style = tab
indent_size = 4
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

# YAML and package.json: npm requires 2-space indentation
# https://github.com/npm/npm/pull/3180#issuecomment-16336516
[{*.yml,*.yaml,package.json}]
indent_style = space
indent_size = 2

# Markdown: trailing whitespace is significant (line breaks)
[*.md]
trim_trailing_whitespace = false

# Makefiles: MUST use tabs
[Makefile]
indent_style = tab

# Shell scripts
[*.sh]
end_of_line = lf

# Windows batch files
[*.{cmd,bat}]
end_of_line = crlf
```

### How — `.vscode/settings.json` with Format-on-Save

This combines formatting enforcement with VS Code's own dev settings (from `/.vscode/settings.json`):

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.insertSpaces": false,
  "editor.tabSize": 4,
  "editor.rulers": [120],
  "files.trimTrailingWhitespace": true,
  "files.insertFinalNewline": true,
  "files.eol": "\n",
  "[typescript]": {
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[jsonc]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[markdown]": {
    "editor.formatOnSave": false,
    "files.trimTrailingWhitespace": false
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/out": true,
    "**/coverage": true
  },
  "files.readonlyInclude": {
    "node_modules/**/*.*": true,
    "package-lock.json": true
  }
}
```

### How — CI Format Check with Exit-on-Diff

```json
{
  "scripts": {
    "format:check": "prettier --check 'src/**/*.{ts,tsx,json,css,md}'",
    "format:fix": "prettier --write 'src/**/*.{ts,tsx,json,css,md}'"
  }
}
```

The `--check` flag exits with code 1 if any file would change. This is the Prettier equivalent of VS Code's byte-for-byte comparison in `build/hygiene.ts`.

### Gotchas

| Pitfall | Solution |
|---------|----------|
| **CRLF vs LF across platforms** | Set `"endOfLine": "lf"` in `.prettierrc` AND `* text=auto eol=lf` in `.gitattributes`. VS Code's `.gitattributes` explicitly sets `eol=crlf` only for `.bat` and `.cmd` files, and `eol=lf` for `.sh` and `.ps1`. Everything else uses `text=auto`. |
| **`git config core.autocrlf` varies per developer** | Add to your onboarding docs: `git config --global core.autocrlf input` (on macOS/Linux) or `git config --global core.autocrlf true` (on Windows). Better yet: `.gitattributes` overrides this per-repo. |
| **Prettier and ESLint conflict** | Use `eslint-config-prettier` to disable ESLint rules that conflict. Or use `eslint-plugin-prettier` to run Prettier as an ESLint rule (slower but simpler). |
| **First-time format commit is huge** | Do a single "format all files" commit (`git commit -m "chore: apply prettier formatting"`). Tell your team in advance. Do it on a Monday morning so everyone pulls fresh. |
| **Format-on-save is slow on large files** | Prettier is fast but can be slow on 2000+ line files. Consider splitting large files (which you should do anyway). |

---

## 1.4 Hygiene Checks Beyond Linting

### Why

VS Code's `build/hygiene.ts` runs a suite of checks that go beyond ESLint:

1. **Copyright/license headers** — Every `.ts` file must start with the Microsoft copyright block
2. **Unicode restrictions** — Blocks non-ASCII characters except for a curated allowlist of UI symbols (✔, ⇧, ⌥, ⌘, etc.)
3. **Indentation verification** — Validates tab-based indentation matches the project standard
4. **Import ordering** — Enforced via ESLint rules
5. **Stylelint** — CSS files are checked for style consistency

These checks run on every commit (via the pre-commit script) and in CI.

### How — Copyright Headers with `eslint-plugin-header`

Already configured in Section 1.1's ESLint config. The `header/header` rule auto-fixes missing headers.

**If you want to check files ESLint doesn't cover** (e.g., `.css`, `.html`), create a dedicated script:

```typescript
// scripts/check-headers.ts
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const HEADER = `/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Your Company. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/`;

async function checkHeaders(): Promise<void> {
  const files = await glob('src/**/*.{ts,tsx,css}', { ignore: ['**/*.d.ts'] });
  const failures: string[] = [];

  for (const file of files) {
    const content = fs.readFileSync(path.resolve(file), 'utf-8');
    if (!content.startsWith(HEADER)) {
      failures.push(file);
    }
  }

  if (failures.length > 0) {
    console.error(`Missing copyright header in ${failures.length} file(s):`);
    failures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }

  console.log(`✓ All ${files.length} files have correct copyright headers.`);
}

checkHeaders();
```

### How — Unicode Restrictions

VS Code's `build/hygiene.ts` scans files for unexpected Unicode characters. This prevents invisible characters (zero-width spaces, RTL overrides) that could mask security vulnerabilities or cause subtle bugs.

```typescript
// scripts/check-unicode.ts
import * as fs from 'fs';
import { glob } from 'glob';

// Characters that are allowed beyond ASCII.
// Adapted from VS Code's build/hygiene.ts allowed unicode chars.
const ALLOWED_UNICODE = new Set([
  0x2714, // ✔
  0x21e7, // ⇧
  0x2325, // ⌥
  0x2318, // ⌘
  0x2303, // ⌃
  0x21b5, // ↵
  0x200b, // zero-width space (used in word-break hints)
]);

// Pattern that matches any non-ASCII character
const NON_ASCII = /[^\x00-\x7F]/g;

async function checkUnicode(): Promise<void> {
  const files = await glob('src/**/*.ts', { ignore: ['**/*.d.ts', '**/test/**'] });
  const failures: string[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const matches = lines[i].matchAll(NON_ASCII);
      for (const match of matches) {
        const codePoint = match[0].codePointAt(0)!;
        if (!ALLOWED_UNICODE.has(codePoint)) {
          failures.push(
            `${file}:${i + 1}: Unexpected Unicode character U+${codePoint.toString(16).padStart(4, '0')} "${match[0]}"`,
          );
        }
      }
    }
  }

  if (failures.length > 0) {
    console.error(`Found ${failures.length} unexpected Unicode character(s):`);
    failures.forEach((f) => console.error(`  ${f}`));
    process.exit(1);
  }

  console.log('✓ No unexpected Unicode characters found.');
}

checkUnicode();
```

### How — Import Ordering via ESLint

Already configured in Section 1.1 via `import/order`. For reference, VS Code handles this through their custom `code-import-patterns` rule, but `eslint-plugin-import`'s `order` rule achieves the same grouping and alphabetization.

### How — Complete "Hygiene" npm Script

```json
{
  "scripts": {
    "hygiene": "concurrently --kill-others-on-fail --names lint,format,types,headers,unicode \"npm run lint\" \"npm run format:check\" \"npm run typecheck\" \"npx tsx scripts/check-headers.ts\" \"npx tsx scripts/check-unicode.ts\"",
    "hygiene:fix": "npm run lint:fix && npm run format:fix",
    "typecheck": "tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p tsconfig.test.json"
  }
}
```

> **Note**: Install `concurrently` (`npm install --save-dev concurrently`) to run checks in parallel. The `--kill-others-on-fail` flag stops all checks when any one fails, giving fast feedback.

---

## 1.5 CI Foundations

### Why

VS Code's CI runs on Azure Pipelines with an elaborate matrix of platform × architecture × test-type jobs. For GitHub-hosted projects, GitHub Actions is the natural equivalent. The principles are the same:

- **Cancel in-progress runs** when a new push arrives (don't waste compute)
- **Cache aggressively** with proper cache keys
- **Retry transient failures** (npm install can flake on network issues)
- **Upload artifacts only on failure** (no one downloads passing builds)
- **Set step timeouts** (a hung test shouldn't block the queue for hours)

### How — Complete `.github/workflows/ci.yml`

```yaml
name: CI — Lint, Format, Typecheck

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

# Cancel previous runs on the same branch/PR.
# This prevents queued runs from wasting compute when you push again.
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

env:
  NODE_VERSION: '20'

jobs:
  hygiene:
    name: Lint + Format + Typecheck
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      # Cache node_modules based on lockfile hash.
      # The key includes the OS because native modules differ across platforms.
      - name: Cache node_modules
        uses: actions/cache@v4
        id: cache-deps
        with:
          path: node_modules
          key: deps-${{ runner.os }}-node${{ env.NODE_VERSION }}-${{ hashFiles('package-lock.json') }}
          restore-keys: |
            deps-${{ runner.os }}-node${{ env.NODE_VERSION }}-

      # npm install with retry logic for transient network failures.
      # VS Code's CI has similar retry mechanisms for their package management.
      - name: Install dependencies
        if: steps.cache-deps.outputs.cache-hit != 'true'
        shell: bash
        run: |
          install_with_retry() {
            local max_attempts=3
            local attempt=1
            while [ $attempt -le $max_attempts ]; do
              echo "npm ci attempt $attempt of $max_attempts..."
              if npm ci --ignore-scripts; then
                echo "npm ci succeeded on attempt $attempt"
                return 0
              fi
              echo "npm ci failed on attempt $attempt"
              attempt=$((attempt + 1))
              if [ $attempt -le $max_attempts ]; then
                echo "Waiting 10 seconds before retry..."
                sleep 10
              fi
            done
            echo "npm ci failed after $max_attempts attempts"
            return 1
          }
          install_with_retry

      # Run postinstall scripts after cache restore (native rebuilds, etc.)
      - name: Post-install
        if: steps.cache-deps.outputs.cache-hit == 'true'
        run: npm rebuild

      # ── Lint ───────────────────────────────────────────────────────
      - name: ESLint
        timeout-minutes: 5
        run: npm run lint

      # ── Format Check ───────────────────────────────────────────────
      - name: Prettier
        timeout-minutes: 2
        run: npm run format:check

      # ── Type Check ─────────────────────────────────────────────────
      - name: TypeScript (app)
        timeout-minutes: 5
        run: npx tsc --noEmit -p tsconfig.app.json

      - name: TypeScript (tests)
        timeout-minutes: 5
        run: npx tsc --noEmit -p tsconfig.test.json

      # ── Security Check (optional) ─────────────────────────────────
      - name: tsec Security Scan
        timeout-minutes: 3
        run: npx tsec -p tsconfig.tsec.json
        continue-on-error: true  # Remove this once all exemptions are configured

      # ── Upload diagnostic artifacts only on failure ────────────────
      - name: Upload ESLint report
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: eslint-report
          path: eslint-report.json
          retention-days: 7
```

### Key Design Decisions Explained

| Decision | Why |
|----------|-----|
| **`concurrency.cancel-in-progress: true`** | If you push 3 commits in quick succession, only the latest runs. VS Code uses similar gating in their pipeline. |
| **Cache key includes `runner.os`** | Native modules (like `esbuild`) differ between Linux/macOS/Windows. A shared cache would cause rebuild failures. |
| **`npm ci` not `npm install`** | `npm ci` does a clean install from the lockfile. It's faster, deterministic, and catches lockfile desync. |
| **Retry logic for npm** | npm registry has occasional 502/503 errors. Three retries with 10s backoff handles this gracefully. |
| **Per-step `timeout-minutes`** | A hung ESLint process shouldn't block the job for the full 15-minute job timeout. Individual step timeouts give faster feedback. |
| **`failure()` artifact upload** | Successful runs don't need artifacts. Only upload diagnostic data when something breaks. |

---

## 1.6 Pre-Commit Hooks

### Why

VS Code runs `build/hygiene.ts` as a pre-commit hook on staged files. This catches formatting issues, missing headers, and lint errors *before* they reach CI. The hook runs only on staged files (not the entire codebase), so it's fast even in a 50,000-file repository.

### How — Complete Husky + lint-staged Setup

**Install:**
```bash
npm install --save-dev husky lint-staged
npx husky init
```

This creates a `.husky/` directory with a `pre-commit` hook.

**`.husky/pre-commit`:**
```bash
npx lint-staged
```

**`package.json` — lint-staged configuration:**
```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --max-warnings 0 --fix",
      "prettier --write"
    ],
    "*.{json,md,yml,yaml}": [
      "prettier --write"
    ],
    "*.css": [
      "prettier --write"
    ]
  }
}
```

### What Runs and Why

| Check | Files | Purpose |
|-------|-------|---------|
| `eslint --fix` | `.ts`, `.tsx` | Fix auto-fixable issues, fail on errors |
| `prettier --write` | All supported | Ensure formatting is deterministic |
| `--max-warnings 0` | `.ts`, `.tsx` | Zero-tolerance: warnings are errors |

### How VS Code's Pre-Commit Works

VS Code's approach (`build/hygiene.ts` running with `import.meta.main` detection) is more monolithic — it's a single Node.js script that runs all checks in sequence on staged files obtained via `git diff --cached --name-only`. The husky + lint-staged approach is the standard equivalent for the ecosystem.

> **Note**: Do NOT run `tsc --noEmit` in the pre-commit hook. TypeScript type checking requires the full project context (not just staged files) and is too slow for a commit hook. Leave type checking for CI.

---

## 1.7 Git Configuration

### How — `.gitattributes`

Adapted from VS Code's `/.gitattributes`:

```gitignore
# Auto-detect text files and normalize line endings to LF on commit.
# This is the single most important line — it prevents CRLF/LF mismatches.
* text=auto eol=lf

# Force LF for all shell scripts (even on Windows)
*.sh text eol=lf
*.ps1 text eol=lf

# Force CRLF for Windows-specific scripts
*.bat text eol=crlf
*.cmd text eol=crlf

# Binary files — do not attempt text conversion
*.png binary
*.jpg binary
*.jpeg binary
*.gif binary
*.ico binary
*.svg binary
*.woff binary
*.woff2 binary
*.ttf binary
*.eot binary

# Treat JSON as JSONC for GitHub linguist (VS Code does this)
**/*.json linguist-language=jsonc

# Lock files are generated — don't show in diffs by default
package-lock.json linguist-generated=true
pnpm-lock.yaml linguist-generated=true
```

### How — `.gitignore` Template

```gitignore
# ─── Build outputs ───────────────────────────────────────────────
dist/
out/
out-build/
*.js.map

# ─── Dependencies ────────────────────────────────────────────────
node_modules/

# ─── Test & coverage ─────────────────────────────────────────────
coverage/
test-results/
*.test-results.xml
.nyc_output/

# ─── IDE ─────────────────────────────────────────────────────────
# Keep .vscode/settings.json and extensions.json committed.
# Ignore personal workspace files.
.vscode/*.code-workspace
.vscode/.ropeproject
.idea/
*.swp
*.swo
*~

# ─── OS files ────────────────────────────────────────────────────
.DS_Store
Thumbs.db
Desktop.ini

# ─── Environment ─────────────────────────────────────────────────
.env
.env.local
.env.*.local

# ─── ESLint cache ────────────────────────────────────────────────
.eslintcache

# ─── TypeScript incremental ──────────────────────────────────────
*.tsbuildinfo
```

### Branch Protection Rules (Recommended)

Configure these on your `main` branch in GitHub:

| Rule | Setting | Why |
|------|---------|-----|
| Require pull request reviews | 1 reviewer minimum | Catches issues before merge |
| Require status checks to pass | `hygiene` job | No broken code on main |
| Require branches to be up to date | Enabled | Prevents merge skew |
| Require linear history | Enabled (squash merge) | Clean git history |
| Do not allow bypassing | Enabled | Even admins follow the rules |

---

# PHASE 2: TEST INFRASTRUCTURE

---

## 2.1 Test Framework Setup

### Why

VS Code uses Mocha with TDD-style (`suite`/`test`) syntax across three completely separate test harnesses:

| Harness | File | Environment | Runs in |
|---------|------|-------------|---------|
| Electron | `test/unit/electron/renderer.js` | Electron renderer process | Chromium (Electron) |
| Browser | `test/unit/browser/index.js` | Playwright-controlled browser | Chromium, Firefox, WebKit |
| Node.js | `test/unit/node/index.js` | Pure Node.js | Node.js process |

Each harness dynamically discovers test files via `glob('**/test/**/*.test.js')` and excludes tests belonging to other environments. For example, the Node harness excludes `**/browser/**/*.test.js` and `**/electron-browser/**/*.test.js`.

**For modern projects, Vitest is the recommended framework.** It provides the same multi-environment capabilities with zero-config, native ESM support, built-in TypeScript support, and dramatically faster execution through Vite's transform pipeline.

### How — Complete `vitest.config.ts` (Base)

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    // TDD-style API (suite/test) to match VS Code's Mocha conventions.
    // You can also use 'bdd' for describe/it syntax.
    globals: true,

    // Separate config files per test type (like VS Code's separate harnesses)
    include: ['src/**/*.test.ts'],

    // Exclude integration and e2e tests from default "vitest" command
    exclude: [
      'node_modules/**',
      'test/integration/**',
      'test/e2e/**',
    ],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/test/**',
        'src/**/*.d.ts',
        'src/**/index.ts',  // barrel files
      ],
      // Thresholds — start low, ratchet up over time
      thresholds: {
        statements: 60,
        branches: 60,
        functions: 60,
        lines: 60,
      },
    },

    // Reporter configuration
    reporters: process.env.CI
      ? ['default', 'junit']
      : ['default'],
    outputFile: process.env.CI
      ? { junit: './test-results/junit.xml' }
      : undefined,

    // Timeouts — match VS Code's CI timeout of 30s
    testTimeout: process.env.CI ? 30_000 : 5_000,
    hookTimeout: process.env.CI ? 30_000 : 10_000,

    // Pool configuration
    pool: 'forks',
    poolOptions: {
      forks: {
        // Limit memory per worker to prevent leaks from crashing the host
        execArgv: ['--max-old-space-size=4096'],
      },
    },
  },
});
```

### How — Separate Configs per Test Type

**`vitest.config.unit.ts`** — Unit tests (fast, no I/O):
```typescript
// vitest.config.unit.ts
import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config';

export default mergeConfig(baseConfig, defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: [
      'node_modules/**',
      'test/**',
      'src/**/*.integration.test.ts',
    ],
    testTimeout: 5_000,
    // Unit tests should be fast — no file I/O, no network
    pool: 'forks',
  },
}));
```

**`vitest.config.integration.ts`** — Integration tests (database, file system):
```typescript
// vitest.config.integration.ts
import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config';

export default mergeConfig(baseConfig, defineConfig({
  test: {
    include: ['test/integration/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Integration tests run sequentially to avoid port/resource conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Longer setup/teardown for databases, servers, etc.
    setupFiles: ['test/integration/setup.ts'],
  },
}));
```

**`vitest.config.e2e.ts`** — End-to-end tests (Playwright, full stack):
```typescript
// vitest.config.e2e.ts
import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config';

export default mergeConfig(baseConfig, defineConfig({
  test: {
    include: ['test/e2e/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    setupFiles: ['test/e2e/setup.ts'],
    // E2E tests need browser environment
    browser: {
      enabled: false, // Set true if using vitest-browser-mode
    },
  },
}));
```

### How — Environment-Based Test Directory Convention

Following VS Code's pattern of `test/common/`, `test/browser/`, `test/node/`:

```
src/
├── common/              # Platform-agnostic code
│   ├── utils.ts
│   └── utils.test.ts    # Tests alongside source (unit)
├── node/                # Node.js-specific code
│   ├── fileService.ts
│   └── fileService.test.ts
├── browser/             # Browser-specific code
│   ├── domUtils.ts
│   └── domUtils.test.ts
test/
├── integration/         # Cross-module integration tests
│   ├── setup.ts
│   └── api.integration.test.ts
└── e2e/                 # Full end-to-end tests
    ├── setup.ts
    └── app.e2e.test.ts
```

**`package.json` scripts:**
```json
{
  "scripts": {
    "test": "vitest run --config vitest.config.unit.ts",
    "test:watch": "vitest --config vitest.config.unit.ts",
    "test:integration": "vitest run --config vitest.config.integration.ts",
    "test:e2e": "vitest run --config vitest.config.e2e.ts",
    "test:all": "vitest run --config vitest.config.unit.ts && vitest run --config vitest.config.integration.ts",
    "test:coverage": "vitest run --config vitest.config.unit.ts --coverage"
  }
}
```

---

## 2.2 Test Parallelization & Sharding

### Why

VS Code splits their ~5000+ unit tests across multiple CI agents using a `--testSplit` parameter. From `test/unit/electron/renderer.js`:

```javascript
if (opts.testSplit) {
  const [i, n] = opts.testSplit.split('/').map(Number);
  const chunkSize = Math.floor(modules.length / n);
  const start = (i - 1) * chunkSize;
  const end = i === n ? modules.length : i * chunkSize;
  modules = modules.slice(start, end);
}
```

This divides the test module list into `n` equal chunks and runs chunk `i`. The last chunk gets any remainder modules, ensuring nothing is skipped.

### How — Vitest Native Sharding

Vitest has built-in sharding that works identically:

```bash
# Run shard 1 of 4
vitest run --shard 1/4

# Run shard 3 of 4
vitest run --shard 3/4
```

No custom code needed. Vitest handles the splitting automatically, distributing test *files* across shards.

### How — CI Matrix Strategy for Cross-Platform + Sharded Tests

```yaml
# In your test workflow (see Section 2.8 for the complete file)
jobs:
  unit-tests:
    strategy:
      fail-fast: false  # Don't cancel other shards if one fails
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        shard: [1, 2]
        total-shards: [2]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx vitest run --config vitest.config.unit.ts --shard ${{ matrix.shard }}/${{ matrix.total-shards }}
```

### How — Determining Optimal Shard Count

```bash
# Measure your test suite duration
time npx vitest run --config vitest.config.unit.ts --reporter=verbose 2>&1 | tail -5

# Rule of thumb:
# - Under 2 minutes: no sharding needed (1 shard)
# - 2-5 minutes: 2 shards
# - 5-15 minutes: 4 shards
# - 15+ minutes: 8 shards, and also investigate slow tests

# Profile individual test file durations:
npx vitest run --reporter=json > test-results.json
# Parse the JSON to find slow test files
```

> **Note**: More shards means more CI jobs means more overhead (checkout, install, etc.). Each shard adds ~30-60 seconds of fixed overhead. Don't shard a 90-second test suite into 8 pieces — you'll make it slower.

---

## 2.3 In-Memory Mocks & Test Doubles

### Why

VS Code builds hundreds of in-memory implementations of their service interfaces. This is foundational to their testing strategy:
- **No I/O in unit tests** — tests run in milliseconds, not seconds
- **Deterministic** — no flaky tests from file system races or network timeouts
- **Isolated** — each test gets a fresh state

Key examples:
- `InMemoryFileSystemProvider` (`src/vs/platform/files/common/inMemoryFilesystemProvider.ts`) — complete file system with read/write/delete/rename/watch
- `TestInstantiationService` (`src/vs/platform/instantiation/test/common/instantiationServiceMock.ts`) — DI container for tests
- `workbenchTestServices.ts` (`src/vs/workbench/test/browser/workbenchTestServices.ts`) — hundreds of mock services

### How — Complete `InMemoryFileSystem` (Adapted for General Use)

```typescript
// src/common/test-utils/InMemoryFileSystem.ts
import { EventEmitter } from 'events';

export interface FileEntry {
  type: 'file';
  name: string;
  content: Uint8Array;
  ctime: number;
  mtime: number;
}

export interface DirectoryEntry {
  type: 'directory';
  name: string;
  entries: Map<string, FileEntry | DirectoryEntry>;
  ctime: number;
  mtime: number;
}

type Entry = FileEntry | DirectoryEntry;

export interface FileChangeEvent {
  type: 'created' | 'updated' | 'deleted';
  path: string;
}

/**
 * Complete in-memory file system for testing.
 *
 * Adapted from VS Code's InMemoryFileSystemProvider
 * (src/vs/platform/files/common/inMemoryFilesystemProvider.ts).
 *
 * Usage:
 *   const fs = new InMemoryFileSystem();
 *   fs.writeFile('/config/app.json', '{"port": 3000}');
 *   const content = fs.readFile('/config/app.json');
 */
export class InMemoryFileSystem {
  private root: DirectoryEntry = {
    type: 'directory',
    name: '',
    entries: new Map(),
    ctime: Date.now(),
    mtime: Date.now(),
  };

  private events = new EventEmitter();

  // ─── Read Operations ─────────────────────────────────────────

  readFile(path: string): string {
    const entry = this.lookupFile(path);
    return new TextDecoder().decode(entry.content);
  }

  readFileBytes(path: string): Uint8Array {
    return this.lookupFile(path).content;
  }

  readdir(path: string): string[] {
    const dir = this.lookupDirectory(path);
    return [...dir.entries.keys()];
  }

  stat(path: string): { type: 'file' | 'directory'; size: number; ctime: number; mtime: number } {
    const entry = this.lookup(path);
    return {
      type: entry.type,
      size: entry.type === 'file' ? entry.content.byteLength : entry.entries.size,
      ctime: entry.ctime,
      mtime: entry.mtime,
    };
  }

  exists(path: string): boolean {
    try {
      this.lookup(path);
      return true;
    } catch {
      return false;
    }
  }

  // ─── Write Operations ────────────────────────────────────────

  writeFile(path: string, content: string | Uint8Array): void {
    const data = typeof content === 'string' ? new TextEncoder().encode(content) : content;
    const parts = this.splitPath(path);
    const fileName = parts.pop()!;
    const parent = this.mkdirp(parts);

    const existing = parent.entries.get(fileName);
    const isNew = !existing || existing.type !== 'file';

    const file: FileEntry = {
      type: 'file',
      name: fileName,
      content: data,
      ctime: existing?.type === 'file' ? existing.ctime : Date.now(),
      mtime: Date.now(),
    };

    parent.entries.set(fileName, file);
    this.emit({ type: isNew ? 'created' : 'updated', path });
  }

  mkdir(path: string): void {
    this.mkdirp(this.splitPath(path));
  }

  delete(path: string): void {
    const parts = this.splitPath(path);
    const name = parts.pop()!;
    const parent = this.lookupDirectory('/' + parts.join('/'));

    if (!parent.entries.has(name)) {
      throw new Error(`ENOENT: ${path}`);
    }

    parent.entries.delete(name);
    parent.mtime = Date.now();
    this.emit({ type: 'deleted', path });
  }

  rename(from: string, to: string): void {
    const entry = this.lookup(from);
    this.delete(from);

    const toParts = this.splitPath(to);
    const toName = toParts.pop()!;
    const toParent = this.mkdirp(toParts);

    if (entry.type === 'file') {
      toParent.entries.set(toName, { ...entry, name: toName });
    } else {
      toParent.entries.set(toName, { ...entry, name: toName });
    }

    this.emit({ type: 'created', path: to });
  }

  // ─── Events ──────────────────────────────────────────────────

  onDidChange(listener: (event: FileChangeEvent) => void): () => void {
    this.events.on('change', listener);
    return () => this.events.off('change', listener);
  }

  // ─── Internals ───────────────────────────────────────────────

  private emit(event: FileChangeEvent): void {
    this.events.emit('change', event);
  }

  private splitPath(path: string): string[] {
    return path.split('/').filter(Boolean);
  }

  private lookup(path: string): Entry {
    const parts = this.splitPath(path);
    let current: Entry = this.root;

    for (const part of parts) {
      if (current.type !== 'directory') {
        throw new Error(`ENOTDIR: ${path}`);
      }
      const child = current.entries.get(part);
      if (!child) {
        throw new Error(`ENOENT: ${path}`);
      }
      current = child;
    }

    return current;
  }

  private lookupFile(path: string): FileEntry {
    const entry = this.lookup(path);
    if (entry.type !== 'file') {
      throw new Error(`EISDIR: ${path}`);
    }
    return entry;
  }

  private lookupDirectory(path: string): DirectoryEntry {
    if (path === '/' || path === '') return this.root;
    const entry = this.lookup(path);
    if (entry.type !== 'directory') {
      throw new Error(`ENOTDIR: ${path}`);
    }
    return entry;
  }

  private mkdirp(parts: string[]): DirectoryEntry {
    let current: DirectoryEntry = this.root;

    for (const part of parts) {
      let child = current.entries.get(part);
      if (!child) {
        child = {
          type: 'directory',
          name: part,
          entries: new Map(),
          ctime: Date.now(),
          mtime: Date.now(),
        };
        current.entries.set(part, child);
      } else if (child.type !== 'directory') {
        throw new Error(`ENOTDIR: /${parts.join('/')}`);
      }
      current = child;
    }

    return current;
  }
}
```

### How — Complete `InMemoryKeyValueStore`

```typescript
// src/common/test-utils/InMemoryKeyValueStore.ts

/**
 * In-memory key-value store for database mocking.
 *
 * Implements a common IKeyValueStore interface that your production
 * code depends on. In production, you'd use Redis/DynamoDB/etc.
 * In tests, you swap in this zero-dependency implementation.
 */
export interface IKeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
  keys(pattern?: string): Promise<string[]>;
  clear(): Promise<void>;
}

interface StoreEntry {
  value: string;
  expiresAt: number | null;
}

export class InMemoryKeyValueStore implements IKeyValueStore {
  private store = new Map<string, StoreEntry>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: string, ttlMs?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : null,
    });
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== null;
  }

  async keys(pattern?: string): Promise<string[]> {
    const allKeys = [...this.store.keys()];
    if (!pattern) return allKeys;

    // Simple glob matching (supports * wildcard)
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
    );
    return allKeys.filter((key) => regex.test(key));
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  /** Test helper: get the raw store size (including expired entries) */
  get size(): number {
    return this.store.size;
  }
}
```

### How — Complete `InMemoryEventBus`

```typescript
// src/common/test-utils/InMemoryEventBus.ts

/**
 * In-memory event bus for pub/sub mocking.
 *
 * Pattern: interface → real implementation → test implementation.
 * Production code uses IEventBus. In prod, this might be backed by
 * Redis Pub/Sub, RabbitMQ, or Kafka. In tests, it's this class.
 */
export interface IEventBus {
  publish(channel: string, message: unknown): Promise<void>;
  subscribe(channel: string, handler: (message: unknown) => void): () => void;
}

export class InMemoryEventBus implements IEventBus {
  private handlers = new Map<string, Set<(message: unknown) => void>>();
  private publishedMessages: Array<{ channel: string; message: unknown; timestamp: number }> = [];

  async publish(channel: string, message: unknown): Promise<void> {
    this.publishedMessages.push({
      channel,
      message,
      timestamp: Date.now(),
    });

    const channelHandlers = this.handlers.get(channel);
    if (channelHandlers) {
      for (const handler of channelHandlers) {
        handler(message);
      }
    }
  }

  subscribe(channel: string, handler: (message: unknown) => void): () => void {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
    }
    this.handlers.get(channel)!.add(handler);

    // Return unsubscribe function (this is the Disposable pattern)
    return () => {
      this.handlers.get(channel)?.delete(handler);
    };
  }

  // ─── Test Helpers ────────────────────────────────────────────

  /** Get all messages published to a specific channel */
  getMessages(channel: string): unknown[] {
    return this.publishedMessages
      .filter((m) => m.channel === channel)
      .map((m) => m.message);
  }

  /** Get ALL published messages across all channels */
  getAllMessages(): Array<{ channel: string; message: unknown }> {
    return [...this.publishedMessages];
  }

  /** Reset all handlers and published messages */
  reset(): void {
    this.handlers.clear();
    this.publishedMessages = [];
  }

  /** Check if a channel has any subscribers */
  hasSubscribers(channel: string): boolean {
    const handlers = this.handlers.get(channel);
    return handlers !== undefined && handlers.size > 0;
  }
}
```

### The Pattern: Interface → Real → Test

This is VS Code's core testing philosophy, codified:

```typescript
// 1. Define the interface (src/common/interfaces.ts)
export interface IFileSystem {
  readFile(path: string): string;
  writeFile(path: string, content: string): void;
  exists(path: string): boolean;
}

// 2. Real implementation (src/node/NodeFileSystem.ts)
export class NodeFileSystem implements IFileSystem {
  readFile(path: string): string {
    return fs.readFileSync(path, 'utf-8');
  }
  // ... real I/O
}

// 3. Test implementation (src/common/test-utils/InMemoryFileSystem.ts)
// The InMemoryFileSystem class from above implements IFileSystem

// 4. Production wiring
const fileSystem = new NodeFileSystem();
const service = new ConfigService(fileSystem);

// 5. Test wiring
const fileSystem = new InMemoryFileSystem();
fileSystem.writeFile('/config.json', '{"debug": true}');
const service = new ConfigService(fileSystem);
```

---

## 2.4 Dependency Injection for Tests

### Why

VS Code's `TestInstantiationService` (at `src/vs/platform/instantiation/test/common/instantiationServiceMock.ts`) extends their production `InstantiationService` with Sinon-powered mock/stub/spy capabilities. Tests compose a *minimal* DI container with only the services they need, replacing everything else with stubs.

This pattern ensures:
- Tests only create what they need (fast, minimal)
- Dependencies are explicit (no hidden global state)
- Mocking is type-safe (the DI container enforces service interfaces)

### How — Complete `TestContainer` Class

```typescript
// src/common/test-utils/TestContainer.ts

type Constructor<T> = new (...args: any[]) => T;
type ServiceFactory<T> = () => T;
type ServiceId<T> = symbol & { __serviceType?: T };

/**
 * Lightweight DI container for tests, inspired by VS Code's
 * TestInstantiationService.
 *
 * Usage:
 *   const container = new TestContainer();
 *   container.register(ILogger, new ConsoleLogger());
 *   container.register(IDatabase, new InMemoryKeyValueStore());
 *   const userService = container.create(UserService);
 */
export class TestContainer {
  private services = new Map<symbol, unknown>();
  private factories = new Map<symbol, ServiceFactory<unknown>>();

  /**
   * Register a service instance or factory.
   */
  register<T>(id: ServiceId<T>, instanceOrFactory: T | ServiceFactory<T>): this {
    if (typeof instanceOrFactory === 'function' && instanceOrFactory.length === 0) {
      // Treat zero-arg functions as factories (lazy instantiation)
      this.factories.set(id, instanceOrFactory as ServiceFactory<T>);
    } else {
      this.services.set(id, instanceOrFactory);
    }
    return this;
  }

  /**
   * Get a registered service. Throws if not found.
   */
  get<T>(id: ServiceId<T>): T {
    if (this.services.has(id)) {
      return this.services.get(id) as T;
    }
    if (this.factories.has(id)) {
      const instance = this.factories.get(id)!();
      this.services.set(id, instance); // Cache for subsequent calls
      return instance as T;
    }
    throw new Error(`Service not registered: ${id.toString()}`);
  }

  /**
   * Create a class instance, injecting registered services into the constructor.
   * Services are matched by parameter order to the `dependencies` array.
   */
  create<T>(ctor: Constructor<T>, ...dependencies: ServiceId<unknown>[]): T {
    const args = dependencies.map((dep) => this.get(dep));
    return new ctor(...args);
  }

  /**
   * Create a stub for a service — an object where every method is a no-op
   * that can be individually overridden.
   */
  stub<T extends object>(id: ServiceId<T>, overrides: Partial<T> = {}): T {
    const stub = new Proxy({} as T, {
      get(_target, prop) {
        if (prop in overrides) {
          return (overrides as any)[prop];
        }
        // Return a no-op function for any unspecified method
        return () => undefined;
      },
    });
    this.register(id, stub);
    return stub;
  }

  /**
   * Create a child container that inherits this container's registrations.
   * Child registrations shadow parent registrations.
   */
  createChild(): TestContainer {
    const child = new TestContainer();
    // Copy parent registrations
    for (const [id, service] of this.services) {
      child.services.set(id, service);
    }
    for (const [id, factory] of this.factories) {
      child.factories.set(id, factory);
    }
    return child;
  }

  /**
   * Dispose all services that have a dispose() method.
   */
  dispose(): void {
    for (const service of this.services.values()) {
      if (service && typeof (service as any).dispose === 'function') {
        (service as any).dispose();
      }
    }
    this.services.clear();
    this.factories.clear();
  }
}

/**
 * Helper to create a typed service identifier.
 */
export function createServiceId<T>(name: string): ServiceId<T> {
  return Symbol(name) as ServiceId<T>;
}
```

### How — Full Example: Testing a UserService

```typescript
// src/common/interfaces.ts
import { createServiceId } from './test-utils/TestContainer';

export interface IDatabase {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<boolean>;
}

export interface ILogger {
  info(message: string): void;
  error(message: string, error?: Error): void;
  warn(message: string): void;
}

export interface IEventBus {
  publish(channel: string, message: unknown): Promise<void>;
}

// Service identifiers
export const IDatabase = createServiceId<IDatabase>('IDatabase');
export const ILogger = createServiceId<ILogger>('ILogger');
export const IEventBus = createServiceId<IEventBus>('IEventBus');
```

```typescript
// src/services/UserService.ts
import type { IDatabase, ILogger, IEventBus } from '../common/interfaces';

export class UserService {
  constructor(
    private readonly db: IDatabase,
    private readonly logger: ILogger,
    private readonly events: IEventBus,
  ) {}

  async createUser(name: string, email: string): Promise<string> {
    if (!email.includes('@')) {
      throw new Error('Invalid email');
    }

    const id = `user_${Date.now()}`;
    await this.db.set(`user:${id}`, JSON.stringify({ id, name, email }));
    this.logger.info(`Created user ${id}`);
    await this.events.publish('user.created', { id, name, email });
    return id;
  }

  async getUser(id: string): Promise<{ id: string; name: string; email: string } | null> {
    const data = await this.db.get(`user:${id}`);
    return data ? JSON.parse(data) : null;
  }
}
```

```typescript
// src/services/UserService.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestContainer } from '../common/test-utils/TestContainer';
import { InMemoryKeyValueStore } from '../common/test-utils/InMemoryKeyValueStore';
import { InMemoryEventBus } from '../common/test-utils/InMemoryEventBus';
import { IDatabase, ILogger, IEventBus } from '../common/interfaces';
import { UserService } from './UserService';

describe('UserService', () => {
  let container: TestContainer;
  let db: InMemoryKeyValueStore;
  let eventBus: InMemoryEventBus;
  let userService: UserService;

  beforeEach(() => {
    container = new TestContainer();
    db = new InMemoryKeyValueStore();
    eventBus = new InMemoryEventBus();

    // Register real in-memory implementations for data dependencies
    container.register(IDatabase, db);
    container.register(IEventBus, eventBus);

    // Stub the logger — we don't care about log output in these tests
    container.stub(ILogger, {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    });

    // Create the service under test with all dependencies injected
    userService = container.create(UserService, IDatabase, ILogger, IEventBus);
  });

  it('should create a user and publish an event', async () => {
    const id = await userService.createUser('Alice', 'alice@example.com');

    // Verify user was stored
    const user = await userService.getUser(id);
    expect(user).toBeDefined();
    expect(user!.name).toBe('Alice');
    expect(user!.email).toBe('alice@example.com');

    // Verify event was published
    const events = eventBus.getMessages('user.created');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ name: 'Alice', email: 'alice@example.com' });
  });

  it('should reject invalid email', async () => {
    await expect(
      userService.createUser('Bob', 'not-an-email'),
    ).rejects.toThrow('Invalid email');
  });

  it('should return null for non-existent user', async () => {
    const user = await userService.getUser('user_nonexistent');
    expect(user).toBeNull();
  });
});
```

---

## 2.5 Resource Leak Detection

### Why

VS Code's `ensureNoDisposablesAreLeakedInTestSuite()` (at `src/vs/base/test/common/utils.ts`) is one of their most important testing innovations. It automatically detects when tests create disposable resources (event listeners, file handles, timers) and forget to clean them up.

The implementation uses a `DisposableTracker` class (at `src/vs/base/common/lifecycle.ts`) that records the creation stack trace of every disposable object and tracks parent-child relationships. After each test, it computes which disposables are "leaking" — i.e., were created but never disposed and are not children of a disposed parent.

They even have an ESLint rule (`.eslint-plugin-local/code-ensure-no-disposables-leak-in-test.ts`) that *automatically adds* the leak detection call to test suites that are missing it.

### How — Complete Implementation

```typescript
// src/common/lifecycle.ts — The Disposable system

/**
 * An object that performs cleanup when .dispose() is called.
 * This is the same pattern used throughout VS Code.
 */
export interface IDisposable {
  dispose(): void;
}

/**
 * Tracks all disposables created during a test to detect leaks.
 *
 * Adapted from VS Code's DisposableTracker
 * (src/vs/base/common/lifecycle.ts, lines 85-226).
 */
export class DisposableTracker {
  private livingDisposables = new Map<
    IDisposable,
    { source: string | null; parent: IDisposable | null; isSingleton: boolean }
  >();

  trackDisposable(d: IDisposable): void {
    if (!this.livingDisposables.has(d)) {
      this.livingDisposables.set(d, {
        source: new Error().stack ?? null,
        parent: null,
        isSingleton: false,
      });
    }
  }

  setParent(child: IDisposable, parent: IDisposable | null): void {
    const data = this.livingDisposables.get(child);
    if (data) {
      data.parent = parent;
    }
  }

  markAsDisposed(d: IDisposable): void {
    this.livingDisposables.delete(d);
  }

  markAsSingleton(d: IDisposable): void {
    const data = this.livingDisposables.get(d);
    if (data) {
      data.isSingleton = true;
    }
  }

  computeLeakingDisposables(): { count: number; details: string } | undefined {
    // Find root parents for each disposable
    const getRootParent = (d: IDisposable): IDisposable => {
      const data = this.livingDisposables.get(d);
      if (data?.parent) {
        return getRootParent(data.parent);
      }
      return d;
    };

    const leaking = [...this.livingDisposables.entries()].filter(([d, info]) => {
      if (info.source === null) return false;
      if (info.isSingleton) return false;
      // Check if root parent is singleton
      const root = getRootParent(d);
      const rootInfo = this.livingDisposables.get(root);
      return !rootInfo?.isSingleton;
    });

    if (leaking.length === 0) {
      return undefined;
    }

    const details = leaking
      .slice(0, 10)
      .map(([d, info], i) => {
        const name = d.constructor?.name ?? 'Anonymous';
        const stack = info.source
          ?.split('\n')
          .slice(2, 6)
          .map((l) => l.trim())
          .join('\n    ');
        return `  ${i + 1}. ${name}\n    ${stack}`;
      })
      .join('\n\n');

    return {
      count: leaking.length,
      details: `Leaked ${leaking.length} disposable(s):\n\n${details}${
        leaking.length > 10 ? `\n\n  ... and ${leaking.length - 10} more` : ''
      }`,
    };
  }
}

// ─── Global tracker (set during tests) ─────────────────────────

let activeTracker: DisposableTracker | null = null;

export function setDisposableTracker(tracker: DisposableTracker | null): void {
  activeTracker = tracker;
}

export function trackDisposable(d: IDisposable): void {
  activeTracker?.trackDisposable(d);
}

export function markAsDisposed(d: IDisposable): void {
  activeTracker?.markAsDisposed(d);
}

export function markAsSingleton(d: IDisposable): void {
  activeTracker?.markAsSingleton(d);
}

// ─── Base Disposable class ─────────────────────────────────────

export abstract class Disposable implements IDisposable {
  static readonly None: IDisposable = Object.freeze({ dispose() {} });

  private _isDisposed = false;
  private _disposables = new Set<IDisposable>();

  constructor() {
    trackDisposable(this);
  }

  dispose(): void {
    if (this._isDisposed) return;
    this._isDisposed = true;
    markAsDisposed(this);
    for (const d of this._disposables) {
      d.dispose();
    }
    this._disposables.clear();
  }

  protected _register<T extends IDisposable>(disposable: T): T {
    this._disposables.add(disposable);
    return disposable;
  }
}

/**
 * A store for collecting disposables, like VS Code's DisposableStore.
 */
export class DisposableStore implements IDisposable {
  private _toDispose = new Set<IDisposable>();
  private _isDisposed = false;

  constructor() {
    trackDisposable(this);
  }

  add<T extends IDisposable>(o: T): T {
    if (this._isDisposed) {
      console.warn('Adding to a disposed DisposableStore!');
      return o;
    }
    this._toDispose.add(o);
    return o;
  }

  dispose(): void {
    if (this._isDisposed) return;
    this._isDisposed = true;
    markAsDisposed(this);
    for (const d of this._toDispose) {
      d.dispose();
    }
    this._toDispose.clear();
  }
}
```

### How — `ensureNoDisposablesAreLeakedInTestSuite` for Vitest

```typescript
// src/common/test-utils/leakDetection.ts
import { afterEach, beforeEach } from 'vitest';
import {
  DisposableStore,
  DisposableTracker,
  setDisposableTracker,
  type IDisposable,
} from '../lifecycle';

/**
 * Call this at the top level of any describe() block to enable
 * automatic disposable leak detection.
 *
 * Adapted from VS Code's ensureNoDisposablesAreLeakedInTestSuite()
 * (src/vs/base/test/common/utils.ts).
 *
 * Usage:
 *   describe('MyService', () => {
 *     const ds = ensureNoDisposablesAreLeakedInTestSuite();
 *
 *     it('should work', () => {
 *       // Use ds.add() to register disposables that will be auto-cleaned
 *       const emitter = ds.add(new EventEmitter());
 *     });
 *   });
 */
export function ensureNoDisposablesAreLeakedInTestSuite(): Pick<DisposableStore, 'add'> {
  let tracker: DisposableTracker;
  let store: DisposableStore;

  beforeEach(() => {
    store = new DisposableStore();
    tracker = new DisposableTracker();
    setDisposableTracker(tracker);
  });

  afterEach((context) => {
    store.dispose();
    setDisposableTracker(null);

    // Only check for leaks if the test passed.
    // A failing test might have leaked due to the error itself.
    if (context.task.result?.state !== 'fail') {
      const result = tracker.computeLeakingDisposables();
      if (result) {
        throw new Error(
          `There are ${result.count} undisposed disposable(s)!\n${result.details}`,
        );
      }
    }
  });

  // Return a proxy that forwards add() to the current store.
  // This is necessary because the store is recreated before each test.
  return {
    add<T extends IDisposable>(o: T): T {
      return store.add(o);
    },
  };
}
```

### How — ESLint Rule to Enforce Leak Detection

```typescript
// eslint-rules/ensure-disposable-leak-detection.ts
//
// This is a simplified version of VS Code's
// .eslint-plugin-local/code-ensure-no-disposables-leak-in-test.ts
//
// It warns when a test file's describe/suite block doesn't call
// ensureNoDisposablesAreLeakedInTestSuite().

import type { Rule } from 'eslint';

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Ensure test suites include disposable leak detection',
    },
    messages: {
      missingLeakDetection:
        'Test suite is missing ensureNoDisposablesAreLeakedInTestSuite(). Add it to detect resource leaks.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        // Look for describe() or suite() calls
        if (
          node.callee.type === 'Identifier' &&
          (node.callee.name === 'describe' || node.callee.name === 'suite')
        ) {
          const callback = node.arguments[1];
          if (!callback || (callback.type !== 'ArrowFunctionExpression' && callback.type !== 'FunctionExpression')) {
            return;
          }

          const body = callback.body;
          if (body.type !== 'BlockStatement') return;

          // Check if ensureNoDisposablesAreLeakedInTestSuite is called
          const hasLeakDetection = body.body.some((stmt) => {
            if (stmt.type !== 'VariableDeclaration') return false;
            return stmt.declarations.some((decl) => {
              if (decl.init?.type !== 'CallExpression') return false;
              const callee = decl.init.callee;
              return (
                callee.type === 'Identifier' &&
                callee.name === 'ensureNoDisposablesAreLeakedInTestSuite'
              );
            });
          });

          if (!hasLeakDetection) {
            context.report({
              node,
              messageId: 'missingLeakDetection',
            });
          }
        }
      },
    };
  },
};

export default rule;
```

---

## 2.6 Console Output Guards

### Why

VS Code fails tests that produce unexpected console output. From `test/unit/electron/renderer.js` (lines 224-233):

```javascript
for (const consoleFn of [console.log, console.error, console.info, console.warn, console.trace, console.debug]) {
  console[consoleFn.name] = function (msg) {
    if (!currentTest) {
      consoleFn.apply(console, arguments);
    } else if (
      !_allowedTestOutput.some(a => a.test(msg)) &&
      !_allowedTestsWithOutput.has(currentTest.title)
    ) {
      _testsWithUnexpectedOutput = true;
      consoleFn.apply(console, arguments);
    }
  };
}
```

After each test, if `_testsWithUnexpectedOutput` is true, the test fails:
```javascript
if (_testsWithUnexpectedOutput && !opts.dev) {
  assert.ok(false, 'Error: Unexpected console output in test run.');
}
```

They maintain two allowlists:
- `_allowedTestOutput` — regex patterns for expected messages (e.g., deprecation warnings)
- `_allowedTestsWithOutput` — specific test titles that are known to produce output

### How — Complete Implementation for Vitest

```typescript
// src/common/test-utils/consoleGuard.ts
import { afterEach, beforeEach } from 'vitest';

interface ConsoleCapture {
  method: string;
  args: unknown[];
  stack: string;
}

interface ConsoleGuardOptions {
  /** Regex patterns for output that is always allowed */
  allowedPatterns?: RegExp[];
  /** Specific test names that are known to produce console output */
  allowedTests?: Set<string>;
  /** Which console methods to guard. Default: all */
  methods?: Array<'log' | 'error' | 'warn' | 'info' | 'debug' | 'trace'>;
}

/**
 * Installs console output guards that fail tests producing unexpected output.
 *
 * Adapted from VS Code's test/unit/electron/renderer.js.
 *
 * Usage:
 *   describe('MyFeature', () => {
 *     installConsoleGuard({
 *       allowedPatterns: [/ExperimentalWarning/],
 *       allowedTests: new Set(['test that legitimately logs']),
 *     });
 *
 *     it('should not log', () => {
 *       console.log('oops'); // This will FAIL the test
 *     });
 *   });
 */
export function installConsoleGuard(options: ConsoleGuardOptions = {}): {
  getCaptured(): ConsoleCapture[];
} {
  const {
    allowedPatterns = [],
    allowedTests = new Set<string>(),
    methods = ['log', 'error', 'warn', 'info', 'debug', 'trace'],
  } = options;

  const originals = new Map<string, (...args: unknown[]) => void>();
  const captured: ConsoleCapture[] = [];
  let currentTestName = '';

  beforeEach((context) => {
    currentTestName = context.task.name;
    captured.length = 0;

    // Patch each console method
    for (const method of methods) {
      const original = console[method].bind(console);
      originals.set(method, original);

      console[method] = (...args: unknown[]) => {
        const message = args.map(String).join(' ');

        // Check allowlists
        if (allowedTests.has(currentTestName)) {
          original(...args);
          return;
        }
        if (allowedPatterns.some((pattern) => pattern.test(message))) {
          original(...args);
          return;
        }

        // Capture unexpected output
        captured.push({
          method,
          args,
          stack: new Error().stack ?? '',
        });

        // Still call original so the output is visible in test logs
        original(...args);
      };
    }
  });

  afterEach(() => {
    // Restore original console methods
    for (const [method, original] of originals) {
      (console as any)[method] = original;
    }
    originals.clear();

    // Fail if there was unexpected output
    if (captured.length > 0) {
      const summary = captured
        .map((c) => `  console.${c.method}(${c.args.map(String).join(', ')})`)
        .join('\n');

      throw new Error(
        `Test "${currentTestName}" produced ${captured.length} unexpected console output(s):\n${summary}\n\n` +
          `If this output is expected, add the test name to allowedTests or add a pattern to allowedPatterns.`,
      );
    }
  });

  return {
    getCaptured: () => [...captured],
  };
}
```

---

## 2.7 Test Speed Optimizations

### Why

VS Code's test suite runs thousands of tests. Every millisecond counts when multiplied by test count. Their most impactful optimization is the **`postMessage` hack** — replacing `setTimeout(0)` with `postMessage()` to avoid the browser's built-in 4ms minimum delay.

### The `postMessage` Hack — Complete Implementation

From `test/unit/electron/renderer.js` in the VS Code repo:

```javascript
const $globalThis = globalThis;
const setTimeout0IsFaster = (
  typeof $globalThis.postMessage === 'function' && !$globalThis.importScripts
);

/**
 * See https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html
 *
 * Works similarly to setTimeout(0) but doesn't suffer from the 4ms
 * artificial delay that browsers set when the nesting level is > 5.
 */
const setTimeout0 = (() => {
  if (setTimeout0IsFaster) {
    const pending = [];

    $globalThis.addEventListener('message', (e) => {
      if (e.data && e.data.vscodeScheduleAsyncWork) {
        for (let i = 0, len = pending.length; i < len; i++) {
          const candidate = pending[i];
          if (candidate.id === e.data.vscodeScheduleAsyncWork) {
            pending.splice(i, 1);
            candidate.callback();
            return;
          }
        }
      }
    });

    let lastId = 0;
    return (callback) => {
      const myId = ++lastId;
      pending.push({ id: myId, callback });
      $globalThis.postMessage({ vscodeScheduleAsyncWork: myId }, '*');
    };
  }
  return (callback) => setTimeout(callback);
})();
```

Then, critically, VS Code patches Mocha's internal scheduler:

```javascript
// @ts-expect-error
Mocha.Runner.immediately = setTimeout0;
```

### Why `setTimeout(0)` Is Slow in Browsers

The HTML spec (§8.6, "Timers") mandates that when the "timer nesting level" exceeds 5, `setTimeout` must enforce a minimum 4ms delay. This is an old optimization to prevent busy-wait loops from consuming CPU.

In a test suite, Mocha's internal scheduling rapidly nests timers. After just 5-6 levels of nesting:
- `setTimeout(fn, 0)` → actually `setTimeout(fn, 4)`
- Over 1000 test transitions = **4 extra seconds** of pure wait time

`postMessage()` does not have this restriction. It fires on the next microtask/message cycle (~0.1ms), making it 40x faster than nested `setTimeout(0)`.

### How — Vitest Equivalent

Vitest runs in Node.js (not a browser), so the `setTimeout(0)` browser limitation doesn't apply. However, if you run browser-mode tests (via `@vitest/browser`), you can apply this optimization:

```typescript
// test/browser-setup.ts — Only needed for browser-mode Vitest
if (typeof globalThis.postMessage === 'function') {
  const pending: Array<{ id: number; callback: () => void }> = [];
  let lastId = 0;

  globalThis.addEventListener('message', (e: MessageEvent) => {
    if (e.data?.vitestScheduleWork) {
      const idx = pending.findIndex((p) => p.id === e.data.vitestScheduleWork);
      if (idx >= 0) {
        const [item] = pending.splice(idx, 1);
        item.callback();
      }
    }
  });

  // Replace globalThis.setTimeout for zero-delay calls
  const origSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = ((callback: () => void, delay?: number, ...args: unknown[]) => {
    if (delay === 0 || delay === undefined) {
      const myId = ++lastId;
      pending.push({ id: myId, callback });
      globalThis.postMessage({ vitestScheduleWork: myId }, '*');
      return myId as unknown as ReturnType<typeof setTimeout>;
    }
    return origSetTimeout(callback, delay, ...args);
  }) as typeof setTimeout;
}
```

### Module Pre-Loading Strategy

VS Code pre-loads all test modules before running any tests. In `test/unit/electron/renderer.js`, the `loadModules()` function imports every test file first, then runs Mocha. This avoids the overhead of dynamic imports between tests.

For Vitest, this is the default behavior — Vitest transforms and loads all test files before execution. To optimize further:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    // Pre-transform dependencies to avoid on-demand compilation during tests
    deps: {
      optimizer: {
        ssr: {
          include: [
            // List heavy dependencies that are used in many test files
            'lodash',
            'date-fns',
          ],
        },
      },
    },
    // Warm up test files that are slow to transform
    warmupFiles: {
      ssr: ['src/common/**/*.ts'],
    },
  },
});
```

### How to Profile Test Suite Performance

```bash
# Vitest has built-in profiling
npx vitest run --reporter=verbose 2>&1 | sort -t'(' -k2 -rn | head -20

# Or use the JSON reporter for programmatic analysis:
npx vitest run --reporter=json --outputFile=test-perf.json

# Then analyze:
node -e "
  const r = require('./test-perf.json');
  const tests = r.testResults.flatMap(f =>
    f.assertionResults.map(t => ({
      name: t.fullName,
      duration: t.duration,
    }))
  );
  tests.sort((a, b) => b.duration - a.duration);
  tests.slice(0, 20).forEach(t =>
    console.log(\`\${t.duration}ms - \${t.name}\`)
  );
"
```

---

## 2.8 CI Test Pipeline

### How — Complete `.github/workflows/test.yml`

```yaml
name: Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: tests-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read
  checks: write  # For test result reporting

env:
  NODE_VERSION: '20'

jobs:
  # ─── Unit Tests: 3 OS × 2 shards ────────────────────────────────
  unit-tests:
    name: Unit Tests (${{ matrix.os }}, shard ${{ matrix.shard }}/${{ matrix.total-shards }})
    runs-on: ${{ matrix.os }}
    timeout-minutes: 20

    strategy:
      fail-fast: false  # Run all matrix jobs even if one fails
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        shard: [1, 2]
        total-shards: [2]

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Cache node_modules
        uses: actions/cache@v4
        id: cache-deps
        with:
          path: node_modules
          key: deps-${{ runner.os }}-node${{ env.NODE_VERSION }}-${{ hashFiles('package-lock.json') }}
          restore-keys: |
            deps-${{ runner.os }}-node${{ env.NODE_VERSION }}-

      - name: Install dependencies
        if: steps.cache-deps.outputs.cache-hit != 'true'
        shell: bash
        run: |
          for i in 1 2 3; do
            npm ci --ignore-scripts && break
            echo "Attempt $i failed, retrying in 10s..."
            sleep 10
          done

      - name: Post-install rebuild
        if: steps.cache-deps.outputs.cache-hit == 'true'
        run: npm rebuild

      - name: Run unit tests (shard ${{ matrix.shard }}/${{ matrix.total-shards }})
        timeout-minutes: 15
        run: >
          npx vitest run
          --config vitest.config.unit.ts
          --shard ${{ matrix.shard }}/${{ matrix.total-shards }}
          --reporter=default
          --reporter=junit
          --outputFile.junit=test-results/junit-unit-${{ matrix.os }}-${{ matrix.shard }}.xml

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results-unit-${{ matrix.os }}-shard${{ matrix.shard }}
          path: test-results/
          retention-days: 7

  # ─── Integration Tests (single OS, no sharding) ─────────────────
  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    timeout-minutes: 30
    needs: unit-tests  # Only run if unit tests pass

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Cache node_modules
        uses: actions/cache@v4
        id: cache-deps
        with:
          path: node_modules
          key: deps-${{ runner.os }}-node${{ env.NODE_VERSION }}-${{ hashFiles('package-lock.json') }}

      - name: Install dependencies
        if: steps.cache-deps.outputs.cache-hit != 'true'
        shell: bash
        run: |
          for i in 1 2 3; do
            npm ci --ignore-scripts && break
            echo "Attempt $i failed, retrying in 10s..."
            sleep 10
          done

      - name: Post-install rebuild
        if: steps.cache-deps.outputs.cache-hit == 'true'
        run: npm rebuild

      - name: Run integration tests
        timeout-minutes: 20
        run: >
          npx vitest run
          --config vitest.config.integration.ts
          --reporter=default
          --reporter=junit
          --outputFile.junit=test-results/junit-integration.xml

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results-integration
          path: test-results/
          retention-days: 7

  # ─── E2E Tests (only on main branch, expensive) ─────────────────
  e2e-tests:
    name: E2E Tests (${{ matrix.browser }})
    runs-on: ubuntu-latest
    timeout-minutes: 45
    needs: integration-tests
    if: github.ref == 'refs/heads/main' || contains(github.event.pull_request.labels.*.name, 'run-e2e')

    strategy:
      fail-fast: false
      matrix:
        browser: [chromium, firefox]

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Cache node_modules
        uses: actions/cache@v4
        id: cache-deps
        with:
          path: node_modules
          key: deps-${{ runner.os }}-node${{ env.NODE_VERSION }}-${{ hashFiles('package-lock.json') }}

      - name: Install dependencies
        if: steps.cache-deps.outputs.cache-hit != 'true'
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps ${{ matrix.browser }}

      - name: Run E2E tests
        timeout-minutes: 30
        run: >
          npx vitest run
          --config vitest.config.e2e.ts
          --reporter=default
          --reporter=junit
          --outputFile.junit=test-results/junit-e2e-${{ matrix.browser }}.xml
        env:
          BROWSER: ${{ matrix.browser }}

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-results-e2e-${{ matrix.browser }}
          path: test-results/
          retention-days: 7

      - name: Upload Playwright traces (on failure)
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-traces-${{ matrix.browser }}
          path: test-results/traces/
          retention-days: 7

  # ─── Aggregate test results ─────────────────────────────────────
  test-report:
    name: Test Report
    runs-on: ubuntu-latest
    if: always()
    needs: [unit-tests, integration-tests]

    steps:
      - name: Download all test results
        uses: actions/download-artifact@v4
        with:
          pattern: test-results-*
          path: all-test-results
          merge-multiple: true

      - name: Publish test results
        uses: dorny/test-reporter@v1
        if: always()
        with:
          name: Test Results
          path: 'all-test-results/**/*.xml'
          reporter: java-junit
          fail-on-error: true
```

### Design Decisions Explained

| Decision | Why |
|----------|-----|
| **`fail-fast: false`** | When shard 1 fails, shard 2 still runs. This gives complete failure information instead of partial. VS Code's matrix jobs also run independently. |
| **3 OS × 2 shards = 6 parallel jobs** | Balances coverage with cost. Windows tests often catch path separator issues. macOS tests catch case sensitivity differences. |
| **Integration tests `needs: unit-tests`** | Fast feedback first. If unit tests fail, don't waste 30 minutes on integration tests. |
| **E2E tests only on `main` or with label** | E2E tests are expensive (45 min timeout). Only run on merge or when explicitly requested via a PR label. |
| **Per-test-type timeouts** | Unit: 15 min. Integration: 20 min. E2E: 30 min. These are the *step* timeouts, not the job timeouts. Catching hung tests faster. |
| **`always()` for artifact upload** | Upload test results even when tests fail — that's when you need them most. |
| **Separate test-report job** | Aggregates all JUnit XML files into a single GitHub check with pass/fail details visible directly in the PR. |

---

## Appendix: Package Installation Summary

Run this to install all development dependencies referenced in this playbook:

```bash
npm install --save-dev \
  eslint \
  @eslint/js \
  typescript-eslint \
  eslint-plugin-import \
  eslint-plugin-header \
  prettier \
  eslint-config-prettier \
  husky \
  lint-staged \
  concurrently \
  tsx \
  glob \
  vitest \
  @vitest/coverage-v8 \
  tsec
```

```bash
# Initialize husky
npx husky init

# Initialize git hooks
echo "npx lint-staged" > .husky/pre-commit
```

---

## Quick Reference: VS Code Source Files Referenced

| VS Code File Path | What It Contains | Section |
|---|---|---|
| `/eslint.config.js` | Flat config with 30+ custom rules | §1.1 |
| `/build/eslint.ts` | Zero-tolerance enforcement (warnings = errors) | §1.1 |
| `/build/gulp-eslint.ts` | Custom Gulp plugin wrapping ESLint | §1.1 |
| `/.eslint-plugin-local/index.ts` | Custom rules: layering, import patterns, disposables | §1.1 |
| `/src/tsconfig.base.json` | Shared strict TS config (ES2024, nodenext) | §1.2 |
| `/src/tsconfig.json` | Main app config with tsec plugin | §1.2 |
| `/src/tsconfig.tsec.json` | Dedicated security scanning config | §1.2 |
| `/build/tsconfig.json` | Build tools config (verbatimModuleSyntax) | §1.2 |
| `/extensions/tsconfig.base.json` | Extension base (commonjs module) | §1.2 |
| `/src/tsec.exemptions.json` | Security rule exemptions per-file | §1.2 |
| `/tsfmt.json` | TypeScript formatter settings | §1.3 |
| `/build/lib/formatter.ts` | TS Language Service formatter integration | §1.3 |
| `/.editorconfig` | Tab indentation, trailing whitespace | §1.3 |
| `/.vscode/settings.json` | Format-on-save, readonly patterns | §1.3 |
| `/.vscode/extensions.json` | Recommended extensions | §1.1, §1.3 |
| `/build/hygiene.ts` | Copyright, unicode, indentation, format checks | §1.4 |
| `/build/filters.ts` | File filtering for hygiene checks | §1.4 |
| `/.gitattributes` | Line ending normalization, linguist config | §1.7 |
| `/.gitignore` | Build outputs, test results, local overrides | §1.7 |
| `/test/unit/electron/renderer.js` | Electron test harness, console guard, postMessage hack | §2.1, §2.6, §2.7 |
| `/test/unit/node/index.js` | Node.js test harness | §2.1 |
| `/test/unit/browser/index.js` | Browser test harness (Playwright) | §2.1 |
| `/src/vs/base/common/lifecycle.ts` | DisposableTracker, Disposable, DisposableStore | §2.5 |
| `/src/vs/base/test/common/utils.ts` | ensureNoDisposablesAreLeakedInTestSuite() | §2.5 |
| `/src/vs/platform/files/common/inMemoryFilesystemProvider.ts` | InMemoryFileSystemProvider | §2.3 |
| `/src/vs/platform/instantiation/test/common/instantiationServiceMock.ts` | TestInstantiationService | §2.4 |
| `/src/vs/workbench/test/browser/workbenchTestServices.ts` | Hundreds of mock workbench services | §2.3 |

---

*This playbook covers Phases 1–2. Phase 3 (Architecture Patterns), Phase 4 (Build System), and Phase 5 (Release Engineering) are covered in subsequent documents.*
