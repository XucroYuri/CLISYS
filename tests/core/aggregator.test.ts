/**
 * CLISYS Aggregator Tests
 */

import { describe, it, expect } from 'vitest';
import { Aggregator } from '../../src/core/orchestrator/Aggregator.js';
import type { ExecutionResult } from '../../src/core/adapter/types.js';

function createMockResult(
  adapterName: string,
  output: string,
  success: boolean = true,
  tokens?: number,
  files?: string[]
): ExecutionResult {
  return {
    taskId: `task-${Date.now()}`,
    adapterName,
    success,
    output,
    error: success ? undefined : 'Execution failed',
    duration: 100,
    timestamp: new Date(),
    metadata: {
      tokensUsed: tokens ?? 100,
      filesModified: files ?? [],
    },
  };
}

describe('Aggregator', () => {
  describe('selectBestResult strategy', () => {
    it('should select result with longest output', () => {
      const aggregator = new Aggregator({ strategy: 'best_result' });
      const results = [
        createMockResult('adapter1', 'Short'),
        createMockResult('adapter2', 'This is a longer output'),
        createMockResult('adapter3', 'Medium'),
      ];

      const aggregated = aggregator.aggregate(results);

      expect(aggregated.success).toBe(true);
      expect(aggregated.output).toBe('This is a longer output');
      expect(aggregated.metadata?.adaptersUsed).toContain('adapter1');
      expect(aggregated.metadata?.adaptersUsed).toContain('adapter2');
      expect(aggregated.metadata?.adaptersUsed).toContain('adapter3');
    });

    it('should aggregate metadata correctly', () => {
      const aggregator = new Aggregator({ strategy: 'best_result' });
      const results = [
        createMockResult('adapter1', 'Output1', true, 50, ['file1.ts']),
        createMockResult('adapter2', 'Output2', true, 100, ['file2.ts', 'file3.ts']),
      ];

      const aggregated = aggregator.aggregate(results);

      expect(aggregated.metadata?.totalTokens).toBe(150);
      expect(aggregated.metadata?.filesModified).toEqual(['file1.ts', 'file2.ts', 'file3.ts']);
    });
  });

  describe('merge strategy', () => {
    it('should merge all results', () => {
      const aggregator = new Aggregator({ strategy: 'merge' });
      const results = [
        createMockResult('adapter1', 'Output1'),
        createMockResult('adapter2', 'Output2'),
      ];

      const aggregated = aggregator.aggregate(results);

      expect(aggregated.success).toBe(true);
      expect(aggregated.output).toContain('adapter1');
      expect(aggregated.output).toContain('adapter2');
      expect(aggregated.output).toContain('Output1');
      expect(aggregated.output).toContain('Output2');
    });
  });

  describe('vote strategy', () => {
    it('should select first successful result', () => {
      const aggregator = new Aggregator({ strategy: 'vote' });
      const results = [
        createMockResult('adapter1', 'Output1'),
        createMockResult('adapter2', 'Output2'),
      ];

      const aggregated = aggregator.aggregate(results);

      expect(aggregated.success).toBe(true);
      expect(aggregated.output).toBe('Output1');
    });
  });

  describe('error handling', () => {
    it('should handle all failed results', () => {
      const aggregator = new Aggregator({ strategy: 'best_result' });
      const results = [
        createMockResult('adapter1', '', false),
        createMockResult('adapter2', '', false),
      ];

      const aggregated = aggregator.aggregate(results);

      expect(aggregated.success).toBe(false);
      expect(aggregated.error).toBeDefined();
    });

    it('should handle empty results array', () => {
      const aggregator = new Aggregator({ strategy: 'best_result' });
      const results: ExecutionResult[] = [];

      const aggregated = aggregator.aggregate(results);

      expect(aggregated.success).toBe(false);
      expect(aggregated.error).toBe('All executions failed');
    });

    it('should filter out failed results and use successful ones', () => {
      const aggregator = new Aggregator({ strategy: 'best_result' });
      const results = [
        createMockResult('adapter1', '', false),
        createMockResult('adapter2', 'Successful output', true),
      ];

      const aggregated = aggregator.aggregate(results);

      expect(aggregated.success).toBe(true);
      expect(aggregated.output).toBe('Successful output');
    });
  });
});
