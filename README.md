# CLISYS

> Multi-CLI Intelligent Collaboration System | Meta-CLI evolving into Agentic Execution Fabric

## Overview

CLISYS is not another CLI tool—it's a **Meta-CLI** that orchestrates multiple AI-powered CLI tools to work together collaboratively. Think of it as a conductor for an orchestra of AI assistants.

### Core Concept

```
User Request → CLISYS (Orchestrator)
                    │
         ┌──────────┼──────────┐
         ↓          ↓          ↓
    ┌─────────┐ ┌─────────┐ ┌─────────┐
    │  Claude │ │  Codex  │ │  Gemini │  ...more
    │  Code   │ │   CLI   │ │   CLI   │
    └─────────┘ └─────────┘ └─────────┘
         │          │          │
         └──────────┴──────────┘
                    │
                    ↓
          Collaborative Result
```

## Features

- **Multi-CLI Orchestration**: Coordinate multiple AI CLI tools (Claude Code, Codex CLI, Gemini CLI, etc.)
- **Intelligent Task Dispatch**: Automatically route tasks to the most suitable adapter
- **Loop Mechanisms**: Ralph Loop (self-referential iteration) and Ultrawork Loop (parallel execution)
- **Result Aggregation**: Combine outputs from multiple adapters
- **Capability-Based Matching**: Match tasks to adapters based on required capabilities

## Project Status

🚧 **Early Development (MVP Phase)**

Current version: `0.1.0`

## Architecture

```
clisys/
├── src/
│   ├── core/
│   │   ├── orchestrator/    # TaskParser, Dispatcher, Aggregator, LoopManager
│   │   ├── adapter/         # BaseAdapter, AdapterRegistry
│   │   ├── context/         # Context sharing engine
│   │   └── infrastructure/  # Config, Logger, Session
│   ├── adapters/            # CLI-specific adapters
│   ├── loops/               # Loop implementations
│   └── cli/                 # CLI interface
```

## Installation

```bash
# Clone the repository
git clone https://github.com/XucroYuri/CLISYS.git
cd CLISYS

# Install dependencies
bun install

# Run in development
bun run dev
```

## Quick Start

```bash
# Show help
clisys --help

# List available adapters
clisys adapters

# Execute a task
clisys run "Create a REST API with authentication"

# Use specific adapter
clisys run "Review this code" --adapter claude-code
```

## Development Roadmap

### Phase 1: MVP (Current)
- [x] Project structure
- [x] Core types and interfaces
- [x] Orchestrator framework
- [ ] Claude Code adapter
- [ ] Codex CLI adapter
- [ ] Basic configuration system

### Phase 2: Extended Support
- [ ] Gemini CLI adapter
- [ ] OpenCode adapter
- [ ] Aider adapter
- [ ] Ralph Loop implementation
- [ ] Ultrawork Loop implementation

### Phase 3: Enterprise Features
- [ ] Plugin system
- [ ] Permission control
- [ ] Monitoring and logging
- [ ] Security sandbox

### Phase 4: Ecosystem
- [ ] Documentation
- [ ] Community plugins
- [ ] Examples and tutorials

## Technical Stack

| Component | Technology |
|-----------|------------|
| Runtime | Bun / Node.js 20+ |
| Language | TypeScript (strict) |
| CLI Framework | Commander |
| Validation | Zod |
| Logging | Pino |
| Testing | Vitest |

## Contributing

This project is currently in private development. Contribution guidelines will be available when the project goes open source.

## License

MIT License

## Vision

CLISYS is designed to evolve from a Meta-CLI into an **Agentic Execution Fabric**—a comprehensive infrastructure for AI agent orchestration, execution tracking, and governance.

---

*Built with ❤️ for the AI-assisted development future*
