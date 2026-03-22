import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validatePluginManifest } from './validator.js';
import type { PluginManifest } from './manifest.js';
import type { RegisteredPlugin } from './registry.js';

export interface PluginLoaderOptions {
  hostVersion: string;
  pluginApiVersion: string;
  platform?: NodeJS.Platform;
  architecture?: string;
  runtime?: 'bun' | 'node';
  manifestFileName?: string;
}

export type PluginFactory = (...args: never[]) => unknown;

export interface LoadedPluginModule extends RegisteredPlugin {
  factory: PluginFactory;
}

const DEFAULT_MANIFEST_FILE = 'clisys-plugin.json';

export async function loadPluginFromDirectory(
  rootPath: string,
  options: PluginLoaderOptions
): Promise<LoadedPluginModule> {
  const manifestFileName = options.manifestFileName ?? DEFAULT_MANIFEST_FILE;
  const manifestPath = path.join(rootPath, manifestFileName);
  const packageJsonPath = path.join(rootPath, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    throw new Error(`Plugin package.json not found at ${packageJsonPath}`);
  }

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Plugin manifest not found at ${manifestPath}`);
  }

  const manifest = readPluginManifest(manifestPath);
  validatePluginCompatibility(manifest, options);

  const entrypointPath = path.resolve(rootPath, manifest.entrypoint.module);
  if (!fs.existsSync(entrypointPath)) {
    throw new Error(`Plugin entrypoint not found at ${entrypointPath}`);
  }

  const imported = await import(pathToFileURL(entrypointPath).href);
  const factory = imported[manifest.entrypoint.export];

  if (typeof factory !== 'function') {
    throw new Error(
      `Plugin export "${manifest.entrypoint.export}" must be a callable factory in ${entrypointPath}`
    );
  }

  return {
    manifest,
    rootPath,
    manifestPath,
    packageJsonPath,
    entrypointPath,
    factory,
  };
}

function readPluginManifest(manifestPath: string): PluginManifest {
  const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as unknown;
  return validatePluginManifest(raw);
}

function validatePluginCompatibility(
  manifest: PluginManifest,
  options: PluginLoaderOptions
): void {
  if (!satisfiesVersionRange(options.hostVersion, manifest.compatibility.clisysVersionRange)) {
    throw new Error(
      `Plugin "${manifest.identity.id}" is incompatible with CLISYS ${options.hostVersion}`
    );
  }

  if (!isPluginApiCompatible(options.pluginApiVersion, manifest.entrypoint.pluginApiVersion)) {
    throw new Error(
      `Plugin "${manifest.identity.id}" requires plugin API ${manifest.entrypoint.pluginApiVersion}`
    );
  }

  const platform = options.platform ?? process.platform;
  if (!manifest.compatibility.operatingSystems.some((value) => value === platform)) {
    throw new Error(
      `Plugin "${manifest.identity.id}" does not support platform ${platform}`
    );
  }

  const architecture = options.architecture ?? process.arch;
  if (!manifest.compatibility.architectures.some((value) => value === architecture)) {
    throw new Error(
      `Plugin "${manifest.identity.id}" does not support architecture ${architecture}`
    );
  }

  const runtime = options.runtime ?? (typeof Bun !== 'undefined' ? 'bun' : 'node');
  if (!manifest.compatibility.runtimes.includes(runtime)) {
    throw new Error(
      `Plugin "${manifest.identity.id}" does not support runtime ${runtime}`
    );
  }
}

function isPluginApiCompatible(hostVersion: string, requiredVersion: string): boolean {
  return satisfiesVersionRange(hostVersion, requiredVersion);
}

function satisfiesVersionRange(version: string, range: string): boolean {
  const current = parseVersion(version);
  if (!current) {
    return false;
  }

  const normalized = range.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  if (normalized === '*' || normalized === version) {
    return true;
  }

  const groups = normalized.split('||').map((group) => group.trim()).filter(Boolean);
  return groups.some((group) => {
    const comparators = group.split(' ').map((token) => token.trim()).filter(Boolean);
    return comparators.every((comparator) => matchesComparator(current, comparator));
  });
}

function matchesComparator(
  current: { major: number; minor: number; patch: number },
  comparator: string
): boolean {
  if (comparator === '*') {
    return true;
  }

  const operators = ['>=', '<=', '>', '<', '^', '~'] as const;
  const operator = operators.find((candidate) => comparator.startsWith(candidate)) ?? '=';
  const versionToken = operator === '=' ? comparator : comparator.slice(operator.length);
  const target = parseVersion(versionToken);

  if (!target) {
    return false;
  }

  const comparison = compareVersions(current, target);

  switch (operator) {
    case '=':
      return comparison === 0;
    case '>=':
      return comparison >= 0;
    case '<=':
      return comparison <= 0;
    case '>':
      return comparison > 0;
    case '<':
      return comparison < 0;
    case '^':
      return current.major === target.major && comparison >= 0;
    case '~':
      return current.major === target.major && current.minor === target.minor && comparison >= 0;
  }
}

function parseVersion(input: string) {
  const match = input.trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function compareVersions(
  left: { major: number; minor: number; patch: number },
  right: { major: number; minor: number; patch: number }
): number {
  if (left.major !== right.major) {
    return left.major - right.major;
  }

  if (left.minor !== right.minor) {
    return left.minor - right.minor;
  }

  return left.patch - right.patch;
}
