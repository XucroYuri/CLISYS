/**
 * CLISYS Database Module
 * 使用 Bun 内置 SQLite + Drizzle ORM
 */

import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { createChildLogger } from '../logger/index.js';
import * as schema from './schema.js';

const logger = createChildLogger('storage');

let db: ReturnType<typeof drizzle> | null = null;
let sqlite: Database | null = null;

export interface DatabaseOptions {
  path?: string;
  inMemory?: boolean;
}

/**
 * 初始化数据库
 */
export function initDatabase(options: DatabaseOptions = {}): ReturnType<typeof drizzle> {
  const { path = 'clisys.db', inMemory = false } = options;

  if (db) {
    logger.warn('Database already initialized');
    return db;
  }

  const dbPath = inMemory ? ':memory:' : path;
  sqlite = new Database(dbPath);

  // 启用 WAL 模式以提高性能
  sqlite.run('PRAGMA journal_mode = WAL');
  sqlite.run('PRAGMA synchronous = NORMAL');
  sqlite.run('PRAGMA cache_size = 5000');

  db = drizzle(sqlite, { schema });

  // 创建表
  createTables();

  logger.info({ path: dbPath }, 'Database initialized');
  return db;
}

/**
 * 获取数据库实例
 */
export function getDatabase(): ReturnType<typeof drizzle> {
  if (!db) {
    return initDatabase();
  }
  return db;
}

/**
 * 关闭数据库连接
 */
export function closeDatabase(): void {
  if (sqlite) {
    sqlite.close();
    sqlite = null;
    db = null;
    logger.info('Database closed');
  }
}

/**
 * 创建表结构
 */
function createTables(): void {
  if (!sqlite) return;

  // 会话表
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      adapter_name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      last_activity_at INTEGER NOT NULL,
      metadata TEXT
    )
  `);

  // 执行记录表
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS executions (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES sessions(id),
      task_id TEXT NOT NULL,
      adapter_name TEXT NOT NULL,
      success INTEGER NOT NULL,
      output TEXT,
      error TEXT,
      duration INTEGER NOT NULL,
      metadata TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  // 任务表
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      type TEXT NOT NULL,
      original_input TEXT NOT NULL,
      priority TEXT NOT NULL,
      status TEXT NOT NULL,
      context TEXT,
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    )
  `);

  // 子任务表
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS subtasks (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id),
      description TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      dependencies TEXT,
      required_capabilities TEXT,
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    )
  `);

  // 事件日志表
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS event_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      payload TEXT,
      metadata TEXT,
      timestamp INTEGER NOT NULL
    )
  `);

  // 创建索引
  sqlite.run('CREATE INDEX IF NOT EXISTS idx_executions_session_id ON executions(session_id)');
  sqlite.run('CREATE INDEX IF NOT EXISTS idx_executions_task_id ON executions(task_id)');
  sqlite.run('CREATE INDEX IF NOT EXISTS idx_executions_adapter_name ON executions(adapter_name)');
  sqlite.run('CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id)');
  sqlite.run('CREATE INDEX IF NOT EXISTS idx_event_logs_type ON event_logs(type)');

  logger.debug('Tables and indexes created');
}

export { schema };
