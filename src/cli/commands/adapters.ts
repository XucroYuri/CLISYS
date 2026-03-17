/**
 * CLISYS Adapters Command
 * 列出和管理适配器
 */

import { Command, Option } from 'clipanion';

export class AdaptersCommand extends Command {
  static paths = [['adapters'], ['adapter']];

  static usage = Command.Usage({
    description: 'List and manage available CLI adapters',
    examples: [
      ['List all adapters', 'clisys adapters'],
      ['Show adapter details', 'clisys adapters --show claude-code'],
    ],
  });

  show = Option.String('--show', {
    description: 'Show details for a specific adapter',
  });

  async execute() {
    const { show } = this;

    // 预定义的适配器信息
    const adapters = [
      {
        name: 'claude-code',
        displayName: 'Claude Code',
        provider: 'Anthropic',
        description: 'Official Claude CLI for coding tasks',
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
        ],
        enabled: true,
        status: 'available',
      },
      {
        name: 'codex',
        displayName: 'Codex CLI',
        provider: 'OpenAI',
        description: 'OpenAI Codex CLI for code generation',
        capabilities: [
          'code_generation',
          'code_editing',
          'debugging',
          'analysis',
        ],
        enabled: true,
        status: 'available',
      },
      {
        name: 'gemini',
        displayName: 'Gemini CLI',
        provider: 'Google',
        description: 'Google Gemini CLI for AI-assisted coding',
        capabilities: [
          'code_generation',
          'code_editing',
          'multi_modal',
          'long_context',
        ],
        enabled: false,
        status: 'planned',
      },
      {
        name: 'opencode',
        displayName: 'OpenCode',
        provider: 'SST',
        description: 'Open source coding assistant',
        capabilities: [
          'code_generation',
          'code_editing',
          'interactive',
        ],
        enabled: false,
        status: 'planned',
      },
      {
        name: 'aider',
        displayName: 'Aider',
        provider: 'Community',
        description: 'AI pair programming in your terminal',
        capabilities: [
          'code_generation',
          'code_editing',
          'git_integration',
          'interactive',
        ],
        enabled: false,
        status: 'planned',
      },
    ];

    if (show) {
      const adapter = adapters.find(a => a.name === show);
      if (!adapter) {
        this.context.stderr.write(`Adapter "${show}" not found.\n`);
        return 1;
      }

      this.context.stdout.write(`\n${adapter.displayName}\n`);
      this.context.stdout.write(`${'='.repeat(adapter.displayName.length)}\n\n`);
      this.context.stdout.write(`Provider: ${adapter.provider}\n`);
      this.context.stdout.write(`Description: ${adapter.description}\n`);
      this.context.stdout.write(`Status: ${adapter.status}\n`);
      this.context.stdout.write(`Enabled: ${adapter.enabled ? 'Yes' : 'No'}\n`);
      this.context.stdout.write(`\nCapabilities:\n`);
      adapter.capabilities.forEach(cap => {
        this.context.stdout.write(`  • ${cap}\n`);
      });

      return 0;
    }

    // 列出所有适配器
    this.context.stdout.write('\nAvailable CLI Adapters\n');
    this.context.stdout.write('=======================\n\n');

    const enabled = adapters.filter(a => a.enabled);
    const disabled = adapters.filter(a => !a.enabled);

    if (enabled.length > 0) {
      this.context.stdout.write('Enabled:\n');
      enabled.forEach(adapter => {
        const status = adapter.status === 'available' ? '✓' : '○';
        this.context.stdout.write(`  ${status} ${adapter.name.padEnd(15)} - ${adapter.description}\n`);
      });
    }

    if (disabled.length > 0) {
      this.context.stdout.write('\nAvailable (not enabled):\n');
      disabled.forEach(adapter => {
        this.context.stdout.write(`  ○ ${adapter.name.padEnd(15)} - ${adapter.description}\n`);
      });
    }

    this.context.stdout.write('\nUse --show <name> for detailed information.\n');

    return 0;
  }
}
