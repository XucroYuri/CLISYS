import { describe, expect, it } from 'vitest';
import { ProviderRegistry } from '../../src/core/providers/registry.js';
import type {
  ProviderDetectionResult,
  ProviderExecutionResult,
  ProviderPlan,
  ProviderRequest,
  ProviderScope,
  ToolchainProvider,
} from '../../src/core/providers/types.js';
import { ToolchainManager } from '../../src/core/toolchain/manager.js';

class FakeProvider implements ToolchainProvider {
  readonly name = 'npm' as const;
  readonly supportedScopes: readonly ProviderScope[];
  private installed = false;

  constructor(
    private readonly behavior: 'success' | 'install-fails' | 'verify-fails' = 'success',
    scopes: readonly ProviderScope[] = ['user']
  ) {
    this.supportedScopes = scopes;
  }

  supportsPlatform(_platform: NodeJS.Platform): boolean {
    return true;
  }

  async detect(_request: ProviderRequest): Promise<ProviderDetectionResult> {
    return {
      provider: this.name,
      installed: this.installed,
      version: this.installed ? '1.0.0' : undefined,
    };
  }

  async planInstall(request: ProviderRequest): Promise<ProviderPlan> {
    return {
      provider: this.name,
      action: 'install',
      request,
      steps: [
        {
          title: 'Install',
          command: ['npm', 'install', '--global', request.locator],
          description: 'Install tool',
        },
      ],
    };
  }

  async install(_plan: ProviderPlan): Promise<ProviderExecutionResult> {
    if (this.behavior === 'install-fails') {
      return {
        provider: this.name,
        success: false,
        output: '',
        error: 'installation failed',
        durationMs: 1,
      };
    }

    if (this.behavior === 'success') {
      this.installed = true;
    }

    return {
      provider: this.name,
      success: true,
      output: 'installed',
      durationMs: 1,
    };
  }

  async planUpgrade(request: ProviderRequest): Promise<ProviderPlan> {
    return this.planInstall(request);
  }

  async upgrade(plan: ProviderPlan): Promise<ProviderExecutionResult> {
    return this.install(plan);
  }
}

function createRequest(scope: ProviderScope = 'user'): ProviderRequest {
  return {
    pluginId: 'goose',
    toolId: 'goose',
    scope,
    platform: 'linux',
    architecture: 'x64',
    locator: '@clisys/adapter-goose',
    dryRun: false,
  };
}

describe('ToolchainManager', () => {
  it('activates a missing toolchain after successful install and verification', async () => {
    const registry = new ProviderRegistry();
    registry.register(new FakeProvider('success'));

    const manager = new ToolchainManager(registry);
    const result = await manager.ensureToolchain(createRequest());

    expect(result.state.state).toBe('active');
    expect(result.activatedProvider).toBe('npm');
  });

  it('awaits confirmation for protected scopes', async () => {
    const registry = new ProviderRegistry();
    registry.register(new FakeProvider('success', ['user', 'system']));

    const manager = new ToolchainManager(registry);
    const result = await manager.ensureToolchain(createRequest('system'));

    expect(result.state.state).toBe('awaiting_confirmation');
    expect(result.policyDecision?.decision).toBe('confirm');
  });

  it('rolls back when install execution fails', async () => {
    const registry = new ProviderRegistry();
    registry.register(new FakeProvider('install-fails'));

    const manager = new ToolchainManager(registry);
    const result = await manager.ensureToolchain(createRequest());

    expect(result.state.state).toBe('rolled_back');
  });

  it('quarantines a toolchain when post-install verification fails', async () => {
    const registry = new ProviderRegistry();
    registry.register(new FakeProvider('verify-fails'));

    const manager = new ToolchainManager(registry);
    const result = await manager.ensureToolchain(createRequest());

    expect(result.state.state).toBe('quarantined');
    expect(result.verification?.success).toBe(false);
  });
});
