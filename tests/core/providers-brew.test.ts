import { describe, expect, it, vi } from 'vitest';
import { BrewProvider } from '../../src/core/providers/brew.js';

describe('BrewProvider', () => {
  it('builds a brew install plan', async () => {
    const provider = new BrewProvider();
    const plan = await provider.planInstall({
      pluginId: 'goose',
      toolId: 'goose',
      scope: 'system',
      platform: 'darwin',
      architecture: 'arm64',
      locator: 'goose-cli',
    });

    expect(plan.steps[0].command).toEqual(['brew', 'install', 'goose-cli']);
  });

  it('returns a dry-run execution result without invoking the runner', async () => {
    const runner = vi.fn();
    const provider = new BrewProvider(runner);
    const plan = await provider.planInstall({
      pluginId: 'goose',
      toolId: 'goose',
      scope: 'system',
      platform: 'darwin',
      architecture: 'arm64',
      locator: 'goose-cli',
      dryRun: true,
    });

    const result = await provider.install(plan);

    expect(result.success).toBe(true);
    expect(result.output).toContain('brew install goose-cli');
    expect(runner).not.toHaveBeenCalled();
  });

  it('rejects user-scope brew installs', async () => {
    const provider = new BrewProvider();

    await expect(
      provider.planInstall({
        pluginId: 'goose',
        toolId: 'goose',
        scope: 'user',
        platform: 'darwin',
        architecture: 'arm64',
        locator: 'goose-cli',
      })
    ).rejects.toThrow('only supports system scope');
  });
});
