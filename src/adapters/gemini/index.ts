/**
 * CLISYS Gemini CLI Adapter
 * Gemini CLI 的适配器实现
 */

import { BaseAdapter } from '../../core/adapter/BaseAdapter.js';
import type {
  AdapterMetadata,
  Capability,
  ExecutionRequest,
  ExecutionResult,
  HealthCheckResult,
} from '../../core/adapter/types.js';
import { createChildLogger } from '../../core/logger/index.js';
import { $ } from 'bun';

const logger = createChildLogger('gemini-adapter');

/**
 * Gemini 适配器元数据
 */
const GEMINI_METADATA: AdapterMetadata = {
  name: 'gemini',
  version: '1.0.0',
  description: 'Google Gemini CLI adapter for CLISYS',
  capabilities: [
    'code_generation',
    'code_editing',
    'code_review',
    'debugging',
    'refactoring',
    'documentation',
    'testing',
    'analysis',
    'multi_modal',
    'long_context',
    'interactive',
  ] as Capability[],
  defaultModel: 'gemini-2.0-flash',
  supportedModels: [
    'gemini-2.0-flash',
    'gemini-2.0-pro',
    'gemini-1.5-flash',
    'gemini-1.5-pro',
  ],
};

/**
 * Gemini 输出解析结果
 */
interface ParsedOutput {
  content: string;
  filesModified: string[];
  commandsExecuted: string[];
  metadata: Record<string, unknown>;
}

/**
 * Gemini 适配器
 */
export class GeminiAdapter extends BaseAdapter {
  private commandPath: string | null = null;
  private initialized = false;

  constructor() {
    super(GEMINI_METADATA);
  }

  /**
   * 初始化适配器
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const result = await $`which gemini`.quiet();

      if (result.exitCode === 0) {
        this.commandPath = result.text().trim();
        logger.info({ path: this.commandPath }, 'Gemini CLI found');
      } else {
        logger.warn('Gemini CLI not found in PATH');
        this.commandPath = 'gemini';
      }

      this.initialized = true;
    } catch (error) {
      logger.warn({ error }, 'Gemini CLI initialization warning');
      this.commandPath = 'gemini';
      this.initialized = true;
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      if (!this.commandPath) {
        return this.createHealthCheckResult(
          'unhealthy',
          'Gemini CLI not initialized'
        );
      }

      const result = await $`gemini --version`.quiet().nothrow();
      const latency = Date.now() - startTime;

      if (result.exitCode === 0) {
        const version = result.text().trim();
        return this.createHealthCheckResult('healthy', `Gemini CLI ${version}`, latency);
      } else {
        return this.createHealthCheckResult(
          'degraded',
          'Gemini CLI found but version check failed',
          latency
        );
      }
    } catch (error) {
      return this.createHealthCheckResult(
        'unhealthy',
        error instanceof Error ? error.message : 'Unknown error',
        Date.now() - startTime
      );
    }
  }

  /**
   * 关闭适配器
   */
  async shutdown(): Promise<void> {
    for (const sessionId of this.sessions.keys()) {
      await this.closeSession(sessionId);
    }
    this.initialized = false;
    logger.info('Gemini adapter shutdown');
  }

  /**
   * 执行任务
   */
  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const startTime = Date.now();
    const { taskId, prompt, options } = request;

    logger.info({ taskId }, 'Executing task');

    try {
      if (!this.commandPath) {
        return this.createErrorResult(taskId, 'Gemini CLI not initialized');
      }

      const args = this.buildArgs(prompt, options);
      const result = await this.runGeminiCommand(args, options?.timeout);
      const duration = Date.now() - startTime;
      const parsed = this.parseOutput(result.stdout, result.stderr);

      return {
        taskId,
        adapterName: this.name,
        success: result.exitCode === 0,
        output: parsed.content,
        error: result.exitCode !== 0 ? result.stderr : undefined,
        metadata: {
          ...parsed.metadata,
          filesModified: parsed.filesModified,
          commandsExecuted: parsed.commandsExecuted,
        },
        duration,
        timestamp: new Date(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error({ taskId, error: errorMessage }, 'Task execution failed');

      return {
        taskId,
        adapterName: this.name,
        success: false,
        output: '',
        error: errorMessage,
        duration,
        timestamp: new Date(),
      };
    }
  }

  /**
   * 构建命令参数
   */
  private buildArgs(prompt: string, options?: ExecutionRequest['options']): string[] {
    const args: string[] = [];

    args.push(prompt);

    if (options?.model) {
      args.unshift('--model', options.model);
    }

    if (!options?.interactive) {
      args.unshift('--no-interactive');
    }

    return args;
  }

  /**
   * 运行 Gemini 命令
   */
  private async runGeminiCommand(
    args: string[],
    timeout?: number
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const command = ['gemini', ...args];
    const timeoutMs = timeout ?? 300000;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const result = await $`${command}`.quiet().nothrow();

      clearTimeout(timeoutId);

      return {
        stdout: result.stdout.toString(),
        stderr: result.stderr.toString(),
        exitCode: result.exitCode,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          stdout: '',
          stderr: 'Command timed out',
          exitCode: 124,
        };
      }
      throw error;
    }
  }

  /**
   * 解析 Gemini 输出
   */
  private parseOutput(stdout: string, _stderr?: string): ParsedOutput {
    const filesModified: string[] = [];
    const commandsExecuted: string[] = [];
    const metadata: Record<string, unknown> = {};

    const filePatterns = [
      /(?:Created|Modified|Deleted|Edited)\s+file:\s*(.+)/gi,
      /(?:Writing|Updating)\s+(.+\.(?:ts|js|py|go|rs|java|cpp|c|h))/gi,
    ];

    for (const pattern of filePatterns) {
      let match;
      while ((match = pattern.exec(stdout)) !== null) {
        filesModified.push(match[1].trim());
      }
    }

    const commandPatterns = [
      /(?:Running|Executing):\s*(.+)/gi,
      /\$\s+(.+)/g,
    ];

    for (const pattern of commandPatterns) {
      let match;
      while ((match = pattern.exec(stdout)) !== null) {
        commandsExecuted.push(match[1].trim());
      }
    }

    const tokenMatch = stdout.match(/tokens[:\s]+(\d+)/i);
    if (tokenMatch) {
      metadata.tokensUsed = parseInt(tokenMatch[1], 10);
    }

    return {
      content: stdout,
      filesModified: [...new Set(filesModified)],
      commandsExecuted: [...new Set(commandsExecuted)],
      metadata,
    };
  }
}

/**
 * Factory function
 */
export function createGeminiAdapter(): GeminiAdapter {
  return new GeminiAdapter();
}
