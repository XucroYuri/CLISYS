/**
 * CLISYS Config Command
 * 配置管理命令
 */

import { Command, Option } from 'clipanion';
import { getConfig, getDefaultConfig, saveToTOML } from '../../core/config/index.js';

export class ConfigCommand extends Command {
  static paths = [['config']];

  static usage = Command.Usage({
    description: 'Manage CLISYS configuration',
    examples: [
      ['Show current configuration', 'clisys config'],
      ['Show configuration path', 'clisys config --path'],
      ['Initialize default config', 'clisys config --init'],
    ],
  });

  showPath = Option.Boolean('--path', false, {
    description: 'Show configuration file path',
  });

  init = Option.Boolean('--init', false, {
    description: 'Initialize default configuration file',
  });

  output = Option.String('-o,--output', {
    description: 'Output file path for --init',
  });

  async execute() {
    const { showPath, init, output } = this;

    if (showPath) {
      const homeConfig = `${process.env.HOME ?? '~'}/.clisys/config.toml`;
      const projectConfig = '.clisys/config.toml';
      this.context.stdout.write(`Global config: ${homeConfig}\n`);
      this.context.stdout.write(`Project config: ${projectConfig}\n`);
      return 0;
    }

    if (init) {
      const configPath = output ?? '.clisys/config.toml';
      const defaultConfig = getDefaultConfig();

      try {
        saveToTOML(configPath, defaultConfig);
        this.context.stdout.write(`Default configuration written to ${configPath}\n`);
        return 0;
      } catch (error) {
        this.context.stderr.write(`Failed to write config: ${error}\n`);
        return 1;
      }
    }

    // 显示当前配置
    const config = getConfig();

    this.context.stdout.write('\nCLISYS Configuration\n');
    this.context.stdout.write('===================\n\n');

    this.context.stdout.write(`Version: ${config.version}\n\n`);

    // 适配器配置
    this.context.stdout.write('Adapters:\n');
    Object.entries(config.adapters).forEach(([name, adapter]) => {
      const status = adapter.enabled ? '✓' : '○';
      this.context.stdout.write(`  ${status} ${name}\n`);
      if (adapter.command) {
        this.context.stdout.write(`      command: ${adapter.command}\n`);
      }
    });

    // 编排器配置
    this.context.stdout.write('\nOrchestrator:\n');
    this.context.stdout.write(`  Default Strategy: ${config.orchestrator.defaultStrategy}\n`);
    this.context.stdout.write(`  Max Parallel Tasks: ${config.orchestrator.maxParallelTasks}\n`);
    this.context.stdout.write(`  Task Timeout: ${config.orchestrator.taskTimeout}ms\n`);

    // 日志配置
    this.context.stdout.write('\nLogging:\n');
    this.context.stdout.write(`  Level: ${config.logging.level}\n`);
    this.context.stdout.write(`  Output: ${config.logging.output}\n`);
    this.context.stdout.write(`  Pretty: ${config.logging.pretty}\n`);

    // 会话配置
    this.context.stdout.write('\nSession:\n');
    this.context.stdout.write(`  Persistent: ${config.session.persistent}\n`);
    this.context.stdout.write(`  Storage Path: ${config.session.storagePath}\n`);
    this.context.stdout.write(`  TTL: ${config.session.ttl}ms\n`);

    return 0;
  }
}

// 子命令
export class ConfigShowCommand extends Command {
  static paths = [['config', 'show']];

  static usage = Command.Usage({
    description: 'Show current configuration',
  });

  async execute() {
    const config = getConfig();
    this.context.stdout.write(JSON.stringify(config, null, 2));
    this.context.stdout.write('\n');
    return 0;
  }
}

export class ConfigInitCommand extends Command {
  static paths = [['config', 'init']];

  static usage = Command.Usage({
    description: 'Initialize default configuration file',
  });

  output = Option.String('-o,--output', {
    description: 'Output file path',
  });

  async execute() {
    const configPath = this.output ?? '.clisys/config.toml';
    const defaultConfig = getDefaultConfig();

    try {
      saveToTOML(configPath, defaultConfig);
      this.context.stdout.write(`Default configuration written to ${configPath}\n`);
      return 0;
    } catch (error) {
      this.context.stderr.write(`Failed to write config: ${error}\n`);
      return 1;
    }
  }
}
