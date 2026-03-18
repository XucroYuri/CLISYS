/**
 * CLISYS Ralph Loop Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RalphLoop } from '../../src/loops/ralph.js';
import { BaseAdapter } from '../../src/core/adapter/BaseAdapter.js';
import type {
  ExecutionRequest,
  ExecutionResult,
  HealthCheckResult,
} from '../../src/core/adapter/types.js';

class MockRalphAdapter extends BaseAdapter {
  private callCount = 0;
  private completeOnCall: number;

  constructor(completeOnCall: number = 1) {
    super({
      name: 'mock-ralph-adapter',
      version: '1.0.0',
      capabilities: ['code_generation'],
    });
    this.completeOnCall = completeOnCall;
  }

  async initialize(): Promise<void> {}

  async healthCheck(): Promise<HealthCheckResult> {
    return this.createHealthCheckResult('healthy', 'Healthy', 10);
  }

  async shutdown(): Promise<void> {}

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    this.callCount++;

    if (this.callCount >= this.completeOnCall) {
      return this.createSuccessResult(
        request.taskId,
        `Task completed successfully. All done!`
      );
    }

    return this.createSuccessResult(
      request.taskId,
      `Working on it... (iteration ${this.callCount})`
    );
  }
}

describe('RalphLoop', () => {
  describe('completion detection', () => {
    it('should detect completion markers', async () => {
      const adapter = new MockRalphAdapter(1);
      const loop = new RalphLoop({
        maxIterations: 10,
      });

      const result = await loop.execute('Test prompt', adapter);

      expect(result.success).toBe(true);
      expect(result.iterations).toBe(1);
      expect(result.finalOutput).toContain('All done');
    });

    it('should respect maxIterations limit', async () => {
      const adapter = new MockRalphAdapter(100);
      const loop = new RalphLoop({
        maxIterations: 3,
      });

      const result = await loop.execute('Test prompt', adapter);

      expect(result.iterations).toBe(3);
    });

    it('should detect custom completion markers', async () => {
      let completed = false;
      const adapter = new (class extends BaseAdapter {
        constructor() {
          super({ name: 'custom-marker', version: '1.0.0', capabilities: ['code_generation'] });
        }
        async initialize() {}
        async healthCheck() { return this.createHealthCheckResult('healthy', 'ok', 10); }
        async shutdown() {}
        async execute(request: ExecutionRequest) {
          if (!completed) {
            completed = true;
            return this.createSuccessResult(request.taskId, 'CUSTOM_FINISHED');
          }
          return this.createSuccessResult(request.taskId, 'Done');
        }
      })();

      const loop = new RalphLoop({
        maxIterations: 5,
        completionMarkers: ['CUSTOM_FINISHED'],
      });

      const result = await loop.execute('Test', adapter);

      expect(result.iterations).toBe(1);
      expect(result.finalOutput).toContain('CUSTOM_FINISHED');
    });
  });

  describe('callbacks', () => {
    it('should call onIteration callback', async () => {
      const adapter = new MockRalphAdapter(2);
      const iterations: number[] = [];

      const loop = new RalphLoop({
        maxIterations: 10,
        onIteration: (iteration) => {
          iterations.push(iteration);
        },
      });

      await loop.execute('Test', adapter);

      expect(iterations.length).toBe(2);
      expect(iterations[0]).toBe(1);
      expect(iterations[1]).toBe(2);
    });
  });

  describe('error handling', () => {
    it('should abort on error by default', async () => {
      const adapter = new (class extends BaseAdapter {
        constructor() {
          super({ name: 'error-adapter', version: '1.0.0', capabilities: ['code_generation'] });
        }
        async initialize() {}
        async healthCheck() { return this.createHealthCheckResult('healthy', 'ok', 10); }
        async shutdown() {}
        async execute(request: ExecutionRequest): Promise<ExecutionResult> {
          throw new Error('Adapter error');
        }
      })();

      const loop = new RalphLoop({
        maxIterations: 10,
      });

      const result = await loop.execute('Test', adapter);

      expect(result.success).toBe(false);
      expect(result.iterations).toBeLessThan(10);
    });

    it('should retry on error when configured', async () => {
      let attempts = 0;
      const adapter = new (class extends BaseAdapter {
        constructor() {
          super({ name: 'retry-adapter', version: '1.0.0', capabilities: ['code_generation'] });
        }
        async initialize() {}
        async healthCheck() { return this.createHealthCheckResult('healthy', 'ok', 10); }
        async shutdown() {}
        async execute(request: ExecutionRequest): Promise<ExecutionResult> {
          attempts++;
          if (attempts < 3) {
            throw new Error('Temporary error');
          }
          return this.createSuccessResult(request.taskId, 'Done. Task completed!');
        }
      })();

      const loop = new RalphLoop({
        maxIterations: 10,
        onError: () => 'retry',
      });

      const result = await loop.execute('Test', adapter);

      expect(result.success).toBe(true);
      expect(attempts).toBe(3);
    });
  });

  describe('result structure', () => {
    it('should return correct result structure', async () => {
      const adapter = new MockRalphAdapter(1);
      const loop = new RalphLoop({
        maxIterations: 10,
      });

      const result = await loop.execute('Test prompt', adapter);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('iterations');
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('finalOutput');
      expect(result).toHaveProperty('totalDuration');
      expect(result).toHaveProperty('completedAt');
      expect(result).toHaveProperty('selectedResult');
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.selectedResult).not.toBeNull();
    });
  });
});
