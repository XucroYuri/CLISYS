/**
 * CLISYS Adapter Registry
 * 适配器注册表 - 管理所有 CLI 适配器的注册、发现和生命周期
 */

import type { BaseAdapter } from './BaseAdapter.js';
import type { Capability, HealthCheckResult, AdapterScore } from './types.js';
import { createChildLogger } from '../logger/index.js';

const logger = createChildLogger('adapter-registry');

export interface RegistryOptions {
  healthCheckInterval?: number;
  enableHealthCheck?: boolean;
}

export class AdapterRegistry {
  private adapters: Map<string, BaseAdapter> = new Map();
  private healthStatus: Map<string, HealthCheckResult> = new Map();
  private healthCheckInterval?: ReturnType<typeof setInterval>;
  private options: RegistryOptions;

  constructor(options: RegistryOptions = {}) {
    this.options = {
      healthCheckInterval: 60000, // 默认 1 分钟
      enableHealthCheck: true,
      ...options,
    };
  }

  // ============================================================================
  // 注册管理
  // ============================================================================

  /**
   * 注册适配器
   */
  async register(adapter: BaseAdapter): Promise<void> {
    if (this.adapters.has(adapter.name)) {
      throw new Error(`Adapter "${adapter.name}" is already registered`);
    }

    // 初始化适配器
    await adapter.initialize();

    this.adapters.set(adapter.name, adapter);

    // 执行初始健康检查
    if (this.options.enableHealthCheck) {
      await this.performHealthCheck(adapter.name);
    }
  }

  /**
   * 注销适配器
   */
  async unregister(name: string): Promise<void> {
    const adapter = this.adapters.get(name);
    if (!adapter) {
      throw new Error(`Adapter "${name}" not found`);
    }

    await adapter.shutdown();
    this.adapters.delete(name);
    this.healthStatus.delete(name);
  }

  /**
   * 获取适配器
   */
  get(name: string): BaseAdapter | undefined {
    return this.adapters.get(name);
  }

  /**
   * 获取所有已注册的适配器
   */
  getAll(): BaseAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * 获取所有适配器名称
   */
  getNames(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * 检查适配器是否已注册
   */
  has(name: string): boolean {
    return this.adapters.has(name);
  }

  // ============================================================================
  // 能力发现
  // ============================================================================

  /**
   * 根据能力查找适配器
   */
  findByCapability(capability: Capability): BaseAdapter[] {
    return this.getAll().filter((adapter) => adapter.hasCapability(capability));
  }

  /**
   * 根据多个能力查找适配器
   */
  findByCapabilities(capabilities: Capability[]): BaseAdapter[] {
    return this.getAll().filter((adapter) => {
      const { hasAll } = adapter.hasCapabilities(capabilities);
      return hasAll;
    });
  }

  /**
   * 为任务匹配合适的适配器并打分
   */
  scoreAdapters(requiredCapabilities: Capability[]): AdapterScore[] {
    const scores: AdapterScore[] = [];

    for (const adapter of this.getAll()) {
      const { hasAll, missing } = adapter.hasCapabilities(requiredCapabilities);
      const matchedCapabilities = requiredCapabilities.filter((cap) =>
        adapter.hasCapability(cap)
      );

      // 计算匹配分数
      // 如果缺少必要能力，分数为 0
      // 否则根据匹配能力数量和健康状态打分
      let score = 0;

      if (hasAll) {
        // 基础分：能力匹配率
        score = (matchedCapabilities.length / requiredCapabilities.length) * 100;

        // 健康状态加成
        const health = this.healthStatus.get(adapter.name);
        if (health) {
          switch (health.status) {
            case 'healthy':
              score += 20;
              break;
            case 'degraded':
              score += 10;
              break;
            case 'unhealthy':
              score = 0; // 不健康的不使用
              break;
          }
        }
      }

      scores.push({
        adapterName: adapter.name,
        score,
        matchedCapabilities,
        missingCapabilities: missing,
      });
    }

    // 按分数降序排序
    return scores.sort((a, b) => b.score - a.score);
  }

  /**
   * 获取最佳匹配的适配器
   */
  getBestAdapter(requiredCapabilities: Capability[]): BaseAdapter | undefined {
    const scores = this.scoreAdapters(requiredCapabilities);
    const best = scores[0];

    if (!best || best.score === 0) {
      return undefined;
    }

    return this.adapters.get(best.adapterName);
  }

  // ============================================================================
  // 健康检查
  // ============================================================================

  /**
   * 执行单个适配器的健康检查
   */
  async performHealthCheck(name: string): Promise<HealthCheckResult> {
    const adapter = this.adapters.get(name);
    if (!adapter) {
      throw new Error(`Adapter "${name}" not found`);
    }

    const result = await adapter.healthCheck();
    this.healthStatus.set(name, result);
    return result;
  }

  /**
   * 执行所有适配器的健康检查（并行执行，每个适配器3000ms超时）
   */
  async performHealthCheckAll(): Promise<Map<string, HealthCheckResult>> {
    const results = new Map<string, HealthCheckResult>();
    const HEALTH_CHECK_TIMEOUT = 3000;

    const healthCheckPromises = Array.from(this.adapters.keys()).map(async (name) => {
      const adapter = this.adapters.get(name);
      if (!adapter) {
        return {
          name,
          result: {
            adapterName: name,
            status: 'unhealthy' as const,
            message: 'Adapter not found',
            timestamp: new Date(),
          },
        };
      }

      const timeoutPromise = new Promise<{ name: string; result: HealthCheckResult }>((resolve) => {
        setTimeout(() => {
          resolve({
            name,
            result: {
              adapterName: name,
              status: 'unhealthy' as const,
              message: 'Health check timed out after 3000ms',
              timestamp: new Date(),
            },
          });
        }, HEALTH_CHECK_TIMEOUT);
      });

      const healthCheckPromise = adapter.healthCheck()
        .then((result) => ({ name, result }))
        .catch((error) => ({
          name,
          result: {
            adapterName: name,
            status: 'unhealthy' as const,
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
          },
        }));

      return Promise.race([healthCheckPromise, timeoutPromise]);
    });

    const checkResults = await Promise.all(healthCheckPromises);

    for (const { name, result } of checkResults) {
      results.set(name, result);
      this.healthStatus.set(name, result);
    }

    return results;
  }

  /**
   * 获取适配器的健康状态
   */
  getHealthStatus(name: string): HealthCheckResult | undefined {
    return this.healthStatus.get(name);
  }

  /**
   * 获取所有适配器的健康状态
   */
  getAllHealthStatus(): Map<string, HealthCheckResult> {
    return new Map(this.healthStatus);
  }

  /**
   * 启动定期健康检查
   */
  startHealthCheckLoop(): void {
    if (this.healthCheckInterval) {
      return;
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheckAll();
    }, this.options.healthCheckInterval);
  }

  /**
   * 停止定期健康检查
   */
  stopHealthCheckLoop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  // ============================================================================
  // 生命周期
  // ============================================================================

  /**
   * 初始化所有适配器并启动健康检查
   */
  async start(): Promise<void> {
    if (this.options.enableHealthCheck) {
      this.startHealthCheckLoop();
    }
  }

  /**
   * 关闭所有适配器
   */
  async shutdown(): Promise<void> {
    this.stopHealthCheckLoop();

    const shutdownPromises = Array.from(this.adapters.values()).map((adapter) =>
      adapter.shutdown().catch((error) => {
        logger.error({ adapter: adapter.name, error }, 'Failed to shutdown adapter');
      })
    );

    await Promise.all(shutdownPromises);
    this.adapters.clear();
    this.healthStatus.clear();
  }
}
