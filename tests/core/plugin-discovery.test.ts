import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverPlugins } from '../../src/core/plugins/discovery.js';

const TEMP_DIRS: string[] = [];

function createPluginRoot(parent: string, name: string) {
  const root = path.join(parent, name);
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({
      name: `@clisys/adapter-${name}`,
      version: '0.1.0',
      type: 'module',
    }),
    'utf8'
  );
  fs.writeFileSync(
    path.join(root, 'clisys-plugin.json'),
    JSON.stringify({
      schema: { manifestVersion: '1.0.0', kind: 'adapter' },
      identity: {
        id: name,
        packageName: `@clisys/adapter-${name}`,
        version: '0.1.0',
        displayName: `${name} Adapter`,
        provider: 'Test',
        description: `Plugin ${name}`,
      },
      entrypoint: {
        module: './dist/index.js',
        export: 'createAdapterPlugin',
        pluginApiVersion: '1.0.0',
      },
      adapter: {
        capabilities: ['analysis'],
        featureFlags: {},
      },
      install: {
        npm: {
          packageName: `@clisys/adapter-${name}`,
        },
      },
      compatibility: {
        clisysVersionRange: '>=0.1.0 <2.0.0',
        operatingSystems: ['darwin', 'linux', 'win32'],
        architectures: ['x64', 'arm64'],
        runtimes: ['bun', 'node'],
      },
      declarations: {
        network: {
          outbound: 'metadata-only',
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
    }),
    'utf8'
  );
  fs.writeFileSync(
    path.join(root, 'dist/index.js'),
    'export const createAdapterPlugin = () => ({ name: "test" });\n',
    'utf8'
  );
}

afterEach(() => {
  while (TEMP_DIRS.length > 0) {
    const dir = TEMP_DIRS.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('discoverPlugins', () => {
  it('discovers plugins from configured directories and their children', async () => {
    const base = fs.mkdtempSync(path.join(tmpdir(), 'clisys-discovery-'));
    TEMP_DIRS.push(base);
    const pluginsDir = path.join(base, 'plugins');
    fs.mkdirSync(pluginsDir, { recursive: true });

    createPluginRoot(pluginsDir, 'goose');
    createPluginRoot(base, 'direct');

    const discovered = await discoverPlugins(
      [pluginsDir, path.join(base, 'direct')],
      {
        hostVersion: '0.1.0',
        pluginApiVersion: '1.0.0',
        platform: 'linux',
        architecture: 'x64',
        runtime: 'node',
      }
    );

    expect(discovered.map((plugin) => plugin.manifest.identity.id).sort()).toEqual([
      'direct',
      'goose',
    ]);
  });
});
