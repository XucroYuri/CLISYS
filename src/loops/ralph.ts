/**
 * CLISYS Ralph Loop
 * 自引用循环 - 持续迭代直到任务完成
 */

import type { BaseAdapter } from '../core/adapter/BaseAdapter.js';
import type { ExecutionResult } from '../core/adapter/types.js';
import { createChildLogger } from '../core/logger/index.js';
import { getEventBus } from '../core/bus/index.js';

const logger = createChildLogger('ralph-loop');

/**
 * Ralph Loop 执行结果
 */
export interface RalphLoopResult {
  success: boolean;
  iterations: number;
  results: ExecutionResult[];
  finalOutput: string;
  totalDuration: number;
  completedAt: Date;
  selectedResult: ExecutionResult | null;
}

/**
 * Ralph Loop 配置
 */
export interface RalphLoopOptions {
  maxIterations?: number;
  timeout?: number;
  completionMarkers?: string[];
  onIteration?: (iteration: number, result: ExecutionResult) => void | Promise<void>;
  onError?: (error: Error, iteration: number) => 'retry' | 'abort';
}

const DEFAULT_COMPLETION_MARKERS = [
  'done',
  'completed',
  'finished',
  'success',
  '完成',
  '成功',
  'task completed',
  'all done',
];

/**
 * Ralph Loop 实现
 * 通过自引用方式持续迭代，直到任务完成或达到最大迭代次数
 */
export class RalphLoop {
  private options: Required<RalphLoopOptions>;
  private bus = getEventBus();

  constructor(options: RalphLoopOptions = {}) {
    this.options = {
      maxIterations: options.maxIterations ?? 10,
      timeout: options.timeout ?? 300000, // 5 minutes
      completionMarkers: options.completionMarkers ?? DEFAULT_COMPLETION_MARKERS,
      onIteration: options.onIteration ?? (() => {}),
      onError: options.onError ?? (() => 'abort'),
    };
  }

  /**
   * 执行 Ralph Loop
   */
  async execute(
    initialPrompt: string,
    adapter: BaseAdapter
  ): Promise<RalphLoopResult> {
    const startTime = Date.now();
    const results: ExecutionResult[] = [];
    let currentPrompt = initialPrompt;
    let iteration = 0;

    logger.info({ maxIterations: this.options.maxIterations }, 'Starting Ralph Loop');

    while (iteration < this.options.maxIterations) {
      iteration++;

      try {
        // 发射迭代开始事件
        await this.bus.emit('loop:iteration', {
          loopType: 'ralph',
          iteration,
          prompt: currentPrompt,
        });

        logger.debug({ iteration }, 'Executing iteration');

        // 执行任务
        const result = await adapter.execute({
          taskId: `ralph_${iteration}_${Date.now()}`,
          prompt: currentPrompt,
          options: {
            timeout: this.options.timeout,
          },
        });

        results.push(result);

        // 调用迭代回调
        await this.options.onIteration(iteration, result);

        // 检查是否完成
        if (this.checkCompletion(result)) {
          const totalDuration = Date.now() - startTime;

          logger.info({ iterations: iteration }, 'Ralph Loop completed');

          await this.bus.emit('loop:completed', {
            loopType: 'ralph',
            iterations: iteration,
            success: true,
          });

          return {
            success: true,
            iterations: iteration,
            results,
            finalOutput: result.output,
            totalDuration,
            completedAt: new Date(),
            selectedResult: result,
          };
        }

        // 准备下一次迭代的提示
        currentPrompt = this.prepareNextPrompt(result, initialPrompt);
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        logger.error({ iteration, error: err.message }, 'Iteration failed');

        const action = this.options.onError(err, iteration);

        if (action === 'abort') {
          break;
        }
        // 'retry' 继续下一次迭代
      }
    }

    // 达到最大迭代次数
    const totalDuration = Date.now() - startTime;
    const lastResult = results[results.length - 1];

    logger.warn({ iterations: iteration }, 'Ralph Loop reached max iterations');

    await this.bus.emit('loop:completed', {
      loopType: 'ralph',
      iterations: iteration,
      success: false,
      reason: 'max_iterations_reached',
    });

    return {
      success: lastResult?.success ?? false,
      iterations: iteration,
      results,
      finalOutput: lastResult?.output ?? '',
      totalDuration,
      completedAt: new Date(),
      selectedResult: lastResult ?? null,
    };
  }

  /**
   * 检查任务是否完成
   */
  private checkCompletion(result: ExecutionResult): boolean {
    if (!result.success) {
      return false;
    }

    const lowerOutput = result.output.toLowerCase();

    // 检查完成标记
    return this.options.completionMarkers.some(marker =>
      lowerOutput.includes(marker.toLowerCase())
    );
  }

  /**
   * 准备下一次迭代的提示
   */
  private prepareNextPrompt(result: ExecutionResult, originalPrompt: string): string {
    return `Previous attempt result:
${result.output.substring(0, 2000)}${result.output.length > 2000 ? '...(truncated)' : ''}

Original task: ${originalPrompt}

Please continue and complete the task. Focus on what's still missing or needs improvement.
Current iteration: Continue working on the remaining parts.`;
  }
}

/**
 * 创建 Ralph Loop 实例
 */
export function createRalphLoop(options?: RalphLoopOptions): RalphLoop {
  return new RalphLoop(options);
}
