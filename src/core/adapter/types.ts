/**
 * CLISYS Core Types
 * 核心类型定义 - 整个系统的基础类型契约
 */

// ============================================================================
// 任务相关类型
// ============================================================================

export type TaskType =
  | 'code_generation'
  | 'code_review'
  | 'debugging'
  | 'refactoring'
  | 'documentation'
  | 'testing'
  | 'analysis'
  | 'search'
  | 'git_operation'
  | 'file_operation'
  | 'shell_command'
  | 'multi_step'
  | 'unknown';

export type TaskPriority = 'high' | 'medium' | 'low';

export interface TaskContext {
  workingDirectory: string;
  projectType?: string;
  language?: string;
  framework?: string;
  files?: string[];
  previousResults?: Map<string, ExecutionResult>;
  metadata?: Record<string, unknown>;
}

export interface SubTask {
  id: string;
  description: string;
  type: TaskType;
  dependencies?: string[];
  requiredCapabilities: Capability[];
}

export interface ParsedTask {
  id: string;
  type: TaskType;
  description: string;
  originalInput: string;
  subtasks: SubTask[];
  requiredCapabilities: Capability[];
  priority: TaskPriority;
  context: TaskContext;
}

// ============================================================================
// CLI 适配器相关类型
// ============================================================================

export type Capability =
  | 'code_generation'
  | 'code_editing'
  | 'code_review'
  | 'debugging'
  | 'refactoring'
  | 'documentation'
  | 'testing'
  | 'analysis'
  | 'search'
  | 'web_search'
  | 'git_integration'
  | 'file_operations'
  | 'shell_execution'
  | 'multi_modal'
  | 'long_context'
  | 'interactive';

export interface AdapterMetadata {
  name: string;
  version: string;
  description?: string;
  capabilities: Capability[];
  supportedModels?: string[];
  defaultModel?: string;
}

export interface ExecutionRequest {
  taskId: string;
  prompt: string;
  context?: TaskContext;
  options?: ExecutionOptions;
}

export interface ExecutionOptions {
  timeout?: number;
  maxRetries?: number;
  model?: string;
  temperature?: number;
  stream?: boolean;
  interactive?: boolean;
}

export interface ExecutionResult {
  taskId: string;
  adapterName: string;
  success: boolean;
  output: string;
  error?: string;
  metadata?: ResultMetadata;
  duration: number;
  timestamp: Date;
}

export interface ResultMetadata {
  tokensUsed?: number;
  model?: string;
  filesModified?: string[];
  commandsExecuted?: string[];
  additionalInfo?: Record<string, unknown>;
}

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface HealthCheckResult {
  adapterName: string;
  status: HealthStatus;
  latency?: number;
  message?: string;
  timestamp: Date;
}

// ============================================================================
// 会话相关类型
// ============================================================================

export interface Session {
  id: string;
  adapterName: string;
  createdAt: Date;
  lastActivityAt: Date;
  metadata?: SessionMetadata;
}

export interface SessionOptions {
  persistent?: boolean;
  ttl?: number;
  metadata?: SessionMetadata;
}

export interface SessionMetadata {
  projectRoot?: string;
  taskHistory?: string[];
  customData?: Record<string, unknown>;
}

// ============================================================================
// 分发策略类型
// ============================================================================

export type DispatchStrategyType = 'capability_based' | 'cost_optimized' | 'performance_based' | 'round_robin';

export interface DispatchStrategy {
  type: DispatchStrategyType;
  capabilityBased?: {
    matchThreshold: number;
    fallbackChain: string[];
  };
  costOptimized?: {
    preferFree: boolean;
    budgetLimit?: number;
  };
  performanceBased?: {
    maxLatency: number;
    parallelExecution: boolean;
  };
}

export interface AdapterScore {
  adapterName: string;
  score: number;
  matchedCapabilities: Capability[];
  missingCapabilities: Capability[];
}

// ============================================================================
// Loop 机制类型
// ============================================================================

export type LoopType = 'ralph' | 'ultrawork' | 'adaptive';

export interface LoopConfig {
  type: LoopType;
  maxIterations: number;
  timeout?: number;
}

export interface RalphLoopConfig extends LoopConfig {
  type: 'ralph';
  completionCheck: (result: ExecutionResult) => boolean | Promise<boolean>;
  onIteration?: (iteration: number, result: ExecutionResult) => void;
  onError?: (error: Error, iteration: number) => 'retry' | 'fallback' | 'abort';
}

export interface UltraworkLoopConfig extends LoopConfig {
  type: 'ultrawork';
  parallelAdapters: string[];
  aggregationStrategy: 'best_result' | 'merge' | 'vote';
  onProgress?: (adapterName: string, progress: unknown) => void;
}

// ============================================================================
// 配置相关类型
// ============================================================================

export interface CLISYSConfig {
  version: string;
  adapters: AdapterConfig[];
  orchestrator: OrchestratorConfig;
  logging: LoggingConfig;
  session: SessionConfig;
}

export interface AdapterConfig {
  name: string;
  enabled: boolean;
  command?: string;
  defaultModel?: string;
  capabilities?: Capability[];
  config?: Record<string, unknown>;
}

export interface OrchestratorConfig {
  defaultStrategy: DispatchStrategyType;
  maxParallelTasks: number;
  taskTimeout: number;
}

export interface LoggingConfig {
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  output: 'console' | 'file' | 'both';
  filePath?: string;
}

export interface SessionConfig {
  persistent: boolean;
  storagePath: string;
  ttl: number;
}

// ============================================================================
// 事件类型
// ============================================================================

export type CLISYSEventType =
  | 'task:parsed'
  | 'task:dispatched'
  | 'task:completed'
  | 'task:failed'
  | 'adapter:started'
  | 'adapter:completed'
  | 'adapter:error'
  | 'loop:iteration'
  | 'loop:completed'
  | 'session:created'
  | 'session:closed';

export interface CLISYSEvent {
  type: CLISYSEventType;
  timestamp: Date;
  payload: unknown;
  metadata?: Record<string, unknown>;
}
