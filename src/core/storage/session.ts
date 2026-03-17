/**
 * CLISYS Session Storage
 * 会话持久化存储操作
 */

import { eq, desc } from 'drizzle-orm';
import { getDatabase, schema } from './db.js';
import { createChildLogger } from '../logger/index.js';
import type { Session, NewSession, Execution, NewExecution } from './schema.js';

const logger = createChildLogger('session-storage');

/**
 * 会话存储类
 */
export class SessionStorage {
  /**
   * 创建新会话
   */
  createSession(data: Omit<NewSession, 'createdAt' | 'lastActivityAt'>): Session {
    const db = getDatabase();
    const now = new Date();

    const session: NewSession = {
      ...data,
      createdAt: now,
      lastActivityAt: now,
    };

    db.insert(schema.sessions).values(session).run();

    logger.debug({ sessionId: session.id }, 'Session created');
    return session as Session;
  }

  /**
   * 获取会话
   */
  getSession(id: string): Session | undefined {
    const db = getDatabase();
    const result = db.select().from(schema.sessions).where(eq(schema.sessions.id, id)).get();
    return result ?? undefined;
  }

  /**
   * 更新会话活动时间
   */
  updateActivity(id: string): void {
    const db = getDatabase();
    db.update(schema.sessions)
      .set({ lastActivityAt: new Date() })
      .where(eq(schema.sessions.id, id))
      .run();
  }

  /**
   * 删除会话
   */
  deleteSession(id: string): void {
    const db = getDatabase();
    // 先删除关联的执行记录
    db.delete(schema.executions).where(eq(schema.executions.sessionId, id)).run();
    // 再删除会话
    db.delete(schema.sessions).where(eq(schema.sessions.id, id)).run();
    logger.debug({ sessionId: id }, 'Session deleted');
  }

  /**
   * 列出所有会话
   */
  listSessions(limit = 50): Session[] {
    const db = getDatabase();
    return db.select()
      .from(schema.sessions)
      .orderBy(desc(schema.sessions.lastActivityAt))
      .limit(limit)
      .all();
  }

  /**
   * 获取适配器的会话
   */
  getSessionsByAdapter(adapterName: string): Session[] {
    const db = getDatabase();
    return db.select()
      .from(schema.sessions)
      .where(eq(schema.sessions.adapterName, adapterName))
      .orderBy(desc(schema.sessions.lastActivityAt))
      .all();
  }

  // ============================================================================
  // 执行记录操作
  // ============================================================================

  /**
   * 添加执行记录
   */
  addExecution(data: Omit<NewExecution, 'id' | 'createdAt'>): Execution {
    const db = getDatabase();
    const id = this.generateId();

    const execution: NewExecution = {
      id,
      ...data,
      createdAt: new Date(),
    };

    db.insert(schema.executions).values(execution).run();

    logger.debug({ executionId: id, taskId: data.taskId }, 'Execution recorded');
    return execution as Execution;
  }

  /**
   * 获取会话的所有执行记录
   */
  getExecutions(sessionId: string): Execution[] {
    const db = getDatabase();
    return db.select()
      .from(schema.executions)
      .where(eq(schema.executions.sessionId, sessionId))
      .orderBy(desc(schema.executions.createdAt))
      .all();
  }

  /**
   * 获取任务的执行记录
   */
  getExecutionsByTask(taskId: string): Execution[] {
    const db = getDatabase();
    return db.select()
      .from(schema.executions)
      .where(eq(schema.executions.taskId, taskId))
      .orderBy(desc(schema.executions.createdAt))
      .all();
  }

  /**
   * 获取最近的执行记录
   */
  getRecentExecutions(limit = 20): Execution[] {
    const db = getDatabase();
    return db.select()
      .from(schema.executions)
      .orderBy(desc(schema.executions.createdAt))
      .limit(limit)
      .all();
  }

  /**
   * 获取执行统计
   */
  getExecutionStats(adapterName?: string): {
    total: number;
    successful: number;
    failed: number;
    avgDuration: number;
  } {
    const db = getDatabase();

    let query = db.select().from(schema.executions);
    if (adapterName) {
      query = query.where(eq(schema.executions.adapterName, adapterName)) as typeof query;
    }

    const executions = query.all();

    const total = executions.length;
    const successful = executions.filter(e => e.success).length;
    const failed = total - successful;
    const avgDuration = total > 0
      ? executions.reduce((sum, e) => sum + e.duration, 0) / total
      : 0;

    return { total, successful, failed, avgDuration };
  }

  private generateId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// 全局单例
let sessionStorage: SessionStorage | null = null;

export function getSessionStorage(): SessionStorage {
  if (!sessionStorage) {
    sessionStorage = new SessionStorage();
  }
  return sessionStorage;
}
