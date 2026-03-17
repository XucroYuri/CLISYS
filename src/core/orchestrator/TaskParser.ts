/**
 * CLISYS Task Parser
 * 任务解析器 - 将自然语言输入解析为结构化任务
 */

import type {
  ParsedTask,
  TaskType,
  TaskPriority,
  TaskContext,
  SubTask,
  Capability,
} from '../adapter/types.js';

// 任务类型关键词映射
const TASK_TYPE_KEYWORDS: Record<TaskType, string[]> = {
  code_generation: ['create', 'generate', 'write', 'implement', 'build', 'develop', '新建', '创建', '生成', '编写', '实现'],
  code_review: ['review', 'check', 'audit', 'analyze code', '代码审查', '检查', '审计'],
  debugging: ['debug', 'fix', 'solve', 'resolve', 'error', 'bug', 'issue', '调试', '修复', '解决', '错误'],
  refactoring: ['refactor', 'restructure', 'optimize', 'clean', 'improve', '重构', '优化', '改进'],
  documentation: ['document', 'docs', 'readme', 'comment', 'explain', '文档', '说明', '注释'],
  testing: ['test', 'spec', 'coverage', 'unit test', '测试', '单元测试'],
  analysis: ['analyze', 'examine', 'investigate', 'understand', '分析', '研究', '理解'],
  search: ['search', 'find', 'locate', 'look for', '搜索', '查找', '寻找'],
  git_operation: ['git', 'commit', 'push', 'pull', 'branch', 'merge', 'rebase'],
  file_operation: ['file', 'read', 'write', 'copy', 'move', 'delete', '文件', '读取', '写入'],
  shell_command: ['run', 'execute', 'command', 'shell', 'terminal', '运行', '执行', '命令'],
  multi_step: ['then', 'after', 'next', 'finally', 'step by step', '然后', '之后', '步骤'],
  unknown: [],
};

// 任务类型到所需能力的映射
const TASK_TYPE_CAPABILITIES: Record<TaskType, Capability[]> = {
  code_generation: ['code_generation'],
  code_review: ['code_review', 'analysis'],
  debugging: ['debugging', 'code_editing'],
  refactoring: ['refactoring', 'code_editing'],
  documentation: ['documentation'],
  testing: ['testing', 'code_generation'],
  analysis: ['analysis'],
  search: ['search'],
  git_operation: ['git_integration'],
  file_operation: ['file_operations'],
  shell_command: ['shell_execution'],
  multi_step: ['code_generation', 'code_editing'],
  unknown: ['code_generation'],
};

// 优先级关键词
const PRIORITY_KEYWORDS: Record<TaskPriority, string[]> = {
  high: ['urgent', 'critical', 'important', 'asap', '紧急', '重要', '立刻'],
  low: ['later', 'eventually', 'low priority', '稍后', '低优先级'],
  medium: [],
};

export interface TaskParserOptions {
  defaultPriority?: TaskPriority;
  defaultWorkingDirectory?: string;
}

export class TaskParser {
  private options: TaskParserOptions;

  constructor(options: TaskParserOptions = {}) {
    this.options = {
      defaultPriority: 'medium',
      defaultWorkingDirectory: process.cwd(),
      ...options,
    };
  }

  /**
   * 解析用户输入为结构化任务
   */
  parse(input: string, context?: Partial<TaskContext>): ParsedTask {
    const taskId = this.generateTaskId();
    const taskType = this.detectTaskType(input);
    const priority = this.detectPriority(input);
    const requiredCapabilities = this.getRequiredCapabilities(taskType);

    // 构建任务上下文
    const taskContext: TaskContext = {
      workingDirectory: context?.workingDirectory ?? this.options.defaultWorkingDirectory ?? process.cwd(),
      projectType: context?.projectType,
      language: context?.language,
      framework: context?.framework,
      files: context?.files,
      previousResults: context?.previousResults,
      metadata: context?.metadata,
    };

    // 尝试分解为子任务
    const subtasks = this.decomposeIntoSubtasks(input, taskType, requiredCapabilities);

    return {
      id: taskId,
      type: taskType,
      description: input,
      originalInput: input,
      subtasks,
      requiredCapabilities,
      priority,
      context: taskContext,
    };
  }

  /**
   * 生成唯一任务 ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 检测任务类型
   */
  private detectTaskType(input: string): TaskType {
    const lowerInput = input.toLowerCase();

    // 遍历所有任务类型的关键词
    for (const [type, keywords] of Object.entries(TASK_TYPE_KEYWORDS)) {
      if (keywords.length === 0) continue;

      for (const keyword of keywords) {
        if (lowerInput.includes(keyword.toLowerCase())) {
          return type as TaskType;
        }
      }
    }

    return 'unknown';
  }

  /**
   * 检测任务优先级
   */
  private detectPriority(input: string): TaskPriority {
    const lowerInput = input.toLowerCase();

    // 检查高优先级关键词
    for (const keyword of PRIORITY_KEYWORDS.high) {
      if (lowerInput.includes(keyword.toLowerCase())) {
        return 'high';
      }
    }

    // 检查低优先级关键词
    for (const keyword of PRIORITY_KEYWORDS.low) {
      if (lowerInput.includes(keyword.toLowerCase())) {
        return 'low';
      }
    }

    return this.options.defaultPriority ?? 'medium';
  }

  /**
   * 获取任务类型所需的能力
   */
  private getRequiredCapabilities(taskType: TaskType): Capability[] {
    return TASK_TYPE_CAPABILITIES[taskType] ?? ['code_generation'];
  }

  /**
   * 将任务分解为子任务
   */
  private decomposeIntoSubtasks(
    input: string,
    taskType: TaskType,
    capabilities: Capability[]
  ): SubTask[] {
    // 检查是否是多步骤任务
    const multiStepPatterns = [
      /(.+?)\s+(?:then|after|next|之后|然后)\s+(.+)/i,
      /(.+?)\s*;\s*(.+)/,
      /(.+?)\s+and\s+(?:then\s+)?(.+)/i,
    ];

    for (const pattern of multiStepPatterns) {
      const match = input.match(pattern);
      if (match) {
        return [
          {
            id: `subtask_${1}`,
            description: match[1].trim(),
            type: this.detectTaskType(match[1]),
            requiredCapabilities: capabilities,
          },
          {
            id: `subtask_${2}`,
            description: match[2].trim(),
            type: this.detectTaskType(match[2]),
            dependencies: [`subtask_${1}`],
            requiredCapabilities: capabilities,
          },
        ];
      }
    }

    // 单一任务，不分解
    return [
      {
        id: 'subtask_1',
        description: input,
        type: taskType,
        requiredCapabilities: capabilities,
      },
    ];
  }

  /**
   * 更新解析器配置
   */
  updateOptions(options: Partial<TaskParserOptions>): void {
    this.options = {
      ...this.options,
      ...options,
    };
  }
}
