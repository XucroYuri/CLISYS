/**
 * CLISYS Dispatcher
 * 任务分发器 - 将任务智能分发到最合适的 CLI 适配器
 */

import type { AdapterRegistry } from '../adapter/AdapterRegistry.js';
import type {
  ParsedTask,
  SubTask,
  DispatchStrategy,
  DispatchStrategyType,
  ExecutionRequest,
  ExecutionResult,
  AdapterScore,
} from '../adapter/types.js';

export interface DispatcherOptions {
  defaultStrategy?: DispatchStrategyType;
  maxParallelTasks?: number;
  taskTimeout?: number;
  fallbackEnabled?: boolean;
}

export interface DispatchResult {
  taskId: string;
  results: ExecutionResult[];
  selectedAdapters: string[];
  strategy: DispatchStrategyType;
}

export class Dispatcher {
  private registry: AdapterRegistry;
  private options: Required<DispatcherOptions>;

  constructor(registry: AdapterRegistry, options: DispatcherOptions = {}) {
    this.registry = registry;
    this.options = {
      defaultStrategy: options.defaultStrategy ?? 'capability_based',
      maxParallelTasks: options.maxParallelTasks ?? 3,
      taskTimeout: options.taskTimeout ?? 300000, // 5 分钟
      fallbackEnabled: options.fallbackEnabled ?? true,
    };
  }

  /**
   * 分发任务到合适的适配器
   */
  async dispatch(task: ParsedTask, strategy?: DispatchStrategy): Promise<DispatchResult> {
    const strategyType = strategy?.type ?? this.options.defaultStrategy;
    const selectedAdapters: string[] = [];
    const results: ExecutionResult[] = [];

    // 根据策略选择适配器
    const adapterScores = this.selectAdapters(task, strategy);

    if (adapterScores.length === 0 || adapterScores[0].score === 0) {
      throw new Error(`No suitable adapter found for task type: ${task.type}`);
    }

    // 执行任务
    for (const subtask of task.subtasks) {
      const adapter = this.selectAdapterForSubtask(subtask, adapterScores);

      if (!adapter) {
        results.push({
          taskId: subtask.id,
          adapterName: 'none',
          success: false,
          output: '',
          error: `No adapter available for subtask: ${subtask.description}`,
          duration: 0,
          timestamp: new Date(),
        });
        continue;
      }

      selectedAdapters.push(adapter.name);

      const request: ExecutionRequest = {
        taskId: subtask.id,
        prompt: subtask.description,
        context: task.context,
        options: {
          timeout: this.options.taskTimeout,
        },
      };

      try {
        const result = await adapter.execute(request);
        results.push(result);

        // 如果失败且启用了回退，尝试备用适配器
        if (!result.success && this.options.fallbackEnabled) {
          const fallbackResult = await this.tryFallback(subtask, request, adapter.name);
          if (fallbackResult) {
            results.push(fallbackResult);
          }
        }
      } catch (error) {
        results.push({
          taskId: subtask.id,
          adapterName: adapter.name,
          success: false,
          output: '',
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: 0,
          timestamp: new Date(),
        });
      }
    }

    return {
      taskId: task.id,
      results,
      selectedAdapters: [...new Set(selectedAdapters)],
      strategy: strategyType,
    };
  }

  /**
   * 并行分发多个任务
   */
  async dispatchParallel(tasks: ParsedTask[]): Promise<DispatchResult[]> {
    const batchCount = Math.ceil(tasks.length / this.options.maxParallelTasks);
    const allResults: DispatchResult[] = [];

    for (let i = 0; i < batchCount; i++) {
      const batch = tasks.slice(
        i * this.options.maxParallelTasks,
        (i + 1) * this.options.maxParallelTasks
      );

      const batchResults = await Promise.all(
        batch.map((task) => this.dispatch(task))
      );

      allResults.push(...batchResults);
    }

    return allResults;
  }

  /**
   * 根据策略选择适配器
   */
  private selectAdapters(task: ParsedTask, strategy?: DispatchStrategy): AdapterScore[] {
    const strategyType = strategy?.type ?? this.options.defaultStrategy;

    switch (strategyType) {
      case 'capability_based':
        return this.selectByCapability(task, strategy?.capabilityBased?.matchThreshold);
      case 'cost_optimized':
        return this.selectByCost(task, strategy?.costOptimized);
      case 'performance_based':
        return this.selectByPerformance(task, strategy?.performanceBased);
      case 'round_robin':
        return this.selectRoundRobin(task);
      default:
        return this.selectByCapability(task);
    }
  }

  /**
   * 基于能力选择适配器
   */
  private selectByCapability(task: ParsedTask, threshold = 50): AdapterScore[] {
    const scores = this.registry.scoreAdapters(task.requiredCapabilities);
    return scores.filter((s) => s.score >= threshold);
  }

  /**
   * 基于成本选择适配器
   */
  private selectByCost(
    task: ParsedTask,
    options?: { preferFree?: boolean; budgetLimit?: number }
  ): AdapterScore[] {
    const scores = this.registry.scoreAdapters(task.requiredCapabilities);

    // TODO: 实现成本计算逻辑
    // 目前简单返回能力匹配的结果
    return scores.filter((s) => s.score > 0);
  }

  /**
   * 基于性能选择适配器
   */
  private selectByPerformance(
    task: ParsedTask,
    options?: { maxLatency?: number; parallelExecution?: boolean }
  ): AdapterScore[] {
    const scores = this.registry.scoreAdapters(task.requiredCapabilities);

    // TODO: 实现性能评估逻辑
    return scores.filter((s) => s.score > 0);
  }

  /**
   * 轮询选择适配器
   */
  private selectRoundRobin(task: ParsedTask): AdapterScore[] {
    const allAdapters = this.registry.getAll();
    const scores = this.registry.scoreAdapters(task.requiredCapabilities);

    // 简单实现：返回所有可用的适配器
    return scores.filter((s) => s.score > 0);
  }

  /**
   * 为子任务选择最佳适配器
   */
  private selectAdapterForSubtask(
    subtask: SubTask,
    adapterScores: AdapterScore[]
  ): ReturnType<AdapterRegistry['get']> {
    // 找到具有所需能力的最高分适配器
    for (const score of adapterScores) {
      if (score.missingCapabilities.length === 0) {
        return this.registry.get(score.adapterName);
      }
    }

    // 如果没有完美匹配，返回最高分的适配器
    if (adapterScores.length > 0) {
      return this.registry.get(adapterScores[0].adapterName);
    }

    return undefined;
  }

  /**
   * 尝试使用备用适配器
   */
  private async tryFallback(
    subtask: SubTask,
    request: ExecutionRequest,
    failedAdapter: string
  ): Promise<ExecutionResult | null> {
    const scores = this.registry.scoreAdapters(subtask.requiredCapabilities);
    const fallbackAdapter = scores.find((s) => s.adapterName !== failedAdapter && s.score > 0);

    if (!fallbackAdapter) {
      return null;
    }

    const adapter = this.registry.get(fallbackAdapter.adapterName);
    if (!adapter) {
      return null;
    }

    try {
      return await adapter.execute(request);
    } catch {
      return null;
    }
  }

  /**
   * 更新分发器配置
   */
  updateOptions(options: Partial<DispatcherOptions>): void {
    this.options = {
      ...this.options,
      ...options,
    };
  }
}
