import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ToolchainAuditEvent {
  eventId: string;
  timestamp: string;
  actorType: 'user' | 'background_maintenance' | 'system';
  action: 'detect' | 'install' | 'upgrade' | 'verify' | 'rollback' | 'quarantine' | 'policy_decision';
  pluginId: string;
  toolId: string;
  provider?: string;
  scope?: string;
  fromVersion?: string;
  toVersion?: string;
  artifactDigest?: string;
  sourceLocator?: string;
  policyDecision?: 'allow' | 'confirm' | 'deny';
  verificationResult?: 'passed' | 'failed';
  healthResult?: 'healthy' | 'degraded' | 'unhealthy';
  rollbackResult?: 'performed' | 'skipped';
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export class ToolchainAuditLog {
  constructor(private readonly filePath: string) {}

  append(event: ToolchainAuditEvent): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.appendFileSync(this.filePath, `${JSON.stringify(event)}\n`, 'utf8');
  }

  readAll(): ToolchainAuditEvent[] {
    if (!fs.existsSync(this.filePath)) {
      return [];
    }

    return fs
      .readFileSync(this.filePath, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as ToolchainAuditEvent);
  }
}
