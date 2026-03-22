import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { loadPluginFromDirectory } from '../../src/core/plugins/loader.js';
import { PluginRegistry } from '../../src/core/plugins/registry.js';

const TEMP_DIRS: string[] = [];

function createPluginFixture(options?: {
  manifestOverrides?: Record<string, unknown>;
  entrypointContents?: string;
}) {
  const rootPath = fs.mkdtempSync(path.join(tmpdir(), 'clisys-plugin-'));
  TEMP_DIRS.push(rootPath);

  fs.writeFileSync(
    path.join(rootPath, 'package.json'),
    JSON.stringify({
      name: '@clisys/adapter-goose',
      version: '0.1.0',
      type: 'module',
    }),
    'utf8'
  );

  const manifest = {
    schema: {
      manifestVersion: '1.0.0',
      kind: 'adapter',
    },
    identity: {
      id: 'goose',
      packageName: '@clisys/adapter-goose',
      version: '0.1.0',
      displayName: 'Goose Adapter',
      provider: 'Block',
      description: 'Adapter for Goose CLI',
    },
    entrypoint: {
      module: './dist/index.js',
      export: 'createAdapterPlugin',
      pluginApiVersion: '>=1.0.0 <2.0.0',
    },
    adapter: {
      capabilities: ['analysis', 'interactive'],
      supportedModels: ['goose-default'],
      defaultModel: 'goose-default',
      featureFlags: {
        interactive: true,
      },
    },
    install: {
      npm: {
        packageName: '@clisys/adapter-goose',
        bin: 'goose',
        version: '^1.0.0',
        global: true,
      },
    },
    compatibility: {
      clisysVersionRange: '>=0.1.0 <2.0.0',
      cliVersionRange: '^1.0.0',
      operatingSystems: ['darwin', 'linux', 'win32'],
      architectures: ['x64', 'arm64'],
      runtimes: ['bun', 'node'],
    },
    declarations: {
      network: {
        outbound: 'allowlisted',
        allowlistedHosts: ['registry.npmjs.org'],
        allowlistedProtocols: ['https'],
      },
      environment: {
        requires: [],
        optional: ['PATH'],
        forbidden: [],
      },
      writeTargets: {
        home: true,
        project: false,
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

  const mergedManifest = deepMerge(manifest, options?.manifestOverrides ?? {});

  fs.mkdirSync(path.join(rootPath, 'dist'), { recursive: true });
  fs.writeFileSync(
    path.join(rootPath, 'clisys-plugin.json'),
    JSON.stringify(mergedManifest, null, 2),
    'utf8'
  );
  fs.writeFileSync(
    path.join(rootPath, 'dist/index.js'),
    options?.entrypointContents ?? 'export const createAdapterPlugin = () => ({ name: "goose" });\n',
    'utf8'
  );

  return rootPath;
}

function deepMerge(base: Record<string, unknown>, override: Record<string, unknown>) {
  const output = { ...base };

  for (const [key, value] of Object.entries(override)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      output[key] &&
      typeof output[key] === 'object' &&
      !Array.isArray(output[key])
    ) {
      output[key] = deepMerge(
        output[key] as Record<string, unknown>,
        value as Record<string, unknown>
      );
    } else {
      output[key] = value;
    }
  }

  return output;
}

afterEach(() => {
  while (TEMP_DIRS.length > 0) {
    const dir = TEMP_DIRS.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('Plugin loader', () => {
  it('loads a compatible plugin from a directory', async () => {
    const rootPath = createPluginFixture();

    const loaded = await loadPluginFromDirectory(rootPath, {
      hostVersion: '0.1.0',
      pluginApiVersion: '1.0.0',
      platform: 'linux',
      architecture: 'x64',
      runtime: 'node',
    });

    expect(loaded.manifest.identity.id).toBe('goose');
    expect(typeof loaded.factory).toBe('function');
  });

  it('rejects incompatible clisys versions', async () => {
    const rootPath = createPluginFixture({
      manifestOverrides: {
        compatibility: {
          clisysVersionRange: '>=2.0.0 <3.0.0',
        },
      },
    });

    await expect(
      loadPluginFromDirectory(rootPath, {
        hostVersion: '0.1.0',
        pluginApiVersion: '1.0.0',
        platform: 'linux',
        architecture: 'x64',
        runtime: 'node',
      })
    ).rejects.toThrow('is incompatible with CLISYS 0.1.0');
  });

  it('rejects incompatible plugin API versions', async () => {
    const rootPath = createPluginFixture({
      manifestOverrides: {
        entrypoint: {
          pluginApiVersion: '>=2.0.0 <3.0.0',
        },
      },
    });

    await expect(
      loadPluginFromDirectory(rootPath, {
        hostVersion: '0.1.0',
        pluginApiVersion: '1.0.0',
        platform: 'linux',
        architecture: 'x64',
        runtime: 'node',
      })
    ).rejects.toThrow('requires plugin API >=2.0.0 <3.0.0');
  });

  it('accepts tilde-style plugin API ranges', async () => {
    const rootPath = createPluginFixture({
      manifestOverrides: {
        entrypoint: {
          pluginApiVersion: '~1.0.0',
        },
      },
    });

    const loaded = await loadPluginFromDirectory(rootPath, {
      hostVersion: '0.1.5',
      pluginApiVersion: '1.0.3',
      platform: 'linux',
      architecture: 'x64',
      runtime: 'node',
    });

    expect(loaded.manifest.entrypoint.pluginApiVersion).toBe('~1.0.0');
  });

  it('rejects missing entrypoint exports', async () => {
    const rootPath = createPluginFixture({
      entrypointContents: 'export const notTheRightExport = () => ({});\n',
    });

    await expect(
      loadPluginFromDirectory(rootPath, {
        hostVersion: '0.1.0',
        pluginApiVersion: '1.0.0',
        platform: 'linux',
        architecture: 'x64',
        runtime: 'node',
      })
    ).rejects.toThrow('must be a callable factory');
  });

  it('rejects unsupported operating systems', async () => {
    const rootPath = createPluginFixture({
      manifestOverrides: {
        compatibility: {
          operatingSystems: ['darwin'],
        },
      },
    });

    await expect(
      loadPluginFromDirectory(rootPath, {
        hostVersion: '0.1.0',
        pluginApiVersion: '1.0.0',
        platform: 'linux',
        architecture: 'x64',
        runtime: 'node',
      })
    ).rejects.toThrow('does not support platform linux');
  });

  it('rejects unsupported architectures', async () => {
    const rootPath = createPluginFixture({
      manifestOverrides: {
        compatibility: {
          architectures: ['arm64'],
        },
      },
    });

    await expect(
      loadPluginFromDirectory(rootPath, {
        hostVersion: '0.1.0',
        pluginApiVersion: '1.0.0',
        platform: 'linux',
        architecture: 'x64',
        runtime: 'node',
      })
    ).rejects.toThrow('does not support architecture x64');
  });

  it('rejects unsupported runtimes', async () => {
    const rootPath = createPluginFixture({
      manifestOverrides: {
        compatibility: {
          runtimes: ['bun'],
        },
      },
    });

    await expect(
      loadPluginFromDirectory(rootPath, {
        hostVersion: '0.1.0',
        pluginApiVersion: '1.0.0',
        platform: 'linux',
        architecture: 'x64',
        runtime: 'node',
      })
    ).rejects.toThrow('does not support runtime node');
  });

  it('rejects non-callable entrypoint exports', async () => {
    const rootPath = createPluginFixture({
      entrypointContents: 'export const createAdapterPlugin = 42;\n',
    });

    await expect(
      loadPluginFromDirectory(rootPath, {
        hostVersion: '0.1.0',
        pluginApiVersion: '1.0.0',
        platform: 'linux',
        architecture: 'x64',
        runtime: 'node',
      })
    ).rejects.toThrow('must be a callable factory');
  });
});

describe('Plugin registry', () => {
  it('registers and retrieves plugins by id', async () => {
    const rootPath = createPluginFixture();
    const loaded = await loadPluginFromDirectory(rootPath, {
      hostVersion: '0.1.0',
      pluginApiVersion: '1.0.0',
    });

    const registry = new PluginRegistry();
    registry.register(loaded);

    expect(registry.has('goose')).toBe(true);
    expect(registry.get('goose')?.manifest.identity.packageName).toBe('@clisys/adapter-goose');
  });
});
