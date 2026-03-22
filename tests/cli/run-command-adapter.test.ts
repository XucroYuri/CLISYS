import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

function createIsolatedWorkspace(geminiEnabled = true, withPlugin = false) {
  const rootDir = mkdtempSync(path.join(tmpdir(), 'clisys-run-test-'));
  const homeDir = path.join(rootDir, 'home');
  const binDir = path.join(rootDir, 'bin');
  const workDir = path.join(rootDir, 'workspace');

  mkdirSync(homeDir, { recursive: true });
  mkdirSync(binDir, { recursive: true });
  mkdirSync(path.join(workDir, '.clisys', 'data'), { recursive: true });

  const fakeGeminiPath = path.join(binDir, 'fake-gemini');
  writeFileSync(
    fakeGeminiPath,
    `#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "gemini-test 0.0.1"
  exit 0
fi
echo "fake gemini output"
exit 0
`,
    'utf8'
  );
  chmodSync(fakeGeminiPath, 0o755);

  let configContent = `version = "1.0"

[adapters.gemini]
enabled = ${geminiEnabled ? 'true' : 'false'}
command = "${fakeGeminiPath}"
defaultModel = "gemini-test-model"
`;

  if (withPlugin) {
    const fakeGoosePath = path.join(binDir, 'goose');
    writeFileSync(
      fakeGoosePath,
      `#!/bin/sh
echo "fake goose tool"
exit 0
`,
      'utf8'
    );
    chmodSync(fakeGoosePath, 0o755);

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
          capabilities: ['analysis'],
          featureFlags: {},
        },
        install: {
          npm: {
            packageName: '@clisys/adapter-goose',
            bin: 'goose',
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
      `import { BaseAdapter } from ${JSON.stringify(pathToFileURL(path.join(process.cwd(), 'src/core/adapter/BaseAdapter.js')).href)};
export const createAdapterPlugin = () => new (class GooseAdapter extends BaseAdapter {
  constructor() {
    super({
      name: 'goose',
      version: '0.1.0',
      description: 'Plugin Goose Adapter',
      capabilities: ['analysis'],
    });
  }
  async initialize() {}
  async healthCheck() {
    return this.createHealthCheckResult('healthy', 'ok');
  }
  async shutdown() {}
  async execute(request) {
    return this.createSuccessResult(request.taskId, 'fake goose adapter output');
  }
})();\n`,
      'utf8'
    );

    configContent += `
[plugins]
directories = ["./plugins"]
`;
  }

  writeFileSync(path.join(workDir, 'clisys.toml'), configContent, 'utf8');

  return {
    rootDir,
    homeDir,
    workDir,
    fakeGeminiPath,
  };
}

function runCli(workDir: string, homeDir: string, args: string[]) {
  return spawnSync('bun', ['run', path.join(process.cwd(), 'src/cli/index.ts'), ...args], {
    cwd: workDir,
    encoding: 'utf8',
    env: {
      HOME: homeDir,
      USERPROFILE: homeDir,
      PATH: `${path.join(path.dirname(homeDir), 'bin')}:${process.env.PATH ?? ''}`,
    },
  });
}

describe('Run command adapter selection', () => {
  it('supports --adapter gemini through the real CLI path', () => {
    const { rootDir, homeDir, workDir } = createIsolatedWorkspace();

    try {
      const result = runCli(workDir, homeDir, ['run', 'smoke', '--adapter', 'gemini']);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('fake gemini output');
      expect(result.stderr).not.toContain('Unsupported option name');
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('rejects planned adapters through the real CLI path', () => {
    const { rootDir, homeDir, workDir } = createIsolatedWorkspace();

    try {
      const result = runCli(workDir, homeDir, ['run', 'smoke', '--adapter', 'opencode']);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('not a supported built-in adapter');
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('rejects disabled built-in adapters through the real CLI path', () => {
    const { rootDir, homeDir, workDir } = createIsolatedWorkspace(false);

    try {
      const result = runCli(workDir, homeDir, ['run', 'smoke', '--adapter', 'gemini']);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain('disabled in configuration');
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('supports discovered plugin adapters through the real CLI path', () => {
    const { rootDir, homeDir, workDir } = createIsolatedWorkspace(true, true);

    try {
      const result = runCli(workDir, homeDir, ['run', 'smoke', '--adapter', 'goose']);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('fake goose adapter output');
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
