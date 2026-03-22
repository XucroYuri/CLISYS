import type { ProviderScope } from '../providers/types.js';

export interface ToolchainPolicy {
  autoInstallScopes: ProviderScope[];
  autoUpgradeScopes: ProviderScope[];
  allowDestructiveAutoActions: boolean;
}

export interface ToolchainPolicyInput {
  action: 'install' | 'upgrade' | 'uninstall';
  scope: ProviderScope;
  destructive?: boolean;
}

export interface ToolchainPolicyDecision {
  decision: 'allow' | 'confirm' | 'deny';
  reason: string;
  riskLabels: string[];
}

export const DEFAULT_TOOLCHAIN_POLICY: ToolchainPolicy = {
  autoInstallScopes: ['user'],
  autoUpgradeScopes: ['user'],
  allowDestructiveAutoActions: false,
};

export function evaluateToolchainPolicy(
  input: ToolchainPolicyInput,
  policy: ToolchainPolicy = DEFAULT_TOOLCHAIN_POLICY
): ToolchainPolicyDecision {
  const riskLabels: string[] = [];

  if (input.scope === 'system') {
    riskLabels.push('system-scope');
  }

  if (input.destructive) {
    riskLabels.push('destructive');
  }

  if (input.action === 'uninstall') {
    riskLabels.push('destructive');
  }

  if (input.action === 'install') {
    if (!policy.autoInstallScopes.includes(input.scope)) {
      return {
        decision: 'confirm',
        reason: `Auto-install is not allowed for ${input.scope} scope`,
        riskLabels,
      };
    }
  }

  if (input.action === 'upgrade') {
    if (!policy.autoUpgradeScopes.includes(input.scope)) {
      return {
        decision: 'confirm',
        reason: `Auto-upgrade is not allowed for ${input.scope} scope`,
        riskLabels,
      };
    }
  }

  if ((input.destructive || input.action === 'uninstall') && !policy.allowDestructiveAutoActions) {
    return {
      decision: 'confirm',
      reason: 'Destructive actions require confirmation',
      riskLabels,
    };
  }

  return {
    decision: 'allow',
    reason: 'Policy allows automatic execution',
    riskLabels,
  };
}
