# CLISYS — Copilot Agent Instructions

> **Persistent system prompt for GitHub Copilot agents working on this repository.**
> Read every section before generating code, tests, or reviews. Deviating from these
> constraints leads to drift and regression.

---

## 1. Project Identity

**CLISYS** (Multi-CLI Intelligent Collaboration System) is a **Meta-CLI Orchestrator** written in TypeScript/Bun. It coordinates multiple AI-powered CLI tools (Claude Code, Codex CLI, Gemini CLI, …) through a unified execution fabric.

| Item | Value |
|------|-------|
| Current version | **v0.1.0** (MVP — Phase 1 complete) |
| Active phase | **Phase 2** — Extended Adapter Support |
| Roadmap | `docs/roadmap.md` |
| Primary language | TypeScript 5.3+ (strict mode) |
| Runtime | **Bun ≥ 1.0 ONLY** (see §2) |
| License | MIT |

---

## 2. Runtime Constraint — Bun Only ⚠️

**CLISYS is Bun-only at runtime.** Despite `engines.node` in `package.json`, the codebase
uses Bun-exclusive APIs that have **no Node.js equivalents**:

- `import { Database } from 'bun:sqlite'` — `src/core/storage/db.ts`
- `drizzle-orm/bun-sqlite` — `src/core/storage/db.ts`
- `import { $ } from 'bun'` — `src/adapters/claude-code/index.ts`, `src/adapters/codex/index.ts`

**Never:**
- Suggest or introduce `better-sqlite3`, `node:sqlite`, or any Node SQLite driver.
- Replace `$` (Bun shell) with `child_process.spawn` / `execa` / `shelljs`.
- Add Node-specific shims or polyfills for Bun APIs.

**Development commands (always use `bun`):**
```bash
bun install          # install dependencies
bun test             # run Vitest test suite (24 tests)
bun run typecheck    # tsc --noEmit  (must show 0 errors)
bun run lint         # eslint src --ext .ts
bun run build        # build CLI to dist/cli/
bun run dev          # watch mode for development
bun run test:coverage # coverage report
```

---

## 3. Repository Structure

```
CLISYS/
├── src/
│   ├── core/
│   │   ├── adapter/          # BaseAdapter (abstract), AdapterRegistry, types
│   │   ├── orchestrator/     # TaskParser, Dispatcher, Aggregator, LoopManager
│   │   ├── bus/              # EventBus (event-driven hooks)
│   │   ├── config/           # TOML loader + Zod schema (loader.ts)
│   │   ├── logger/           # Pino-based structured logger
│   │   └── storage/          # bun:sqlite + Drizzle ORM (db.ts, schema.ts, session.ts)
│   ├── adapters/
│   │   ├── claude-code/      # ClaudeCodeAdapter — STABLE (uses $ from bun)
│   │   └── codex/            # CodexAdapter — STABLE (uses $ from bun)
│   ├── loops/
│   │   ├── ralph.ts          # RalphLoop — iterative self-refinement
│   │   └── ultrawork.ts      # UltraworkLoop — parallel multi-adapter
│   └── cli/
│       ├── commands/         # run.ts, adapters.ts, config.ts
│       └── index.ts          # Clipanion CLI entry point
├── tests/
│   ├── core/                 # adapter.test.ts, aggregator.test.ts, config.test.ts,
│   │   │                     #   dispatcher.test.ts, parser.test.ts, storage.test.ts
│   └── loops/                # ralph.test.ts, ultrawork.test.ts
├── docs/
│   ├── design/architecture.md
│   └── roadmap.md
├── config/
│   └── default.toml          # shipped default TOML config
├── drizzle.config.ts
├── package.json
└── tsconfig.json
```

---

## 4. Architecture & Core Contracts

### 4.1 Data Flow

```
User Prompt → CLI (Clipanion)
                 │
                 ▼
           TaskParser          ← keyword-based intent extraction (no LLM yet)
                 │
                 ▼
           Dispatcher          ← 4 strategies: capability_based | cost_optimized |
                 │                              performance_based | round_robin
                 │     ←─── AdapterRegistry (health checks, capability scoring)
                 ▼
     Concrete Adapters         ← subprocess via Bun's $ shell operator
                 │
                 ▼
           Aggregator          ← strategies: best_result | merge | vote
                 │
                 ▼
              Result
```

### 4.2 BaseAdapter Contract

Every adapter **must** extend `src/core/adapter/BaseAdapter.ts` and implement:

```typescript
abstract initialize(): Promise<void>      // CLI tool discovery / setup
abstract healthCheck(): Promise<HealthCheckResult>
abstract shutdown(): Promise<void>
abstract execute(request: ExecutionRequest): Promise<ExecutionResult>
```

Use the protected helpers: `createSuccessResult()`, `createErrorResult()`,
`createHealthCheckResult()`.

**Session management** is handled by `BaseAdapter`; subclasses override only if needed.

### 4.3 AdapterRegistry

- `register(adapter)` — calls `initialize()`, throws on duplicate name.
- `scoreAdapters(capabilities[])` — returns sorted `AdapterScore[]`.
- `findByCapability(cap)` — filter by single capability.
- `getAllHealthStatus()` — returns `Map<string, HealthCheckResult>`.

