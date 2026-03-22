import { describe, expect, it, vi } from 'vitest';
import { PipxProvider } from '../../src/core/providers/pipx.js';

describe('PipxProvider', () => {
  it('builds a pipx install plan', async () => {
    const provider = new PipxProvider();
    const plan = await provider.planInstall({
      pluginId: 'python-agent',
      toolId: 'python-agent',
      scope: 'user',
      platform: 'linux',
      architecture: 'x64',
      locator: 'python-agent-cli',
    });

    expect(plan.steps[0].command).toEqual(['pipx', 'install', 'python-agent-cli']);
  });

  it('rejects invalid pipx package names', async () => {
    const provider = new PipxProvider();

    await expect(
      provider.planInstall({
        pluginId: 'python-agent',
        toolId: 'python-agent',
        scope: 'user',
        platform: 'linux',
        architecture: 'x64',
        locator: 'https://example.com/package.whl',
      })
    ).rejects.toThrow('requires a valid pipx package name');
  });

  it('supports dry-run upgrades', async () => {
    const runner = vi.fn();
    const provider = new PipxProvider(runner);
    const plan = await provider.planUpgrade({
      pluginId: 'python-agent',
      toolId: 'python-agent',
      scope: 'user',
      platform: 'linux',
      architecture: 'x64',
      locator: 'python-agent-cli',
      dryRun: true,
    });

    const result = await provider.upgrade(plan);

    expect(result.output).toContain('pipx upgrade python-agent-cli');
    expect(runner).not.toHaveBeenCalled();
  });
});
