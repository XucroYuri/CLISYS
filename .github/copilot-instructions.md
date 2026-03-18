**Third-Round Iteration — 2026-03-18 | Quality Gate 95% Enforced**

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

Every adapter **must** extend `src/core/adapter/BaseAdapter.ts` (180 lines) and implement:

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
| Vitest test suite (8 files) | `tests/` | ✅ 24/24 passing |

### 🔄 Phase 2 — In Progress (v0.2.x target)

| Item | Priority | Status | Acceptance Criteria | Known Limitation (from §7) |
|------|----------|--------|---------------------|---------------------------|
| **Gemini CLI adapter** | High | ❌ Not started — `src/adapters/gemini/` does not exist | (1) `GeminiAdapter extends BaseAdapter` with all 4 abstract methods implemented; (2) `createGeminiAdapter()` factory exported; (3) `config/default.toml` has `[adapters.gemini]` section; (4) Registered in `src/adapters/index.ts`; (5) Tests in `tests/adapters/gemini.test.ts` with mocked `$` calls; (6) `README.md` + `README.zh-CN.md` adapter tables updated | — |
| **Aider adapter** | Medium | ❌ Not started — `src/adapters/aider/` does not exist | Same 6-point criteria as Gemini, adapted for Aider CLI (`aider` command, git-aware capabilities) | — |
| **OpenCode / Oh My OpenAgent adapter** | Medium | ❌ Not started — `src/adapters/openagent/` does not exist | Same 6-point criteria as Gemini, adapted for OpenCode/OpenAgent CLI | — |
| **Parallel health checks** | Low | ❌ Not started — `AdapterRegistry.ts` uses sequential polling | (1) `getAllHealthStatus()` uses `Promise.all` with 3000 ms timeout per adapter; (2) Real `AbortController` cancellation verified (not just instantiated); (3) No resource leaks on timeout; (4) Unit test proving parallel execution and timeout behaviour | `AbortController` in adapter `runCommand` does not actually cancel Bun's `$` (see `src/adapters/claude-code/index.ts`, `src/adapters/codex/index.ts`) |
| **CLI command tests** | Medium | ❌ Not started — `tests/cli/` does not exist | (1) `tests/cli/` directory created; (2) Tests for `run`, `adapters`, `config` commands; (3) All CLI commands tested with mocked adapter layer; (4) `bun test tests/cli/` passes | No CLI command tests currently exist |
| **AbortController fix** | Low | ❌ Not started | (1) `AbortController.abort()` actually terminates Bun `$` subprocess; (2) Verified with test that checks process termination; (3) No zombie processes after timeout | Listed in current codebase — `src/adapters/claude-code/index.ts`, `src/adapters/codex/index.ts` both declare `AbortController` without functional cancellation |

#### Phase 2 — New Adapter Template (Ready-to-Use)

Every new Phase 2 adapter **must** follow this exact pattern. Copy this template and fill in the `<PLACEHOLDERS>`:

