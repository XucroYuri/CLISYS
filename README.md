<div align="center">

# CLISYS

**Multi-CLI Intelligent Collaboration System**

*Meta-CLI · Agentic Execution Fabric · AI Orchestrator*

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-orange.svg)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-latest-black.svg)](https://bun.sh/)
[![Tests](https://img.shields.io/badge/tests-24%2F24_passing-brightgreen.svg)](#testing)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[English](README.md) · [中文](README.zh-CN.md) · [Roadmap](docs/roadmap.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

</div>

---

## What is CLISYS?

CLISYS is **not** another AI CLI tool. It is a **Meta-CLI Orchestrator** — a coordination layer that makes multiple AI-powered CLI tools work together as one cohesive system.

Think of it as a conductor for an orchestra of AI assistants: each tool plays to its strengths while CLISYS routes tasks, aggregates results, and iterates toward a solution.

```
User Request → CLISYS Orchestrator
                      │
         ┌────────────┼────────────┐
         ↓            ↓            ↓
    ┌─────────┐  ┌─────────┐  ┌─────────┐
    │ Claude  │  │  Codex  │  │ Gemini  │  … more
    │  Code   │  │   CLI   │  │   CLI   │
    └─────────┘  └─────────┘  └─────────┘
         │            │            │
         └────────────┴────────────┘
                      │
                      ↓
            Collaborative Result
```

> **Inspired by** [Oh My OpenAgent](https://github.com/code-yeongyu/oh-my-openagent) (formerly Oh My OpenCode) — the idea that the AI CLI ecosystem deserves the same composability as shell environments like oh-my-zsh.

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Supported Adapters](#supported-adapters)
- [Loop Mechanisms](#loop-mechanisms)
- [Configuration](#configuration)
- [Development Roadmap](#development-roadmap)
- [Technical Stack](#technical-stack)
- [Inspirations & Credits](#inspirations--credits)
- [Contributing](#contributing)
- [License](#license)
- [Community](#community)

---

## Features

| Feature | Description |
|---------|-------------|
| 🎯 **Multi-CLI Orchestration** | Coordinate Claude Code, Codex CLI, Gemini CLI, and more |
| 🧠 **Intelligent Task Dispatch** | Capability-based, cost-aware, and performance-based routing |
| 🔄 **Loop Mechanisms** | Ralph Loop (self-refinement) and Ultrawork Loop (parallel execution) |
| 📊 **Result Aggregation** | Merge, vote, or select-best from multiple adapter outputs |
| ⚙️ **Flexible Configuration** | TOML-based config with Zod validation and multi-level override |
| 💾 **Session Persistence** | SQLite + Drizzle ORM for execution history and session state |
| 🔌 **Extensible Adapter System** | Clean `BaseAdapter` interface — add any CLI tool in minutes |
| 🏗️ **Event-Driven Core** | EventBus for monitoring, debugging, and hook integration |

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) ≥ 1.0 or Node.js ≥ 20
- At least one supported AI CLI tool installed (e.g. `claude`, `codex`)

### Installation

```bash
# Clone the repository
git clone https://github.com/XucroYuri/CLISYS.git
cd CLISYS

# Install dependencies
bun install

# (Optional) Run tests to verify the installation
bun test
```

### Basic Usage

```bash
# Show all available commands
bun run src/cli/index.ts --help

# List available adapters and their status
bun run src/cli/index.ts adapters

# Execute a task (auto-routes to best adapter)
bun run src/cli/index.ts run "Create a REST API with JWT authentication"

# Target a specific adapter
bun run src/cli/index.ts run "Review this code for security issues" --adapter claude-code

# Run in parallel across all adapters
bun run src/cli/index.ts run "Refactor this module" --parallel

# Use iterative refinement (Ralph Loop)
bun run src/cli/index.ts run "Write comprehensive tests" --loop ralph --max-iterations 3
```

---

## Architecture

```
clisys/
├── src/
│   ├── core/
│   │   ├── orchestrator/     # TaskParser, Dispatcher, Aggregator, LoopManager
│   │   ├── adapter/          # BaseAdapter, AdapterRegistry
│   │   ├── bus/              # EventBus
│   │   ├── config/           # Configuration loader & validator
│   │   ├── logger/           # Pino-based structured logging
│   │   └── storage/          # SQLite session & execution history
│   ├── adapters/
│   │   ├── claude-code/      # Claude Code adapter
│   │   └── codex/            # OpenAI Codex CLI adapter
│   ├── loops/
│   │   ├── ralph.ts          # Self-referential iterative loop
│   │   └── ultrawork.ts      # Parallel multi-adapter loop
│   └── cli/
│       ├── commands/         # run, adapters, config commands
│       └── index.ts          # CLI entry point (Clipanion)
├── tests/                    # Vitest test suite (24+ tests)
├── docs/
│   ├── design/               # Architecture & design documents
│   └── roadmap.md            # Development roadmap
└── config/
    └── default.toml          # Default configuration
```

### Data Flow

```
User Prompt
    │
    ▼
┌─────────────┐
│  CLI Layer  │  Clipanion command routing
└─────────────┘
    │
    ▼
┌─────────────┐
│ TaskParser  │  Intent extraction, capability requirements
└─────────────┘
    │
    ▼
┌─────────────┐
│ Dispatcher  │  Strategy: capability / cost / performance / round-robin
└─────────────┘  ←── AdapterRegistry (health checks, capability scoring)
    │
    ▼
┌─────────────┐
│  Adapters   │  Subprocess execution, output capture
└─────────────┘
    │
    ▼
┌─────────────┐
│ Aggregator  │  Strategy: best_result / merge / vote
└─────────────┘
    │
    ▼
  Result
```

---

## Supported Adapters

| Adapter | Status | CLI Tool | Notes |
|---------|--------|----------|-------|
| `claude-code` | ✅ Stable | [Claude Code](https://docs.anthropic.com/claude-code) | Anthropic's coding assistant |
| `codex` | ✅ Stable | [Codex CLI](https://github.com/openai/codex) | OpenAI's CLI coding agent |
| `gemini` | 🔲 Planned | [Gemini CLI](https://github.com/google-gemini/gemini-cli) | Google's CLI AI tool |
| `openagent` | 🔲 Planned | [Oh My OpenAgent](https://github.com/openagentlabs/oh-my-openagent) | Composable agent framework |
| `aider` | 🔲 Planned | [Aider](https://github.com/paul-gauthier/aider) | Git-aware coding assistant |

**Adding a new adapter** is straightforward — extend `BaseAdapter` and register it. See [docs/design/architecture.md](docs/design/architecture.md) and [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

## Loop Mechanisms

### Ralph Loop — Iterative Self-Refinement

Iterates on a task until a completion criterion is met or the maximum iteration limit is reached. Ideal for tasks requiring refinement cycles (e.g., test → fix → test).

```
┌──────────────────────────────────────┐
│  ┌──────┐   ┌─────────┐   ┌───────┐ │
│  │ Task │──▶│ Execute │──▶│ Check │ │
│  └──────┘   └─────────┘   └───────┘ │
│      ▲                        │      │
│      └────────────────────────┘      │
│          (iterate if incomplete)     │
└──────────────────────────────────────┘
```

### Ultrawork Loop — Parallel Multi-Adapter Execution

Dispatches the same task to multiple adapters concurrently, then aggregates or selects the best result. Ideal for validation, diverse perspectives, and redundancy.

```
           ┌──────┐
           │ Task │
           └──────┘
               │
    ┌──────────┼──────────┐
    ▼          ▼          ▼
┌───────┐ ┌───────┐ ┌───────┐
│Adapter│ │Adapter│ │Adapter│
│   1   │ │   2   │ │   3   │
└───────┘ └───────┘ └───────┘
    │          │          │
    └──────────┴──────────┘
               ▼
         ┌──────────┐
         │ Aggregate│
         └──────────┘
               │
               ▼
           ┌──────┐
           │Result│
           └──────┘
```

---

## Configuration

CLISYS uses a layered TOML configuration system:

1. Built-in defaults (`config/default.toml`)
2. User-level config (`~/.clisys/config.toml`)
3. Project-level config (`.clisys/config.toml` in your project)

```toml
version = "1.0"

[adapters.claude-code]
enabled = true
command  = "claude"

[adapters.codex]
enabled = true
command  = "codex"

[orchestrator]
default_strategy   = "capability_based"   # capability_based | cost_based | performance | round_robin
max_parallel_tasks = 3
task_timeout       = 300000               # ms

[logging]
level  = "info"    # debug | info | warn | error
output = "console" # console | file
```

---

## Development Roadmap

See [docs/roadmap.md](docs/roadmap.md) for the full technical roadmap. Summary:

| Phase | Version | Focus |
|-------|---------|-------|
| Phase 1 ✅ | v0.1.0 | MVP — core orchestration, two adapters, loops, storage |
| Phase 2 🔄 | v0.2.x | Extended adapters (Gemini, OpenAgent, Aider) |
| Phase 3 📋 | v0.3.x | Plugin architecture, streaming output, score caching |
| Phase 4 📋 | v0.5.x | Enterprise features: permissions, sandbox, audit log |
| Phase 5 📋 | v1.0.0 | Public release, SDK, community ecosystem |

---

## Technical Stack

| Component | Technology | Why |
|-----------|------------|-----|
| Runtime | [Bun](https://bun.sh/) / Node.js 20+ | Near-native performance, excellent TypeScript support |
| Language | TypeScript 5 (strict) | Type safety across all components, great AI tooling integration |
| CLI Framework | [Clipanion](https://mael.dev/clipanion/) | Type-safe command handling with decorators |
| Validation | [Zod](https://github.com/colinhacks/zod) | Schema validation for config and adapter contracts |
| Logging | [Pino](https://github.com/pinojs/pino) | Fast, structured JSON logging |
| Testing | [Vitest](https://vitest.dev/) | Blazing fast unit tests, native ESM support |
| Storage | [Drizzle ORM](https://orm.drizzle.team/) + SQLite | Type-safe ORM, zero-dependency SQLite |
| Config | [TOML](https://toml.io/) via `@iarna/toml` | Human-friendly, widely used in CLI tools |

---

## Inspirations & Credits

CLISYS builds on the shoulders of giants. The following projects directly inspired its design or are used as foundational dependencies:

### Conceptual Inspirations

| Project | Contribution |
|---------|-------------|
| [Oh My OpenAgent](https://github.com/openagentlabs/oh-my-openagent) *(formerly Oh My OpenCode)* | The core idea: composable AI CLI orchestration, the "oh-my-zsh for AI agents" concept |
| [oh-my-zsh](https://github.com/ohmyzsh/ohmyzsh) | Plugin/adapter ecosystem model |
| [LangChain](https://github.com/langchain-ai/langchain) | Agent chaining and tool-use patterns |
| [AutoGPT](https://github.com/Significant-Gravitas/AutoGPT) | Self-referential looping and autonomous task execution |
| [CrewAI](https://github.com/joaomdmoura/crewAI) | Multi-agent role-based collaboration |

### AI CLI Tools Integrated / Planned

| Tool | Repository | Notes |
|------|------------|-------|
| Claude Code | [Anthropic docs](https://docs.anthropic.com/claude-code) | Primary adapter |
| Codex CLI | [openai/codex](https://github.com/openai/codex) | Primary adapter |
| Gemini CLI | [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli) | Planned |
| Aider | [paul-gauthier/aider](https://github.com/paul-gauthier/aider) | Planned |
| Oh My OpenAgent | [openagentlabs/oh-my-openagent](https://github.com/openagentlabs/oh-my-openagent) | Planned |

### Core Dependencies

| Package | Repository | Purpose |
|---------|------------|---------|
| clipanion | [arcanis/clipanion](https://github.com/arcanis/clipanion) | Type-safe CLI framework |
| zod | [colinhacks/zod](https://github.com/colinhacks/zod) | Schema validation |
| pino | [pinojs/pino](https://github.com/pinojs/pino) | Structured logging |
| drizzle-orm | [drizzle-team/drizzle-orm](https://github.com/drizzle-team/drizzle-orm) | Type-safe SQLite ORM |
| @iarna/toml | [iarna/iarna-toml](https://github.com/iarna/iarna-toml) | TOML parsing |
| vitest | [vitest-dev/vitest](https://github.com/vitest-dev/vitest) | Test framework |
| bun | [oven-sh/bun](https://github.com/oven-sh/bun) | JS/TS runtime |

---

## Contributing

CLISYS cannot be maintained by one person alone. Contributions — code, documentation, adapters, ideas — are very welcome.

**This project explicitly invites experienced developers to join as long-term maintainers.** If you are interested in taking on a stewardship role, please open an issue or reach out directly.

See [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Development setup
- Code style guidelines
- How to add a new adapter
- Pull request process
- Maintainer responsibilities

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community standards.

---

## License

CLISYS is released under the **MIT License**. See [LICENSE](LICENSE) for full text.

### Licence Considerations

MIT allows unrestricted use, including commercial use. This is intentional for v0.x to encourage adoption and ecosystem growth.

As the project matures toward v1.0, the maintainers may evaluate a dual-licensing model (MIT for individual/open-source use, commercial licence for enterprise deployments). Any such change would apply only to future versions and would be discussed openly with the community before being adopted.

---

## Community

- **Issues & Feature Requests**: [GitHub Issues](https://github.com/XucroYuri/CLISYS/issues)
- **Discussions**: [GitHub Discussions](https://github.com/XucroYuri/CLISYS/discussions)
- **Security**: See [SECURITY.md](SECURITY.md) for responsible disclosure

---

## Project Status

| Metric | Status |
|--------|--------|
| Build | ✅ Passing |
| Tests | ✅ 24/24 passing |
| TypeScript | ✅ Strict mode, 0 errors |
| Version | 0.1.0 (MVP) |
| Stability | Beta — API may change before v1.0 |

---

<div align="center">

*Built with ❤️ for the AI-assisted development future.*

*If CLISYS has been useful to you, please consider starring ⭐ the repository — it helps others find the project.*

</div>
