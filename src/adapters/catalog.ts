import type { BaseAdapter } from '../core/adapter/BaseAdapter.js';
import type { Capability } from '../core/adapter/types.js';
import type { AdapterConfig, CLISYSConfig } from '../core/config/loader.js';
import { createClaudeCodeAdapter } from './claude-code/index.js';
import { createCodexAdapter } from './codex/index.js';
import { createGeminiAdapter } from './gemini/index.js';

export type BuiltInAdapterName = 'claude-code' | 'codex' | 'gemini';

export interface AdapterCatalogEntry {
  name: string;
  displayName: string;
  provider: string;
  description: string;
  capabilities: Capability[];
  status: 'available' | 'planned';
  defaultEnabled: boolean;
  createAdapter?: (_config?: AdapterConfig) => BaseAdapter;
}

const BUILT_IN_ADAPTERS: readonly AdapterCatalogEntry[] = [
  {
    name: 'claude-code',
    displayName: 'Claude Code',
    provider: 'Anthropic',
    description: 'Official Claude CLI for coding tasks',
    capabilities: [
      'code_generation',
      'code_editing',
      'code_review',
      'debugging',
      'refactoring',
      'documentation',
      'testing',
      'analysis',
      'search',
      'git_integration',
      'file_operations',
      'shell_execution',
    ],
    status: 'available',
    defaultEnabled: true,
    createAdapter: () => createClaudeCodeAdapter(),
  },
  {
    name: 'codex',
    displayName: 'Codex CLI',
    provider: 'OpenAI',
    description: 'OpenAI Codex CLI for code generation',
    capabilities: [
      'code_generation',
      'code_editing',
      'debugging',
      'analysis',
    ],
    status: 'available',
    defaultEnabled: true,
    createAdapter: () => createCodexAdapter(),
  },
  {
    name: 'gemini',
    displayName: 'Gemini CLI',
    provider: 'Google',
    description: 'Google Gemini CLI for AI-assisted coding',
    capabilities: [
      'code_generation',
      'code_editing',
      'code_review',
      'debugging',
      'refactoring',
      'documentation',
      'testing',
      'analysis',
      'multi_modal',
      'long_context',
      'interactive',
    ],
    status: 'available',
    defaultEnabled: true,
    createAdapter: (config) => createGeminiAdapter(config),
  },
] as const;

const PLANNED_ADAPTERS: readonly AdapterCatalogEntry[] = [
  {
    name: 'opencode',
    displayName: 'OpenCode',
    provider: 'SST',
    description: 'Open source coding assistant',
    capabilities: [
      'code_generation',
      'code_editing',
      'interactive',
    ],
    status: 'planned',
    defaultEnabled: false,
  },
  {
    name: 'aider',
    displayName: 'Aider',
    provider: 'Community',
    description: 'AI pair programming in your terminal',
    capabilities: [
      'code_generation',
      'code_editing',
      'git_integration',
      'interactive',
    ],
    status: 'planned',
    defaultEnabled: false,
  },
] as const;

export function getAdapterCatalog(): AdapterCatalogEntry[] {
  return [...BUILT_IN_ADAPTERS, ...PLANNED_ADAPTERS];
}

export function getAdapterDisplayEntries(
  adaptersConfig: CLISYSConfig['adapters']
): Array<AdapterCatalogEntry & { enabled: boolean }> {
  return getAdapterCatalog().map((entry) => ({
    ...entry,
    enabled: entry.status === 'available'
      ? (adaptersConfig[entry.name]?.enabled ?? entry.defaultEnabled)
      : false,
  }));
}

export function isBuiltInAdapterName(name: string): name is BuiltInAdapterName {
  return BUILT_IN_ADAPTERS.some((entry) => entry.name === name);
}

export function createBuiltInAdapter(
  name: BuiltInAdapterName,
  config?: AdapterConfig
): BaseAdapter {
  const entry = BUILT_IN_ADAPTERS.find((candidate) => candidate.name === name);

  if (!entry?.createAdapter) {
    throw new Error(`Adapter "${name}" is not a supported built-in adapter`);
  }

  return entry.createAdapter(config);
}

export function getEnabledBuiltInAdapterNames(
  adaptersConfig: CLISYSConfig['adapters'],
  requestedAdapter?: string
): BuiltInAdapterName[] {
  if (requestedAdapter) {
    if (!isBuiltInAdapterName(requestedAdapter)) {
      throw new Error(`Adapter "${requestedAdapter}" is not a supported built-in adapter`);
    }

    if (adaptersConfig[requestedAdapter]?.enabled === false) {
      throw new Error(`Adapter "${requestedAdapter}" is disabled in configuration`);
    }

    return [requestedAdapter];
  }

  return BUILT_IN_ADAPTERS
    .filter((entry) => adaptersConfig[entry.name]?.enabled ?? entry.defaultEnabled)
    .map((entry) => entry.name as BuiltInAdapterName);
}
