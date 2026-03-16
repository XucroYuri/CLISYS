/**
 * CLISYS Loop Manager
 * 循环管理器 - 管理 Ralph Loop 和 Ultrawork Loop
 */

import type {
  ExecutionResult,
  RalphLoopConfig,
  UltraworkLoopConfig,
  LoopConfig,
} from '../adapter/types.js';
import type { AdapterRegistry } from '../adapter/AdapterRegistry.js';
import type { BaseAdapter } from '../adapter/BaseAdapter.js';

export interface LoopResult {
  success: boolean;
  iterations: number;
  results: ExecutionResult[];
  finalOutput: string;
  metadata: {
    loopType: 'ralph' | 'ultrawork';
    totalDuration: number;
    adapterUsed: string[];
  };
}

export class LoopManager {
  private registry: AdapterRegistry;

  constructor(registry: AdapterRegistry) {
    this.registry = registry;
  }

  /**
   * 执行 Ralph Loop（自引用循环）
   * 持续迭代直到任务 100% 完成
   */
  async executeRalphLoop(
    initialPrompt: string,
    adapter: BaseAdapter,
    config: Partial<RalphLoopConfig> = {}
  ): Promise<LoopResult> {
    const fullConfig: RalphLoopConfig = {
      type: 'ralph',
      maxIterations: config.maxIterations ?? 10,
      timeout: config.timeout,
      completionCheck: config.completionCheck ?? this.defaultCompletionCheck,
      onIteration: config.onIteration,
      onError: config.onError,
    };

    const results: ExecutionResult[] = [];
    let currentPrompt = initialPrompt;
    let iteration = 0;
    const startTime = Date.now();
    const adaptersUsed = new Set<string>([adapter.name]);

    while (iteration < fullConfig.maxIterations) {
      iteration++;

      try {
        const result = await adapter.execute({
          taskId: `ralph_loop_${iteration}`,
          prompt: currentPrompt,
          options: {
            timeout: fullConfig.timeout,
          },
        });

        results.push(result);
        adaptersUsed.add(adapter.name);

        // 调用迭代回调
        if (fullConfig.onIteration) {
          fullConfig.onIteration(iteration, result);
        }

        // 检查是否完成
        const isComplete = await fullConfig.completionCheck(result);
        if (isComplete) {
          return {
            success: true,
            iterations: iteration,
            results,
            finalOutput: result.output,
            metadata: {
              loopType: 'ralph',
              totalDuration: Date.now() - startTime,
              adapterUsed: Array.from(adaptersUsed),
            },
          };
        }

        // 准备下一次迭代的提示（自引用）
        currentPrompt = this.prepareNextIterationPrompt(result, currentPrompt);
      } catch (error) {
        const errorMsg = error instanceof Error ? error : new Error('Unknown error');

        if (fullConfig.onError) {
          const action = fullConfig.onError(errorMsg, iteration);
          if (action === 'abort') {
            break;
          } else if (action === 'fallback') {
            // 尝试使用其他适配器
            const fallbackAdapter = this.findFallbackAdapter(adapter);
            if (fallbackAdapter) {
              adapter = fallbackAdapter;
              continue;
            }
          }
          // 'retry' 继续下一次迭代
        } else {
          break;
        }
      }
    }

    // 达到最大迭代次数或出错
    const lastResult = results[results.length - 1];
    return {
      success: lastResult?.success ?? false,
      iterations: iteration,
      results,
      finalOutput: lastResult?.output ?? '',
      metadata: {
        loopType: 'ralph',
        totalDuration: Date.now() - startTime,
        adapterUsed: Array.from(adaptersUsed),
      },
    };
  }

