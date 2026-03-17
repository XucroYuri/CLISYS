/**
 * CLISYS Claude Code Adapter
 * Anthropic Claude Code CLI 的适配器实现
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

const logger = createChildLogger('claude-code-adapter');

/**
 * Claude Code 适配器元数据
 */
const CLAUDE_CODE_METADATA: AdapterMetadata = {
  name: 'claude-code',
  version: '1.0.0',
  description: 'Anthropic Claude Code CLI adapter for CLISYS',
  capabilities: [
    'code_generation',
    'code_editing',
    'code_review',
    'debugging',
    'refactoring',
    'documentation',
    'testing',
    'analysis',
    'search',
    'git_integration',
    'file_operations',
    'shell_execution',
    'interactive',
  ] as Capability[],
  defaultModel: 'claude-3-sonnet',
  supportedModels: [
    'claude-3-opus',
    'claude-3-sonnet',
    'claude-3-haiku',
    'claude-3-5-sonnet',
    'claude-3-5-haiku',
  ],
};

/**
 * Claude Code 输出解析结果
 */
interface ParsedOutput {
  content: string;
  filesModified: string[];
  commandsExecuted: string[];
  metadata: Record<string, unknown>;
}

/**
 * Claude Code 适配器
 */
export class ClaudeCodeAdapter extends BaseAdapter {
  private commandPath: string | null = null;
  private initialized = false;

  constructor() {
    super(CLAUDE_CODE_METADATA);
  }

  /**
   * 初始化适配器
   * 检查 Claude Code CLI 是否可用
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // 检查 claude 命令是否存在
      const result = await $`which claude`.quiet();

      if (result.exitCode === 0) {
        this.commandPath = result.text().trim();
        logger.info({ path: this.commandPath }, 'Claude Code CLI found');
      } else {
        // 尝试检查是否通过 npx/bunx 可用
        logger.warn('Claude Code CLI not found in PATH');
        this.commandPath = 'claude'; // 仍然设置为 'claude'，运行时会处理错误
      }

      this.initialized = true;
    } catch (error) {
      logger.warn({ error }, 'Claude Code CLI initialization warning');
      this.commandPath = 'claude';
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
          'Claude Code CLI not initialized'
        );
      }

      // 尝试运行 claude --version
      const result = await $`claude --version`.quiet().nothrow();
      const latency = Date.now() - startTime;

      if (result.exitCode === 0) {
        const version = result.text().trim();
        return this.createHealthCheckResult('healthy', `Claude Code ${version}`, latency);
      } else {
        return this.createHealthCheckResult(
          'degraded',
          'Claude Code CLI found but version check failed',
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
    // 清理所有会话
    for (const sessionId of this.sessions.keys()) {
      await this.closeSession(sessionId);
    }
    this.initialized = false;
    logger.info('Claude Code adapter shutdown');
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
        return this.createErrorResult(taskId, 'Claude Code CLI not initialized');
      }

      // 构建命令参数
      const args = this.buildArgs(prompt, options);

      // 执行命令
      const result = await this.runClaudeCommand(args, options?.timeout);

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
   * 构建命令参数
   */
  private buildArgs(prompt: string, options?: ExecutionRequest['options']): string[] {
    const args: string[] = [];

    // 添加提示
    args.push(prompt);

    // 模型选择
    if (options?.model) {
      args.unshift('--model', options.model);
    }

    // 非交互模式
    if (!options?.interactive) {
      args.unshift('--no-interactive');
    }

    return args;
  }

  /**
   * 运行 Claude 命令
   */
  private async runClaudeCommand(
    args: string[],
    timeout?: number
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const command = ['claude', ...args];
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
   * 解析 Claude Code 输出
   */
  private parseOutput(stdout: string, _stderr?: string): ParsedOutput {
    const filesModified: string[] = [];
    const commandsExecuted: string[] = [];
    const metadata: Record<string, unknown> = {};

    // 解析 stdout 中的文件修改信息
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

    // 解析命令执行信息
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

    // 提取 token 使用信息（如果有）
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

// 导出工厂函数
export function createClaudeCodeAdapter(): ClaudeCodeAdapter {
  return new ClaudeCodeAdapter();
}
