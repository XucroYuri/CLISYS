import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { ToolchainAuditLog, type ToolchainAuditEvent } from '../../src/core/toolchain/audit.js';
import { calculateTrustScore } from '../../src/core/toolchain/trust-score.js';

const TEMP_PATHS: string[] = [];

function createAuditLog() {
  const dir = fs.mkdtempSync(path.join(tmpdir(), 'clisys-audit-'));
  TEMP_PATHS.push(dir);
  return new ToolchainAuditLog(path.join(dir, 'audit.jsonl'));
}

function createEvent(overrides: Partial<ToolchainAuditEvent> = {}): ToolchainAuditEvent {
  return {
    eventId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    actorType: 'system',
    action: 'install',
    pluginId: 'goose',
    toolId: 'goose',
    provider: 'npm',
    scope: 'user',
    verificationResult: 'passed',
    healthResult: 'healthy',
    ...overrides,
  };
}

afterEach(() => {
  while (TEMP_PATHS.length > 0) {
    const dir = TEMP_PATHS.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('ToolchainAuditLog', () => {
  it('appends audit events in order', () => {
    const auditLog = createAuditLog();
    const first = createEvent({ action: 'install' });
    const second = createEvent({ action: 'verify' });

    auditLog.append(first);
    auditLog.append(second);

    expect(auditLog.readAll()).toEqual([first, second]);
  });
});

describe('calculateTrustScore', () => {
  it('increases trust after successful verified installs', () => {
    const summary = calculateTrustScore([
      createEvent({ action: 'install', verificationResult: 'passed', healthResult: 'healthy' }),
      createEvent({ action: 'verify', verificationResult: 'passed', healthResult: 'healthy' }),
    ]);

    expect(summary.score).toBeGreaterThan(50);
    expect(summary.eventCount).toBe(2);
  });

  it('decreases trust after rollback and quarantine events', () => {
    const summary = calculateTrustScore([
      createEvent({ action: 'rollback', rollbackResult: 'performed', healthResult: 'degraded' }),
      createEvent({ action: 'quarantine', healthResult: 'unhealthy' }),
    ]);

    expect(summary.score).toBeLessThan(50);
    expect(summary.eventCount).toBe(2);
  });
});
