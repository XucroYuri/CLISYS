import type {
  ProviderName,
  ProviderScope,
  ToolchainProvider,
} from './types.js';

export interface ProviderRegistryOptions {
  allowlist?: ProviderName[];
}

export class ProviderRegistry {
  private readonly providers = new Map<ProviderName, ToolchainProvider>();
  private readonly allowlist: Set<ProviderName> | null;

  constructor(options: ProviderRegistryOptions = {}) {
    this.allowlist = options.allowlist ? new Set(options.allowlist) : null;
  }

  register(provider: ToolchainProvider): void {
    this.assertAllowed(provider.name);

    if (this.providers.has(provider.name)) {
      throw new Error(`Provider "${provider.name}" is already registered`);
    }

    this.providers.set(provider.name, provider);
  }

  unregister(name: ProviderName): void {
    this.providers.delete(name);
  }

  get(name: ProviderName): ToolchainProvider | undefined {
    return this.providers.get(name);
  }

  has(name: ProviderName): boolean {
    return this.providers.has(name);
  }

  getAll(): ToolchainProvider[] {
    return Array.from(this.providers.values());
  }

  getAvailable(options: {
    platform: NodeJS.Platform;
    scope?: ProviderScope;
  }): ToolchainProvider[] {
    return this.getAll().filter((provider) => {
      const supportsScope = options.scope
        ? provider.supportedScopes.includes(options.scope)
        : true;

      return supportsScope && provider.supportsPlatform(options.platform);
    });
  }

  private assertAllowed(name: ProviderName): void {
    if (this.allowlist && !this.allowlist.has(name)) {
      throw new Error(`Provider "${name}" is not allowed by registry policy`);
    }
  }
}
