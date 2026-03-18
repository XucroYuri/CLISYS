/**
 * CLISYS Gemini CLI Adapter
 * Google Gemini CLI 的适配器实现
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
 * Gemini CLI 适配器元数据
 */
const GEMINI_METADATA: AdapterMetadata = {
  name: 'gemini',
  version: '1.0.0',
  description: 'Google Gemini CLI adapter for CLISYS',
  capabilities: [
    'code_generation',
    'code_editing',
    'multi_modal',
    'analysis',
  ] as Capability[],
  defaultModel: 'gemini-2.0-flash',
  supportedModels: [
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-2.5-pro',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
  ],
};

/**
 * Gemini CLI 输出解析结果
 */
interface ParsedOutput {
  content: string;
  filesModified: string[];
  commandsExecuted: string[];
  metadata: Record<string, unknown>;
}

/**
 * Gemini CLI 适配器
 */
export class GeminiAdapter extends BaseAdapter {
  private commandPath: string | null = null;
  private initialized = false;

  constructor() {
    super(GEMINI_METADATA);
  }

  /**
   * 初始化适配器
   * 检查 Gemini CLI 是否可用
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // 检查 gemini 命令是否存在
      const result = await $`which gemini`.quiet();

      if (result.exitCode === 0) {
        this.commandPath = result.text().trim();
        logger.info({ path: this.commandPath }, 'Gemini CLI found');
      } else {
        // CLI 未在 PATH 中，仍设置默认值；运行时将处理错误
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
   * 验证 Gemini CLI 可用性
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

      // 尝试运行 gemini --version
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
   * 清理所有活跃会话
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
   * 将请求转换为 Gemini CLI 命令并运行
   */
  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const startTime = Date.now();
    const { taskId, prompt, options } = request;

    logger.info({ taskId }, 'Executing task');

    try {
      if (!this.commandPath) {
        return this.createErrorResult(taskId, 'Gemini CLI not initialized');
      }

      // 构建命令参数
      const args = this.buildArgs(prompt, options);

      // 执行命令
      const result = await this.runGeminiCommand(args, options?.timeout);

      const duration = Date.now() - startTime;

      // 解析输出
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
   * 构建 Gemini CLI 命令参数
   */
  private buildArgs(prompt: string, options?: ExecutionRequest['options']): string[] {
    const args: string[] = [];

    // 模型选择（覆盖默认模型）
    if (options?.model) {
      args.push('--model', options.model);
    }

    // 添加提示
    args.push(prompt);

    return args;
  }

  /**
   * 运行 Gemini CLI 命令
   * 支持超时控制
   */
  private async runGeminiCommand(
    args: string[],
    timeout?: number
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const command = ['gemini', ...args];
    const timeoutMs = timeout ?? 300000;

    try {
      // 使用 AbortController 来处理超时
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
   * 解析 Gemini CLI 输出
   * 提取文件修改信息、命令执行信息和元数据
   */
  private parseOutput(stdout: string, _stderr?: string): ParsedOutput {
    const filesModified: string[] = [];
    const commandsExecuted: string[] = [];
    const metadata: Record<string, unknown> = {};

    // 解析文件修改信息
    const filePatterns = [
      /(?:Created|Modified|Updated|Wrote)\s+[:\s]*(.+\.(?:ts|js|py|go|rs|java|cpp|c|h|md|json|toml|yaml|yml))/gi,
      /(?:File)\s+:\s*(.+)/gi,
    ];

    for (const pattern of filePatterns) {
      let match;
      while ((match = pattern.exec(stdout)) !== null) {
        filesModified.push(match[1].trim());
      }
    }

    // 解析命令执行信息
    const commandPatterns = [
      /(?:Running|Executed|Command)\s*:\s*(.+)/gi,
    ];

    for (const pattern of commandPatterns) {
      let match;
      while ((match = pattern.exec(stdout)) !== null) {
        commandsExecuted.push(match[1].trim());
      }
    }

    // 提取 token 使用信息（如果有）
    const tokenPatterns = [
      /tokens[:\s]+(\d+)/i,
      /usage[:\s]+\{[^}]*total_tokens[:\s]+(\d+)/i,
    ];

    for (const pattern of tokenPatterns) {
      const match = stdout.match(pattern);
      if (match) {
        metadata.tokensUsed = parseInt(match[1], 10);
        break;
      }
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
 * Factory function for creating a GeminiAdapter instance.
 * 工厂函数（优先使用此函数而非直接实例化）
 */
export function createGeminiAdapter(): GeminiAdapter {
  return new GeminiAdapter();
}
