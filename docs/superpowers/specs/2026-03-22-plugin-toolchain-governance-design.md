# CLISYS Plugin Toolchain Governance Design

> Plugin-first adapter platform with managed install, upgrade, verification, rollback, and audit capabilities.

## Goal

Evolve CLISYS from a small set of built-in adapters into a plugin-first multi-CLI orchestration platform that can safely discover, install, upgrade, verify, and quarantine external CLI toolchains across macOS, Linux, and Windows.

## Constraints

- Distribution strategy: plugin-first (`@clisys/adapter-*`)
- Permission strategy: user-scope installs may auto-run; system-scope or destructive changes require confirmation
- Provider strategy: support `brew`, `npm`, `pipx`, `cargo`, and direct binary download
- Platform scope: macOS, Linux, Windows
- Networking: allowed by default for version checks, metadata fetches, and downloads

## Section 1: High-Level Architecture

CLISYS should be split into:

- `plugin-runtime`: discovery, loading, validation, and compatibility checks for plugin packages
- `toolchain-manager`: detect, plan, policy-check, execute, verify, rollback, and register toolchains
- `provider-engine`: concrete install/upgrade backends (`brew`, `npm`, `pipx`, `cargo`, `binary`)
- `plugin manifests`: declarative metadata describing capabilities, compatibility, install sources, and lifecycle declarations

The core owns all privileged and stateful behavior. Plugins declare facts and adapter behavior, but never directly execute installation logic.

## Section 2: Permission and Upgrade Strategy

The platform should enforce:

- `user-scope auto`: user-directory installs and non-breaking patch/minor upgrades may auto-run
- `system-scope confirm`: actions that write system locations or require elevated privileges always require confirmation
- `destructive confirm`: uninstall, downgrade, force reinstall, source replacement, or major upgrades always require confirmation
- `policy overrides`: users/projects can pin versions, disable providers, or force confirmation per tool

Install and upgrade flow:

1. Detect current state
2. Build an install/upgrade plan
3. Apply policy gate
4. Execute through provider engine
5. Verify with version/health/smoke checks
6. Promote or rollback

## Section 3: Manifest / Provider / Manager Structure

### Plugin Manifest

The manifest must remain publish-time, declarative metadata. Required groups:

- `schema`: `manifestVersion`, `kind`
- `identity`: `id`, `packageName`, `version`, `displayName`, `provider`, `description`
- `entrypoint`: `module`, `export`, `pluginApiVersion`
- `adapter`: `capabilities`, `supportedModels`, `defaultModel`, feature flags
- `install`: strict provider descriptors and package coordinates
- `compatibility`: CLISYS version range, OS/arch/runtime support, CLI version range
- `declarations`: network, env, write targets, subprocess behavior

Manifest data must not include mutable runtime state such as detected binary path, health status, confirmation history, or current install selection.

### Provider Engine

Each provider must implement:

- `detect`
- `planInstall`
- `install`
- `planUpgrade`
- `upgrade`
- `verify`
- `uninstall`

All providers must support allowlists, dry-run planning, timeouts, retries, locks, temporary staging, atomic promotion, and structured audit events.

### Toolchain Manager

The manager should orchestrate:

- resolution of required adapters/toolchains
- detection of current state
- plan generation
- policy gating
- provider execution
- verification
- rollback/quarantine
- activation/registration

## Section 4: State Machine / Audit / Maintenance

Each `tool@scope@provider` should move through explicit states:

- `undetected`
- `missing`
- `plan_ready`
- `awaiting_confirmation`
- `installing`
- `installed_unverified`
- `verified`
- `active`
- `upgrade_available`
- `upgrading`
- `rollback_pending`
- `rolled_back`
- `degraded`
- `incompatible`
- `blocked_by_policy`
- `quarantined`

Only verified tools can become active. Failed or incompatible toolchains must not be routed into dispatch.

Every lifecycle action must emit append-only audit records including actor, reason, provider, scope, version transition, source, digest, policy decision, verification result, health result, rollback result, and duration.

Foreground task fulfillment and background maintenance must be separated. Maintenance handles metadata refresh, health checks, safe user-scope upgrades, cache cleanup, and quarantine refresh under rate limits, backoff, coalescing, and maintenance windows.

## Section 5: Failure Recovery / Quarantine / Trust Scoring

All install/upgrade actions must be transactional:

- stage into temp location
- verify artifact and version
- run health/smoke checks
- atomically promote
- rollback automatically on failure

Bad artifacts or versions enter quarantine and cannot be automatically reactivated until metadata or policy changes.

The platform should maintain trust scores for providers, artifacts, plugins, and active toolchains using:

- source trust and verification quality
- install/upgrade success rates
- rollback frequency
- health-check stability
- compatibility stability

The core boundary is strict:

- plugins declare facts and constraints
- provider engine executes approved lifecycle actions
- toolchain manager decides what may happen and when

## Security and Stability Requirements

- Provider identity and source must be allowlisted and pinned
- Plugin/provider execution is untrusted by default and runs with least privilege
- Installs/upgrades must be transactional and locked
- Artifacts must be verified before activation
- Rollback is mandatory
- Auto actions are limited to user-scope, non-destructive operations
- Caches are content-addressed and trust-aware
- Rate limiting, backoff, and circuit breaking are first-class
- Post-install verification is a promotion gate

## Intended Follow-up

Write an implementation plan and execute it task-by-task using `subagent-driven-development`.
