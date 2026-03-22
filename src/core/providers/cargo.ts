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
  getCommandLookup,
  requirePackageCoordinate,
  requireUserScope,
} from './shared.js';

const CARGO_CRATE_PATTERN = /^[a-z0-9][a-z0-9_-]*$/i;

export class CargoProvider implements ToolchainProvider {
  readonly name = 'cargo' as const;
  readonly supportedScopes = ['user'] as const;

  constructor(private readonly runner: CommandRunner = createDefaultCommandRunner()) {}

  supportsPlatform(_platform: NodeJS.Platform): boolean {
    return true;
  }

  async detect(request: ProviderRequest): Promise<ProviderDetectionResult> {
    const binary = request.binaryName ?? request.toolId;
    const result = await this.runner(getCommandLookup(binary, request.platform));
    return {
      provider: this.name,
      installed: result.exitCode === 0,
      executablePath: result.exitCode === 0 ? result.stdout.trim() : undefined,
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
          title: 'Install cargo crate',
          command: ['cargo', 'install', request.locator],
          description: `Install cargo crate ${request.locator}`,
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
          title: 'Upgrade cargo crate',
          command: ['cargo', 'install', request.locator, '--force'],
          description: `Upgrade cargo crate ${request.locator}`,
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
    requirePackageCoordinate(request.locator, this.name, CARGO_CRATE_PATTERN, 'cargo crate name');
  }
}
