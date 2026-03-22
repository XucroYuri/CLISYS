import type { ZodIssue } from 'zod';
import {
  isVersionRangeLike,
  PluginManifestSchema,
  type PluginManifest,
} from './manifest.js';

const PACKAGE_PREFIX = '@clisys/adapter-';

function formatIssues(prefix: string, issues: ZodIssue[]): string {
  const details = issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : '<root>';
    return `${path}: ${issue.message}`;
  });

  return `${prefix}: ${details.join('; ')}`;
}

function checksumLengthForAlgorithm(algorithm: 'sha256' | 'sha512'): number {
  return algorithm === 'sha256' ? 64 : 128;
}

export function validatePluginManifest(manifest: unknown): PluginManifest {
  const parsed = PluginManifestSchema.safeParse(manifest);

  if (!parsed.success) {
    throw new Error(formatIssues('Manifest schema validation failed', parsed.error.issues));
  }

  const value = parsed.data;
  const issues: string[] = [];

  if (!value.identity.packageName.startsWith(PACKAGE_PREFIX)) {
    issues.push(`identity.packageName must start with "${PACKAGE_PREFIX}"`);
  }

  const packageSuffix = value.identity.packageName.slice(PACKAGE_PREFIX.length);
  if (packageSuffix !== value.identity.id) {
    issues.push(`identity.id "${value.identity.id}" must match package suffix "${packageSuffix}"`);
  }

  if (!value.install.brew && !value.install.npm && !value.install.pipx && !value.install.cargo && !value.install.binary) {
    issues.push('install must declare at least one provider method');
  }

  if (value.install.npm && value.install.npm.packageName !== value.identity.packageName) {
    issues.push('install.npm.packageName must match identity.packageName');
  }

  if (!isVersionRangeLike(value.compatibility.clisysVersionRange)) {
    issues.push('compatibility.clisysVersionRange must be semver-like');
  }

  if (value.compatibility.cliVersionRange && !isVersionRangeLike(value.compatibility.cliVersionRange)) {
    issues.push('compatibility.cliVersionRange must be semver-like');
  }

  if (value.adapter.defaultModel && !value.adapter.supportedModels) {
    issues.push('adapter.supportedModels must be provided when adapter.defaultModel is set');
  }

  if (
    value.adapter.defaultModel &&
    value.adapter.supportedModels &&
    !value.adapter.supportedModels.includes(value.adapter.defaultModel)
  ) {
    issues.push('adapter.defaultModel must be included in adapter.supportedModels');
  }

  if (value.install.binary) {
    const expectedLength = checksumLengthForAlgorithm(value.install.binary.checksum.algorithm);
    if (value.install.binary.checksum.value.length !== expectedLength) {
      issues.push(
        `install.binary.checksum.value must be ${expectedLength} hexadecimal characters for ${value.install.binary.checksum.algorithm}`
      );
    }
  }

  if (value.declarations.network.outbound === 'none') {
    if (value.declarations.network.allowlistedHosts.length > 0) {
      issues.push('declarations.network.allowlistedHosts must be empty when outbound is "none"');
    }
    if (value.declarations.network.allowlistedProtocols.length > 0) {
      issues.push('declarations.network.allowlistedProtocols must be empty when outbound is "none"');
    }
  }

  if (!value.declarations.subprocess.allowed) {
    if (value.declarations.subprocess.interactive) {
      issues.push('declarations.subprocess.interactive must be false when subprocesses are disallowed');
    }
    if (value.declarations.subprocess.networkAccess) {
      issues.push('declarations.subprocess.networkAccess must be false when subprocesses are disallowed');
    }
  }

  if (issues.length > 0) {
    throw new Error(`Manifest semantic validation failed: ${issues.join('; ')}`);
  }

  return value;
}

export type { PluginManifest } from './manifest.js';
