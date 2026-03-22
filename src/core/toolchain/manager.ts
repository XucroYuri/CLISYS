import { ProviderRegistry } from '../providers/registry.js';
import type { ProviderPlan, ProviderRequest, ToolchainProvider } from '../providers/types.js';
import {
  DEFAULT_TOOLCHAIN_POLICY,
  evaluateToolchainPolicy,
  type ToolchainPolicy,
  type ToolchainPolicyDecision,
} from './policy-gate.js';
import { ToolchainLockManager } from './locks.js';
import { ToolchainStateStore, type ToolchainStateRecord } from './state-store.js';
import { detectToolchain } from './detector.js';
import { planInstallForToolchain } from './planner.js';
import { verifyToolchainActivation, type ToolchainVerificationResult } from './verifier.js';

export interface ToolchainManagerOptions {
  stateStore?: ToolchainStateStore;
  lockManager?: ToolchainLockManager;
  policy?: ToolchainPolicy;
}

export interface EnsureToolchainResult {
  state: ToolchainStateRecord;
  policyDecision?: ToolchainPolicyDecision;
  plan?: ProviderPlan;
  verification?: ToolchainVerificationResult;
  activatedProvider?: string;
}

export class ToolchainManager {
  private readonly stateStore: ToolchainStateStore;
  private readonly lockManager: ToolchainLockManager;
  private readonly policy: ToolchainPolicy;

  constructor(
    private readonly registry: ProviderRegistry,
    options: ToolchainManagerOptions = {}
  ) {
    this.stateStore = options.stateStore ?? new ToolchainStateStore();
    this.lockManager = options.lockManager ?? new ToolchainLockManager();
    this.policy = options.policy ?? DEFAULT_TOOLCHAIN_POLICY;
  }

  async ensureToolchain(request: ProviderRequest): Promise<EnsureToolchainResult> {
    const key = `${request.toolId}@${request.scope}`;
    this.stateStore.initialize(key);

    const detections = await detectToolchain(this.registry, request);
    const installed = detections.find((candidate) => candidate.detection.installed);

    if (installed) {
      this.stateStore.transition(key, 'detected', { provider: installed.providerName });
      this.stateStore.transition(key, 'verified', { provider: installed.providerName });
      const active = this.stateStore.transition(key, 'active', { provider: installed.providerName });

      return {
        state: active,
        activatedProvider: installed.providerName,
      };
    }

    this.stateStore.transition(key, 'missing');
    const plan = await planInstallForToolchain(this.registry, request);
    this.stateStore.transition(key, 'plan_ready', { provider: plan.provider });

    const policyDecision = evaluateToolchainPolicy(
      {
        action: 'install',
        scope: request.scope,
      },
      this.policy
    );

    if (policyDecision.decision === 'confirm') {
      const awaiting = this.stateStore.transition(key, 'awaiting_confirmation', {
        provider: plan.provider,
      });

      return {
        state: awaiting,
        policyDecision,
        plan,
      };
    }

    if (policyDecision.decision === 'deny') {
      const blocked = this.stateStore.transition(key, 'blocked_by_policy', {
        provider: plan.provider,
      });

      return {
        state: blocked,
        policyDecision,
        plan,
      };
    }

    const provider = this.registry.get(plan.provider);
    if (!provider) {
      throw new Error(`Provider "${plan.provider}" is not registered`);
    }

    const lock = this.lockManager.acquire(key, `ensure:${key}`);

    try {
      this.stateStore.transition(key, 'installing', { provider: provider.name });
      const execution = await provider.install(plan);

      if (!execution.success) {
        this.stateStore.transition(key, 'rollback_pending', { provider: provider.name });
        const rolledBack = this.stateStore.transition(key, 'rolled_back', { provider: provider.name });
        return {
          state: rolledBack,
          policyDecision,
          plan,
        };
      }

      this.stateStore.transition(key, 'installed_unverified', { provider: provider.name });
      const verification = await verifyToolchainActivation(provider, request, execution);

      if (!verification.success) {
        this.stateStore.transition(key, 'rollback_pending', {
          provider: provider.name,
          reason: verification.reason,
        });
        const quarantined = this.stateStore.transition(key, 'quarantined', {
          provider: provider.name,
          reason: verification.reason,
        });

        return {
          state: quarantined,
          policyDecision,
          plan,
          verification,
        };
      }

      this.stateStore.transition(key, 'verified', { provider: provider.name });
      const active = this.stateStore.transition(key, 'active', { provider: provider.name });

      return {
        state: active,
        policyDecision,
        plan,
        verification,
        activatedProvider: provider.name,
      };
    } finally {
      this.lockManager.release(lock);
    }
  }
}