### 4.4 EventBus

Singleton (`getEventBus()`). Used for real-time feedback and hooks.
Events emitted: `adapter:started`, `adapter:completed`, `task:dispatched`,
`loop:iteration`, `loop:completed`.

### 4.5 Configuration

TOML → Zod validation → `CLISYSConfig`. Load priority (lowest → highest):
1. Built-in defaults in `loader.ts`
2. `~/.clisys/config.toml`
3. `.clisys/config.toml` (project-level)
4. `CLISYS_CONFIG` env var path
5. Env overrides: `CLISYS_LOG_LEVEL`, `CLISYS_MAX_PARALLEL`, `CLISYS_STRATEGY`

### 4.6 Storage (Bun-only SQLite)

Five tables: `sessions`, `executions`, `tasks`, `subtasks`, `event_logs`.
WAL mode enabled. Access via `getDatabase()` / `initDatabase()`.

---

## 5. Implementation Status

### ✅ Phase 1 — Complete (v0.1.0)

| Component | File(s) | Status |
|-----------|---------|--------|
| BaseAdapter + AdapterRegistry | `src/core/adapter/` | ✅ Stable |
| TaskParser (keyword-based) | `src/core/orchestrator/TaskParser.ts` | ✅ Stable |
| Dispatcher (4 strategies) | `src/core/orchestrator/Dispatcher.ts` | ✅ Stable |
| Aggregator (3 strategies) | `src/core/orchestrator/Aggregator.ts` | ✅ Stable |
| EventBus | `src/core/bus/` | ✅ Stable |
| TOML Config + Zod validation | `src/core/config/` | ✅ Stable |
| Pino logger | `src/core/logger/` | ✅ Stable |
| SQLite storage (Bun) | `src/core/storage/` | ✅ Stable |
| ClaudeCodeAdapter | `src/adapters/claude-code/` | ✅ Stable |
| CodexAdapter | `src/adapters/codex/` | ✅ Stable |
| RalphLoop | `src/loops/ralph.ts` | ✅ Stable |
| UltraworkLoop | `src/loops/ultrawork.ts` | ✅ Stable |
| CLI commands (run/adapters/config) | `src/cli/commands/` | ✅ Stable |
| Vitest test suite | `tests/` | ✅ 24/24 passing |

### 🔄 Phase 2 — In Progress (v0.2.x target)

| Item | Priority | Notes |
|------|----------|-------|
| Gemini CLI adapter | High | `src/adapters/gemini/` — not yet created |
| Aider adapter | Medium | `src/adapters/aider/` — not yet created |
| OpenCode / Oh My OpenAgent adapter | Medium | `src/adapters/openagent/` — not yet created |
| Parallel health checks (`Promise.all`) | Low | Sequential checks exist in some paths |
| CLI command tests | Medium | `tests/cli/` does not exist yet |

### 📋 Future Phases (v0.3.x+)

- Phase 3: Plugin/dynamic-loader architecture, streaming output (`AsyncGenerator`), score caching
- Phase 4: Permission/ACL, sandbox, audit log, rate limiting, secrets management
- Phase 5: Public API docs, Adapter SDK, binary distribution, community ecosystem

---

## 6. Coding Conventions

### 6.1 TypeScript

- **Strict mode is mandatory.** `tsconfig.json` enforces it. Never disable strict flags.
- Use explicit return types on all exported functions and class methods.
- Prefer `type` imports (`import type { … }`) for type-only imports.
- Local module imports must use the `.js` extension (ESM requirement):
  ```typescript
  import { AdapterRegistry } from '../adapter/AdapterRegistry.js';
  ```

### 6.2 Naming

| Kind | Convention | Example |
|------|-----------|---------|
| Variables / functions | `camelCase` | `parseTask`, `adapterScore` |
| Classes / interfaces / types | `PascalCase` | `BaseAdapter`, `ExecutionResult` |
| Constants | `SCREAMING_SNAKE_CASE` | `DEFAULT_COMPLETION_MARKERS` |
| File names | `PascalCase` for classes, `camelCase` for modules | `BaseAdapter.ts`, `index.ts` |
| Adapter directories | `kebab-case` | `claude-code/`, `codex/` |

### 6.3 Comments

- **Chinese comments** for business logic, implementation details, and internal notes.
- **English comments/JSDoc** for exported interfaces, public APIs, and type definitions.
- Write *why*, not *what*. Avoid redundant comments that echo the code.

### 6.4 Error Handling

- Always propagate or explicitly handle errors. Never silently swallow them.
- Use `error instanceof Error ? error.message : 'Unknown error'` for unknown throws.
- Adapters return `createErrorResult()` for expected failures; throw only for programming errors.

### 6.5 Adapters — Specific Pattern

