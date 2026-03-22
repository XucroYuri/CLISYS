/**
 * CLISYS Configuration Loader
 * TOML 配置文件加载与验证
 */

import * as TOML from '@iarna/toml';
import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { createChildLogger } from '../logger/index.js';

const logger = createChildLogger('config');

// ============================================================================
// 配置 Schema 定义
// ============================================================================

const AdapterConfigSchema = z.object({
  enabled: z.boolean().default(true),
  command: z.string().optional(),
  defaultModel: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
  config: z.record(z.unknown()).optional(),
});

const OrchestratorConfigSchema = z.object({
  defaultStrategy: z.enum(['capability_based', 'cost_optimized', 'performance_based', 'round_robin']).default('capability_based'),
  maxParallelTasks: z.number().int().min(1).max(10).default(3),
  taskTimeout: z.number().int().positive().default(300000),
  fallbackEnabled: z.boolean().default(true),
});

const LoggingConfigSchema = z.object({
  level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  output: z.enum(['console', 'file', 'both']).default('console'),
  filePath: z.string().optional(),
  pretty: z.boolean().default(true),
});

const SessionConfigSchema = z.object({
  persistent: z.boolean().default(true),
  storagePath: z.string().default('.clisys/data'),
  ttl: z.number().int().positive().default(86400000), // 24 hours
});

const PluginsConfigSchema = z.object({
  directories: z.array(z.string()).default([]),
});

const ConfigSchema = z.object({
  version: z.string().default('1.0'),
  adapters: z.record(AdapterConfigSchema).default({}),
  orchestrator: OrchestratorConfigSchema.default({}),
  logging: LoggingConfigSchema.default({}),
  session: SessionConfigSchema.default({}),
  plugins: PluginsConfigSchema.default({}),
});

// ============================================================================
// 类型导出
// ============================================================================

export type AdapterConfig = z.infer<typeof AdapterConfigSchema>;
export type OrchestratorConfig = z.infer<typeof OrchestratorConfigSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
export type SessionConfig = z.infer<typeof SessionConfigSchema>;
export type PluginsConfig = z.infer<typeof PluginsConfigSchema>;
export type CLISYSConfig = z.infer<typeof ConfigSchema>;

// ============================================================================
// 配置加载器
// ============================================================================

const DEFAULT_CONFIG: CLISYSConfig = {
  version: '1.0',
  adapters: {
    'claude-code': {
      enabled: true,
      command: 'claude',
    },
    codex: {
      enabled: true,
      command: 'codex',
    },
    gemini: {
      enabled: true,
      command: 'gemini',
    },
  },
  orchestrator: {
    defaultStrategy: 'capability_based',
    maxParallelTasks: 3,
    taskTimeout: 300000,
    fallbackEnabled: true,
  },
  logging: {
    level: 'info',
    output: 'console',
    pretty: true,
  },
  session: {
    persistent: true,
    storagePath: '.clisys/data',
    ttl: 86400000,
  },
  plugins: {
    directories: [],
  },
};

/**
 * 配置加载选项
 */
export interface LoadOptions {
  configPath?: string;
  env?: NodeJS.ProcessEnv;
}

/**
 * 从文件加载 TOML 配置
 */
export function loadFromTOML(filePath: string): CLISYSConfig {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    logger.warn({ path: absolutePath }, 'Config file not found, using defaults');
    return { ...DEFAULT_CONFIG };
  }

  try {
    const content = fs.readFileSync(absolutePath, 'utf-8');
    const raw = TOML.parse(content);
    const config = ConfigSchema.parse(raw);

    logger.info({ path: absolutePath }, 'Configuration loaded');
    return config;
  } catch (error) {
    logger.error({ path: absolutePath, error }, 'Failed to load config');
    throw new Error(`Failed to load config from ${absolutePath}: ${error}`);
  }
}

/**
 * 将配置写入 TOML 文件
 */
