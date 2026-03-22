import { describe, expect, it } from 'vitest';
import { MaintenanceQueue } from '../../src/core/toolchain/maintenance-queue.js';

describe('MaintenanceQueue', () => {
  it('coalesces duplicate tasks by key', () => {
    const queue = new MaintenanceQueue();
    queue.enqueue({ key: 'goose', provider: 'npm', action: 'upgrade' }, 1000);
    queue.enqueue({ key: 'goose', provider: 'npm', action: 'upgrade' }, 2000);

    expect(queue.getPendingTasks()).toHaveLength(1);
    expect(queue.getPendingTasks()[0].key).toBe('goose');
  });

  it('rate limits concurrent tasks per provider', () => {
    const queue = new MaintenanceQueue({ maxRunsPerProvider: 1 });
    queue.enqueue({ key: 'goose', provider: 'npm', action: 'upgrade' }, 1000);
    queue.enqueue({ key: 'codex', provider: 'npm', action: 'refresh' }, 1000);

    const runnable = queue.getRunnableTasks(1000);
    expect(runnable.map((task) => task.key)).toEqual(['goose', 'codex']);

    queue.markStarted(runnable[0]);

    const limited = queue.getRunnableTasks(1000);
    expect(limited.map((task) => task.key)).toEqual([]);
  });

  it('applies backoff after failures', () => {
    const queue = new MaintenanceQueue({ backoffMs: 5000 });
    const task = { key: 'goose', provider: 'npm', action: 'upgrade' } as const;
    queue.enqueue(task, 1000);

    queue.markStarted(task);
    queue.markFailed(task, 1000);

    expect(queue.getRunnableTasks(2000)).toEqual([]);
    expect(queue.getRunnableTasks(7000)).toEqual([task]);
  });

  it('only runs tasks inside the maintenance window', () => {
    const queue = new MaintenanceQueue({
      maintenanceWindow: {
        startHourUtc: 2,
        endHourUtc: 4,
      },
    });

    queue.enqueue({ key: 'goose', provider: 'npm', action: 'upgrade' }, 0);

    const outsideWindow = Date.UTC(2026, 0, 1, 1, 0, 0);
    const insideWindow = Date.UTC(2026, 0, 1, 2, 30, 0);

    expect(queue.getRunnableTasks(outsideWindow)).toEqual([]);
    expect(queue.getRunnableTasks(insideWindow)).toEqual([
      { key: 'goose', provider: 'npm', action: 'upgrade' },
    ]);
  });
});
