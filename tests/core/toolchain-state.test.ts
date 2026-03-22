import { describe, expect, it } from 'vitest';
import { ToolchainLockManager } from '../../src/core/toolchain/locks.js';
import { ToolchainStateStore } from '../../src/core/toolchain/state-store.js';

describe('ToolchainStateStore', () => {
  it('allows legal state transitions', () => {
    const store = new ToolchainStateStore();
    store.initialize('gemini@user', 'missing');

    const planned = store.transition('gemini@user', 'plan_ready');
    const installing = store.transition('gemini@user', 'installing');
    const verified = store.transition('gemini@user', 'installed_unverified');
    const active = store.transition('gemini@user', 'verified');
    const final = store.transition('gemini@user', 'active');

    expect(planned.state).toBe('plan_ready');
    expect(installing.state).toBe('installing');
    expect(verified.state).toBe('installed_unverified');
    expect(active.state).toBe('verified');
    expect(final.state).toBe('active');
  });

  it('rejects illegal state transitions', () => {
    const store = new ToolchainStateStore();
    store.initialize('codex@user', 'missing');

    expect(() => store.transition('codex@user', 'active')).toThrow(
      'Invalid toolchain state transition: missing -> active'
    );
  });
});

describe('ToolchainLockManager', () => {
  it('prevents concurrent acquisition of the same tool lock', () => {
    const locks = new ToolchainLockManager();
    const first = locks.acquire('gemini@user', 'task-1');

    expect(locks.isLocked('gemini@user')).toBe(true);
    expect(() => locks.acquire('gemini@user', 'task-2')).toThrow(
      'Toolchain lock "gemini@user" is already held'
    );

    locks.release(first);
    expect(locks.isLocked('gemini@user')).toBe(false);
  });

  it('allows different tool locks to be held independently', () => {
    const locks = new ToolchainLockManager();
    const gemini = locks.acquire('gemini@user', 'task-1');
    const codex = locks.acquire('codex@user', 'task-2');

    expect(locks.isLocked('gemini@user')).toBe(true);
    expect(locks.isLocked('codex@user')).toBe(true);

    locks.release(gemini);
    locks.release(codex);
    expect(locks.isLocked('gemini@user')).toBe(false);
    expect(locks.isLocked('codex@user')).toBe(false);
  });
});
