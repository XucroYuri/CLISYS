import type { ProviderDetectionResult, ProviderRequest } from '../providers/types.js';
import { ProviderRegistry } from '../providers/registry.js';

export interface ToolchainDetection {
  providerName: string;
  detection: ProviderDetectionResult;
}

export async function detectToolchain(
  registry: ProviderRegistry,
  request: ProviderRequest
): Promise<ToolchainDetection[]> {
  const providers = registry.getAvailable({
    platform: request.platform,
    scope: request.scope,
  });

  const detections = await Promise.all(
    providers.map(async (provider) => ({
      providerName: provider.name,
      detection: await provider.detect(request),
    }))
  );

  return detections;
}
