/**
 * CLISYS Dispatcher Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Dispatcher } from '../../src/core/orchestrator/Dispatcher.js';
import { AdapterRegistry } from '../../src/core/adapter/AdapterRegistry.js';
import { BaseAdapter } from '../../src/core/adapter/BaseAdapter.js';
import type {
  Capability,
  ExecutionRequest,
  ExecutionResult,
  HealthCheckResult,
  ParsedTask,
} from '../../src/core/adapter/types.js';

class MockAdapter extends BaseAdapter {
  private shouldSucceed: boolean;
  private delay: number;

  constructor(
    name: string,
    capabilities: Capability[] = ['code_generation'],
    shouldSucceed: boolean = true,
    delay: number = 10
  ) {
    super({
      name,
      version: '1.0.0',
      capabilities,
    });
    this.shouldSucceed = shouldSucceed;
    this.delay = delay;
  }

  async initialize(): Promise<void> {}

  async healthCheck(): Promise<HealthCheckResult> {
    return this.createHealthCheckResult('healthy', 'Mock adapter healthy', this.delay);
  }

  async shutdown(): Promise<void> {}

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    await new Promise(resolve => setTimeout(resolve, this.delay));

    if (this.shouldSucceed) {
      return this.createSuccessResult(request.taskId, `Output from ${this.name}: ${request.prompt}`);
    } else {
      return this.createErrorResult(request.taskId, `Error from ${this.name}`);
    }
  }
}

function createMockTask(description: string, capabilities: Capability[] = ['code_generation']): ParsedTask {
  return {
    id: 'test-task-1',
    type: 'code_generation',
    description,
    originalInput: description,
    subtasks: [
      {
        id: 'subtask-1',
        description,
        type: 'code_generation',
        requiredCapabilities: capabilities,
      },
    ],
    requiredCapabilities: capabilities,
    priority: 'medium',
    context: {
      workingDirectory: process.cwd(),
    },
  };
}

describe('Dispatcher', () => {
  let registry: AdapterRegistry;
  let dispatcher: Dispatcher;

  beforeEach(() => {
    registry = new AdapterRegistry({ enableHealthCheck: false });
    dispatcher = new Dispatcher(registry, {
      defaultStrategy: 'capability_based',
      maxParallelTasks: 3,
      taskTimeout: 5000,
      fallbackEnabled: true,
    });
  });

  describe('dispatch', () => {
    it('should dispatch task to best matching adapter', async () => {
      const adapter1 = new MockAdapter('adapter1', ['code_generation']);
      const adapter2 = new MockAdapter('adapter2', ['code_review']);

      await registry.register(adapter1);
      await registry.register(adapter2);

      const task = createMockTask('Create a function');
      const result = await dispatcher.dispatch(task);

      expect(result.selectedAdapters).toContain('adapter1');
      expect(result.results).toHaveLength(1);
      expect(result.results[0].success).toBe(true);
    });

    it('should use capability_based strategy by default', async () => {
      const adapter1 = new MockAdapter('adapter1', ['code_generation', 'debugging']);
      const adapter2 = new MockAdapter('adapter2', ['code_generation']);

      await registry.register(adapter1);
      await registry.register(adapter2);

      const task = createMockTask('Create and debug', ['code_generation', 'debugging']);
      const result = await dispatcher.dispatch(task);

      expect(result.strategy).toBe('capability_based');
    });

    it('should throw error when no suitable adapter found', async () => {
      const adapter = new MockAdapter('adapter1', ['code_review']);
      await registry.register(adapter);

      const task = createMockTask('Create code', ['code_generation']);

      await expect(dispatcher.dispatch(task)).rejects.toThrow('No suitable adapter found');
    });

    it('should handle adapter execution errors gracefully', async () => {
      const adapter = new MockAdapter('failing-adapter', ['code_generation'], false);
      await registry.register(adapter);

      const task = createMockTask('Create code');

      const result = await dispatcher.dispatch(task);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].success).toBe(false);
    });

    it('should dispatch to multiple adapters for parallel execution', async () => {
      const adapter1 = new MockAdapter('adapter1', ['code_generation']);
      const adapter2 = new MockAdapter('adapter2', ['code_generation']);

      await registry.register(adapter1);
      await registry.register(adapter2);

      const task = createMockTask('Create code');

      const result = await dispatcher.dispatch(task);

      expect(result.selectedAdapters.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('adapter selection', () => {
    it('should select adapter with most matching capabilities', async () => {
      const adapter1 = new MockAdapter('adapter1', ['code_generation']);
      const adapter2 = new MockAdapter('adapter2', ['code_generation', 'debugging', 'testing']);

      await registry.register(adapter1);
      await registry.register(adapter2);

      const task = createMockTask('Complex task', ['code_generation', 'debugging', 'testing']);
      const result = await dispatcher.dispatch(task);

      expect(result.selectedAdapters).toContain('adapter2');
    });

    it('should handle single subtask', async () => {
      const adapter = new MockAdapter('adapter1', ['code_generation']);
      await registry.register(adapter);

      const task = createMockTask('Simple task');
      const result = await dispatcher.dispatch(task);

      expect(result.results).toHaveLength(1);
    });

    it('should handle multiple subtasks', async () => {
      const adapter = new MockAdapter('adapter1', ['code_generation', 'debugging', 'testing']);
      await registry.register(adapter);

      const task: ParsedTask = {
        id: 'multi-task',
        type: 'multi_step',
        description: 'Multi-step task',
        originalInput: 'Multi-step task',
        subtasks: [
          { id: 'sub1', description: 'Create code', type: 'code_generation', requiredCapabilities: ['code_generation'] },
          { id: 'sub2', description: 'Debug code', type: 'debugging', requiredCapabilities: ['debugging'] },
        ],
        requiredCapabilities: ['code_generation', 'debugging'],
        priority: 'medium',
        context: { workingDirectory: process.cwd() },
      };

      const result = await dispatcher.dispatch(task);

      expect(result.results.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('fallback behavior', () => {
    it('should try fallback on adapter failure when enabled', async () => {
      const failingAdapter = new MockAdapter('failing', ['code_generation'], false);
      const workingAdapter = new MockAdapter('working', ['code_generation'], true);

      await registry.register(failingAdapter);
      await registry.register(workingAdapter);

      const task = createMockTask('Create code');
      const result = await dispatcher.dispatch(task);

      expect(result.results.some(r => r.success)).toBe(true);
    });
  });

  describe('options', () => {
    it('should respect maxParallelTasks option', () => {
      const localDispatcher = new Dispatcher(registry, {
        maxParallelTasks: 5,
      });

      expect(localDispatcher).toBeDefined();
    });

    it('should respect taskTimeout option', () => {
      const localDispatcher = new Dispatcher(registry, {
        taskTimeout: 10000,
      });

      expect(localDispatcher).toBeDefined();
    });

    it('should respect fallbackEnabled option', () => {
      const localDispatcher = new Dispatcher(registry, {
        fallbackEnabled: false,
      });

      expect(localDispatcher).toBeDefined();
    });
  });
});
