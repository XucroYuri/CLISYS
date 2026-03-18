# Changelog

All notable changes to CLISYS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Comprehensive `CONTRIBUTING.md` with adapter authoring guide and maintainer onboarding
- `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1)
- `SECURITY.md` with responsible disclosure policy and known security considerations
- `CHANGELOG.md` (this file)
- Chinese documentation (`README.zh-CN.md`)
- Normalized development roadmap (`docs/roadmap.md`)
- GitHub issue templates (bug report, feature request, adapter request, maintainer interest)
- GitHub pull request template
- `.gitignore` entries for AI development tool configs (`.claude/`, `.sisyphus/`, `.cursor/`, `.windsurf/`, `.aider/`) and internal planning docs (`docs/archive/`, `docs/reference/`)

### Changed
- Redesigned `README.md` with badges, detailed sections, inspirations/credits, multilingual links, and project status table
- Moved internal brainstorm and analysis documents to `docs/archive/` (gitignored)

---

## [0.1.0] — 2026-03-17

### Added
- Core orchestration engine:
  - `TaskParser` — intent extraction and capability requirement detection
  - `Dispatcher` — four dispatch strategies: capability-based, cost-based, performance-based, round-robin
  - `Aggregator` — three aggregation strategies: best_result, merge, vote
  - `LoopManager` — manages Ralph Loop and Ultrawork Loop
- Adapter framework:
  - `BaseAdapter` — abstract base class with session management and health checks
  - `AdapterRegistry` — adapter lifecycle management and capability scoring
- Adapters:
  - `ClaudeCodeAdapter` — full Claude Code CLI integration
  - `CodexAdapter` — full OpenAI Codex CLI integration
- Loop mechanisms:
  - `RalphLoop` — self-referential iterative execution
  - `UltraworkLoop` — parallel multi-adapter execution
- Infrastructure:
  - `EventBus` — event-driven architecture for monitoring and hooks
  - Configuration system — TOML-based with Zod validation and multi-level override
  - Storage — SQLite + Drizzle ORM for session persistence and execution history
  - Logger — Pino-based structured logging
- CLI interface (Clipanion):
  - `run` command — execute tasks
  - `adapters` command — list and inspect adapters
  - `config` command — view and manage configuration
- Test suite — 24/24 tests passing (Vitest)
- TypeScript strict mode compilation — 0 errors

[Unreleased]: https://github.com/XucroYuri/CLISYS/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/XucroYuri/CLISYS/releases/tag/v0.1.0