```typescript
/**
 * CLISYS <TOOL_DISPLAY_NAME> Adapter
 * <TOOL_DISPLAY_NAME> CLI 的适配器实现
 */

import { BaseAdapter } from '../../core/adapter/BaseAdapter.js';
import type {
  AdapterMetadata,
  Capability,
  ExecutionRequest,
  ExecutionResult,
  HealthCheckResult,
} from '../../core/adapter/types.js';
import { createChildLogger } from '../../core/logger/index.js';
import { $ } from 'bun';

const logger = createChildLogger('<TOOL_KEBAB_NAME>-adapter');

/**
 * <TOOL_DISPLAY_NAME> 适配器元数据
 */
const <TOOL_SCREAMING_SNAKE>_METADATA: AdapterMetadata = {
  name: '<TOOL_KEBAB_NAME>',        // must match config key in default.toml
  version: '1.0.0',
  description: '<TOOL_DISPLAY_NAME> CLI adapter for CLISYS',
  capabilities: [
    'code_generation',
    'code_editing',
    // 根据工具实际能力添加更多 capabilities
  ] as Capability[],
  defaultModel: '<DEFAULT_MODEL>',
  supportedModels: ['<MODEL_1>', '<MODEL_2>'],
};

export class <TOOL_PASCAL_NAME>Adapter extends BaseAdapter {
  constructor() {
    super(<TOOL_SCREAMING_SNAKE>_METADATA);
  }

  async initialize(): Promise<void> {
    // 检查 CLI 工具是否安装
    try {
      const result = await $`<TOOL_COMMAND> --version`.quiet();
      logger.info({ version: result.text().trim() }, '<TOOL_DISPLAY_NAME> CLI detected');
    } catch {
      throw new Error('<TOOL_DISPLAY_NAME> CLI not found. Install: <INSTALL_COMMAND>');
    }
    this.isInitialized = true;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      await $`<TOOL_COMMAND> --version`.quiet();
      return this.createHealthCheckResult('healthy', 'ok', Date.now() - start);
    } catch (error) {
      return this.createHealthCheckResult(
        'unhealthy',
        error instanceof Error ? error.message : 'Unknown error',
        Date.now() - start
      );
    }
  }

  async shutdown(): Promise<void> {
    // 清理所有活跃会话
    const sessions = await this.listSessions();
    for (const session of sessions) {
      await this.closeSession(session.id);
    }
    this.isInitialized = false;
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const start = Date.now();
    try {
      // 实现具体的执行逻辑，使用 Bun $ 调用 CLI
      const result = await $`<TOOL_COMMAND> ${request.prompt}`.quiet();
      const output = result.text().trim();
      const execResult = this.createSuccessResult(request.taskId, output);
      execResult.duration = Date.now() - start;
      return execResult;
    } catch (error) {
      const execResult = this.createErrorResult(
        request.taskId,
        error instanceof Error ? error.message : 'Unknown error'
      );
      execResult.duration = Date.now() - start;
      return execResult;
    }
  }
}

/**
 * Factory function (preferred over direct instantiation)
 */
export function create<TOOL_PASCAL_NAME>Adapter(): <TOOL_PASCAL_NAME>Adapter {
  return new <TOOL_PASCAL_NAME>Adapter();
}
```

**After creating the adapter, complete all integration steps:**
1. Register in `src/adapters/index.ts`
2. Add `[adapters.<tool-kebab-name>]` section to `config/default.toml`
3. Update Zod schema defaults in `src/core/config/loader.ts`
4. Wire into `src/cli/commands/run.ts` `initialize()` method
5. Add tests in `tests/adapters/<tool-name>.test.ts` with mocked `$` calls
6. Update adapter tables in `README.md` and `README.zh-CN.md`

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

### 6.5 Tests

- Framework: **Vitest** (run via `bun test`, which invokes the `vitest` script from `package.json`).
- Test files mirror `src/` under `tests/` (e.g., `tests/core/adapter.test.ts`).
- Mock all external CLI calls — tests must not require any AI CLI tool installed.
- Use `describe` / `it` with descriptive names that document expected behaviour.
- Mock adapters extend `BaseAdapter` inline (see `tests/core/adapter.test.ts` pattern).
- Run a single file: `bun test tests/core/adapter.test.ts`
- Run with coverage: `bun run test:coverage`

---

## 7. Known Limitations & Technical Debt

> Items that overlap with Phase 2 deliverables are tracked in §5 Phase 2 table with explicit acceptance criteria.
> This section covers **non-Phase-2** technical debt only.

| Item | Severity | Phase to fix | Evidence |
|------|----------|-------------|----------|
| TaskParser uses keyword matching only — no LLM/embeddings routing | Medium | Phase 3 | `src/core/orchestrator/TaskParser.ts` |
| No streaming output (adapters buffer full stdout) | Medium | Phase 3 | `src/adapters/claude-code/index.ts`, `src/adapters/codex/index.ts` |
| No adapter isolation / sandboxing | High (long-term) | Phase 4 | No sandbox wrapper exists in `src/` |
| `best_result` aggregation picks longest output (naive heuristic) | Medium | Phase 3 | `src/core/orchestrator/Aggregator.ts` |
| `vote` aggregation is a stub (falls back to first success) | Low | Phase 3 | `src/core/orchestrator/Aggregator.ts` |
| No integration / E2E tests | Low | Phase 3 | Only unit tests exist in `tests/` |
| README incorrectly states "Node.js ≥ 20" — runtime is Bun-only | Documentation | Immediate | `package.json` `engines.node` field |

