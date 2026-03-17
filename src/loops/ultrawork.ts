/**
 * CLISYS Ultrawork Loop
 * 并行执行循环 - 同时激活多个适配器，选择最佳结果
 */

import type { BaseAdapter } from '../core/adapter/BaseAdapter.js';
import type { ExecutionResult } from '../core/adapter/types.js';
import { createChildLogger } from '../core/logger/index.js';
import { getEventBus } from '../core/bus/index.js';

const logger = createChildLogger('ultrawork-loop');

/**
 * Ultrawork Loop 聚合策略
 */
export type AggregationStrategy = 'best_result' | 'merge' | 'vote' | 'first_success';

/**
 * Ultrawork Loop 配置选项
 */
export interface UltraworkLoopOptions {
  timeout?: number;
  aggregationStrategy?: AggregationStrategy;
  onProgress?: (adapterName: string, status: ProgressStatus) => void;
}

/**
 * 进度状态
 */
export interface ProgressStatus {
  status: 'started' | 'completed' | 'error';
  result?: ExecutionResult;
  error?: Error;
}

/**
 * Ultrawork Loop 执行结果
 */
export interface UltraworkLoopResult {
  success: boolean;
  results: ExecutionResult[];
  selectedResult: ExecutionResult | null;
  aggregatedOutput: string;
  totalDuration: number;
  adapterUsed: string[];
  completedAt: Date;
}

/**
 * Ultrawork Loop 实现
 * 并行执行多个适配器，根据策略选择或聚合结果
 */
export class UltraworkLoop {
  private options: Required<UltraworkLoopOptions>;
  private bus = getEventBus();

  constructor(options: UltraworkLoopOptions = {}) {
    this.options = {
      timeout: options.timeout ?? 300000,
      aggregationStrategy: options.aggregationStrategy ?? 'best_result',
      onProgress: options.onProgress ?? (() => {}),
    };
  }

  /**
   * 执行 Ultrawork Loop
   */
  async execute(
    prompt: string,
    adapters: BaseAdapter[]
  ): Promise<UltraworkLoopResult> {
    const startTime = Date.now();

    if (adapters.length === 0) {
      logger.warn('No adapters provided');
      return {
        success: false,
        results: [],
        selectedResult: null,
        aggregatedOutput: '',
        totalDuration: 0,
        adapterUsed: [],
        completedAt: new Date(),
      };
    }

    logger.info({ adapterCount: adapters.length }, 'Starting Ultrawork Loop');

    // 并行执行所有适配器
    const executionPromises = adapters.map(adapter => this.executeAdapter(prompt, adapter));

    const results = await Promise.all(executionPromises);
    const adaptersUsed = adapters.map(a => a.name);

    // 根据策略选择/聚合结果
    const { selectedResult, aggregatedOutput } = this.aggregateResults(results);

    const totalDuration = Date.now() - startTime;

    await this.bus.emit('loop:completed', {
      loopType: 'ultrawork',
      success: selectedResult?.success ?? false,
      adapterCount: adapters.length,
    });

    logger.info(
      {
        adapterCount: adapters.length,
        successCount: results.filter(r => r.success).length,
        strategy: this.options.aggregationStrategy,
      },
      'Ultrawork Loop completed'
    );

    return {
      success: selectedResult?.success ?? false,
      results,
      selectedResult,
      aggregatedOutput,
      totalDuration,
      adapterUsed: adaptersUsed,
      completedAt: new Date(),
    };
  }

  /**
   * 执行单个适配器
   */
  private async executeAdapter(prompt: string, adapter: BaseAdapter): Promise<ExecutionResult> {
    const adapterName = adapter.name;

    // 报告开始
    this.options.onProgress(adapterName, { status: 'started' });

    try {
      const result = await adapter.execute({
        taskId: `ultrawork_${adapterName}_${Date.now()}`,
        prompt,
        options: {
          timeout: this.options.timeout,
        },
      });

      // 报告完成
      this.options.onProgress(adapterName, { status: 'completed', result });

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error');

      logger.error({ adapter: adapterName, error: err.message }, 'Adapter execution failed');

      // 报告错误
      this.options.onProgress(adapterName, { status: 'error', error: err });

      // 返回错误结果
      return {
        taskId: `ultrawork_${adapterName}_${Date.now()}`,
        adapterName,
        success: false,
        output: '',
        error: err.message,
        duration: 0,
        timestamp: new Date(),
      };
    }
  }

  /**
   * 聚合结果
   */
  private aggregateResults(results: ExecutionResult[]): {
    selectedResult: ExecutionResult | null;
    aggregatedOutput: string;
  } {
    const successfulResults = results.filter(r => r.success);

    if (successfulResults.length === 0 && results.length === 0) {
      return { selectedResult: null, aggregatedOutput: '' };
    }

    // 如果没有成功的结果，使用第一个结果
    const candidateResults = successfulResults.length > 0 ? successfulResults : results;

    switch (this.options.aggregationStrategy) {
      case 'first_success':
        return {
          selectedResult: successfulResults[0] ?? null,
          aggregatedOutput: successfulResults[0]?.output ?? '',
        };

      case 'best_result':
        // 选择输出最长且成功的结果
        const best = candidateResults.reduce((best, current) =>
          current.output.length > best.output.length ? current : best
        );
        return {
          selectedResult: best,
          aggregatedOutput: best.output,
        };

      case 'merge':
        // 合并所有成功的结果
        const mergedOutput = candidateResults
          .map(r => `=== ${r.adapterName} ===\n${r.output}`)
          .join('\n\n');
        return {
          selectedResult: candidateResults[0] ?? null,
          aggregatedOutput: mergedOutput,
        };

      case 'vote':
        // 简单投票：选择大多数适配器都认为成功的结果
        // 这里简化为选择第一个成功的结果
        return {
          selectedResult: successfulResults[0] ?? null,
          aggregatedOutput: successfulResults[0]?.output ?? '',
        };

      default:
        return {
          selectedResult: candidateResults[0] ?? null,
          aggregatedOutput: candidateResults[0]?.output ?? '',
        };
    }
  }
}

/**
 * 创建 Ultrawork Loop 实例
 */
export function createUltraworkLoop(options?: UltraworkLoopOptions): UltraworkLoop {
  return new UltraworkLoop(options);
}
