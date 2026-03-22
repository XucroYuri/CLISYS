/**
 * CLISYS Adapters Command
 * 列出和管理适配器
 */

import { Command, Option } from 'clipanion';
import { getAdapterDisplayEntries } from '../../adapters/catalog.js';
import { discoverPlugins } from '../../core/plugins/discovery.js';
import { getConfig } from '../../core/config/index.js';

export class AdaptersCommand extends Command {
  static paths = [['adapters'], ['adapter']];

  static usage = Command.Usage({
    description: 'List and manage available CLI adapters',
    examples: [
      ['List all adapters', 'clisys adapters'],
      ['Show adapter details', 'clisys adapters --show claude-code'],
    ],
  });

  show = Option.String('--show', {
    description: 'Show details for a specific adapter',
  });

  async execute() {
    const { show } = this;
    const config = getConfig();
    const builtInAdapters = getAdapterDisplayEntries(config.adapters);
    const discoveredPlugins = await discoverPlugins(config.plugins.directories, {
      hostVersion: '0.1.0',
      pluginApiVersion: '1.0.0',
      platform: process.platform,
      architecture: process.arch,
      runtime: typeof Bun !== 'undefined' ? 'bun' : 'node',
    });
    const pluginAdapters = discoveredPlugins.map((plugin) => ({
      name: plugin.manifest.identity.id,
      displayName: plugin.manifest.identity.displayName,
      provider: plugin.manifest.identity.provider,
      description: plugin.manifest.identity.description,
      capabilities: plugin.manifest.adapter.capabilities,
      status: 'available' as const,
      enabled: true,
    }));
    const adapters = [...builtInAdapters, ...pluginAdapters];

    if (show) {
      const adapter = adapters.find(a => a.name === show);
      if (!adapter) {
        this.context.stderr.write(`Adapter "${show}" not found.\n`);
        return 1;
      }

      this.context.stdout.write(`\n${adapter.displayName}\n`);
      this.context.stdout.write(`${'='.repeat(adapter.displayName.length)}\n\n`);
      this.context.stdout.write(`Provider: ${adapter.provider}\n`);
      this.context.stdout.write(`Description: ${adapter.description}\n`);
      this.context.stdout.write(`Status: ${adapter.status}\n`);
      this.context.stdout.write(`Enabled: ${adapter.enabled ? 'Yes' : 'No'}\n`);
      this.context.stdout.write(`\nCapabilities:\n`);
      adapter.capabilities.forEach(cap => {
        this.context.stdout.write(`  • ${cap}\n`);
      });

      return 0;
    }

    // 列出所有适配器
    this.context.stdout.write('\nAvailable CLI Adapters\n');
    this.context.stdout.write('=======================\n\n');

    const enabled = adapters.filter((adapter) => adapter.status === 'available' && adapter.enabled);
    const disabled = adapters.filter((adapter) => adapter.status === 'available' && !adapter.enabled);
    const planned = adapters.filter((adapter) => adapter.status === 'planned');

    if (enabled.length > 0) {
      this.context.stdout.write('Enabled:\n');
      enabled.forEach(adapter => {
        const status = adapter.status === 'available' ? '✓' : '○';
        this.context.stdout.write(`  ${status} ${adapter.name.padEnd(15)} - ${adapter.description}\n`);
      });
    }

    if (disabled.length > 0) {
      this.context.stdout.write('\nAvailable (not enabled):\n');
      disabled.forEach(adapter => {
        this.context.stdout.write(`  ○ ${adapter.name.padEnd(15)} - ${adapter.description}\n`);
      });
    }

    if (planned.length > 0) {
      this.context.stdout.write('\nPlanned:\n');
      planned.forEach((adapter) => {
        this.context.stdout.write(`  ○ ${adapter.name.padEnd(15)} - ${adapter.description}\n`);
      });
    }

    this.context.stdout.write('\nUse --show <name> for detailed information.\n');

    return 0;
  }
}
