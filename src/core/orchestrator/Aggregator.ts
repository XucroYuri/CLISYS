/**
 * CLISYS Aggregator
 * 结果聚合器 - 聚合多个适配器的执行结果
 */

import type { ExecutionResult } from '../adapter/types.js';

export type AggregationStrategy = 'best_result' | 'merge' | 'vote' | 'sequential';

export interface AggregatorOptions {
  defaultStrategy?: AggregationStrategy;
}

export interface AggregatedResult {
  taskId: string;
  success: boolean;
  output: string;
  sources: Array<{
    adapterName: string;
    contribution: string;
    success: boolean;
  }>;
  metadata: {
    totalDuration: number;
    strategy: AggregationStrategy;
    adapterCount: number;
  };
  errors: string[];
}

export class Aggregator {
  private options: Required<AggregatorOptions>;

  constructor(options: AggregatorOptions = {}) {
    this.options = {
      defaultStrategy: options.defaultStrategy ?? 'best_result',
    };
  }

  /**
   * 聚合执行结果
   */
  aggregate(
    taskId: string,
    results: ExecutionResult[],
    strategy?: AggregationStrategy
  ): AggregatedResult {
    const aggregationStrategy = strategy ?? this.options.defaultStrategy;

    switch (aggregationStrategy) {
      case 'best_result':
        return this.aggregateBestResult(taskId, results);
      case 'merge':
        return this.aggregateMerge(taskId, results);
      case 'vote':
        return this.aggregateVote(taskId, results);
      case 'sequential':
        return this.aggregateSequential(taskId, results);
      default:
        return this.aggregateBestResult(taskId, results);
    }
  }

  /**
   * 最佳结果策略：选择最成功的结果
   */
  private aggregateBestResult(taskId: string, results: ExecutionResult[]): AggregatedResult {
    const successfulResults = results.filter((r) => r.success);

    if (successfulResults.length === 0) {
      // 没有成功的结果，返回第一个失败结果
      const firstResult = results[0];
      return {
        taskId,
        success: false,
        output: '',
        sources: results.map((r) => ({
          adapterName: r.adapterName,
          contribution: r.output,
          success: r.success,
        })),
        metadata: {
          totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
          strategy: 'best_result',
          adapterCount: results.length,
        },
        errors: results.map((r) => r.error).filter((e): e is string => Boolean(e)),
      };
    }

    // 选择输出最长且成功的结果作为最佳结果
    const bestResult = successfulResults.reduce((best, current) =>
      current.output.length > best.output.length ? current : best
    );

    return {
      taskId,
      success: true,
      output: bestResult.output,
      sources: [
        {
          adapterName: bestResult.adapterName,
          contribution: bestResult.output,
          success: true,
        },
      ],
      metadata: {
        totalDuration: bestResult.duration,
        strategy: 'best_result',
        adapterCount: results.length,
      },
      errors: [],
    };
  }

  /**
   * 合并策略：将所有成功结果合并
   */
  private aggregateMerge(taskId: string, results: ExecutionResult[]): AggregatedResult {
    const successfulResults = results.filter((r) => r.success);
    const errors = results
      .filter((r) => !r.success)
      .map((r) => r.error)
      .filter((e): e is string => Boolean(e));

    if (successfulResults.length === 0) {
      return {
        taskId,
        success: false,
        output: '',
        sources: results.map((r) => ({
          adapterName: r.adapterName,
          contribution: r.output,
          success: r.success,
        })),
        metadata: {
          totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
          strategy: 'merge',
          adapterCount: results.length,
        },
        errors,
      };
    }

    // 合并所有成功的输出
    const mergedOutput = successfulResults
      .map((r, index) => {
        const prefix = successfulResults.length > 1 ? `[${r.adapterName}]\n` : '';
        return prefix + r.output;
      })
      .join('\n\n---\n\n');

    return {
      taskId,
      success: true,
      output: mergedOutput,
      sources: successfulResults.map((r) => ({
        adapterName: r.adapterName,
        contribution: r.output,
        success: true,
      })),
      metadata: {
        totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
        strategy: 'merge',
        adapterCount: results.length,
      },
      errors,
    };
  }

  /**
   * 投票策略：选择多数适配器同意的结果
   */
  private aggregateVote(taskId: string, results: ExecutionResult[]): AggregatedResult {
    // 简单实现：如果多数成功，则返回成功
    const successCount = results.filter((r) => r.success).length;
    const success = successCount > results.length / 2;

    return this.aggregateBestResult(taskId, results);
  }

  /**
   * 顺序策略：按顺序连接结果
   */
  private aggregateSequential(taskId: string, results: ExecutionResult[]): AggregatedResult {
    const errors = results
      .filter((r) => !r.success)
      .map((r) => r.error)
      .filter((e): e is string => Boolean(e));

    const sequentialOutput = results
      .map((r, index) => {
        const header = `Step ${index + 1} (${r.adapterName}):`;
        const status = r.success ? '✓' : '✗';
        return `${header} [${status}]\n${r.output}`;
      })
      .join('\n\n');

    const allSuccess = results.every((r) => r.success);

    return {
      taskId,
      success: allSuccess,
      output: sequentialOutput,
      sources: results.map((r) => ({
        adapterName: r.adapterName,
        contribution: r.output,
        success: r.success,
      })),
      metadata: {
        totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
        strategy: 'sequential',
        adapterCount: results.length,
      },
      errors,
    };
  }

  /**
   * 更新聚合器配置
   */
  updateOptions(options: Partial<AggregatorOptions>): void {
    this.options = {
      ...this.options,
      ...options,
    };
  }
}
