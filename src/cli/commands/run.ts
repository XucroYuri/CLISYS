/**
 * CLISYS Run Command
 * 执行任务的主要命令 - 连接到完整的编排流程
 */

import { Command, Option } from 'clipanion';
import { AdapterRegistry } from '../../core/adapter/AdapterRegistry.js';
import { TaskParser } from '../../core/orchestrator/TaskParser.js';
import { Dispatcher } from '../../core/orchestrator/Dispatcher.js';
import { Aggregator } from '../../core/orchestrator/Aggregator.js';
import { createClaudeCodeAdapter } from '../../adapters/claude-code/index.js';
import { createCodexAdapter } from '../../adapters/codex/index.js';
import { getEventBus } from '../../core/bus/index.js';
import { getLogger, setLogger, createLogger } from '../../core/logger/index.js';
import { initDatabase } from '../../core/storage/index.js';
import { getConfig } from '../../core/config/index.js';
import type { DispatchStrategyType, CLISYSEvent } from '../../core/adapter/types.js';

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
    description: 'Run multiple adapters in parallel (ultrawork mode)',
  });

  verbose = Option.Boolean('-v, --verbose', false, {
    description: 'Enable verbose output',
  });

  private maxIterations: number | undefined;

  private registry: AdapterRegistry | null = null;
  private dispatcher: Dispatcher | null = null;
  private taskParser: TaskParser | null = null;
  private initialized = false;

  constructor() {
    super();
    // Parse --max-iterations manually
    const args = process.argv;
    const idx = args.indexOf('--max-iterations');
    if (idx !== -1 && idx + 1 < args.length) {
      this.maxIterations = parseInt(args[idx + 1], 10);
    }
  }

  async execute() {
    const { prompt, adapter, strategy, parallel, verbose, maxIterations } = this;

    // Initialize logging
    const config = getConfig();
    setLogger(createLogger({
      level: config.logging.level,
      pretty: config.logging.pretty,
    }));
    const logger = getLogger();

    try {
      // Initialize the system
      await this.initialize();

      if (!this.registry || !this.dispatcher || !this.taskParser) {
        this.context.stderr.write('Failed to initialize execution engine\n');
        return 1;
      }

      this.context.stdout.write(`\n🚀 CLISYS Executing: ${prompt}\n`);
      this.context.stdout.write('─'.repeat(50) + '\n');

      if (verbose) {
        this.context.stdout.write(`Adapter: ${adapter ?? 'auto-select'}\n`);
        this.context.stdout.write(`Strategy: ${strategy ?? config.orchestrator.defaultStrategy}\n`);
        this.context.stdout.write(`Parallel: ${parallel}\n`);
        this.context.stdout.write('─'.repeat(50) + '\n\n');
      }

      // Setup event listeners for real-time feedback
      this.setupEventListeners();

      // Parse the task
      const parsedTask = this.taskParser.parse(prompt, {
        workingDirectory: process.cwd(),
      });

      if (verbose) {
        this.context.stdout.write(`📋 Task Type: ${parsedTask.type}\n`);
        this.context.stdout.write(`📊 Priority: ${parsedTask.priority}\n`);
        this.context.stdout.write(`🔧 Required Capabilities: ${parsedTask.requiredCapabilities.join(', ')}\n`);
        this.context.stdout.write(`📝 Subtasks: ${parsedTask.subtasks.length}\n\n`);
      }

      // Determine dispatch strategy
      const dispatchStrategy: DispatchStrategyType = (strategy as DispatchStrategyType) ?? config.orchestrator.defaultStrategy;

      let result;

      if (parallel) {
        // Use Ultrawork mode - parallel execution
        result = await this.executeParallel(parsedTask.description, verbose);
      } else if (maxIterations && maxIterations > 1) {
        // Use Ralph Loop mode - iterative execution
        result = await this.executeRalphLoop(parsedTask.description, maxIterations, verbose);
      } else {
        // Standard dispatch
        const dispatchResult = await this.dispatcher.dispatch(parsedTask);

        if (verbose) {
          this.context.stdout.write(`✓ Selected adapters: ${dispatchResult.selectedAdapters.join(', ')}\n`);
        }

        // Aggregate results
        const aggregator = new Aggregator();
        result = aggregator.aggregate(dispatchResult.results);
      }

      // Output the result
      this.context.stdout.write('\n' + '─'.repeat(50) + '\n');
      this.context.stdout.write('📝 Result:\n');
      this.context.stdout.write('─'.repeat(50) + '\n');

      if (result.success) {
        this.context.stdout.write(`✅ Task completed successfully\n\n`);
        this.context.stdout.write(result.output + '\n');

        if (result.metadata?.filesModified && (result.metadata.filesModified as string[]).length > 0) {
          this.context.stdout.write(`\n📁 Files modified: ${(result.metadata.filesModified as string[]).join(', ')}\n`);
        }
      } else {
        this.context.stdout.write(`❌ Task failed\n`);
        if (result.error) {
          this.context.stdout.write(`Error: ${result.error}\n`);
        }
      }

      return result.success ? 0 : 1;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Task execution failed');
      this.context.stderr.write(`\n❌ Error: ${errorMessage}\n`);
      return 1;
    } finally {
      // Cleanup
      await this.shutdown();
    }
  }

  /**
   * Initialize the execution engine
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    const config = getConfig();
    const logger = getLogger();

    // Initialize database
    initDatabase({
      path: config.session.storagePath + '/clisys.db',
    });

    // Create adapter registry
    this.registry = new AdapterRegistry({
      enableHealthCheck: true,
      healthCheckInterval: 60000,
    });

    // Register adapters
    const adaptersToRegister = [];

    if (config.adapters['claude-code']?.enabled) {
      adaptersToRegister.push(createClaudeCodeAdapter());
    }

    if (config.adapters['codex']?.enabled) {
      adaptersToRegister.push(createCodexAdapter());
    }

    // If specific adapter requested, only use that one
    if (this.adapter) {
      const adapterConfig = config.adapters[this.adapter];
      if (!adapterConfig?.enabled) {
        throw new Error(`Adapter "${this.adapter}" is not enabled or not found`);
      }
    }

    for (const adapter of adaptersToRegister) {
      try {
        await this.registry.register(adapter);
        logger.info({ adapter: adapter.name }, 'Adapter registered');
      } catch (error) {
        logger.warn({ adapter: adapter.name, error }, 'Failed to register adapter');
      }
    }

    // Create task parser
    this.taskParser = new TaskParser({
      defaultWorkingDirectory: process.cwd(),
    });

    // Create dispatcher
    this.dispatcher = new Dispatcher(this.registry, {
      defaultStrategy: config.orchestrator.defaultStrategy,
      maxParallelTasks: config.orchestrator.maxParallelTasks,
      taskTimeout: config.orchestrator.taskTimeout,
    });

    // Start the registry (enables health checks)
    await this.registry.start();

    this.initialized = true;
    logger.info('Execution engine initialized');
  }

  /**
   * Setup event listeners for real-time feedback
   */
  private setupEventListeners(): void {
    const bus = getEventBus();

    bus.on('adapter:started', (event: CLISYSEvent) => {
      const payload = event.payload as { adapterName: string; taskId: string };
      if (this.verbose) {
        this.context.stdout.write(`  ⚡ ${payload.adapterName}: Starting...\n`);
      }
    });

    bus.on('adapter:completed', (event: CLISYSEvent) => {
      const payload = event.payload as { adapterName: string; success: boolean; duration?: number };
      const icon = payload.success ? '✓' : '✗';
      if (this.verbose) {
        this.context.stdout.write(`  ${icon} ${payload.adapterName}: Completed (${payload.duration ?? 0}ms)\n`);
      }
    });

    bus.on('task:dispatched', (event: CLISYSEvent) => {
      const payload = event.payload as { taskId: string; adapter: string };
      if (this.verbose) {
        this.context.stdout.write(`  📤 Task dispatched to ${payload.adapter}\n`);
      }
    });
  }

  /**
   * Execute in parallel (Ultrawork mode)
   */
  private async executeParallel(prompt: string, verbose: boolean) {
    const { UltraworkLoop } = await import('../../loops/ultrawork.js');

    const adapters = this.registry!.getAll();
    if (adapters.length === 0) {
      throw new Error('No adapters available for parallel execution');
    }

    if (verbose) {
      this.context.stdout.write(`🔀 Parallel execution with ${adapters.length} adapters\n\n`);
    }

    const loop = new UltraworkLoop({
      timeout: 300000,
      aggregationStrategy: 'best_result',
      onProgress: (adapterName, status) => {
        if (verbose) {
          const statusIcon = status.status === 'completed' ? '✓' :
                            status.status === 'error' ? '✗' : '⏳';
          this.context.stdout.write(`  ${statusIcon} ${adapterName}: ${status.status}\n`);
        }
      },
    });

    const loopResult = await loop.execute(prompt, adapters);

    return {
      success: loopResult.success,
      output: loopResult.aggregatedOutput,
      error: loopResult.success ? undefined : 'Parallel execution failed',
      metadata: {
        adaptersUsed: loopResult.adapterUsed,
        totalDuration: loopResult.totalDuration,
      },
    };
  }

  /**
   * Execute with Ralph Loop (iterative mode)
   */
  private async executeRalphLoop(prompt: string, maxIterations: number, verbose: boolean) {
    const { RalphLoop } = await import('../../loops/ralph.js');

    const adapters = this.registry!.getAll();
    if (adapters.length === 0) {
      throw new Error('No adapters available');
    }

    const adapter = adapters[0]; // Use first available adapter

    if (verbose) {
      this.context.stdout.write(`🔄 Iterative execution (max ${maxIterations} iterations)\n\n`);
    }

    const loop = new RalphLoop({
      maxIterations,
      timeout: 300000,
      onIteration: (iteration) => {
        if (verbose) {
          this.context.stdout.write(`  🔄 Iteration ${iteration}\n`);
        }
      },
    });

    const loopResult = await loop.execute(prompt, adapter);

    return {
      success: loopResult.success,
      output: loopResult.finalOutput,
      error: loopResult.success ? undefined : `Failed after ${loopResult.iterations} iterations`,
      metadata: {
        iterations: loopResult.iterations,
        totalDuration: loopResult.totalDuration,
      },
    };
  }

  /**
   * Shutdown and cleanup
   */
  private async shutdown(): Promise<void> {
    if (this.registry) {
      await this.registry.shutdown();
    }
    this.initialized = false;
  }
}