---

## 8. Review & Quality Protocol

When reviewing code or deciding whether to advance a roadmap phase, evaluate against
these **CLISYS-specific** criteria (not a generic rubric).

**Every review or advancement decision MUST include a concrete evidence chain:**
- Specific file paths + line numbers (e.g., `src/adapters/gemini/index.ts:42`)
- Exact test commands with expected output (e.g., `bun test tests/adapters/gemini.test.ts`)
- Git blame / merged PR references where available
- **Never** accept vague statements like "looks good" or "seems to work"

### 8.1 Per-Change Checklist

Before merging any PR:

- [ ] `bun run typecheck` passes with 0 errors
- [ ] `bun test` passes — all existing tests green, new behaviour has new tests
- [ ] New adapter follows the `BaseAdapter` contract exactly (§5 template)
- [ ] No new Bun-incompatible APIs introduced
- [ ] Config changes are reflected in `config/default.toml` and Zod schema
- [ ] `CHANGELOG.md` updated for user-facing changes
- [ ] Both `README.md` and `README.zh-CN.md` updated if adapter table changes
- [ ] Comments follow Chinese/English convention (§6.3)
- [ ] Imports use `.js` extension for local modules (§6.1)
- [ ] Security review passed (see §8.3)

### 8.2 Phase Advancement — Strict 4-Dimension Quality Gate

Advance to the next roadmap phase **only when the overall score is ≥ 95% AND all individual dimension scores are ≥ 9/10**.

#### Dimension 1: Completion Degree Audit (exact %)

Compute completion as: `(completed items / total planned items) × 100%`.
Every item **must** have evidence:

| Evidence Type | Required Format |
|--------------|----------------|
| Source file | Full path + line range (e.g., `src/adapters/gemini/index.ts:1-120`) |
| Config entry | `config/default.toml` section name |
| Test file | Path + test count (e.g., `tests/adapters/gemini.test.ts` — 8 tests) |
| Documentation | `README.md` section / line numbers |

#### Dimension 2: Usability & DX Score (1–10)

| Criterion | Verification Command |
|-----------|---------------------|
| Clean install | `rm -rf node_modules && bun install` — must succeed with 0 warnings |
| Type safety | `bun run typecheck` — must show 0 errors |
| Test suite | `bun test` — all tests must pass, new features must have tests |
| Lint | `bun run lint` — 0 errors (warnings acceptable) |
| Build | `bun run build` — produces `dist/cli/` without errors |
| Single-test run | `bun test tests/<specific>.test.ts` — targeted test must pass |

Score 10/10 requires **all** commands passing. Deduct 1 point per failing command.

#### Dimension 3: Functional Implementation Capability Score (1–10)

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Architecture adherence | 3 | All new code follows BaseAdapter contract, EventBus integration, config schema |
| Edge case handling | 3 | Timeout, missing CLI, malformed output, concurrent execution |
| Extensibility | 2 | New adapter can be added by following §5 template without modifying core |
| Code quality | 2 | No dead code, no duplicated logic, proper error propagation |

Score 10/10 requires all weights satisfied with concrete evidence.

#### Dimension 4: Debug & Risk Assessment

| Check | Tool / Command | Pass Criteria |
|-------|---------------|---------------|
| Static analysis | `bun run typecheck && bun run lint` | 0 errors |
| Test coverage | `bun run test:coverage` | New code has ≥ 80% branch coverage |
| Security scan | See §8.3 | No critical/high findings |
| Dependency audit | `bun pm ls` | No known vulnerabilities in direct deps |
| Resource leak check | Manual review of `$` subprocess usage | All `$` calls have timeout, no orphan processes |

#### Required Output Format for Phase Reviews

