import * as fs from 'node:fs';
import * as path from 'node:path';
import type { LoadedPluginModule, PluginLoaderOptions } from './loader.js';
import { loadPluginFromDirectory } from './loader.js';

function isPluginRoot(directory: string, manifestFileName: string): boolean {
  return (
    fs.existsSync(path.join(directory, manifestFileName)) &&
    fs.existsSync(path.join(directory, 'package.json'))
  );
}

export async function discoverPlugins(
  directories: string[],
  options: PluginLoaderOptions
): Promise<LoadedPluginModule[]> {
  const manifestFileName = options.manifestFileName ?? 'clisys-plugin.json';
  const results: LoadedPluginModule[] = [];
  const seenRoots = new Set<string>();

  for (const directory of directories) {
    if (!fs.existsSync(directory)) {
      continue;
    }

    const candidates: string[] = [];
    if (isPluginRoot(directory, manifestFileName)) {
      candidates.push(directory);
    }

    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      const child = path.join(directory, entry.name);
      if (isPluginRoot(child, manifestFileName)) {
        candidates.push(child);
      }
    }

    for (const candidate of candidates) {
      if (seenRoots.has(candidate)) {
        continue;
      }

      seenRoots.add(candidate);
      results.push(await loadPluginFromDirectory(candidate, options));
    }
  }

  return results;
}
