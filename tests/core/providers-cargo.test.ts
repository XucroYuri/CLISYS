import { describe, expect, it, vi } from 'vitest';
import { CargoProvider } from '../../src/core/providers/cargo.js';

describe('CargoProvider', () => {
  it('builds a cargo install plan', async () => {
    const provider = new CargoProvider();
    const plan = await provider.planInstall({
      pluginId: 'code-helper',
      toolId: 'code-helper',
      scope: 'user',
      platform: 'linux',
      architecture: 'x64',
      locator: 'code-helper',
    });

    expect(plan.steps[0].command).toEqual(['cargo', 'install', 'code-helper']);
  });

  it('rejects invalid cargo crate names', async () => {
    const provider = new CargoProvider();

    await expect(
      provider.planInstall({
        pluginId: 'code-helper',
        toolId: 'code-helper',
        scope: 'user',
        platform: 'linux',
        architecture: 'x64',
        locator: '@scope/code-helper',
      })
    ).rejects.toThrow('requires a valid cargo crate name');
  });

  it('supports dry-run upgrades', async () => {
    const runner = vi.fn();
    const provider = new CargoProvider(runner);
    const plan = await provider.planUpgrade({
      pluginId: 'code-helper',
      toolId: 'code-helper',
      scope: 'user',
      platform: 'linux',
      architecture: 'x64',
      locator: 'code-helper',
      dryRun: true,
    });

    const result = await provider.upgrade(plan);

    expect(result.output).toContain('cargo install code-helper --force');
    expect(runner).not.toHaveBeenCalled();
  });

  it('uses a Windows-compatible command lookup on win32', async () => {
    const runner = vi.fn().mockResolvedValue({
      exitCode: 1,
      stdout: '',
      stderr: '',
    });
    const provider = new CargoProvider(runner);

    await provider.detect({
      pluginId: 'code-helper',
      toolId: 'code-helper',
      scope: 'user',
      platform: 'win32',
      architecture: 'x64',
      locator: 'code-helper',
      binaryName: 'code-helper.exe',
    });

    expect(runner).toHaveBeenCalledWith(['where', 'code-helper.exe']);
  });
});
