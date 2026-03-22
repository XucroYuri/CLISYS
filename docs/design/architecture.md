# CLISYS Architecture Design

## Overview

CLISYS is a Meta-CLI system that orchestrates multiple AI-powered CLI tools (Claude Code, Codex, etc.) to work together intelligently.

## Core Components

### 1. CLI Layer (`src/cli/`)

Built with **Clipanion** for type-safe command handling.

Commands:
- `clisys run <prompt>` - Execute a task
- `clisys adapters` - List available adapters
- `clisys config` - Manage configuration

### 2. Core Layer (`src/core/`)

#### Adapter System
- `BaseAdapter` - Abstract base class for all CLI adapters
- `AdapterRegistry` - Manages adapter lifecycle and discovery

#### Orchestrator
- `TaskParser` - Parses natural language tasks
- `Dispatcher` - Routes tasks to appropriate adapters
- `Aggregator` - Combines results from multiple adapters
- `LoopManager` - Manages Ralph and Ultrawork loops

#### Storage
- SQLite database with Drizzle ORM
- Session persistence
- Execution history

#### Configuration
- TOML-based configuration
- Multi-level config (global → project)

### 3. Adapter Layer (`src/adapters/`)

Concrete implementations for each CLI tool:
- Claude Code Adapter
- Codex CLI Adapter
- Gemini CLI Adapter
- (Future) OpenCode Adapter

## Data Flow

```
User Prompt
    │
    ▼
┌─────────────┐
│ CLI Parser  │ (Clipanion)
└─────────────┘
    │
    ▼
┌─────────────┐
│ TaskParser  │
└─────────────┘
    │
    ▼
┌─────────────┐
│ Dispatcher  │ ←── AdapterRegistry
└─────────────┘
    │
    ▼
┌─────────────┐
│  Adapters   │ (Claude, Codex, etc.)
└─────────────┘
    │
    ▼
┌─────────────┐
│ Aggregator  │
└─────────────┘
    │
    ▼
   Result
```

## Loop Mechanisms

### Ralph Loop (Self-Referential)
Iterates on a task until completion criteria is met.

```
┌─────────────────────────────────┐
│                                 │
│  ┌─────┐    ┌─────┐    ┌─────┐ │
│  │Task │───▶│Execute│──▶│Check│ │
│  └─────┘    └─────┘    └─────┘ │
│     ▲                      │    │
│     └──────────────────────┘    │
│         (if not complete)       │
└─────────────────────────────────┘
```

### Ultrawork Loop (Parallel)
Executes multiple adapters in parallel, selects/aggregates best results.

```
        ┌─────┐
        │Task │
        └─────┘
            │
    ┌───────┼───────┐
    ▼       ▼       ▼
┌─────┐ ┌─────┐ ┌─────┐
│Adapt│ │Adapt│ │Adapt│
│  1  │ │  2  │ │  3  │
└─────┘ └─────┘ └─────┘
    │       │       │
    └───────┼───────┘
            ▼
      ┌───────────┐
      │ Aggregate │
      └───────────┘
            │
            ▼
        ┌─────┐
        │Result│
        └─────┘
```

## Configuration Schema

```toml
version = "1.0"

[adapters.claude-code]
enabled = true
command = "claude"

[adapters.codex]
enabled = true
command = "codex"

[adapters.gemini]
enabled = true
command = "gemini"

[orchestrator]
default_strategy = "capability_based"
max_parallel_tasks = 3
task_timeout = 300000

[logging]
level = "info"
output = "console"
```

## Storage Schema

### Sessions Table
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  adapter_name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata JSON
);
```

### Executions Table
```sql
CREATE TABLE executions (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  task_id TEXT NOT NULL,
  adapter_name TEXT NOT NULL,
  success BOOLEAN,
  output TEXT,
  error TEXT,
  duration INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

## Extension Points

1. **New Adapters**: Extend `BaseAdapter` and register with `AdapterRegistry`
2. **New Strategies**: Implement dispatch strategies for the `Dispatcher`
3. **New Loops**: Add new loop types to `LoopManager`
4. **Hooks**: Subscribe to events via the Event Bus
