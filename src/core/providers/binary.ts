import * as path from 'node:path';
import * as os from 'node:os';
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
  requireHttpsLocator,
  requireUserScope,
} from './shared.js';

export class BinaryProvider implements ToolchainProvider {
  readonly name = 'binary' as const;
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
    const targetDir =
      (request.metadata?.targetDir as string | undefined) ??
      path.join(os.homedir(), '.clisys', 'bin');
    const archivePath = path.join(targetDir, `${request.toolId}.download`);

    return {
      provider: this.name,
      action: 'install',
      request,
      steps: [
        {
          title: 'Download binary artifact',
          command: ['curl', '-fsSL', request.locator, '-o', archivePath],
          description: `Download binary from ${request.locator}`,
        },
        {
          title: 'Verify checksum',
          command: ['verify-checksum', request.checksum?.algorithm ?? 'sha256', request.checksum?.value ?? '', archivePath],
          description: 'Verify downloaded artifact checksum',
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
    const plan = await this.planInstall(request);
    return {
      ...plan,
      action: 'upgrade',
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
    requireHttpsLocator(request.locator, this.name);
    if (!request.checksum) {
      throw new Error(`Provider "${this.name}" requires checksum metadata`);
    }
  }
}
