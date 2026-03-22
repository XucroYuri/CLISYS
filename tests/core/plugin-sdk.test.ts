import { describe, expect, it } from 'vitest';
import { BaseAdapter } from '../../src/core/adapter/BaseAdapter.js';
import {
  createPluginManifest,
  createPluginManifestBuilder,
  defineAdapterPlugin,
} from '../../src/core/plugins/sdk.js';

function createManifest() {
  return {
    schema: { manifestVersion: '1.0.0', kind: 'adapter' as const },
    identity: {
      id: 'echo',
      packageName: '@clisys/adapter-echo',
      version: '0.1.0',
      displayName: 'Echo Adapter',
      provider: 'Clisys',
      description: 'SDK test adapter',
    },
    entrypoint: {
      module: './dist/index.js',
      export: 'createAdapterPlugin',
      pluginApiVersion: '1.0.0',
    },
    adapter: {
      capabilities: ['analysis' as const],
      featureFlags: {},
    },
    install: {
      npm: {
        packageName: '@clisys/adapter-echo',
      },
    },
    compatibility: {
      clisysVersionRange: '>=0.1.0 <2.0.0',
      operatingSystems: ['darwin', 'linux', 'win32'] as const,
      architectures: ['x64', 'arm64'] as const,
      runtimes: ['bun', 'node'] as const,
    },
    declarations: {
      network: {
        outbound: 'metadata-only' as const,
        allowlistedHosts: [],
        allowlistedProtocols: [],
      },
      environment: {
        requires: [],
        optional: [],
        forbidden: [],
      },
      writeTargets: {
        home: true,
        project: false,
        system: false,
        paths: [],
      },
      subprocess: {
        allowed: true,
        interactive: false,
        networkAccess: false,
      },
    },
  };
}

class EchoAdapter extends BaseAdapter {
  constructor() {
    super({
      name: 'echo',
      version: '0.1.0',
      capabilities: ['analysis'],
    });
  }

  async initialize(): Promise<void> {}

  async healthCheck() {
    return this.createHealthCheckResult('healthy', 'ok');
  }

  async shutdown(): Promise<void> {}

  async execute(request: { taskId: string }) {
    return this.createSuccessResult(request.taskId, 'ok');
  }
}

describe('plugin sdk', () => {
  it('validates plugin manifests through createPluginManifest', () => {
    const manifest = createPluginManifest(createManifest());

    expect(manifest.identity.id).toBe('echo');
  });

  it('builds plugin manifests from defaults and overrides', () => {
    const buildManifest = createPluginManifestBuilder(createManifest() as never);
    const manifest = buildManifest({
      identity: {
        description: 'Updated description',
      } as never,
    });

    expect(manifest.identity.description).toBe('Updated description');
    expect(manifest.identity.packageName).toBe('@clisys/adapter-echo');
  });

  it('defines adapter plugins with validated manifests and factories', () => {
    const definition = defineAdapterPlugin(createManifest() as never, () => new EchoAdapter());

    expect(definition.manifest.identity.id).toBe('echo');
    expect(definition.createAdapterPlugin()).toBeInstanceOf(EchoAdapter);
  });
});
