import { ProviderRegistry } from '../providers/registry.js';
import type { ProviderPlan, ProviderRequest } from '../providers/types.js';

export async function planInstallForToolchain(
  registry: ProviderRegistry,
  request: ProviderRequest
): Promise<ProviderPlan> {
  const provider = registry
    .getAvailable({
      platform: request.platform,
      scope: request.scope,
    })[0];

  if (!provider) {
    throw new Error(`No provider available for ${request.toolId} on ${request.platform}`);
  }

  return provider.planInstall(request);
}