```typescript
// 1. Define metadata constant
const MY_ADAPTER_METADATA: AdapterMetadata = {
  name: 'my-adapter',          // kebab-case, matches config key
  version: '1.0.0',
  description: '…',
  capabilities: ['code_generation', …] as Capability[],
  defaultModel: '…',
  supportedModels: ['…'],
};

// 2. Extend BaseAdapter
export class MyAdapter extends BaseAdapter {
  constructor() { super(MY_ADAPTER_METADATA); }

  async initialize(): Promise<void> { … }       // use $ from bun for CLI checks
  async healthCheck(): Promise<HealthCheckResult> { … }
  async shutdown(): Promise<void> { … }
  async execute(request: ExecutionRequest): Promise<ExecutionResult> { … }
}

// 3. Export factory function (preferred over direct instantiation)
export function createMyAdapter(): MyAdapter {
  return new MyAdapter();
}
```

### 6.6 Tests

- Framework: **Vitest** (`bun test`).
- Test files mirror `src/` under `tests/` (e.g., `tests/core/adapter.test.ts`).
- Mock all external CLI calls — tests must not require any AI CLI tool installed.
- Use `describe` / `it` with descriptive names that document expected behaviour.
- Mock adapters extend `BaseAdapter` inline (see `tests/core/adapter.test.ts` pattern).
- Run a single file: `bun test tests/core/adapter.test.ts`

---

## 7. Known Limitations & Technical Debt

| Item | Severity | Phase to fix |
|------|----------|-------------|
| TaskParser uses keyword matching only — no LLM/embeddings routing | Medium | Phase 3 |
| No streaming output (adapters buffer full stdout) | Medium | Phase 3 |
| No adapter isolation / sandboxing | High (long-term) | Phase 4 |
| `best_result` aggregation picks longest output (naive heuristic) | Medium | Phase 3 |
| `vote` aggregation is a stub (falls back to first success) | Low | Phase 3 |
| Sequential health checks in some paths | Low | Phase 2 |
| No CLI command tests in `tests/cli/` | Medium | Phase 2 |
| No integration / E2E tests | Low | Phase 3 |
| AbortController in adapter `runCommand` does not actually cancel Bun's `$` | Low | Phase 2 |
| README incorrectly states "Node.js ≥ 20" — runtime is Bun-only | Documentation | Immediate |

---

## 8. Review & Quality Protocol

When reviewing code or deciding whether to advance a roadmap phase, evaluate against
these **CLISYS-specific** criteria (not a generic rubric):

### 8.1 Per-Change Checklist

Before merging any PR:

- [ ] `bun run typecheck` passes with 0 errors
- [ ] `bun test` passes — all existing tests green, new behaviour has new tests
- [ ] New adapter follows the `BaseAdapter` contract exactly (§6.5)
- [ ] No new Bun-incompatible APIs introduced
- [ ] Config changes are reflected in `config/default.toml` and Zod schema
- [ ] `CHANGELOG.md` updated for user-facing changes
- [ ] Both `README.md` and `README.zh-CN.md` updated if adapter table changes
- [ ] Comments follow Chinese/English convention (§6.3)
- [ ] Imports use `.js` extension for local modules (§6.1)

### 8.2 Phase Advancement Gate

Advance to the next roadmap phase **only when all of the following are true**:

1. All planned features for the current phase are merged to `main`.
2. `bun test` shows **zero failures** and covers all new critical paths.
3. `bun run typecheck` shows **zero errors**.
4. `docs/roadmap.md` Phase entry updated with completion date.
5. New phase blockers documented in §8 of this file before work starts.

### 8.3 Staged Review Output Format

When producing a phase review, follow this structure:

**📊 Phase Status: [Phase Name] | Version Target: vX.X.x**

**✅ Feature Completion (table with evidence file paths)**

**🐛 Known Issues (linked to §7 above, or new findings)**

**🔍 Test Coverage Delta (new tests added vs. new code written)**

**⚠️ Bun-compatibility scan (any new Bun-incompatible code paths?)**

**➡️ Advancement Decision: Approved / Blocked**
- If blocked: exact list of remaining tasks with file-level pointers
- If approved: next phase feature list sourced from `docs/roadmap.md`

---

## 9. Extending CLISYS

### Adding a New Adapter (Phase 2 pattern)

```bash
mkdir src/adapters/<tool-name>
touch src/adapters/<tool-name>/index.ts
```

Required steps:
1. Implement `<ToolName>Adapter extends BaseAdapter` following §6.5.
2. Use `$ from 'bun'` for subprocess execution.
3. Add `create<ToolName>Adapter()` factory function.
4. Register in `src/adapters/index.ts`.
5. Add config entry to `config/default.toml` and update `loader.ts` defaults.
6. Wire into `src/cli/commands/run.ts` `initialize()` method.
7. Add tests in `tests/adapters/<tool-name>.test.ts` with mocked subprocess calls.
8. Update Supported Adapters table in `README.md` and `README.zh-CN.md`.

### Adding a New Loop Type

Implement as a class in `src/loops/<name>.ts` following the `RalphLoop` / `UltraworkLoop`
pattern: constructor with options, `async execute(prompt, adapters)`, EventBus emissions
for `loop:iteration` and `loop:completed`, export a `create<Name>Loop()` factory.

---

*Last updated: 2026-03-18 | Tied to CLISYS v0.1.0 — update when major architecture changes occur.*
