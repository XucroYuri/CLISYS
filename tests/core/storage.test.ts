import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase, closeDatabase } from '../../src/core/storage/db.js';
import { SessionStorage } from '../../src/core/storage/session.js';

describe('Storage', () => {
  let storage: SessionStorage;

  beforeEach(() => {
    closeDatabase();
    initDatabase({ inMemory: true });
    storage = new SessionStorage();
  });

  afterEach(() => {
    closeDatabase();
  });

  describe('session operations', () => {
    it('should create a session', () => {
      const session = storage.createSession({
        id: 'test-session-1',
        adapterName: 'test-adapter',
      });

      expect(session.id).toBe('test-session-1');
      expect(session.adapterName).toBe('test-adapter');
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.lastActivityAt).toBeInstanceOf(Date);
    });

    it('should get an existing session', () => {
      storage.createSession({
        id: 'test-session-2',
        adapterName: 'test-adapter',
      });

      const session = storage.getSession('test-session-2');

      expect(session).toBeDefined();
      expect(session?.id).toBe('test-session-2');
    });

    it('should return undefined for non-existent session', () => {
      const session = storage.getSession('non-existent');

      expect(session).toBeUndefined();
    });

    it('should update session activity', () => {
      storage.createSession({
        id: 'test-session-3',
        adapterName: 'test-adapter',
      });

      const before = storage.getSession('test-session-3');
      storage.updateActivity('test-session-3');
      const after = storage.getSession('test-session-3');

      expect(after?.lastActivityAt.getTime()).toBeGreaterThanOrEqual(
        before!.lastActivityAt.getTime()
      );
    });

    it('should delete a session', () => {
      storage.createSession({
        id: 'test-session-4',
        adapterName: 'test-adapter',
      });

      storage.deleteSession('test-session-4');

      const session = storage.getSession('test-session-4');
      expect(session).toBeUndefined();
    });

    it('should list sessions', () => {
      storage.createSession({ id: 'session-1', adapterName: 'adapter-1' });
      storage.createSession({ id: 'session-2', adapterName: 'adapter-2' });
      storage.createSession({ id: 'session-3', adapterName: 'adapter-1' });

      const sessions = storage.listSessions();

      expect(sessions.length).toBe(3);
    });

    it('should limit session list', () => {
      storage.createSession({ id: 'session-1', adapterName: 'adapter-1' });
      storage.createSession({ id: 'session-2', adapterName: 'adapter-2' });
      storage.createSession({ id: 'session-3', adapterName: 'adapter-1' });

      const sessions = storage.listSessions(2);

      expect(sessions.length).toBe(2);
    });

    it('should get sessions by adapter', () => {
      storage.createSession({ id: 'session-1', adapterName: 'adapter-1' });
      storage.createSession({ id: 'session-2', adapterName: 'adapter-2' });
      storage.createSession({ id: 'session-3', adapterName: 'adapter-1' });

      const sessions = storage.getSessionsByAdapter('adapter-1');

      expect(sessions.length).toBe(2);
      sessions.forEach(s => {
        expect(s.adapterName).toBe('adapter-1');
      });
    });
  });

  describe('execution operations', () => {
    it('should add execution record', () => {
      const session = storage.createSession({
        id: 'test-session-5',
        adapterName: 'test-adapter',
      });

      const execution = storage.addExecution({
        sessionId: session.id,
        taskId: 'task-1',
        adapterName: 'test-adapter',
        output: 'Test output',
        success: true,
        duration: 100,
      });

      expect(execution.sessionId).toBe('test-session-5');
      expect(execution.taskId).toBe('task-1');
      expect(execution.success).toBe(true);
    });

    it('should get executions', () => {
      const session = storage.createSession({
        id: 'test-session-6',
        adapterName: 'test-adapter',
      });

      storage.addExecution({
        sessionId: session.id,
        taskId: 'task-1',
        adapterName: 'test-adapter',
        output: 'Output 1',
        success: true,
        duration: 100,
      });

      storage.addExecution({
        sessionId: session.id,
        taskId: 'task-2',
        adapterName: 'test-adapter',
        output: 'Output 2',
        success: true,
        duration: 200,
      });

      const executions = storage.getExecutions(session.id);

      expect(executions.length).toBe(2);
    });

    it('should get execution stats', () => {
      const session = storage.createSession({
        id: 'test-session-7',
        adapterName: 'test-adapter',
      });

      storage.addExecution({
        sessionId: session.id,
        taskId: 'task-1',
        adapterName: 'test-adapter',
        output: 'Output 1',
        success: true,
        duration: 100,
      });

      storage.addExecution({
        sessionId: session.id,
        taskId: 'task-2',
        adapterName: 'test-adapter',
        output: '',
        success: false,
        duration: 50,
      });

      const stats = storage.getExecutionStats();

      expect(stats.total).toBe(2);
      expect(stats.successful).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.avgDuration).toBe(75);
    });
  });
});
