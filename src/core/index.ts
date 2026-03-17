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
  CLISYSConfig,
} from './config/loader.js';

// Bus exports
export { EventBus, getEventBus, createEventBus } from './bus/index.js';
export type { EventCallback, BusStats } from './bus/index.js';

// Logger exports
export { createLogger, getLogger, setLogger, createChildLogger } from './logger/index.js';
export type { LoggerOptions, LogLevel } from './logger/index.js';
