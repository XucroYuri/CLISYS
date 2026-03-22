import type {
  CommandRunner,
  ProviderDetectionResult,
  ProviderExecutionResult,
  ProviderPlan,
  ProviderRequest,
  ToolchainProvider,
} from './types.js';
import {
  createDefaultCommandRunner,
  createDryRunExecutionResult,
  executePlanSteps,
  requirePackageCoordinate,
  requireUserScope,
} from './shared.js';

const PIPX_PACKAGE_PATTERN = /^[a-z0-9][a-z0-9._-]*$/i;

export class PipxProvider implements ToolchainProvider {
  readonly name = 'pipx' as const;
  readonly supportedScopes = ['user'] as const;

  constructor(private readonly runner: CommandRunner = createDefaultCommandRunner()) {}

  supportsPlatform(_platform: NodeJS.Platform): boolean {
    return true;
  }

  async detect(request: ProviderRequest): Promise<ProviderDetectionResult> {
    const result = await this.runner(['pipx', 'list', '--short']);
    return {
      provider: this.name,
      installed: result.exitCode === 0 && result.stdout.includes(request.locator),
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
          title: 'Install pipx package',
          command: ['pipx', 'install', request.locator],
          description: `Install pipx package ${request.locator}`,
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
          title: 'Upgrade pipx package',
          command: ['pipx', 'upgrade', request.locator],
          description: `Upgrade pipx package ${request.locator}`,
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
    requireUserScope(request, this.name);
    requirePackageCoordinate(request.locator, this.name, PIPX_PACKAGE_PATTERN, 'pipx package name');
  }
}
