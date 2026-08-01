# VS Code Engineering Playbook

> Lessons extracted from [microsoft/vscode](https://github.com/microsoft/vscode) — how one of the world's largest TypeScript codebases achieves fast tests, strict linting, deterministic formatting, tight CI feedback, and small verifiable changes.

> [!IMPORTANT]
> **Re-validated 2026-08-01** against [`7234ef0`](https://github.com/microsoft/vscode/commit/7234ef01c2cace7cfa911d792ce9c5b1f333fca5). Every factual claim was checked against a local clone of microsoft/vscode. Stale and incorrect claims have been corrected, and sample code that did not compile has been fixed. See **[VALIDATION.md](VALIDATION.md)** for the full audit trail.
>
> **Every VS Code code excerpt is permalinked to the pinned commit.** Look for the 🔗 citation line above each code block, or browse **[SOURCES.md](SOURCES.md)** for the complete index of all 75 cited files. Links include line numbers and cannot drift.

## 📚 Contents

| Document | Description |
|----------|-------------|
| [**SOURCES.md**](SOURCES.md) | **Source index** — all 75 cited `microsoft/vscode` files, pinned and permalinked |
| [**VALIDATION.md**](VALIDATION.md) | **Audit trail** — every claim checked against microsoft/vscode `7234ef0`, with verdicts and corrections |
| [**ANALYSIS.md**](ANALYSIS.md) | Deep technical analysis — code snippets, file paths, architecture details |
| [**PLAYBOOK.md**](PLAYBOOK.md) | Quick-reference adoption playbook (overview of all 4 phases) |
| [**PLAYBOOK-PHASE-1-2.md**](PLAYBOOK-PHASE-1-2.md) | **Deep dive**: Foundations + Test Infrastructure — complete configs, full code, gotchas |
| [**PLAYBOOK-PHASE-3-4.md**](PLAYBOOK-PHASE-3-4.md) | **Deep dive**: Architecture Enforcement + Advanced Patterns — DI framework, custom ESLint rules, CI templates |
| [**examples/**](examples/) | Ready-to-copy config files and templates |

## 🎯 Five Engineering Dimensions

1. **🧪 Faster Tests** — `postMessage` scheduler hack, in-memory mocks, parallel CI matrix (18 jobs), leak detection
2. **🔍 Stricter Linters** — 48 custom ESLint rules for architecture enforcement, warnings-as-errors, multi-surface tsconfigs
3. **📐 Deterministic Formatting** — TS language service formatter (not Prettier), line-ending-normalised CI verification
4. **🔄 Better CI Feedback** — Reusable workflow templates, aggressive caching, visual regression comments, cyclic-dependency gates
5. **📦 Smaller Units of Work** — Layered architecture, service DI, contribution pattern, environment-based code routing

## ⚡ Quick Start

Pick your phase based on project maturity:

| Phase | For | Guide |
|-------|-----|-------|
| **Phase 1: Foundations** | New/small projects | [Quick ref](PLAYBOOK.md#phase-1-foundations-week-1) · [Deep dive](PLAYBOOK-PHASE-1-2.md#phase-1-foundations) |
| **Phase 2: Test Infrastructure** | Growing projects | [Quick ref](PLAYBOOK.md#phase-2-test-infrastructure-weeks-2-3) · [Deep dive](PLAYBOOK-PHASE-1-2.md#phase-2-test-infrastructure) |
| **Phase 3: Architecture** | Large codebases | [Quick ref](PLAYBOOK.md#phase-3-architectural-enforcement-weeks-4-6) · [Deep dive](PLAYBOOK-PHASE-3-4.md) |
| **Phase 4: Advanced** | At-scale engineering | [Quick ref](PLAYBOOK.md#phase-4-advanced-patterns-ongoing) · [Deep dive](PLAYBOOK-PHASE-3-4.md) |

## 📊 Analysis Methodology

**Original pass (2026-04-09)**
- **6 parallel AI agents** (Claude Opus 4.6 + GPT-5.4) performed deep repository exploration
- **300+ GitHub API calls** examining CI configs, custom lint rules, test harnesses, build scripts, and architecture docs
- **50+ VS Code source files** directly referenced with exact file paths and code excerpts

**Validation pass (2026-08-01)**
- Re-checked against a **local clone** of microsoft/vscode at [`7234ef0`](https://github.com/microsoft/vscode/commit/7234ef01c2cace7cfa911d792ce9c5b1f333fca5) — ground truth, not API snapshots
- **Claude Opus 5** and **GPT-5.6 Sol**, both at max reasoning effort, audited the corpus in parallel
- Every claim classified `CONFIRMED` / `IMPRECISE` / `STALE` / `WRONG`; sample code compiled and linted with real toolchains
- All corrections and their evidence are recorded in [VALIDATION.md](VALIDATION.md)

## 📦 Total Content

~260KB of production-ready engineering documentation across 4 documents, with complete copy-paste-able configs, custom ESLint rules, DI framework implementation, CI workflow templates, and a migration guide for existing codebases.

## License

MIT — Use these patterns freely in your projects.
