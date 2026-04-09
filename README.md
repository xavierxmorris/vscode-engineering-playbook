# VS Code Engineering Playbook

> Lessons extracted from [microsoft/vscode](https://github.com/microsoft/vscode) — how one of the world's largest TypeScript codebases achieves fast tests, strict linting, deterministic formatting, tight CI feedback, and small verifiable changes.

## 📚 Contents

| Document | Description |
|----------|-------------|
| [**ANALYSIS.md**](ANALYSIS.md) | Deep technical analysis of VS Code's engineering practices (19KB, code snippets, file paths) |
| [**PLAYBOOK.md**](PLAYBOOK.md) | Adoption playbook — phased guide to implementing these practices in your own project |
| [**examples/**](examples/) | Ready-to-copy config files and templates |

## 🎯 Five Engineering Dimensions

1. **🧪 Faster Tests** — `postMessage` scheduler hack, test sharding, parallel CI matrix, in-memory mocks
2. **🔍 Stricter Linters** — Custom ESLint rules for architecture enforcement, warnings-as-errors, multi-surface tsconfigs
3. **📐 Deterministic Formatting** — TS language service formatter (not Prettier), byte-for-byte CI verification
4. **🔄 Better CI Feedback** — Reusable workflow templates, aggressive caching, visual regression comments, human-in-the-loop API gates
5. **📦 Smaller Units of Work** — Layered architecture, service DI, contribution pattern, environment-based code routing

## ⚡ Quick Start

Pick your phase based on project maturity:

- **New/small project** → Start with [Phase 1](PLAYBOOK.md#phase-1-foundations-week-1) (ESLint strict mode, editorconfig, CI caching)
- **Growing project** → Add [Phase 2](PLAYBOOK.md#phase-2-test-infrastructure-weeks-2-3) (test separation, sharding, custom lint rules)
- **Large codebase** → Implement [Phase 3](PLAYBOOK.md#phase-3-architectural-enforcement-weeks-4-6) (layered architecture, DI, contribution patterns)

## 📊 Analysis Methodology

- **4 parallel AI agents** (Claude Opus 4.6 + GPT-5.4) performed deep repository exploration
- **250+ GitHub API calls** examining CI configs, custom lint rules, test harnesses, build scripts, and architecture docs
- Every finding is traced to a specific file path in the VS Code repository

## License

MIT — Use these patterns freely in your projects.
