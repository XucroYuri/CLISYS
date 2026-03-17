/**
 * CLISYS Run Command
 * 执行任务的主要命令
 */

import { Command, Option } from 'clipanion';

export class RunCommand extends Command {
  static paths = [['run']];

  static usage = Command.Usage({
    description: 'Execute a task using available CLI adapters',
    details: `
      This command executes the given prompt using the configured CLI adapters.
      It supports different dispatch strategies and can run tasks in parallel.
    `,
    examples: [
      ['Run a simple task', 'clisys run "Create a simple HTTP server"'],
      ['Use a specific adapter', 'clisys run "Fix the bug" -a claude-code'],
      ['Use cost-optimized strategy', 'clisys run "Refactor code" -s cost_optimized'],
    ],
  });

  prompt = Option.String({ required: true });

  adapter = Option.String('-a, --adapter', {
    description: 'Specify adapter to use (claude-code, codex, etc.)',
  });

  strategy = Option.String('-s, --strategy', {
    description: 'Dispatch strategy (capability_based, cost_optimized, performance_based)',
  });

  parallel = Option.Boolean('-p, --parallel', false, {
    description: 'Run multiple adapters in parallel',
  });

  verbose = Option.Boolean('-v, --verbose', false, {
    description: 'Enable verbose output',
  });

  async execute() {
    const { prompt, adapter, strategy, parallel, verbose } = this;

    this.context.stdout.write(`CLISYS Executing: ${prompt}\n`);

    if (verbose) {
      this.context.stdout.write(`Adapter: ${adapter ?? 'auto'}\n`);
      this.context.stdout.write(`Strategy: ${strategy ?? 'default'}\n`);
      this.context.stdout.write(`Parallel: ${parallel}\n`);
    }

    // TODO: Implement actual execution logic
    // This will be connected to the orchestrator once adapters are implemented
    this.context.stdout.write('\nTask execution engine initializing...\n');
    this.context.stdout.write('Adapter implementation in progress.\n');

    return 0;
  }
}
