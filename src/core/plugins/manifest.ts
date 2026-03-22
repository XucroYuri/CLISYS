import { z } from 'zod';
import type { Capability as CLISYSCapability } from '../adapter/types.js';

export const CLISYS_CAPABILITIES = [
  'code_generation',
  'code_editing',
  'code_review',
  'debugging',
  'refactoring',
  'documentation',
  'testing',
  'analysis',
  'search',
  'web_search',
  'git_integration',
  'file_operations',
  'shell_execution',
  'multi_modal',
  'long_context',
  'interactive',
] as const satisfies readonly CLISYSCapability[];

export const CapabilitySchema = z.enum(CLISYS_CAPABILITIES);

export const ManifestKindSchema = z.literal('adapter');

export const ManifestVersionSchema = z
  .string()
  .min(1)
  .regex(/^\d+\.\d+(?:\.\d+)?(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/, 'manifestVersion must be a version-like string');

export const PackageNameSchema = z
  .string()
  .regex(/^@clisys\/adapter-[a-z0-9]+(?:-[a-z0-9]+)*$/, 'packageName must use the @clisys/adapter-* convention');

export const PackageSuffixSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'id must be a lowercase kebab-case package suffix');

export const ExactVersionSchema = z
  .string()
  .min(1)
  .regex(/^\d+\.\d+(?:\.\d+)?(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/, 'version must be a version-like string');

export function isVersionRangeLike(value: string): boolean {
  const trimmed = value.trim();

  if (trimmed === '*') {
    return true;
  }

  const normalized = trimmed.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  const groups = normalized.split('||').map((group) => group.trim()).filter(Boolean);
  if (groups.length === 0) {
    return false;
  }

  const tokenPattern = /^(?:\^|~|>=|<=|>|<)?\d+\.\d+(?:\.\d+)?(?:-[0-9A-Za-z.-]+)?$/;

  return groups.every((group) => {
    const tokens = group.split(' ').map((token) => token.trim()).filter(Boolean);
    return tokens.length > 0 && tokens.every((token) => tokenPattern.test(token));
  });
}

export const VersionRangeSchema = z
  .string()
  .min(1)
  .refine(isVersionRangeLike, 'version range must be semver-like');

export const OperatingSystemSchema = z.enum(['darwin', 'linux', 'win32']);
export const ArchitectureSchema = z.enum(['x64', 'arm64', 'arm', 'ia32', 'ppc64', 's390x', 'riscv64']);
export const RuntimeSchema = z.enum(['bun', 'node']);

export const PluginSchemaSchema = z
  .object({
    manifestVersion: ManifestVersionSchema,
    kind: ManifestKindSchema,
  })
  .strict();

export const PluginIdentitySchema = z
  .object({
    id: PackageSuffixSchema,
    packageName: PackageNameSchema,
    version: ExactVersionSchema,
    displayName: z.string().min(1),
    provider: z.string().min(1),
    description: z.string().min(1),
  })
  .strict();

export const PluginEntrypointSchema = z
  .object({
    module: z.string().min(1),
    export: z.string().min(1),
    pluginApiVersion: z.string().min(1),
  })
  .strict();

export const PluginAdapterSchema = z
  .object({
    capabilities: z.array(CapabilitySchema).min(1),
    supportedModels: z.array(z.string().min(1)).optional(),
    defaultModel: z.string().min(1).optional(),
    featureFlags: z.record(z.boolean()).default({}),
  })
  .strict();

const BrewInstallSchema = z
  .object({
    formula: z.string().min(1),
    tap: z.string().min(1).optional(),
    version: z.string().min(1).optional(),
  })
  .strict();

const NpmInstallSchema = z
  .object({
    packageName: z.string().min(1),
    bin: z.string().min(1).optional(),
    version: z.string().min(1).optional(),
    global: z.boolean().optional(),
  })
  .strict();

const PipxInstallSchema = z
  .object({
    packageName: z.string().min(1),
    version: z.string().min(1).optional(),
    includeDependencies: z.boolean().optional(),
  })
  .strict();

const CargoInstallSchema = z
  .object({
    crateName: z.string().min(1),
    binaryName: z.string().min(1).optional(),
    version: z.string().min(1).optional(),
  })
  .strict();

const BinaryChecksumSchema = z
  .object({
    algorithm: z.enum(['sha256', 'sha512']),
    value: z.string().min(1).regex(/^[a-fA-F0-9]+$/, 'checksum value must be hexadecimal'),
  })
  .strict();

const BinaryPlatformSchema = z
  .object({
    operatingSystems: z.array(OperatingSystemSchema).min(1),
    architectures: z.array(ArchitectureSchema).min(1),
  })
  .strict();

const BinaryInstallSchema = z
  .object({
    url: z.string().url(),
    checksum: BinaryChecksumSchema,
    filename: z.string().min(1).optional(),
    platform: BinaryPlatformSchema.optional(),
  })
  .strict();

export const PluginInstallSchema = z
  .object({
    brew: BrewInstallSchema.optional(),
    npm: NpmInstallSchema.optional(),
    pipx: PipxInstallSchema.optional(),
    cargo: CargoInstallSchema.optional(),
    binary: BinaryInstallSchema.optional(),
  })
  .strict();

export const PluginCompatibilitySchema = z
  .object({
    clisysVersionRange: VersionRangeSchema,
    cliVersionRange: VersionRangeSchema.optional(),
    operatingSystems: z.array(OperatingSystemSchema).min(1),
    architectures: z.array(ArchitectureSchema).min(1),
    runtimes: z.array(RuntimeSchema).min(1),
  })
  .strict();

const NetworkDeclarationsSchema = z
  .object({
    outbound: z.enum(['none', 'metadata-only', 'allowlisted', 'full']),
    allowlistedHosts: z.array(z.string().min(1)).default([]),
    allowlistedProtocols: z.array(z.enum(['http', 'https', 'ssh', 'git', 'file'])).default([]),
  })
  .strict();

const EnvironmentDeclarationsSchema = z
  .object({
    requires: z.array(z.string().min(1)).default([]),
    optional: z.array(z.string().min(1)).default([]),
    forbidden: z.array(z.string().min(1)).default([]),
  })
  .strict();

const WriteTargetDeclarationsSchema = z
  .object({
    home: z.boolean(),
    project: z.boolean(),
    system: z.boolean(),
    paths: z.array(z.string().min(1)).default([]),
  })
  .strict();

const SubprocessDeclarationsSchema = z
  .object({
    allowed: z.boolean(),
    interactive: z.boolean(),
    networkAccess: z.boolean(),
  })
  .strict();

export const PluginDeclarationsSchema = z
  .object({
    network: NetworkDeclarationsSchema,
    environment: EnvironmentDeclarationsSchema,
    writeTargets: WriteTargetDeclarationsSchema,
    subprocess: SubprocessDeclarationsSchema,
  })
  .strict();

export const PluginManifestSchema = z
  .object({
    schema: PluginSchemaSchema,
    identity: PluginIdentitySchema,
    entrypoint: PluginEntrypointSchema,
    adapter: PluginAdapterSchema,
    install: PluginInstallSchema,
    compatibility: PluginCompatibilitySchema,
    declarations: PluginDeclarationsSchema,
  })
  .strict();

export type PluginKind = z.infer<typeof ManifestKindSchema>;
export type PluginSchema = z.infer<typeof PluginSchemaSchema>;
export type PluginIdentity = z.infer<typeof PluginIdentitySchema>;
export type PluginEntrypoint = z.infer<typeof PluginEntrypointSchema>;
export type PluginAdapter = z.infer<typeof PluginAdapterSchema>;
export type PluginInstall = z.infer<typeof PluginInstallSchema>;
export type PluginCompatibility = z.infer<typeof PluginCompatibilitySchema>;
export type PluginDeclarations = z.infer<typeof PluginDeclarationsSchema>;
export type PluginManifest = z.infer<typeof PluginManifestSchema>;
export type PluginCapability = z.infer<typeof CapabilitySchema>;
