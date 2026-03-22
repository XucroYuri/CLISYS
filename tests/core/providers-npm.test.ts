import { describe, expect, it, vi } from 'vitest';
import { NpmProvider } from '../../src/core/providers/npm.js';

describe('NpmProvider', () => {
  it('builds an npm install plan', async () => {
    const provider = new NpmProvider();
    const plan = await provider.planInstall({
      pluginId: 'goose',
      toolId: 'goose',
      scope: 'user',
      platform: 'linux',
      architecture: 'x64',
      locator: '@clisys/adapter-goose',
    });

    expect(plan.steps[0].command).toEqual(['npm', 'install', '--global', '@clisys/adapter-goose']);
  });

  it('rejects system-scope npm installs', async () => {
    const provider = new NpmProvider();

    await expect(
      provider.planInstall({
        pluginId: 'goose',
        toolId: 'goose',
        scope: 'system',
        platform: 'linux',
        architecture: 'x64',
        locator: '@clisys/adapter-goose',
      })
    ).rejects.toThrow('only supports user scope');
  });

  it('supports dry-run installs', async () => {
    const runner = vi.fn();
    const provider = new NpmProvider(runner);
    const plan = await provider.planInstall({
      pluginId: 'goose',
      toolId: 'goose',
      scope: 'user',
      platform: 'linux',
      architecture: 'x64',
      locator: '@clisys/adapter-goose',
      dryRun: true,
    });

    const result = await provider.install(plan);

    expect(result.output).toContain('npm install --global @clisys/adapter-goose');
    expect(runner).not.toHaveBeenCalled();
  });

  it('uses a Windows-compatible command lookup on win32', async () => {
    const runner = vi.fn().mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: '',
    });
    const provider = new NpmProvider(runner);

    await provider.detect({
      pluginId: 'goose',
      toolId: 'goose',
      scope: 'user',
      platform: 'win32',
      architecture: 'x64',
      locator: '@clisys/adapter-goose',
      binaryName: 'goose.exe',
    });

    expect(runner).toHaveBeenCalledWith(['where', 'goose.exe']);
  });
});