export function saveToTOML(filePath: string, config: CLISYSConfig): void {
  const absolutePath = path.resolve(filePath);
  const dir = path.dirname(absolutePath);

  // 确保目录存在
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 将配置转换为适合 TOML 的格式
  const tomlSafeConfig = JSON.parse(JSON.stringify(config)) as Parameters<typeof TOML.stringify>[0];
  const content = TOML.stringify(tomlSafeConfig);
  fs.writeFileSync(absolutePath, content, 'utf-8');

  logger.info({ path: absolutePath }, 'Configuration saved');
}

/**
 * 加载多级配置（全局 → 项目）
 */
export function loadConfig(options: LoadOptions = {}): CLISYSConfig {
  const { configPath, env = process.env } = options;

  // 从环境变量获取配置路径
  const envConfigPath = env.CLISYS_CONFIG;

  // 确定配置文件路径优先级
  const configPaths: string[] = [];

  if (configPath) {
    configPaths.push(configPath);
  }

  if (envConfigPath) {
    configPaths.push(envConfigPath);
  }

  // 全局配置
  configPaths.push(path.join(getHomeDir(), '.clisys', 'config.toml'));

  // 项目配置
  configPaths.push(path.join(process.cwd(), '.clisys', 'config.toml'));
  configPaths.push(path.join(process.cwd(), 'clisys.toml'));

  // 加载并合并配置
  let mergedConfig = { ...DEFAULT_CONFIG };

  for (const p of configPaths) {
    if (fs.existsSync(p)) {
      const config = loadFromTOML(p);
      mergedConfig = mergeConfigs(mergedConfig, config);
    }
  }

  // 应用环境变量覆盖
  mergedConfig = applyEnvOverrides(mergedConfig, env);

  return mergedConfig;
}

/**
 * 获取默认配置
 */
export function getDefaultConfig(): CLISYSConfig {
  // Return a deep copy to prevent mutation
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

/**
 * 合并配置
 */
function mergeConfigs(base: CLISYSConfig, override: CLISYSConfig): CLISYSConfig {
  return {
    version: override.version ?? base.version,
    adapters: { ...base.adapters, ...override.adapters },
    orchestrator: { ...base.orchestrator, ...override.orchestrator },
    logging: { ...base.logging, ...override.logging },
    session: { ...base.session, ...override.session },
    plugins: { ...base.plugins, ...override.plugins },
  };
}

/**
 * 应用环境变量覆盖
 */
function applyEnvOverrides(config: CLISYSConfig, env: NodeJS.ProcessEnv): CLISYSConfig {
  const result = { ...config };

  // 日志级别
  if (env.CLISYS_LOG_LEVEL) {
    const level = env.CLISYS_LOG_LEVEL as LoggingConfig['level'];
    if (['trace', 'debug', 'info', 'warn', 'error', 'fatal'].includes(level)) {
      result.logging = { ...result.logging, level };
    }
  }

  // 最大并行任务数
  if (env.CLISYS_MAX_PARALLEL) {
    const maxParallel = parseInt(env.CLISYS_MAX_PARALLEL, 10);
    if (!isNaN(maxParallel) && maxParallel > 0) {
      result.orchestrator = { ...result.orchestrator, maxParallelTasks: maxParallel };
    }
  }

  // 默认策略
  if (env.CLISYS_STRATEGY) {
    const strategy = env.CLISYS_STRATEGY as OrchestratorConfig['defaultStrategy'];
    if (['capability_based', 'cost_optimized', 'performance_based', 'round_robin'].includes(strategy)) {
      result.orchestrator = { ...result.orchestrator, defaultStrategy: strategy };
    }
  }

  return result;
}

/**
 * 获取用户主目录
 */
function getHomeDir(): string {
  return process.env.HOME ?? process.env.USERPROFILE ?? '.';
}

// ============================================================================
// 全局配置实例
// ============================================================================

let globalConfig: CLISYSConfig | null = null;

/**
 * 获取全局配置
 */
export function getConfig(): CLISYSConfig {
  if (!globalConfig) {
    globalConfig = loadConfig();
  }
  return globalConfig;
}

/**
 * 设置全局配置
 */
export function setConfig(config: CLISYSConfig): void {
  globalConfig = config;
}

/**
 * 重新加载配置
 */
export function reloadConfig(): CLISYSConfig {
  globalConfig = loadConfig();
  return globalConfig;
}
