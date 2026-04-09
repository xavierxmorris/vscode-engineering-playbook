# VS Code Engineering Playbook

> Lessons extracted from [microsoft/vscode](https://github.com/microsoft/vscode) — how one of the world's largest TypeScript codebases achieves fast tests, strict linting, deterministic formatting, tight CI feedback, and small verifiable changes.

## 📚 Contents

| Document | Size | Description |
|----------|------|-------------|
| [**ANALYSIS.md**](ANALYSIS.md) | 19KB | Deep technical analysis — code snippets, file paths, architecture details |
| [**PLAYBOOK.md**](PLAYBOOK.md) | 18KB | Quick-reference adoption playbook (overview of all 4 phases) |
| [**PLAYBOOK-PHASE-1-2.md**](PLAYBOOK-PHASE-1-2.md) | 105KB | **Deep dive**: Foundations + Test Infrastructure — complete configs, full code, gotchas |
| [**PLAYBOOK-PHASE-3-4.md**](PLAYBOOK-PHASE-3-4.md) | 117KB | **Deep dive**: Architecture Enforcement + Advanced Patterns — DI framework, custom ESLint rules, CI templates |
| [**examples/**](examples/) | — | Ready-to-copy config files and templates |

## 🎯 Five Engineering Dimensions

1. **🧪 Faster Tests** — `postMessage` scheduler hack, test sharding, parallel CI matrix, in-memory mocks
2. **🔍 Stricter Linters** — Custom ESLint rules for architecture enforcement, warnings-as-errors, multi-surface tsconfigs
3. **📐 Deterministic Formatting** — TS language service formatter (not Prettier), byte-for-byte CI verification
4. **🔄 Better CI Feedback** — Reusable workflow templates, aggressive caching, visual regression comments, human-in-the-loop API gates
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

- **6 parallel AI agents** (Claude Opus 4.6 + GPT-5.4) performed deep repository exploration
- **300+ GitHub API calls** examining CI configs, custom lint rules, test harnesses, build scripts, and architecture docs
- **50+ VS Code source files** directly referenced with exact file paths and code excerpts
- Every finding is traced to a specific file in the VS Code repository

## 📦 Total Content

~260KB of production-ready engineering documentation across 4 documents, with complete copy-paste-able configs, custom ESLint rules, DI framework implementation, CI workflow templates, and a migration guide for existing codebases.

## License

MIT — Use these patterns freely in your projects.
