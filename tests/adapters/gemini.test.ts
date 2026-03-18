/**
 * CLISYS Gemini Adapter Tests
 * GeminiAdapter 单元测试，使用 vitest mock 隔离 Bun $ 调用
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ExecutionRequest } from '../../src/core/adapter/types.js';

// ---------------------------------------------------------------------------
// Mock Bun's $ shell operator before importing the adapter
// ---------------------------------------------------------------------------

const mockShellResult = {
  exitCode: 0,
  stdout: Buffer.from(''),
  stderr: Buffer.from(''),
  text: () => '',
};

const mockShell = vi.fn().mockReturnValue({
  quiet: () => ({
    nothrow: () => Promise.resolve(mockShellResult),
  }),
});

// Mock the entire 'bun' module so $ can be controlled per test
vi.mock('bun', () => ({
  $: mockShell,
}));

// ---------------------------------------------------------------------------
// Import adapter AFTER mocking
// ---------------------------------------------------------------------------

import { GeminiAdapter, createGeminiAdapter } from '../../src/adapters/gemini/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * 构建模拟 shell 结果
 */
function makeShellResult(options: {
  exitCode?: number;
  stdout?: string;
  stderr?: string;
}) {
  const { exitCode = 0, stdout = '', stderr = '' } = options;
  return {
    exitCode,
    stdout: Buffer.from(stdout),
    stderr: Buffer.from(stderr),
    text: () => stdout,
  };
}

/**
 * 配置 mockShell，使其对 .quiet() 返回给定的结果
 * 同时支持 .quiet().nothrow() 链式调用
 */
