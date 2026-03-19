/**
 * CLISYS Orchestrator - Aggregator
 * 结果聚合器 - 合并多个适配器的执行结果
 */

import type { ExecutionResult } from '../adapter/types.js';

export interface AggregatedResult {
  success: boolean;
  output: string;
  error?: string;
  metadata?: {
    totalTokens?: number;
    totalDuration?: number;
    adaptersUsed?: string[];
    filesModified?: string[];
  };
}

export interface AggregatorOptions {
  strategy?: 'best_result' | 'merge' | 'vote';
}

export class Aggregator {
  private options: AggregatorOptions;

  constructor(options: AggregatorOptions = {}) {
    this.options = {
      strategy: options.strategy ?? 'best_result',
    };
  }

  /**
   * 聚合多个执行结果
   */
  aggregate(results: ExecutionResult[]): AggregatedResult {
    const successfulResults = results.filter(r => r.success);

    if (successfulResults.length === 0) {
      // 如果没有成功的结果， return第一个结果或合并失败的输出
      const first = results[0];
      return {
        success: false,
        output: '',
        error: first?.error ?? 'All executions failed',
      };
    }

    switch (this.options.strategy) {
      case 'best_result':
        return this.selectBestResult(successfulResults);

      case 'merge':
        return this.mergeResults(successfulResults);

      case 'vote':
        return this.voteResults(successfulResults);

      default:
        return this.selectBestResult(successfulResults);
    }
  }

  /**
   * 选择最佳结果（最长的输出)
   */
  private selectBestResult(results: ExecutionResult[]): AggregatedResult {
    const best = results.reduce((best, current) =>
      current.output.length > best.output.length ? current : best
    );

    return {
      success: best.success,
      output: best.output,
      error: best.error,
      metadata: {
        totalTokens: results.reduce((sum, r) => sum + (r.metadata?.tokensUsed ?? 0), 0),
        adaptersUsed: results.map(r => r.adapterName),
        filesModified: results.flatMap(r => r.metadata?.filesModified ?? []).filter(Boolean),
      },
    };
  }

  /**
   * 合并所有结果
   */
  private mergeResults(results: ExecutionResult[]): AggregatedResult {
    const mergedOutput = results.map((r) => `=== ${r.adapterName} ===\n${r.output}`).join('\n\n');
    const successfulResults = results.filter(r => r.success);
    const first = successfulResults[0];

    return {
      success: successfulResults.length > 0,
      output: mergedOutput,
      error: first?.error,
      metadata: {
        totalTokens: results.reduce((sum, r) => sum + (r.metadata?.tokensUsed ?? 0), 0),
        adaptersUsed: results.map(r => r.adapterName),
        filesModified: results.flatMap(r => r.metadata?.filesModified ?? []).filter(Boolean),
      },
    };
  }

  /**
   * 投票选择结果(简单实现：选择大多数适配器认为成功的结果)
   */
  private voteResults(results: ExecutionResult[]): AggregatedResult {
    // 简单实现：选择第一个成功的结果
    const successfulResults = results.filter(r => r.success);
    const selected = successfulResults[0];

    if (!selected) {
      return {
        success: false,
        output: '',
        error: 'No successful results to vote on',
      };
    }

    return {
      success: true,
      output: selected.output,
      metadata: {
        totalTokens: selected.metadata?.tokensUsed ?? 0,
        adaptersUsed: [selected.adapterName],
        filesModified: selected.metadata?.filesModified ?? [],
      },
    };
  }
}
