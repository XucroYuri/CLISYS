import type { ToolchainAuditEvent } from './audit.js';

export interface TrustScoreSummary {
  score: number;
  eventCount: number;
}

export function calculateTrustScore(events: ToolchainAuditEvent[]): TrustScoreSummary {
  let score = 50;

  for (const event of events) {
    switch (event.action) {
      case 'install':
      case 'upgrade':
        if (event.verificationResult === 'passed') {
          score += 10;
        }
        if (event.verificationResult === 'failed') {
          score -= 15;
        }
        break;
      case 'verify':
        score += event.verificationResult === 'passed' ? 8 : -12;
        break;
      case 'rollback':
        score -= event.rollbackResult === 'performed' ? 20 : 5;
        break;
      case 'quarantine':
        score -= 25;
        break;
      default:
        break;
    }

    if (event.healthResult === 'healthy') {
      score += 2;
    } else if (event.healthResult === 'degraded') {
      score -= 3;
    } else if (event.healthResult === 'unhealthy') {
      score -= 8;
    }
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    eventCount: events.length,
  };
}
