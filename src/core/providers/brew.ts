import type {
  CommandRunner,
  ProviderDetectionResult,
  ProviderExecutionResult,
  ProviderPlan,
  ProviderRequest,
  ToolchainProvider,
} from './types.js';
import { createDefaultCommandRunner, createDryRunExecutionResult, executePlanSteps, requirePackageCoordinate } from './shared.js';

const FORMULA_PATTERN = /^(?:[a-z0-9-]+\/)?[a-z0-9-]+$/;

export class BrewProvider implements ToolchainProvider {
  readonly name = 'brew' as const;
  readonly supportedScopes = ['system'] as const;

  constructor(private readonly runner: CommandRunner = createDefaultCommandRunner()) {}

  supportsPlatform(platform: NodeJS.Platform): boolean {
    return platform === 'darwin' || platform === 'linux';
  }

  async detect(request: ProviderRequest): Promise<ProviderDetectionResult> {
    const result = await this.runner(['brew', 'list', '--versions', request.locator]);
    return {
      provider: this.name,
      installed: result.exitCode === 0,
      version: result.exitCode === 0 ? result.stdout.trim().split(/\s+/)[1] : undefined,
    };
  }

  async planInstall(request: ProviderRequest): Promise<ProviderPlan> {
    this.assertRequest(request);
    return {
      provider: this.name,
      action: 'install',
      request,
      steps: [
        {
          title: 'Install formula',
          command: ['brew', 'install', request.locator],
          description: `Install Homebrew formula ${request.locator}`,
        },
      ],
    };
  }

  async install(plan: ProviderPlan): Promise<ProviderExecutionResult> {
    if (plan.request.dryRun) {
      return createDryRunExecutionResult(this.name, plan);
    }
    return executePlanSteps(this.name, plan, this.runner);
  }

  async planUpgrade(request: ProviderRequest): Promise<ProviderPlan> {
    this.assertRequest(request);
    return {
      provider: this.name,
      action: 'upgrade',
      request,
      steps: [
        {
          title: 'Upgrade formula',
          command: ['brew', 'upgrade', request.locator],
          description: `Upgrade Homebrew formula ${request.locator}`,
        },
      ],
    };
  }

  async upgrade(plan: ProviderPlan): Promise<ProviderExecutionResult> {
    if (plan.request.dryRun) {
      return createDryRunExecutionResult(this.name, plan);
    }
    return executePlanSteps(this.name, plan, this.runner);
  }

  private assertRequest(request: ProviderRequest): void {
    if (!this.supportsPlatform(request.platform)) {
      throw new Error(`Provider "${this.name}" does not support platform ${request.platform}`);
    }
    if (!this.supportedScopes.some((scope) => scope === request.scope)) {
      throw new Error(`Provider "${this.name}" only supports system scope`);
    }
    requirePackageCoordinate(request.locator, this.name, FORMULA_PATTERN, 'brew formula');
  }
}