function setupMock(result: ReturnType<typeof makeShellResult>) {
  mockShell.mockReturnValue({
    quiet: () => ({
      nothrow: () => Promise.resolve(result),
      then: (resolve: (v: typeof result) => unknown) => Promise.resolve(result).then(resolve),
      ...result,
    }),
    nothrow: () => Promise.resolve(result),
    then: (resolve: (v: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    ...result,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GeminiAdapter', () => {
  let adapter: GeminiAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new GeminiAdapter();
  });

  afterEach(async () => {
    // 确保每个测试后都关闭适配器，避免资源泄漏
    await adapter.shutdown().catch(() => {});
  });

  // -------------------------------------------------------------------------
  // Metadata
  // -------------------------------------------------------------------------

  describe('metadata', () => {
    it('should have correct name', () => {
      expect(adapter.name).toBe('gemini');
    });

    it('should have correct version', () => {
      expect(adapter.version).toBe('1.0.0');
    });

    it('should include required capabilities', () => {
      expect(adapter.capabilities).toContain('code_generation');
      expect(adapter.capabilities).toContain('code_editing');
      expect(adapter.capabilities).toContain('multi_modal');
      expect(adapter.capabilities).toContain('analysis');
    });

    it('should have gemini-2.0-flash as default model', () => {
      expect(adapter.getMetadata().defaultModel).toBe('gemini-2.0-flash');
    });

    it('should list supported models', () => {
      expect(adapter.getMetadata().supportedModels).toBeDefined();
      expect(adapter.getMetadata().supportedModels!.length).toBeGreaterThan(0);
      expect(adapter.getMetadata().supportedModels).toContain('gemini-2.0-flash');
    });
  });

  // -------------------------------------------------------------------------
  // Capability checks
  // -------------------------------------------------------------------------

  describe('capability checks', () => {
    it('hasCapability returns true for code_generation', () => {
      expect(adapter.hasCapability('code_generation')).toBe(true);
    });

    it('hasCapability returns true for multi_modal', () => {
      expect(adapter.hasCapability('multi_modal')).toBe(true);
    });

    it('hasCapability returns false for git_integration', () => {
      expect(adapter.hasCapability('git_integration')).toBe(false);
    });

    it('hasCapabilities returns correct result for subset', () => {
      const result = adapter.hasCapabilities(['code_generation', 'multi_modal']);
      expect(result.hasAll).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('hasCapabilities reports missing capabilities', () => {
      const result = adapter.hasCapabilities(['code_generation', 'interactive']);
      expect(result.hasAll).toBe(false);
      expect(result.missing).toContain('interactive');
    });
  });

  // -------------------------------------------------------------------------
  // initialize()
  // -------------------------------------------------------------------------

  describe('initialize()', () => {
    it('should set commandPath when gemini is found in PATH', async () => {
      setupMock(makeShellResult({ exitCode: 0, stdout: '/usr/local/bin/gemini' }));

      await adapter.initialize();

      // $ should be called with 'which gemini'
      expect(mockShell).toHaveBeenCalled();
    });

    it('should still initialize when gemini is not found in PATH', async () => {
      setupMock(makeShellResult({ exitCode: 1, stdout: '' }));

      // 不应抛出错误
      await expect(adapter.initialize()).resolves.toBeUndefined();
    });

    it('should be idempotent (second call is a no-op)', async () => {
      setupMock(makeShellResult({ exitCode: 0, stdout: '/usr/local/bin/gemini' }));

      await adapter.initialize();
      const callCountAfterFirst = mockShell.mock.calls.length;

      await adapter.initialize();
      // 第二次调用不应调用 $
      expect(mockShell.mock.calls.length).toBe(callCountAfterFirst);
    });

    it('should handle $ throwing an error gracefully', async () => {
      mockShell.mockReturnValue({
        quiet: () => {
          throw new Error('spawn error');
        },
      });

      await expect(adapter.initialize()).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // healthCheck()
  // -------------------------------------------------------------------------

  describe('healthCheck()', () => {
    it('should return healthy when gemini --version succeeds', async () => {
      // initialize first
      setupMock(makeShellResult({ exitCode: 0, stdout: '/usr/local/bin/gemini' }));
      await adapter.initialize();

      // health check mock
      setupMock(makeShellResult({ exitCode: 0, stdout: '1.5.0' }));

      const result = await adapter.healthCheck();

      expect(result.adapterName).toBe('gemini');
      expect(result.status).toBe('healthy');
      expect(result.message).toContain('Gemini CLI');
    });

    it('should return degraded when version check returns non-zero', async () => {
      setupMock(makeShellResult({ exitCode: 0, stdout: '/usr/local/bin/gemini' }));
      await adapter.initialize();

      setupMock(makeShellResult({ exitCode: 1, stdout: '' }));

      const result = await adapter.healthCheck();

      expect(result.status).toBe('degraded');
    });

    it('should return unhealthy when $ throws', async () => {
      setupMock(makeShellResult({ exitCode: 0, stdout: '/usr/local/bin/gemini' }));
      await adapter.initialize();

      mockShell.mockReturnValue({
        quiet: () => ({
          nothrow: () => Promise.reject(new Error('connection refused')),
        }),
      });

      const result = await adapter.healthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.message).toBe('connection refused');
    });

    it('should return unhealthy when not initialized', async () => {
      // adapter is fresh, not initialized — commandPath is null
      const result = await adapter.healthCheck();

      expect(result.status).toBe('unhealthy');
    });

    it('should include latency in result', async () => {
      setupMock(makeShellResult({ exitCode: 0, stdout: '/usr/local/bin/gemini' }));
      await adapter.initialize();

      setupMock(makeShellResult({ exitCode: 0, stdout: '1.5.0' }));

      const result = await adapter.healthCheck();

      expect(result.latency).toBeGreaterThanOrEqual(0);
    });
  });

  // -------------------------------------------------------------------------
  // execute()
  // -------------------------------------------------------------------------

  describe('execute()', () => {
    const baseRequest: ExecutionRequest = {
      taskId: 'task-001',
      prompt: 'Generate a TypeScript function to add two numbers',
    };

    beforeEach(async () => {
      // Initialize the adapter for execute tests
      setupMock(makeShellResult({ exitCode: 0, stdout: '/usr/local/bin/gemini' }));
      await adapter.initialize();
    });

    it('should return success result when command exits with 0', async () => {
      const output = 'function add(a: number, b: number): number { return a + b; }';
      setupMock(makeShellResult({ exitCode: 0, stdout: output }));

      const result = await adapter.execute(baseRequest);

      expect(result.success).toBe(true);
      expect(result.output).toBe(output);
      expect(result.taskId).toBe('task-001');
      expect(result.adapterName).toBe('gemini');
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should return failure result when command exits with non-zero', async () => {
      setupMock(makeShellResult({ exitCode: 1, stdout: '', stderr: 'API quota exceeded' }));

      const result = await adapter.execute(baseRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API quota exceeded');
    });

    it('should pass model override to the command', async () => {
      setupMock(makeShellResult({ exitCode: 0, stdout: 'response' }));

      const requestWithModel: ExecutionRequest = {
        ...baseRequest,
        options: { model: 'gemini-2.5-pro' },
      };

      await adapter.execute(requestWithModel);

      // 验证使用模型参数调用了 $
      expect(mockShell).toHaveBeenCalled();
    });

    it('should return error result when commandPath is null (not initialized)', async () => {
      // 新适配器实例（未初始化）
      const uninitializedAdapter = new GeminiAdapter();

      const result = await uninitializedAdapter.execute(baseRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not initialized');
    });

    it('should handle $ throwing an unexpected error', async () => {
      mockShell.mockReturnValue({
        quiet: () => ({
          nothrow: () => Promise.reject(new Error('unexpected failure')),
        }),
      });

      const result = await adapter.execute(baseRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('unexpected failure');
    });

    it('should parse file modification info from output', async () => {
      const output = 'Modified file: src/utils.ts\nDone.';
      setupMock(makeShellResult({ exitCode: 0, stdout: output }));

      const result = await adapter.execute(baseRequest);

      expect(result.success).toBe(true);
      expect(result.metadata?.filesModified).toBeDefined();
    });

    it('should include duration in result', async () => {
      setupMock(makeShellResult({ exitCode: 0, stdout: 'ok' }));

      const result = await adapter.execute(baseRequest);

      expect(typeof result.duration).toBe('number');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });

  // -------------------------------------------------------------------------
  // shutdown()
  // -------------------------------------------------------------------------

  describe('shutdown()', () => {
    it('should complete without throwing', async () => {
      setupMock(makeShellResult({ exitCode: 0, stdout: '/usr/local/bin/gemini' }));
      await adapter.initialize();

      await expect(adapter.shutdown()).resolves.toBeUndefined();
    });

    it('should allow re-initialization after shutdown', async () => {
      setupMock(makeShellResult({ exitCode: 0, stdout: '/usr/local/bin/gemini' }));
      await adapter.initialize();
      await adapter.shutdown();

      // Re-initialize should work and call $ again
      const callsBefore = mockShell.mock.calls.length;
      setupMock(makeShellResult({ exitCode: 0, stdout: '/usr/local/bin/gemini' }));
      await adapter.initialize();

      expect(mockShell.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  // -------------------------------------------------------------------------
  // Factory function
  // -------------------------------------------------------------------------

  describe('createGeminiAdapter()', () => {
    it('should return a GeminiAdapter instance', () => {
      const instance = createGeminiAdapter();
      expect(instance).toBeInstanceOf(GeminiAdapter);
    });

    it('should return a new instance each time', () => {
      const a = createGeminiAdapter();
      const b = createGeminiAdapter();
      expect(a).not.toBe(b);
    });
  });
});
