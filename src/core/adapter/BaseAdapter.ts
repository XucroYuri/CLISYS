/**
 * CLISYS Base Adapter
 * 所有 CLI 适配器的基类，定义统一的接口契约
 */

import type {
  AdapterMetadata,
  Capability,
  ExecutionRequest,
  ExecutionResult,
  HealthCheckResult,
  HealthStatus,
  Session,
  SessionOptions,
} from './types.js';

export abstract class BaseAdapter {
  protected metadata: AdapterMetadata;
  protected sessions: Map<string, Session> = new Map();
  protected isInitialized: boolean = false;

  constructor(metadata: AdapterMetadata) {
    this.metadata = metadata;
  }

  // ============================================================================
  // 元数据访问
  // ============================================================================

  get name(): string {
    return this.metadata.name;
  }

  get version(): string {
    return this.metadata.version;
  }

  get capabilities(): Capability[] {
    return this.metadata.capabilities;
  }

  get description(): string | undefined {
    return this.metadata.description;
  }

  hasCapability(capability: Capability): boolean {
    return this.capabilities.includes(capability);
  }

  hasCapabilities(required: Capability[]): { hasAll: boolean; missing: Capability[] } {
    const missing = required.filter((cap) => !this.hasCapability(cap));
    return {
      hasAll: missing.length === 0,
      missing,
    };
  }

  // ============================================================================
  // 生命周期方法（子类必须实现）
  // ============================================================================

  /**
   * 初始化适配器
   * 检查 CLI 工具是否可用、配置是否正确等
   */
  abstract initialize(): Promise<void>;

  /**
   * 健康检查
   * 检查适配器是否正常工作
   */
  abstract healthCheck(): Promise<HealthCheckResult>;

  /**
   * 关闭适配器
   * 清理资源、关闭会话等
   */
  abstract shutdown(): Promise<void>;

  /**
   * 执行任务
   * 核心执行方法，子类必须实现
   */
  abstract execute(request: ExecutionRequest): Promise<ExecutionResult>;

  // ============================================================================
  // 会话管理（提供默认实现，子类可覆盖）
  // ============================================================================

  async createSession(options?: SessionOptions): Promise<Session> {
    const sessionId = this.generateSessionId();
    const session: Session = {
      id: sessionId,
      adapterName: this.name,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      metadata: options?.metadata,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  async getSession(sessionId: string): Promise<Session | undefined> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivityAt = new Date();
    }
    return session;
  }

  async closeSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async listSessions(): Promise<Session[]> {
    return Array.from(this.sessions.values());
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  protected generateSessionId(): string {
    return `${this.name}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  protected createSuccessResult(
    taskId: string,
    output: string,
    metadata?: ExecutionResult['metadata']
  ): ExecutionResult {
    return {
      taskId,
      adapterName: this.name,
      success: true,
      output,
      metadata,
      duration: 0,
      timestamp: new Date(),
    };
  }

  protected createErrorResult(
    taskId: string,
    error: string,
    output?: string
  ): ExecutionResult {
    return {
      taskId,
      adapterName: this.name,
      success: false,
      output: output || '',
      error,
      duration: 0,
      timestamp: new Date(),
    };
  }

  protected createHealthCheckResult(
    status: HealthStatus,
    message?: string,
    latency?: number
  ): HealthCheckResult {
    return {
      adapterName: this.name,
      status,
      latency,
      message,
      timestamp: new Date(),
    };
  }
}
