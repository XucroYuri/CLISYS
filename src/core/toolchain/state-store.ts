export const TOOLCHAIN_STATES = [
  'undetected',
  'detected',
  'missing',
  'plan_ready',
  'awaiting_confirmation',
  'installing',
  'installed_unverified',
  'verified',
  'active',
  'upgrade_available',
  'upgrading',
  'rollback_pending',
  'rolled_back',
  'degraded',
  'incompatible',
  'blocked_by_policy',
  'quarantined',
] as const;

export type ToolchainState = (typeof TOOLCHAIN_STATES)[number];

export interface ToolchainStateRecord {
  key: string;
  state: ToolchainState;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

const ALLOWED_TRANSITIONS: Record<ToolchainState, ToolchainState[]> = {
  undetected: ['detected', 'missing', 'blocked_by_policy'],
  detected: ['plan_ready', 'verified', 'incompatible', 'degraded', 'blocked_by_policy'],
  missing: ['plan_ready', 'blocked_by_policy'],
  plan_ready: ['awaiting_confirmation', 'installing', 'blocked_by_policy'],
  awaiting_confirmation: ['installing', 'blocked_by_policy'],
  installing: ['installed_unverified', 'rollback_pending', 'quarantined', 'degraded'],
  installed_unverified: ['verified', 'rollback_pending', 'quarantined', 'degraded'],
  verified: ['active', 'quarantined'],
  active: ['upgrade_available', 'degraded', 'incompatible', 'quarantined'],
  upgrade_available: ['upgrading', 'awaiting_confirmation', 'blocked_by_policy'],
  upgrading: ['installed_unverified', 'rollback_pending', 'quarantined', 'degraded'],
  rollback_pending: ['rolled_back', 'quarantined'],
  rolled_back: ['active', 'degraded', 'quarantined'],
  degraded: ['plan_ready', 'rollback_pending', 'quarantined', 'active'],
  incompatible: ['plan_ready', 'quarantined'],
  blocked_by_policy: ['plan_ready', 'awaiting_confirmation'],
  quarantined: ['plan_ready'],
};

export class ToolchainStateStore {
  private readonly states = new Map<string, ToolchainStateRecord>();

  get(key: string): ToolchainStateRecord | undefined {
    return this.states.get(key);
  }

  list(): ToolchainStateRecord[] {
    return Array.from(this.states.values());
  }

  initialize(
    key: string,
    state: ToolchainState = 'undetected',
    metadata?: Record<string, unknown>
  ): ToolchainStateRecord {
    const record: ToolchainStateRecord = {
      key,
      state,
      updatedAt: new Date(),
      metadata,
    };

    this.states.set(key, record);
    return record;
  }

  transition(
    key: string,
    nextState: ToolchainState,
    metadata?: Record<string, unknown>
  ): ToolchainStateRecord {
    const current = this.states.get(key) ?? this.initialize(key);

    if (!ALLOWED_TRANSITIONS[current.state].includes(nextState)) {
      throw new Error(
        `Invalid toolchain state transition: ${current.state} -> ${nextState}`
      );
    }

    const updated: ToolchainStateRecord = {
      key,
      state: nextState,
      updatedAt: new Date(),
      metadata: metadata ?? current.metadata,
    };

    this.states.set(key, updated);
    return updated;
  }
}
