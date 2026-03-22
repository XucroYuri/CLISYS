# CLISYS Development Roadmap

> A technical guide for contributors and maintainers. This document is forward-looking and welcomes dissenting views — the goal is to converge on the best path forward through open discussion.

---

## Vision Statement

CLISYS is designed to evolve from a **Meta-CLI Orchestrator** into an **Agentic Execution Fabric** — a composable, extensible infrastructure layer that enables AI-powered CLI tools to collaborate intelligently on complex tasks.

The long-term ambition is not to replace individual AI CLI tools, but to provide the coordination layer that allows them to exceed what any single tool can achieve alone.

---

## Current State (main branch)

The MVP is production-ready with:

- Core orchestration engine (TaskParser → Dispatcher → Aggregator)
- Claude Code, Codex CLI, and Gemini CLI adapters
- Ralph Loop (iterative self-refinement) and Ultrawork Loop (parallel execution)
- TOML-based configuration with Zod validation
- SQLite + Drizzle ORM session persistence
- 147/147 tests passing, TypeScript strict-mode clean

**Runtime:** TypeScript / Bun (near-native performance; I/O-bound workloads dominate)

---

## Phase Roadmap

### Phase 1 — MVP ✅ (v0.1.0)

Foundation: core types, orchestrator framework, three built-in adapters, loop mechanisms, config and storage systems.

---

### Phase 2 — Extended Adapter Support (v0.2.x)

**Goal:** Broaden the ecosystem of first-class adapters.

| Adapter | Status | Notes |
|---------|--------|-------|
| OpenCode / Oh My OpenAgent | Planned | Key inspiration source; first-class support |
| Aider | Planned | Git-aware coding assistant |
| Continue.dev | Under evaluation | IDE-integrated model |
| Cursor API | Under evaluation | Programmatic access if exposed |

**Technical decisions:**
- Each adapter must extend `BaseAdapter` and implement the standard `ExecutionRequest → ExecutionResult` contract.
- Adapters should be distributable as separate npm packages (`@clisys/adapter-*`) to allow independent versioning.
- Health-check parallelisation (via `Promise.all`) should land in this phase.
- The core should expose manifest validation, plugin discovery/loading, provider backends, toolchain gating, audit logging, and trust scoring as first-class extension points.

---

### Phase 3 — Plugin Architecture & Streaming (v0.3.x)

**Goal:** Enable the community to build and publish adapters without forking CLISYS core.

**Key deliverables:**
- Dynamic plugin loader (`PluginLoader` class, import-based)
- Official adapter plugin spec (`AdapterPlugin` interface + JSON manifest)
- Registry of community adapters (docs + optional npm org scope)
- Streaming output support (`AsyncGenerator`-based pipeline from adapter to aggregator to CLI)
- Adapter capability scoring cache (5 s TTL, avoids redundant scoring)

**Architectural note:** Streaming changes the aggregator contract. Design the streaming interface (`StreamingAdapter`) as opt-in so existing adapters remain valid.

---

### Phase 4 — Enterprise & Governance Features (v0.5.x)

**Goal:** Make CLISYS safe and auditable in team and enterprise contexts.

| Feature | Rationale |
|---------|-----------|
| Permission / ACL system | Control which adapters a user/project may invoke |
| Execution sandbox | Prevent rogue adapters from accessing unintended system resources |
| Structured audit log | Immutable record of task dispatches and results |
| Rate limiting & quotas | Protect against runaway loops and API cost explosions |
| Secrets management | Secure handling of API keys across adapters |

**Open question:** Should CLISYS offer a server-mode (HTTP/gRPC) for team-shared orchestration, or remain a local CLI tool? Both models are valid; a decision should be made before Phase 4 begins.

---

### Phase 5 — Ecosystem & Distribution (v1.0.0)

**Goal:** First stable public release with a healthy community.

- Complete, versioned public API documentation
- Adapter SDK and scaffolding CLI (`clisys create-adapter`)
- Performance benchmarks and SLA guidelines
- Example repository (showcasing real use cases)
- GitHub Discussions / Discord community
- Binary distribution (standalone executable via Bun's single-binary output)

---

## Technical Debt & Known Limitations

| Item | Severity | Suggested Resolution |
|------|----------|---------------------|
| TaskParser uses keyword matching only | Medium | Add intent classification (embeddings or lightweight LLM call) in v0.3 |
| Sequential health checks in some paths | Low | Replace with `Promise.all`-based parallel checks |
| No streaming output | Medium | Implement `AsyncGenerator` pipeline (Phase 3) |
| No adapter isolation / sandboxing | High (long-term) | Container or WASM sandbox (Phase 4) |
| Limited CLI integration coverage | Medium | Expand command-level and end-to-end suites |
| No integration / E2E tests | Low (MVP) | Add in Phase 3 |

---

## Language & Runtime Strategy

**Decision: Continue with TypeScript / Bun for the foreseeable future.**

The workload is I/O-bound (external CLI processes dominate latency). A Rust or Go core would not materially improve end-to-end throughput.

Conditions that would trigger a revisit:
- Supporting 50+ concurrent adapters simultaneously
- Sub-50 ms internal orchestration overhead required
- Single-binary distribution without Bun runtime dependency becomes critical

A hybrid approach (native core via FFI, TS adapter layer) remains a valid long-term option but carries significant build-system complexity.

---

## Contribution Priorities

For first-time contributors, the highest-value areas are:

1. **New adapters** — any popular AI CLI tool not yet supported
2. **Test coverage** — CLI command tests, integration tests, edge-case tests
3. **Documentation** — usage examples, configuration guide, adapter authoring guide
4. **Performance** — parallel health checks, score caching

See [CONTRIBUTING.md](../CONTRIBUTING.md) for setup instructions.

---

## Open Questions & Dissenting Views Welcome

- **Protocol between core and adapters:** Direct subprocess vs. gRPC vs. stdio JSON-RPC? The current subprocess model is simple but limits language diversity for adapters.
- **Monetisation and licensing:** Is MIT the right long-term licence, or should enterprise use require a commercial licence? (See [LICENSE](../LICENSE) and the licence discussion in [README.md](../README.md).)
- **Server mode:** Local CLI vs. team-shared HTTP service. Both are valid; a clear decision is needed before Phase 4.
- **AI-assisted orchestration:** Should the Dispatcher itself use an LLM for routing decisions? Could improve quality but adds latency and cost.

---

*Last updated: 2026-03-22 | Version tracked in `package.json`*
