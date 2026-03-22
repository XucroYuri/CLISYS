export const PROVIDER_NAMES = [
  'brew',
  'npm',
  'pipx',
  'cargo',
  'binary',
] as const;

export type ProviderName = (typeof PROVIDER_NAMES)[number];

export const PROVIDER_SCOPES = [
  'user',
  'system',
] as const;

export type ProviderScope = (typeof PROVIDER_SCOPES)[number];

export interface ProviderRequest {
  pluginId: string;
  toolId: string;
  version?: string;
  scope: ProviderScope;
  platform: NodeJS.Platform;
  architecture: string;
  locator: string;
  binaryName?: string;
  checksum?: {
    algorithm: 'sha256' | 'sha512';
    value: string;
  };
  metadata?: Record<string, unknown>;
  dryRun?: boolean;
}

export interface ProviderDetectionResult {
  provider: ProviderName;
  installed: boolean;
  version?: string;
  executablePath?: string;
  metadata?: Record<string, unknown>;
}

export interface ProviderPlanStep {
  title: string;
  command: string[];
  description: string;
}

export interface ProviderPlan {
  provider: ProviderName;
  action: 'install' | 'upgrade' | 'uninstall';
  request: ProviderRequest;
  steps: ProviderPlanStep[];
}

export interface ProviderExecutionResult {
  provider: ProviderName;
  success: boolean;
  output: string;
  error?: string;
  durationMs: number;
  executablePath?: string;
  version?: string;
}

export interface CommandExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface CommandRunner {
  (command: string[]): Promise<CommandExecutionResult>;
}

export interface ToolchainProvider {
  readonly name: ProviderName;
  readonly supportedScopes: readonly ProviderScope[];
  supportsPlatform(platform: NodeJS.Platform): boolean;
  detect(request: ProviderRequest): Promise<ProviderDetectionResult>;
  planInstall(request: ProviderRequest): Promise<ProviderPlan>;
  install(plan: ProviderPlan): Promise<ProviderExecutionResult>;
  planUpgrade(request: ProviderRequest): Promise<ProviderPlan>;
  upgrade(plan: ProviderPlan): Promise<ProviderExecutionResult>;
  uninstall?(plan: ProviderPlan): Promise<ProviderExecutionResult>;
}