```
📊 Phase Status: [Phase Name] | Version Target: vX.X.x

✅ Completion: XX% (Y/Z items)
   [table of items with status + evidence file paths + line numbers]

🧪 Usability & DX: X/10
   [table of commands run + pass/fail + evidence]

🏗️ Functional Capability: X/10
   [architecture adherence, edge cases, extensibility — with file references]

🐛 Debug & Risk: X/10
   [static analysis, coverage, security, dependency audit results]

➡️ Overall Score: XX% | Advancement Decision: Approved / Blocked
   - If blocked: exact list of remaining tasks with file-level pointers + ready-to-apply patches
   - If approved: next phase feature list sourced from docs/roadmap.md
```

### 8.3 Security, Performance & Concurrency Review

This subsection is **mandatory** for every PR and phase review.

#### 8.3.1 OWASP CLI Security Risks

| Risk | Check | Mitigation |
|------|-------|-----------|
| **Command injection** | All user input passed to Bun `$` must use template literal interpolation (tagged template), never string concatenation | Review all `$\`…\`` usage in adapter `execute()` methods |
| **Path traversal** | Validate all file paths from user input before passing to adapters | Reject paths containing `..`, absolute paths outside workspace |
| **Environment variable leaks** | Never log or expose env vars containing secrets (API keys, tokens) | Pino logger must redact sensitive fields; `process.env` access audited |
| **Dependency supply chain** | Audit direct + transitive dependencies | Run `bun pm ls` and check for known CVEs before each release |

#### 8.3.2 Performance Gates

| Gate | Requirement | Verification |
|------|-------------|-------------|
| Parallel health checks | `getAllHealthStatus()` must use `Promise.all` (not sequential `for` loop) | Review `src/core/adapter/AdapterRegistry.ts` — confirm `Promise.all` usage |
| Health check timeout | Each health check must have a 3000 ms timeout with `AbortController` | Verify `AbortController` + `setTimeout` pattern in adapter `healthCheck()` |
| Task execution timeout | Default 300000 ms (5 min) from `config/default.toml` `task_timeout` | Verify timeout enforcement in adapter `execute()` methods |
| No resource leaks | All `$` subprocesses must be cleaned up on timeout or error | Review `shutdown()` implementations; verify no zombie processes |

#### 8.3.3 Bun `$` Specific Checks

| Check | Current Status | Required Fix |
|-------|---------------|-------------|
| `AbortController` actually cancels subprocess | ❌ Not functional — `src/adapters/claude-code/index.ts`, `src/adapters/codex/index.ts` both declare `AbortController` but Bun's `$` does not honour it | Implement `process.kill()` fallback or Bun-native cancellation when available |
| Tagged template interpolation (no string concat) | ✅ Both existing adapters use `` $`cmd ${arg}` `` pattern | Maintain for all new adapters |
| `.quiet()` for non-interactive commands | ✅ Used in health checks | Require for all adapter `initialize()` and `healthCheck()` calls |

---

## 9. Extending CLISYS

### Adding a New Loop Type

Implement as a class in `src/loops/<name>.ts` following the `RalphLoop` / `UltraworkLoop`
pattern: constructor with options, `async execute(prompt, adapters)`, EventBus emissions
for `loop:iteration` and `loop:completed`, export a `create<Name>Loop()` factory.

---

## 10. Tech Lead Mindset & Enforcement Protocol

**You are the Tech Lead of CLISYS.** Every code generation, review, or architectural
decision you make must uphold the engineering standards defined in this document.

### 10.1 Red Lines — Immediate Blockers

If you find **any** of the following deviations, you **must** immediately flag it as a
blocker (`type: blocker`, `phase: 2`) and provide a ready-to-apply diff patch:

| Red Line | Detection | Action |
|----------|-----------|--------|
| `BaseAdapter` contract violation | New adapter missing any of the 4 abstract methods | Block PR; provide stub implementation |
| Bun-only API breach | `require()`, `child_process`, `better-sqlite3`, `node:*` imports | Block PR; provide Bun-native replacement |
| Silent error swallowing | `catch {}` or `catch (_) {}` without logging/propagation | Block PR; add proper error handling |
| Missing tests for new code | New adapter/feature without corresponding `.test.ts` file | Block PR; provide test skeleton |
| String concatenation in `$` | `$("cmd " + userInput)` instead of tagged template | Block PR — **security vulnerability** (command injection) |

