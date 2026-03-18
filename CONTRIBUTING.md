# Contributing to CLISYS

Thank you for your interest in contributing to CLISYS! This project is a collaborative effort and **cannot be sustainably maintained by one person**. Contributions of all kinds — code, documentation, bug reports, new adapters, ideas — are very welcome.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [How to Contribute](#how-to-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Features](#suggesting-features)
  - [Adding a New Adapter](#adding-a-new-adapter)
  - [Improving Documentation](#improving-documentation)
  - [Submitting Code Changes](#submitting-code-changes)
- [Code Style & Standards](#code-style--standards)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Becoming a Maintainer](#becoming-a-maintainer)

---

## Code of Conduct

This project follows our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

---

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally
3. Set up your development environment (see below)
4. Create a new branch for your changes
5. Make your changes, write tests, and verify everything passes
6. Submit a Pull Request

---

## Development Setup

### Prerequisites

- [Bun](https://bun.sh/) ≥ 1.0 (recommended) **or** Node.js ≥ 20
- Git ≥ 2.30
- An editor with TypeScript support (VS Code recommended)

### Steps

```bash
# Clone your fork
git clone https://github.com/<YOUR_USERNAME>/CLISYS.git
cd CLISYS

# Install dependencies
bun install

# Run the test suite to confirm everything works
bun test

# Start in watch mode for development
bun run dev
```

### Verifying Your Setup

```bash
# TypeScript type check — should show 0 errors
bun run typecheck

# Run all tests
bun test

# Run a single test file
bun test tests/core/adapter.test.ts
```

---

## Project Structure

```
clisys/
├── src/
│   ├── core/
│   │   ├── orchestrator/     # TaskParser, Dispatcher, Aggregator, LoopManager
│   │   ├── adapter/          # BaseAdapter, AdapterRegistry
│   │   ├── bus/              # EventBus
│   │   ├── config/           # Config loader & schema
│   │   ├── logger/           # Pino logger setup
│   │   └── storage/          # SQLite + Drizzle ORM
│   ├── adapters/             # Concrete adapter implementations
│   ├── loops/                # Ralph & Ultrawork loops
│   └── cli/                  # Clipanion-based CLI
├── tests/                    # Vitest test suite
├── docs/
│   ├── design/               # Architecture documents
│   └── roadmap.md            # Development roadmap
└── config/
    └── default.toml          # Default configuration
```

---

## How to Contribute

### Reporting Bugs

Please use the [Bug Report](.github/ISSUE_TEMPLATE/bug_report.md) issue template. Include:

- CLISYS version
- OS and Node.js / Bun version
- Minimal reproduction steps
- Expected vs. actual behavior
- Relevant log output (use `--log-level debug` if possible)

### Suggesting Features

Use the [Feature Request](.github/ISSUE_TEMPLATE/feature_request.md) template. Good feature requests explain:

- The problem you are trying to solve (not just the solution)
- Who benefits from this feature
- Any alternatives you have considered

### Adding a New Adapter

Adapters are the most impactful contribution type. To add support for a new AI CLI tool:

1. **Create the adapter directory:**
   ```bash
   mkdir -p src/adapters/<tool-name>
   ```

2. **Implement the adapter** by extending `BaseAdapter`:
   ```typescript
   // src/adapters/<tool-name>/index.ts
   import { BaseAdapter } from '../../core/adapter/base-adapter.js';
   import type { ExecutionRequest, ExecutionResult, AdapterCapability } from '../../core/index.js';

   export class MyToolAdapter extends BaseAdapter {
     name = 'my-tool';
     description = 'Adapter for My Tool CLI';

     get capabilities(): AdapterCapability[] {
       return ['code_generation', 'code_review']; // list relevant capabilities
     }

     protected async executeCommand(request: ExecutionRequest): Promise<ExecutionResult> {
       // Invoke the CLI tool and return a structured result
     }
   }
   ```

3. **Register the adapter** in `src/adapters/index.ts`

4. **Add tests** in `tests/adapters/<tool-name>.test.ts`

5. **Document it** in the Supported Adapters table in `README.md` and `README.zh-CN.md`

### Improving Documentation

Documentation improvements are always welcome. The docs follow these conventions:

- English documentation lives in `README.md` and `docs/`
- Chinese documentation lives in `README.zh-CN.md` (keep in sync with English)
- Technical design documents go in `docs/design/`
- The roadmap lives in `docs/roadmap.md`

### Submitting Code Changes

- Keep changes focused — one logical change per PR
- Add or update tests for all changed behaviour
- Ensure `bun run typecheck` and `bun test` both pass before submitting
- Update relevant documentation

---

## Code Style & Standards

- **Language:** TypeScript (strict mode — `tsconfig.json` enforces this)
- **Formatting:** No enforced formatter currently; follow the existing style in the file you are editing
- **Naming:** `camelCase` for variables/functions, `PascalCase` for classes/types, `SCREAMING_SNAKE_CASE` for constants
- **Imports:** Use explicit file extensions for local imports (`.js` suffix, as required by ESM)
- **Error handling:** Always handle or propagate errors; never silently swallow them
- **Comments:** Write comments that explain *why*, not *what*

---

## Testing

CLISYS uses [Vitest](https://vitest.dev/) for testing.

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run a specific test file
bun test tests/core/adapter.test.ts

# Run with coverage
bun run test:coverage
```

**Testing guidelines:**

- Unit tests live in `tests/` mirroring the `src/` structure
- Mock external CLI tool calls — tests should not require any AI CLI tools to be installed
- Use descriptive `describe` and `it`/`test` block names
- Aim for test cases that document the expected behaviour, not just the happy path

---

## Pull Request Process

1. **Title format:** Use [conventional commits](https://www.conventionalcommits.org/) style:
   - `feat: add Gemini CLI adapter`
   - `fix: handle timeout in Ralph Loop`
   - `docs: update adapter authoring guide`
   - `test: add Dispatcher unit tests`

2. **Description:** Fill in the PR template fully. Link to the related issue.

3. **Review:** At least one maintainer approval is required before merging.

4. **CI:** All CI checks must pass. Do not merge with failing tests.

5. **Changelog:** For user-facing changes, add an entry to `CHANGELOG.md` in the `[Unreleased]` section.

---

## Becoming a Maintainer

CLISYS is looking for long-term maintainers who can help with:

- Code review and PR merges
- Issue triage
- Release management
- Strategic direction and roadmap decisions

**If you are interested, please open an issue titled "Maintainer interest: <your name>"** and describe your background and what areas you would like to own. Current maintainers will reach out to discuss.

Maintainer responsibilities:

- Participate in technical discussions
- Review and merge PRs within a reasonable time
- Follow and enforce the Code of Conduct
- Help keep the roadmap updated and realistic

---

## Questions?

If you have questions that aren't answered here, please open a [GitHub Discussion](https://github.com/XucroYuri/CLISYS/discussions) rather than an issue.

Thank you for contributing! 🙏
