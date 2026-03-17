/**
 * CLISYS Logger Module
 * 基于 Pino 的高性能日志系统
 */

import pino from 'pino';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LoggerOptions {
  level?: LogLevel;
  pretty?: boolean;
  name?: string;
}

let defaultLogger: pino.Logger | null = null;

/**
 * 创建 Logger 实例
 */
export function createLogger(options: LoggerOptions = {}): pino.Logger {
  const {
    level = 'info',
    pretty = true,
    name = 'clisys',
  } = options;

  if (pretty) {
    return pino({
      name,
      level,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    });
  }

  return pino({
    name,
    level,
  });
}

/**
 * 获取默认 Logger
 */
export function getLogger(): pino.Logger {
  if (!defaultLogger) {
    defaultLogger = createLogger();
  }
  return defaultLogger;
}

/**
 * 设置默认 Logger
 */
export function setLogger(logger: pino.Logger): void {
  defaultLogger = logger;
}

/**
 * 创建子 Logger
 */
export function createChildLogger(module: string): pino.Logger {
  return getLogger().child({ module });
}

export { pino };
