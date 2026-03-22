import { describe, expect, it } from 'vitest';
import { ProviderRegistry } from '../../src/core/providers/registry.js';
import type {
  ProviderDetectionResult,
  ProviderExecutionResult,
  ProviderName,
  ProviderPlan,
  ProviderRequest,
  ProviderScope,
  ToolchainProvider,
} from '../../src/core/providers/types.js';

class MockProvider implements ToolchainProvider {
  readonly name: ProviderName;
  readonly supportedScopes: ProviderScope[];
  private readonly supportedPlatforms: NodeJS.Platform[];

  constructor(options: {
    name: ProviderName;
    scopes?: ProviderScope[];
    platforms?: NodeJS.Platform[];
  }) {
    this.name = options.name;
    this.supportedScopes = options.scopes ?? ['user'];
    this.supportedPlatforms = options.platforms ?? ['darwin', 'linux', 'win32'];
  }

  supportsPlatform(platform: NodeJS.Platform): boolean {
    return this.supportedPlatforms.includes(platform);
  }

  async detect(request: ProviderRequest): Promise<ProviderDetectionResult> {
    return {
      provider: this.name,
      installed: false,
      metadata: {
        request,
      },
    };
  }

  async planInstall(request: ProviderRequest): Promise<ProviderPlan> {
    return {
      provider: this.name,
      action: 'install',
      request,
      steps: [
        {
          title: 'Install tool',
          command: [this.name, 'install', request.locator],
          description: `Install ${request.locator}`,
        },
      ],
    };
  }

  async install(plan: ProviderPlan): Promise<ProviderExecutionResult> {
    return {
      provider: this.name,
      success: true,
      output: `installed ${plan.request.locator}`,
      durationMs: 1,
    };
  }

  async planUpgrade(request: ProviderRequest): Promise<ProviderPlan> {
    return {
      provider: this.name,
      action: 'upgrade',
      request,
      steps: [
        {
          title: 'Upgrade tool',
          command: [this.name, 'upgrade', request.locator],
          description: `Upgrade ${request.locator}`,
        },
      ],
    };
  }

  async upgrade(plan: ProviderPlan): Promise<ProviderExecutionResult> {
    return {
      provider: this.name,
      success: true,
      output: `upgraded ${plan.request.locator}`,
      durationMs: 1,
    };
  }
}

describe('ProviderRegistry', () => {
  it('registers and retrieves providers', () => {
    const registry = new ProviderRegistry();
    const npmProvider = new MockProvider({ name: 'npm' });

    registry.register(npmProvider);

    expect(registry.has('npm')).toBe(true);
    expect(registry.get('npm')).toBe(npmProvider);
  });

  it('throws when registering duplicate providers', () => {
    const registry = new ProviderRegistry();
    registry.register(new MockProvider({ name: 'npm' }));

    expect(() => registry.register(new MockProvider({ name: 'npm' }))).toThrow(
      'Provider "npm" is already registered'
    );
  });

  it('enforces allowlists at registration time', () => {
    const registry = new ProviderRegistry({
      allowlist: ['npm', 'binary'],
    });

    expect(() => registry.register(new MockProvider({ name: 'brew' }))).toThrow(
      'Provider "brew" is not allowed by registry policy'
    );
  });

  it('filters providers by platform and scope', () => {
    const registry = new ProviderRegistry();
    registry.register(new MockProvider({ name: 'npm', scopes: ['user'] }));
    registry.register(new MockProvider({ name: 'binary', scopes: ['user', 'system'] }));
    registry.register(new MockProvider({ name: 'brew', platforms: ['darwin'] }));

    const linuxUserProviders = registry.getAvailable({
      platform: 'linux',
      scope: 'user',
    });
    const linuxSystemProviders = registry.getAvailable({
      platform: 'linux',
      scope: 'system',
    });

    expect(linuxUserProviders.map((provider) => provider.name)).toEqual(['npm', 'binary']);
    expect(linuxSystemProviders.map((provider) => provider.name)).toEqual(['binary']);
  });
});
