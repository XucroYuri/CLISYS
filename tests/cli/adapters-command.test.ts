import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function createWorkspace(withPlugin = false) {
  const rootDir = mkdtempSync(path.join(tmpdir(), 'clisys-adapters-home-'));
  const homeDir = path.join(rootDir, 'home');
  const workDir = path.join(rootDir, 'workspace');
  mkdirSync(homeDir, { recursive: true });
  mkdirSync(workDir, { recursive: true });

  if (withPlugin) {
    const pluginRoot = path.join(workDir, 'plugins', 'goose');
    mkdirSync(path.join(pluginRoot, 'dist'), { recursive: true });
    writeFileSync(
      path.join(pluginRoot, 'package.json'),
      JSON.stringify({
        name: '@clisys/adapter-goose',
        version: '0.1.0',
        type: 'module',
      }),
      'utf8'
    );
    writeFileSync(
      path.join(pluginRoot, 'clisys-plugin.json'),
      JSON.stringify({
        schema: { manifestVersion: '1.0.0', kind: 'adapter' },
        identity: {
          id: 'goose',
          packageName: '@clisys/adapter-goose',
          version: '0.1.0',
          displayName: 'Goose Adapter',
          provider: 'Block',
          description: 'Plugin-backed Goose CLI adapter',
        },
        entrypoint: {
          module: './dist/index.js',
          export: 'createAdapterPlugin',
          pluginApiVersion: '1.0.0',
        },
        adapter: {
          capabilities: ['analysis', 'interactive'],
          featureFlags: {},
        },
        install: {
          npm: {
            packageName: '@clisys/adapter-goose',
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
    writeFileSync(
      path.join(pluginRoot, 'dist/index.js'),
      `export const createAdapterPlugin = () => ({ name: 'goose' });\n`,
      'utf8'
    );

    writeFileSync(
      path.join(workDir, 'clisys.toml'),
      `version = "1.0"

[plugins]
directories = ["./plugins"]
`,
      'utf8'
    );
  }

  return { rootDir, homeDir, workDir };
}

function runCli(args: string[], withPlugin = false) {
  const { rootDir, homeDir, workDir } = createWorkspace(withPlugin);
  const cliEntry = withPlugin
    ? path.join(process.cwd(), 'src/cli/index.ts')
    : 'src/cli/index.ts';

  try {
    return spawnSync('bun', ['run', cliEntry, ...args], {
      cwd: withPlugin ? workDir : process.cwd(),
      encoding: 'utf8',
      env: {
        HOME: homeDir,
        USERPROFILE: homeDir,
        PATH: process.env.PATH ?? '',
      },
    });
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
}

describe('Adapters command', () => {
  it('lists gemini as an enabled built-in adapter', () => {
    const result = runCli(['adapters']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Enabled:');
    expect(result.stdout).toContain('✓ gemini');
    expect(result.stdout).not.toContain('○ gemini          - Google Gemini CLI for AI-assisted coding');
  });

  it('shows gemini details as available and enabled', () => {
    const result = runCli(['adapters', '--show', 'gemini']);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Gemini CLI');
    expect(result.stdout).toContain('Provider: Google');
    expect(result.stdout).toContain('Status: available');
    expect(result.stdout).toContain('Enabled: Yes');
    expect(result.stdout).toContain('multi_modal');
    expect(result.stdout).toContain('long_context');
  });

  it('lists discovered plugin adapters from configured plugin directories', () => {
    const result = runCli(['adapters'], true);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('✓ goose');
    expect(result.stdout).toContain('Plugin-backed Goose CLI adapter');
  });
});
