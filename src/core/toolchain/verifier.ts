import type { ProviderExecutionResult, ProviderRequest, ToolchainProvider } from '../providers/types.js';

export interface ToolchainVerificationResult {
  success: boolean;
  reason: string;
}

export async function verifyToolchainActivation(
  provider: ToolchainProvider,
  request: ProviderRequest,
  execution: ProviderExecutionResult
): Promise<ToolchainVerificationResult> {
  if (!execution.success) {
    return {
      success: false,
      reason: execution.error ?? 'Execution failed',
    };
  }

  const detection = await provider.detect(request);
  if (!detection.installed) {
    return {
      success: false,
      reason: 'Installed tool was not detectable after execution',
    };
  }

  return {
    success: true,
    reason: 'Toolchain verified successfully',
  };
}
