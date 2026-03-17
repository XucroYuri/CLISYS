/**
 * CLISYS Database Schema
 * Drizzle ORM Schema 定义
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// 会话表
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  adapterName: text('adapter_name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  lastActivityAt: integer('last_activity_at', { mode: 'timestamp' }).notNull(),
  metadata: text('metadata', { mode: 'json' }),
});

// 执行记录表
export const executions = sqliteTable('executions', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').references(() => sessions.id),
  taskId: text('task_id').notNull(),
  adapterName: text('adapter_name').notNull(),
  success: integer('success', { mode: 'boolean' }).notNull(),
  output: text('output'),
  error: text('error'),
  duration: integer('duration').notNull(),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

// 任务表
export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  description: text('description').notNull(),
  type: text('type').notNull(),
  originalInput: text('original_input').notNull(),
  priority: text('priority').notNull(),
  status: text('status').notNull(),
  context: text('context', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

// 子任务表
export const subtasks = sqliteTable('subtasks', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().references(() => tasks.id),
  description: text('description').notNull(),
  type: text('type').notNull(),
  status: text('status').notNull(),
  dependencies: text('dependencies', { mode: 'json' }),
  requiredCapabilities: text('required_capabilities', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

// 事件日志表
export const eventLogs = sqliteTable('event_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').notNull(),
  payload: text('payload', { mode: 'json' }),
  metadata: text('metadata', { mode: 'json' }),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
});

// Schema 类型导出
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Execution = typeof executions.$inferSelect;
export type NewExecution = typeof executions.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type Subtask = typeof subtasks.$inferSelect;
export type NewSubtask = typeof subtasks.$inferInsert;
export type EventLog = typeof eventLogs.$inferSelect;
export type NewEventLog = typeof eventLogs.$inferInsert;
