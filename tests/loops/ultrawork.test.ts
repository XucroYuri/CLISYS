/**
 * CLISYS Ultrawork Loop Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UltraworkLoop } from '../../src/loops/ultrawork.js';
import { BaseAdapter } from '../../src/core/adapter/BaseAdapter.js';
import type {
  ExecutionRequest,
  ExecutionResult,
  HealthCheckResult,
} from '../../src/core/adapter/types.js';

function createMockUltraworkAdapter(
  name: string,
  output: string,
  success: boolean = true,
  delay: number = 10
) {
  return new (class extends BaseAdapter {
    constructor() {
      super({ name, version: '1.0.0', capabilities: ['code_generation'] });
    }
    async initialize() {}
    async healthCheck() { return this.createHealthCheckResult('healthy', 'ok', delay); }
    async shutdown() {}
    async execute(request: ExecutionRequest): Promise<ExecutionResult> {
      await new Promise(r => setTimeout(r, delay));
      if (success) {
        return this.createSuccessResult(request.taskId, output);
      }
      return this.createErrorResult(request.taskId, `Error from ${name}`);
    }
  })();
}

describe('UltraworkLoop', () => {
  describe('parallel execution', () => {
    it('should execute multiple adapters in parallel', async () => {
      const adapters = [
        createMockUltraworkAdapter('adapter1', 'Output1', true, 50),
        createMockUltraworkAdapter('adapter2', 'Output2', true, 50),
      ];

      const loop = new UltraworkLoop();
      const startTime = Date.now();

      const result = await loop.execute('Test prompt', adapters);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(150);

      expect(result.results.length).toBe(2);
      expect(result.adapterUsed.length).toBe(2);
    });

    it('should handle empty adapter list', async () => {
      const loop = new UltraworkLoop();

      const result = await loop.execute('Test', []);

      expect(result.success).toBe(false);
      expect(result.results.length).toBe(0);
      expect(result.aggregatedOutput).toBe('');
    });

    it('should handle partial failures', async () => {
      const adapters = [
        createMockUltraworkAdapter('success', 'Good output', true, 10),
        createMockUltraworkAdapter('failure', '', false, 10),
      ];

      const loop = new UltraworkLoop();

      const result = await loop.execute('Test', adapters);

      expect(result.results.length).toBe(2);
      expect(result.results.filter(r => r.success).length).toBe(1);
    });
  });

  describe('aggregation strategies', () => {
    it('should select best result (longest) with best_result strategy', async () => {
      const adapters = [
        createMockUltraworkAdapter('short', 'Short'),
        createMockUltraworkAdapter('long', 'This is a much longer output'),
        createMockUltraworkAdapter('medium', 'Medium length'),
      ];

      const loop = new UltraworkLoop({
        aggregationStrategy: 'best_result',
      });

      const result = await loop.execute('Test', adapters);

      expect(result.aggregatedOutput).toBe('This is a much longer output');
    });

    it('should select first success with first_success strategy', async () => {
      const adapters = [
        createMockUltraworkAdapter('first', 'First output'),
        createMockUltraworkAdapter('second', 'Second output'),
      ];

      const loop = new UltraworkLoop({
        aggregationStrategy: 'first_success',
      });

      const result = await loop.execute('Test', adapters);

      expect(result.aggregatedOutput).toBe('First output');
    });

    it('should merge results with merge strategy', async () => {
      const adapters = [
        createMockUltraworkAdapter('adapter1', 'Output1'),
        createMockUltraworkAdapter('adapter2', 'Output2'),
      ];

      const loop = new UltraworkLoop({
        aggregationStrategy: 'merge',
      });

      const result = await loop.execute('Test', adapters);

      expect(result.aggregatedOutput).toContain('adapter1');
      expect(result.aggregatedOutput).toContain('adapter2');
      expect(result.aggregatedOutput).toContain('Output1');
      expect(result.aggregatedOutput).toContain('Output2');
    });
  });

  describe('progress callbacks', () => {
    it('should call onProgress callback for each adapter', async () => {
      const adapters = [
        createMockUltraworkAdapter('adapter1', 'Output1'),
        createMockUltraworkAdapter('adapter2', 'Output2'),
      ];

      const progressEvents: Array<{ name: string; status: string }> = [];

      const loop = new UltraworkLoop({
        onProgress: (adapterName, status) => {
          progressEvents.push({ name: adapterName, status: status.status });
        },
      });

      await loop.execute('Test', adapters);

      expect(progressEvents.length).toBe(4);
      expect(progressEvents.filter(e => e.status === 'started').length).toBe(2);
      expect(progressEvents.filter(e => e.status === 'completed').length).toBe(2);
    });
  });

  describe('result structure', () => {
    it('should return correct result structure', async () => {
      const adapters = [
        createMockUltraworkAdapter('adapter1', 'Output'),
      ];

      const loop = new UltraworkLoop();

      const result = await loop.execute('Test', adapters);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('selectedResult');
      expect(result).toHaveProperty('aggregatedOutput');
      expect(result).toHaveProperty('totalDuration');
      expect(result).toHaveProperty('adapterUsed');
      expect(result).toHaveProperty('completedAt');
    });
  });
});
