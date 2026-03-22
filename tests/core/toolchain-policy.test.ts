import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TOOLCHAIN_POLICY,
  evaluateToolchainPolicy,
} from '../../src/core/toolchain/policy-gate.js';

describe('evaluateToolchainPolicy', () => {
  it('allows user-scope installs by default', () => {
    const result = evaluateToolchainPolicy({
      action: 'install',
      scope: 'user',
    });

    expect(result.decision).toBe('allow');
    expect(result.reason).toContain('Policy allows');
  });

  it('requires confirmation for system-scope installs', () => {
    const result = evaluateToolchainPolicy({
      action: 'install',
      scope: 'system',
    });

    expect(result.decision).toBe('confirm');
    expect(result.reason).toContain('system scope');
    expect(result.riskLabels).toContain('system-scope');
  });

  it('requires confirmation for destructive upgrades by default', () => {
    const result = evaluateToolchainPolicy({
      action: 'upgrade',
      scope: 'user',
      destructive: true,
    });

    expect(result.decision).toBe('confirm');
    expect(result.reason).toContain('Destructive actions');
    expect(result.riskLabels).toContain('destructive');
  });

  it('allows destructive actions when policy explicitly permits them', () => {
    const result = evaluateToolchainPolicy(
      {
        action: 'upgrade',
        scope: 'user',
        destructive: true,
      },
      {
        ...DEFAULT_TOOLCHAIN_POLICY,
        allowDestructiveAutoActions: true,
      }
    );

    expect(result.decision).toBe('allow');
  });
});