### 10.2 Quality Gate Enforcement

- **Never** accept "good enough". Reject phase advancement until the 95% quality gate
  (§8.2) is passed with concrete evidence.
- Every review must include file paths, line numbers, and exact test commands.
- If a Phase 2 item lacks acceptance criteria evidence, it is **not complete** regardless
  of implementation status.

### 10.3 Proactive Debt Management

When working on any task, if you discover new technical debt or limitations:
1. Add it to §7 (Known Limitations) with severity and target phase.
2. If it is a security issue, escalate immediately by flagging in the PR description.
3. If it blocks Phase 2 completion, add it to the §5 Phase 2 table with acceptance criteria.

---

## Change Log (Third-Round Iteration — 2026-03-18)

| # | Enhancement | Sections Modified | Summary |
|---|-------------|-------------------|---------|
| 1 | **Quantified Review Protocol** | §8.2 (completely rewritten) | Replaced generic phase gate with strict 4-dimension quality gate: Completion Degree (exact %), Usability & DX (1–10), Functional Capability (1–10), Debug & Risk. Required output format enforced. 95%+ overall + all scores ≥ 9/10 to advance. |
| 2 | **Forced Chain-of-Thought + Evidence Chain** | §8 (intro paragraph), §8.2, §10.2 | Every review/advancement decision must include concrete file paths + line numbers, exact test commands, git references. "Never accept vague statements" rule added. |
| 3 | **Phase 2 Driving Power Boost** | §5 Phase 2 table | Added explicit acceptance criteria for each adapter (Gemini, Aider, OpenAgent); added ready-to-use adapter metadata template with `createXXXAdapter()` factory, `healthCheck()` example using Bun `$`; added rows for parallel health checks (with `Promise.all` + 3000 ms timeout + AbortController verification), CLI command tests, and AbortController fix. |
| 4 | **Security, Performance & Concurrency Review** | §8.3 (new subsection) | Added OWASP CLI risks (command injection, path traversal, env var leaks, supply chain); performance gates (parallel health checks, timeout handling); Bun `$` specific checks (AbortController cancellation status, tagged template enforcement, `.quiet()` requirement). |
| 5 | **Remove Redundancy & Maintenance Burden** | §6.5 removed → merged into §5 template; §7 consolidated; §9 simplified | Merged adapter pattern (old §6.5) into the Phase 2 adapter template in §5; consolidated Phase-2-specific limitations from old §7 into §5 Phase 2 table (with acceptance criteria); simplified §9 (removed duplicate adapter steps now covered by §5 template); updated `Last updated` date. |
| 6 | **Tech Lead Mindset Reinforcement** | §10 (new section) | Added red-line violation table (BaseAdapter contract, Bun-only breach, silent errors, missing tests, command injection); quality gate enforcement rules; proactive debt management protocol. |

---

**✅ Advancement Recommendation**

Based on current repository state, Phase 2 is **0% complete** (0/6 items delivered).

| Item | Status | Evidence |
|------|--------|---------|
| Gemini CLI adapter | ❌ | `src/adapters/gemini/` does not exist |
| Aider adapter | ❌ | `src/adapters/aider/` does not exist |
| OpenCode / OpenAgent adapter | ❌ | `src/adapters/openagent/` does not exist |
| Parallel health checks | ❌ | `src/core/adapter/AdapterRegistry.ts` still uses sequential checks |
| CLI command tests | ❌ | `tests/cli/` directory does not exist |
| AbortController fix | ❌ | Both adapters declare but don't functionally use `AbortController` |

**Next action:** Begin Gemini CLI adapter implementation — create `src/adapters/gemini/index.ts` using the §5 adapter template, then add `[adapters.gemini]` to `config/default.toml` and tests in `tests/adapters/gemini.test.ts`.

---

*Last updated: 2026-03-18 | Tied to CLISYS v0.1.0 (Phase 2 in progress) — update when major architecture changes occur.*
