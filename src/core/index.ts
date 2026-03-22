/**
 * CLISYS Core Module
 */

// Adapter exports
export { BaseAdapter } from './adapter/BaseAdapter.js';
export { AdapterRegistry } from './adapter/AdapterRegistry.js';
export type {
  AdapterMetadata,
  Capability,
  ExecutionRequest,
  ExecutionResult,
  ExecutionOptions,
  HealthCheckResult,
  HealthStatus,
  Session as AdapterSession,
  SessionOptions,
  SessionMetadata,
  ResultMetadata,
  TaskType,
  TaskPriority,
  TaskContext,
  SubTask,
  ParsedTask,
  DispatchStrategyType,
  DispatchStrategy,
  AdapterScore,
  LoopType,
  RalphLoopConfig,
  UltraworkLoopConfig,
  CLISYSEventType,
  CLISYSEvent,
} from './adapter/types.js';

// Orchestrator exports
export { TaskParser } from './orchestrator/TaskParser.js';
export { Dispatcher } from './orchestrator/Dispatcher.js';
export { Aggregator } from './orchestrator/Aggregator.js';
export { LoopManager } from './orchestrator/LoopManager.js';

// Storage exports
export { initDatabase, getDatabase, closeDatabase } from './storage/db.js';
export { SessionStorage, getSessionStorage } from './storage/session.js';
export type {
  Session,
  NewSession,
  Execution,
  NewExecution,
  Task,
  NewTask,
  Subtask,
  NewSubtask,
  EventLog,
  NewEventLog,
} from './storage/schema.js';

// Config exports
export {
  loadConfig,
  loadFromTOML,
  saveToTOML,
  getDefaultConfig,
  getConfig,
  setConfig,
  reloadConfig,
} from './config/loader.js';
export type {
  AdapterConfig,
  OrchestratorConfig,
  LoggingConfig,
  SessionConfig,
  PluginsConfig,
  CLISYSConfig,
} from './config/loader.js';

// Bus exports
export { EventBus, getEventBus, createEventBus } from './bus/index.js';
export type { EventCallback, BusStats } from './bus/index.js';

// Logger exports
export { createLogger, getLogger, setLogger, createChildLogger } from './logger/index.js';
export type { LoggerOptions, LogLevel } from './logger/index.js';

// Provider exports
export { ProviderRegistry } from './providers/registry.js';
export type {
  ProviderName,
  ProviderScope,
  ProviderRequest,
  ProviderDetectionResult,
  ProviderPlan,
  ProviderPlanStep,
  ProviderExecutionResult,
  ToolchainProvider,
} from './providers/types.js';

// Toolchain exports
export { ToolchainStateStore } from './toolchain/state-store.js';
export { ToolchainLockManager } from './toolchain/locks.js';
export {
  DEFAULT_TOOLCHAIN_POLICY,
  evaluateToolchainPolicy,
} from './toolchain/policy-gate.js';
export { ToolchainAuditLog } from './toolchain/audit.js';
export { calculateTrustScore } from './toolchain/trust-score.js';
export type {
  ToolchainState,
  ToolchainStateRecord,
} from './toolchain/state-store.js';
export type {
  ToolchainLockHandle,
} from './toolchain/locks.js';
export type {
  ToolchainPolicy,
  ToolchainPolicyInput,
  ToolchainPolicyDecision,
} from './toolchain/policy-gate.js';
export type {
  ToolchainAuditEvent,
} from './toolchain/audit.js';
export type {
  TrustScoreSummary,
} from './toolchain/trust-score.js';

// Plugin exports
export { PluginRegistry } from './plugins/registry.js';
export { loadPluginFromDirectory } from './plugins/loader.js';
export { discoverPlugins } from './plugins/discovery.js';
export {
  createPluginManifest,
  createPluginManifestBuilder,
  defineAdapterPlugin,
} from './plugins/sdk.js';
export {
  PluginManifestSchema,
  PluginSchemaSchema,
  PluginIdentitySchema,
  PluginEntrypointSchema,
  PluginAdapterSchema,
  PluginInstallSchema,
  PluginCompatibilitySchema,
  PluginDeclarationsSchema,
  CapabilitySchema,
  CLISYS_CAPABILITIES,
} from './plugins/manifest.js';
export {
  validatePluginManifest,
} from './plugins/validator.js';
export type {
  RegisteredPlugin,
} from './plugins/registry.js';
export type {
  PluginLoaderOptions,
  LoadedPluginModule,
} from './plugins/loader.js';
export type {
  AdapterPluginFactory,
  AdapterPluginDefinition,
} from './plugins/sdk.js';
export type {
  PluginManifest,
  PluginSchema,
  PluginIdentity,
  PluginEntrypoint,
  PluginInstall,
  PluginCompatibility,
  PluginDeclarations,
  PluginAdapter,
  PluginCapability,
} from './plugins/manifest.js';
