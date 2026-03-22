import { describe, expect, it } from 'vitest';
import { validatePluginManifest } from '../../src/core/plugins/validator.js';
import type { PluginManifest } from '../../src/core/plugins/manifest.js';

function createValidManifest(): PluginManifest {
  return {
    schema: {
      manifestVersion: '1.0.0',
      kind: 'adapter',
    },
    identity: {
      id: 'echo',
      packageName: '@clisys/adapter-echo',
      version: '1.2.3',
      displayName: 'Echo Adapter',
      provider: 'Clisys',
      description: 'An example adapter manifest used for validation tests.',
    },
    entrypoint: {
      module: './dist/index.js',
      export: 'default',
      pluginApiVersion: '1.0.0',
    },
    adapter: {
      capabilities: ['code_generation', 'code_editing'],
      supportedModels: ['gpt-4.1', 'gpt-5'],
      defaultModel: 'gpt-4.1',
      featureFlags: {
        streaming: true,
      },
    },
    install: {
      npm: {
        packageName: '@clisys/adapter-echo',
        bin: 'echo',
        version: '^1.2.3',
        global: true,
      },
      binary: {
        url: 'https://example.com/echo-linux-amd64.tar.gz',
        checksum: {
          algorithm: 'sha256',
          value: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        },
        filename: 'echo',
        platform: {
          operatingSystems: ['linux'],
          architectures: ['x64'],
        },
      },
    },
    compatibility: {
      clisysVersionRange: '>=0.1.0 <2.0.0',
      cliVersionRange: '>=1.0.0 <2.0.0',
      operatingSystems: ['darwin', 'linux'],
      architectures: ['x64', 'arm64'],
      runtimes: ['bun', 'node'],
    },
    declarations: {
      network: {
        outbound: 'allowlisted',
        allowlistedHosts: ['example.com'],
        allowlistedProtocols: ['https'],
      },
      environment: {
        requires: ['HOME'],
        optional: ['PATH'],
        forbidden: ['CLISYS_INTERNAL_TOKEN'],
      },
      writeTargets: {
        home: true,
        project: true,
        system: false,
        paths: ['.clisys/plugins'],
      },
      subprocess: {
        allowed: true,
        interactive: false,
        networkAccess: false,
      },
    },
  };
}

describe('plugin manifest validation', () => {
  it('accepts a valid manifest', () => {
    const manifest = validatePluginManifest(createValidManifest());

    expect(manifest.identity.packageName).toBe('@clisys/adapter-echo');
    expect(manifest.adapter.capabilities).toContain('code_generation');
    expect(manifest.install.binary?.checksum.algorithm).toBe('sha256');
  });

  it('rejects invalid package names', () => {
    const manifest = createValidManifest();
    manifest.identity.packageName = '@clisys/tool-echo';

    expect(() => validatePluginManifest(manifest)).toThrow(/identity\.packageName/);
  });

  it('rejects ids that do not match the package suffix', () => {
    const manifest = createValidManifest();
    manifest.identity.id = 'different-echo';

    expect(() => validatePluginManifest(manifest)).toThrow(/identity\.id/);
  });

  it('rejects invalid capability values', () => {
    const manifest = createValidManifest() as unknown as PluginManifest;
    manifest.adapter.capabilities = ['code_generation', 'totally_invalid_capability'] as never;

    expect(() => validatePluginManifest(manifest)).toThrow(/adapter\.capabilities/);
  });

  it('rejects invalid binary provider metadata', () => {
    const manifest = createValidManifest();
    if (!manifest.install.binary) {
      throw new Error('test manifest must include a binary install method');
    }

    manifest.install.binary.checksum.value = 'deadbeef';

    expect(() => validatePluginManifest(manifest)).toThrow(/install\.binary\.checksum\.value/);
  });

  it('rejects manifests without an install provider', () => {
    const manifest = createValidManifest();
    manifest.install = {};

    expect(() => validatePluginManifest(manifest)).toThrow(/install must declare at least one provider method/);
  });

  it('rejects npm install coordinates that do not match identity', () => {
    const manifest = createValidManifest();
    if (!manifest.install.npm) {
      throw new Error('test manifest must include an npm install method');
    }

    manifest.install.npm.packageName = '@clisys/adapter-other';

    expect(() => validatePluginManifest(manifest)).toThrow(/install\.npm\.packageName/);
  });

  it('rejects invalid version ranges', () => {
    const manifest = createValidManifest();
    manifest.compatibility.clisysVersionRange = 'banana1';

    expect(() => validatePluginManifest(manifest)).toThrow(/compatibility\.clisysVersionRange/);
  });

  it('rejects contradictory declarations', () => {
    const manifest = createValidManifest();
    manifest.declarations.network.outbound = 'none';
    manifest.declarations.subprocess.allowed = false;
    manifest.declarations.subprocess.interactive = true;

    expect(() => validatePluginManifest(manifest)).toThrow(
      /declarations\.network\.allowlistedHosts|declarations\.subprocess\.interactive/
    );
  });

  it('rejects default models without supported models', () => {
    const manifest = createValidManifest();
    delete manifest.adapter.supportedModels;

    expect(() => validatePluginManifest(manifest)).toThrow(/adapter\.supportedModels/);
  });
});
