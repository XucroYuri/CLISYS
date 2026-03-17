#!/usr/bin/env node

/**
 * CLISYS - Multi-CLI Intelligent Collaboration System
 * CLI Entry Point (Clipanion-based)
 */

import { Cli, Builtins } from 'clipanion';
import { RunCommand, AdaptersCommand, ConfigCommand, ConfigShowCommand, ConfigInitCommand } from './commands/index.js';

// 创建 CLI 实例
const cli = new Cli({
  binaryLabel: 'CLISYS',
  binaryName: 'clisys',
  binaryVersion: '0.1.0',
});

// 注册命令
cli.register(RunCommand);
cli.register(AdaptersCommand);
cli.register(ConfigCommand);
cli.register(ConfigShowCommand);
cli.register(ConfigInitCommand);

// 注册内置命令 (help, version)
cli.register(Builtins.HelpCommand);
cli.register(Builtins.VersionCommand);

// 运行 CLI
cli.runExit(process.argv.slice(2));
