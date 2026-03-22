import { $ } from 'bun';
import type {
  CommandExecutionResult,
  CommandRunner,
  ProviderExecutionResult,
  ProviderName,
  ProviderPlan,
  ProviderRequest,
} from './types.js';

export function createDefaultCommandRunner(): CommandRunner {
  return async (command: string[]) => {
    const result = await $`${command}`.quiet().nothrow();

    return {
      exitCode: result.exitCode,
      stdout: result.stdout.toString(),
      stderr: result.stderr.toString(),
    };
  };
}

export function getCommandLookup(binary: string, platform: NodeJS.Platform): string[] {
  return platform === 'win32' ? ['where', binary] : ['which', binary];
}

export function createDryRunExecutionResult(
  provider: ProviderName,
  plan: ProviderPlan
): ProviderExecutionResult {
  return {
    provider,
    success: true,
    output: plan.steps.map((step) => step.command.join(' ')).join('\n'),
    durationMs: 0,
  };
}

export async function executePlanSteps(
  provider: ProviderName,
  plan: ProviderPlan,
  runner: CommandRunner
): Promise<ProviderExecutionResult> {
  const start = Date.now();
  const outputs: string[] = [];

  for (const step of plan.steps) {
    const result = await runner(step.command);
    if (result.exitCode !== 0) {
      return {
        provider,
        success: false,
        output: outputs.join('\n'),
        error: result.stderr || `Command failed: ${step.command.join(' ')}`,
        durationMs: Date.now() - start,
      };
    }

    if (result.stdout) {
      outputs.push(result.stdout.trim());
    }
  }

  return {
    provider,
    success: true,
    output: outputs.join('\n').trim(),
    durationMs: Date.now() - start,
  };
}

export function requireUserScope(request: ProviderRequest, provider: ProviderName): void {
  if (request.scope !== 'user') {
    throw new Error(`Provider "${provider}" only supports user scope`);
  }
}

export function requireHttpsLocator(locator: string, provider: ProviderName): void {
  if (!locator.startsWith('https://')) {
    throw new Error(`Provider "${provider}" only supports https download sources`);
  }
}

export function requirePackageCoordinate(
  locator: string,
  provider: ProviderName,
  pattern: RegExp,
  description: string
): void {
  if (!pattern.test(locator)) {
    throw new Error(`Provider "${provider}" requires a valid ${description}`);
  }
}
