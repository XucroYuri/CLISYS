import type { BaseAdapter } from '../adapter/BaseAdapter.js';
import type { PluginManifest } from './manifest.js';
import { validatePluginManifest } from './validator.js';

export type AdapterPluginFactory = (...args: never[]) => BaseAdapter;

export interface AdapterPluginDefinition {
  manifest: PluginManifest;
  createAdapterPlugin: AdapterPluginFactory;
}

export function createPluginManifest(manifest: PluginManifest): PluginManifest {
  return validatePluginManifest(manifest);
}

export function createPluginManifestBuilder(
  defaults: PluginManifest
): (overrides?: Partial<PluginManifest>) => PluginManifest {
  return (overrides = {}) =>
    validatePluginManifest(deepMerge(defaults, overrides) as PluginManifest);
}

export function defineAdapterPlugin(
  manifest: PluginManifest,
  factory: AdapterPluginFactory
): AdapterPluginDefinition {
  return {
    manifest: validatePluginManifest(manifest),
    createAdapterPlugin: factory,
  };
}

function deepMerge<T>(base: T, override: Partial<T>): T {
  if (Array.isArray(base) || Array.isArray(override)) {
    return (override ?? base) as T;
  }

  if (
    base &&
    typeof base === 'object' &&
    override &&
    typeof override === 'object'
  ) {
    const output: Record<string, unknown> = { ...(base as Record<string, unknown>) };

    for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
      const existing = output[key];
      if (
        existing &&
        typeof existing === 'object' &&
        !Array.isArray(existing) &&
        value &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        output[key] = deepMerge(existing, value as Record<string, unknown>);
      } else {
        output[key] = value;
      }
    }

    return output as T;
  }

  return (override ?? base) as T;
}
