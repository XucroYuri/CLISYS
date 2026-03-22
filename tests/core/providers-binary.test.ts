import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { BinaryProvider } from '../../src/core/providers/binary.js';

describe('BinaryProvider', () => {
  it('builds a binary install plan with checksum verification', async () => {
    const provider = new BinaryProvider();
    const plan = await provider.planInstall({
      pluginId: 'goose',
      toolId: 'goose',
      scope: 'user',
      platform: 'linux',
      architecture: 'x64',
      locator: 'https://example.com/goose.tar.gz',
      checksum: {
        algorithm: 'sha256',
        value: 'abc123',
      },
      metadata: {
        targetDir: '.clisys/bin',
      },
    });

    expect(plan.steps[0].command).toEqual([
      'curl',
      '-fsSL',
      'https://example.com/goose.tar.gz',
      '-o',
      '.clisys/bin/goose.download',
    ]);
    expect(plan.steps[1].command[0]).toBe('verify-checksum');
  });

  it('rejects non-https binary sources', async () => {
    const provider = new BinaryProvider();

    await expect(
      provider.planInstall({
        pluginId: 'goose',
        toolId: 'goose',
        scope: 'user',
        platform: 'linux',
        architecture: 'x64',
        locator: 'http://example.com/goose.tar.gz',
        checksum: {
          algorithm: 'sha256',
          value: 'abc123',
        },
      })
    ).rejects.toThrow('only supports https download sources');
  });

  it('supports dry-run installs', async () => {
    const runner = vi.fn();
    const provider = new BinaryProvider(runner);
    const plan = await provider.planInstall({
      pluginId: 'goose',
      toolId: 'goose',
      scope: 'user',
      platform: 'linux',
      architecture: 'x64',
      locator: 'https://example.com/goose.tar.gz',
      checksum: {
        algorithm: 'sha256',
        value: 'abc123',
      },
      dryRun: true,
    });

    const result = await provider.install(plan);

    expect(result.output).toContain('curl -fsSL https://example.com/goose.tar.gz');
    expect(result.output).toContain('verify-checksum sha256 abc123');
    expect(runner).not.toHaveBeenCalled();
  });

  it('defaults binary installs to a user home directory target', async () => {
    const provider = new BinaryProvider();
    const plan = await provider.planInstall({
      pluginId: 'goose',
      toolId: 'goose',
      scope: 'user',
      platform: 'linux',
      architecture: 'x64',
      locator: 'https://example.com/goose.tar.gz',
      checksum: {
        algorithm: 'sha256',
        value: 'abc123',
      },
    });

    expect(plan.steps[0].command).toEqual([
      'curl',
      '-fsSL',
      'https://example.com/goose.tar.gz',
      '-o',
      path.join(os.homedir(), '.clisys', 'bin', 'goose.download'),
    ]);
  });

  it('uses a Windows-compatible command lookup on win32', async () => {
    const runner = vi.fn().mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: '',
    });
    const provider = new BinaryProvider(runner);

    await provider.detect({
      pluginId: 'goose',
      toolId: 'goose',
      scope: 'user',
      platform: 'win32',
      architecture: 'x64',
      locator: 'https://example.com/goose.tar.gz',
      binaryName: 'goose.exe',
      checksum: {
        algorithm: 'sha256',
        value: 'abc123',
      },
    });

    expect(runner).toHaveBeenCalledWith(['where', 'goose.exe']);
  });
});
