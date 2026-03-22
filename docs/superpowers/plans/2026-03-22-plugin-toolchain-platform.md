# Plugin Toolchain Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a plugin-first adapter platform with safe multi-provider CLI installation, upgrade, verification, rollback, and audit capabilities.

**Architecture:** Add a manifest-driven plugin runtime, a provider registry for install/upgrade backends, and a policy-gated toolchain manager that owns detection, planning, execution, verification, rollback, and registration. Keep plugin manifests declarative and move all privileged behavior into core-managed execution paths.

**Tech Stack:** TypeScript, Bun, Zod, Clipanion, existing CLISYS adapter/core modules, filesystem-based state and audit persistence.

---

### Task 1: Define plugin manifest schema and validator

**Files:**
- Create: `src/core/plugins/manifest.ts`
- Create: `src/core/plugins/validator.ts`
- Test: `tests/core/plugin-manifest.test.ts`

- [ ] Write failing manifest validation tests for required sections
- [ ] Run `bun test tests/core/plugin-manifest.test.ts`
- [ ] Implement strict Zod schemas and typed exports
- [ ] Implement semantic validation rules
- [ ] Re-run `bun test tests/core/plugin-manifest.test.ts`

### Task 2: Build plugin registry and dynamic loader

**Files:**
- Create: `src/core/plugins/registry.ts`
- Create: `src/core/plugins/loader.ts`
- Modify: `src/core/index.ts`
- Test: `tests/core/plugin-loader.test.ts`

- [ ] Write failing tests for plugin discovery, compatibility gating, and loading
- [ ] Run `bun test tests/core/plugin-loader.test.ts`
- [ ] Implement registry for discovered plugin manifests
- [ ] Implement dynamic loader with `pluginApiVersion` checks
- [ ] Re-run `bun test tests/core/plugin-loader.test.ts`

### Task 3: Create provider engine interfaces

**Files:**
- Create: `src/core/providers/types.ts`
- Create: `src/core/providers/registry.ts`
- Test: `tests/core/provider-registry.test.ts`

- [ ] Write failing tests for provider registration and allowlist enforcement
- [ ] Run `bun test tests/core/provider-registry.test.ts`
- [ ] Implement provider interfaces and registry
- [ ] Re-run `bun test tests/core/provider-registry.test.ts`

### Task 4: Add toolchain state machine and lock manager

**Files:**
- Create: `src/core/toolchain/state-store.ts`
- Create: `src/core/toolchain/locks.ts`
- Test: `tests/core/toolchain-state.test.ts`

- [ ] Write failing tests for legal state transitions and per-tool locks
- [ ] Run `bun test tests/core/toolchain-state.test.ts`
- [ ] Implement typed state machine
- [ ] Implement per-tool lock manager
- [ ] Re-run `bun test tests/core/toolchain-state.test.ts`

### Task 5: Implement policy gate and risk classification

**Files:**
- Create: `src/core/toolchain/policy-gate.ts`
- Test: `tests/core/toolchain-policy.test.ts`

- [ ] Write failing tests for user-scope auto actions and protected confirmations
- [ ] Run `bun test tests/core/toolchain-policy.test.ts`
- [ ] Implement policy gate with risk labels
- [ ] Re-run `bun test tests/core/toolchain-policy.test.ts`

### Task 6: Implement provider backends

**Files:**
- Create: `src/core/providers/brew.ts`
- Create: `src/core/providers/npm.ts`
- Create: `src/core/providers/pipx.ts`
- Create: `src/core/providers/cargo.ts`
- Create: `src/core/providers/binary.ts`
- Test: `tests/core/providers-brew.test.ts`
- Test: `tests/core/providers-npm.test.ts`
- Test: `tests/core/providers-pipx.test.ts`
- Test: `tests/core/providers-cargo.test.ts`
- Test: `tests/core/providers-binary.test.ts`

- [ ] Write failing tests for provider planning and dry-run execution
- [ ] Implement provider backends with source and scope enforcement
- [ ] Re-run provider test suite

### Task 7: Implement toolchain manager orchestration

**Files:**
- Create: `src/core/toolchain/manager.ts`
- Create: `src/core/toolchain/planner.ts`
- Create: `src/core/toolchain/detector.ts`
- Create: `src/core/toolchain/verifier.ts`
- Test: `tests/core/toolchain-manager.test.ts`

- [ ] Write failing orchestration tests for detect -> plan -> execute -> verify -> activate
- [ ] Run `bun test tests/core/toolchain-manager.test.ts`
- [ ] Implement orchestration flow with rollback and quarantine
- [ ] Re-run `bun test tests/core/toolchain-manager.test.ts`

### Task 8: Add audit logging and trust scoring

**Files:**
- Create: `src/core/toolchain/audit.ts`
- Create: `src/core/toolchain/trust-score.ts`
- Test: `tests/core/toolchain-audit.test.ts`

- [ ] Write failing tests for append-only audit events and trust score updates
- [ ] Run `bun test tests/core/toolchain-audit.test.ts`
- [ ] Implement audit writer and trust score logic
- [ ] Re-run `bun test tests/core/toolchain-audit.test.ts`

### Task 9: Integrate plugin-backed adapters into CLI flows

**Files:**
- Modify: `src/cli/commands/adapters.ts`
- Modify: `src/cli/commands/run.ts`
- Modify: `src/core/config/loader.ts`
- Modify: `src/adapters/catalog.ts`
- Test: `tests/cli/adapters-command.test.ts`
- Test: `tests/cli/run-command-adapter.test.ts`

- [ ] Write failing CLI tests for plugin-backed adapter discovery and toolchain gating
- [ ] Run targeted CLI tests
- [ ] Integrate plugin runtime and toolchain manager into CLI flows
- [ ] Re-run targeted CLI tests

### Task 10: Add background maintenance queue

**Files:**
- Create: `src/core/toolchain/maintenance-queue.ts`
- Test: `tests/core/toolchain-maintenance.test.ts`

- [ ] Write failing tests for coalescing, rate limiting, backoff, and maintenance windows
- [ ] Run `bun test tests/core/toolchain-maintenance.test.ts`
- [ ] Implement maintenance queue for metadata refresh and safe upgrades
- [ ] Re-run `bun test tests/core/toolchain-maintenance.test.ts`

### Task 11: Publish plugin SDK surface

**Files:**
- Create: `src/core/plugins/sdk.ts`
- Modify: `README.md`
- Modify: `docs/roadmap.md`
- Test: `tests/core/plugin-sdk.test.ts`

- [ ] Write failing tests for manifest builder helpers and SDK ergonomics
- [ ] Run `bun test tests/core/plugin-sdk.test.ts`
- [ ] Implement SDK exports and documentation updates
- [ ] Re-run `bun test tests/core/plugin-sdk.test.ts`

### Task 12: Final verification

**Files:**
- Verify: entire repo

- [ ] Run `bun run typecheck`
- [ ] Run `bun test`
- [ ] Run focused CLI smoke checks
- [ ] Review rollback and quarantine paths