  /**
   * 执行 Ultrawork Loop（并行执行）
   * 同时激活多个适配器，选择最佳结果
   */
  async executeUltraworkLoop(
    prompt: string,
    config: Partial<UltraworkLoopConfig> = {}
  ): Promise<LoopResult> {
    const fullConfig: UltraworkLoopConfig = {
      type: 'ultrawork',
      maxIterations: config.maxIterations ?? 1,
      timeout: config.timeout ?? 300000,
      parallelAdapters: config.parallelAdapters ?? [],
      aggregationStrategy: config.aggregationStrategy ?? 'best_result',
      onProgress: config.onProgress,
    };

    const startTime = Date.now();
    const adaptersUsed = new Set<string>();

    // 获取要使用的适配器
    const adapters = this.getParallelAdapters(fullConfig.parallelAdapters);

    if (adapters.length === 0) {
      return {
        success: false,
        iterations: 0,
        results: [],
        finalOutput: '',
        metadata: {
          loopType: 'ultrawork',
          totalDuration: 0,
          adapterUsed: [],
        },
      };
    }

    // 并行执行所有适配器
    const executionPromises = adapters.map(async (adapter) => {
      adaptersUsed.add(adapter.name);

      // 报告进度
      if (fullConfig.onProgress) {
        fullConfig.onProgress(adapter.name, { status: 'started' });
      }

      try {
        const result = await adapter.execute({
          taskId: `ultrawork_${adapter.name}`,
          prompt,
          options: {
            timeout: fullConfig.timeout,
          },
        });

        if (fullConfig.onProgress) {
          fullConfig.onProgress(adapter.name, { status: 'completed', result });
        }

        return result;
      } catch (error) {
        const errorResult: ExecutionResult = {
          taskId: `ultrawork_${adapter.name}`,
          adapterName: adapter.name,
          success: false,
          output: '',
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: 0,
          timestamp: new Date(),
        };

        if (fullConfig.onProgress) {
          fullConfig.onProgress(adapter.name, { status: 'error', error });
        }

        return errorResult;
      }
    });

    const results = await Promise.all(executionPromises);

    // 根据策略选择最佳结果
    const finalResult = this.selectBestResult(results, fullConfig.aggregationStrategy);

    return {
      success: finalResult.success,
      iterations: 1,
      results,
      finalOutput: finalResult.output,
      metadata: {
        loopType: 'ultrawork',
        totalDuration: Date.now() - startTime,
        adapterUsed: Array.from(adaptersUsed),
      },
    };
  }

  /**
   * 默认完成检查
   */
  private defaultCompletionCheck(result: ExecutionResult): boolean {
    if (!result.success) {
      return false;
    }

    // 检查输出中是否包含"完成"相关的标记
    const completionMarkers = ['done', 'completed', 'finished', 'success', '完成', '成功'];
    const lowerOutput = result.output.toLowerCase();

    return completionMarkers.some((marker) => lowerOutput.includes(marker));
  }

  /**
   * 准备下一次迭代的提示
   */
  private prepareNextIterationPrompt(result: ExecutionResult, originalPrompt: string): string {
    return `Previous attempt result:
${result.output}

Original task: ${originalPrompt}

Please continue and complete the task. Focus on what's still missing or needs improvement.`;
  }

  /**
   * 查找备用适配器
   */
  private findFallbackAdapter(currentAdapter: BaseAdapter): BaseAdapter | undefined {
    const allAdapters = this.registry.getAll();
    return allAdapters.find((a) => a.name !== currentAdapter.name);
  }

  /**
   * 获取并行执行的适配器
   */
  private getParallelAdapters(adapterNames: string[]): BaseAdapter[] {
    if (adapterNames.length > 0) {
      return adapterNames
        .map((name) => this.registry.get(name))
        .filter((a): a is BaseAdapter => a !== undefined);
    }

    // 如果没有指定，使用所有可用适配器
    return this.registry.getAll();
  }

  /**
   * 根据策略选择最佳结果
   */
  private selectBestResult(
    results: ExecutionResult[],
    strategy: 'best_result' | 'merge' | 'vote'
  ): ExecutionResult {
    const successfulResults = results.filter((r) => r.success);

    if (successfulResults.length === 0) {
      return results[0] ?? {
        taskId: 'none',
        adapterName: 'none',
        success: false,
        output: '',
        error: 'All adapters failed',
        duration: 0,
        timestamp: new Date(),
      };
    }

    switch (strategy) {
      case 'best_result':
        // 选择输出最长且成功的结果
        return successfulResults.reduce((best, current) =>
          current.output.length > best.output.length ? current : best
        );

      case 'vote':
        // 简单实现：与 best_result 相同
        return successfulResults[0];

      case 'merge':
        // 合并所有结果
        const mergedOutput = successfulResults.map((r) => r.output).join('\n\n');
        return {
          ...successfulResults[0],
          output: mergedOutput,
        };

      default:
        return successfulResults[0];
    }
  }
}
