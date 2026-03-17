/**
 * CLISYS Core Adapter Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AdapterRegistry } from '../../src/core/adapter/AdapterRegistry.js';
import { BaseAdapter } from '../../src/core/adapter/BaseAdapter.js';
import type {
  AdapterMetadata,
  Capability,
  ExecutionRequest,
  ExecutionResult,
  HealthCheckResult,
} from '../../src/core/adapter/types.js';

// Mock Adapter for testing
class MockAdapter extends BaseAdapter {
  constructor(name: string, capabilities: Capability[] = ['code_generation']) {
    super({
      name,
      version: '1.0.0',
      capabilities,
    });
  }

  async initialize(): Promise<void> {
    // Mock initialization
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return this.createHealthCheckResult('healthy', 'Mock adapter healthy', 10);
  }

  async shutdown(): Promise<void> {
    // Mock shutdown
  }

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    return this.createSuccessResult(request.taskId, `Mock output for: ${request.prompt}`);
  }
}

describe('AdapterRegistry', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = new AdapterRegistry({ enableHealthCheck: false });
  });

  it('should register an adapter', async () => {
    const adapter = new MockAdapter('test-adapter');
    await registry.register(adapter);

    expect(registry.has('test-adapter')).toBe(true);
    expect(registry.get('test-adapter')).toBe(adapter);
  });

  it('should throw when registering duplicate adapter', async () => {
    const adapter = new MockAdapter('test-adapter');
    await registry.register(adapter);

    await expect(registry.register(adapter)).rejects.toThrow('already registered');
  });

  it('should unregister an adapter', async () => {
    const adapter = new MockAdapter('test-adapter');
    await registry.register(adapter);

    await registry.unregister('test-adapter');

    expect(registry.has('test-adapter')).toBe(false);
  });

  it('should find adapters by capability', async () => {
    const adapter1 = new MockAdapter('adapter1', ['code_generation', 'debugging']);
    const adapter2 = new MockAdapter('adapter2', ['code_review']);

    await registry.register(adapter1);
    await registry.register(adapter2);

    const found = registry.findByCapability('code_generation');
    expect(found.length).toBe(1);
    expect(found[0].name).toBe('adapter1');
  });

  it('should score adapters correctly', async () => {
    const adapter1 = new MockAdapter('adapter1', ['code_generation', 'debugging']);
    const adapter2 = new MockAdapter('adapter2', ['code_generation']);

    await registry.register(adapter1);
    await registry.register(adapter2);

    const scores = registry.scoreAdapters(['code_generation', 'debugging']);

    expect(scores.length).toBe(2);
    expect(scores[0].adapterName).toBe('adapter1'); // Has both capabilities
  });

  it('should return all adapters', async () => {
    const adapter1 = new MockAdapter('adapter1');
    const adapter2 = new MockAdapter('adapter2');

    await registry.register(adapter1);
    await registry.register(adapter2);

    const all = registry.getAll();
    expect(all.length).toBe(2);
  });
});

describe('BaseAdapter', () => {
  let adapter: MockAdapter;

  beforeEach(async () => {
    adapter = new MockAdapter('test-adapter');
    await adapter.initialize();
  });

  it('should have correct metadata', () => {
    expect(adapter.name).toBe('test-adapter');
    expect(adapter.version).toBe('1.0.0');
    expect(adapter.capabilities).toContain('code_generation');
  });

  it('should check capabilities correctly', () => {
    expect(adapter.hasCapability('code_generation')).toBe(true);
    expect(adapter.hasCapability('multi_modal')).toBe(false);
  });

  it('should check multiple capabilities', () => {
    const result = adapter.hasCapabilities(['code_generation']);
    expect(result.hasAll).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('should create and manage sessions', async () => {
    const session = await adapter.createSession();
    expect(session.adapterName).toBe('test-adapter');
    expect(session.id).toBeDefined();

    const retrieved = await adapter.getSession(session.id);
    expect(retrieved).toBeDefined();
  });

  it('should execute tasks', async () => {
    const result = await adapter.execute({
      taskId: 'test-123',
      prompt: 'Test prompt',
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('Test prompt');
    expect(result.adapterName).toBe('test-adapter');
  });
});
