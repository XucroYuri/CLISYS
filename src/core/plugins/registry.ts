import type { PluginManifest } from './manifest.js';

export interface RegisteredPlugin {
  manifest: PluginManifest;
  rootPath: string;
  manifestPath: string;
  packageJsonPath: string;
  entrypointPath: string;
}

export class PluginRegistry {
  private readonly plugins = new Map<string, RegisteredPlugin>();

  register(plugin: RegisteredPlugin): void {
    if (this.plugins.has(plugin.manifest.identity.id)) {
      throw new Error(`Plugin "${plugin.manifest.identity.id}" is already registered`);
    }

    this.plugins.set(plugin.manifest.identity.id, plugin);
  }

  unregister(id: string): void {
    this.plugins.delete(id);
  }

  get(id: string): RegisteredPlugin | undefined {
    return this.plugins.get(id);
  }

  has(id: string): boolean {
    return this.plugins.has(id);
  }

  getAll(): RegisteredPlugin[] {
    return Array.from(this.plugins.values());
  }

  clear(): void {
    this.plugins.clear();
  }
}
