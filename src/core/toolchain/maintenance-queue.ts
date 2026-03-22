export interface MaintenanceTask {
  key: string;
  provider: string;
  action: 'refresh' | 'upgrade' | 'cleanup';
  payload?: Record<string, unknown>;
}

export interface MaintenanceQueueOptions {
  maxRunsPerProvider?: number;
  backoffMs?: number;
  maintenanceWindow?: {
    startHourUtc: number;
    endHourUtc: number;
  };
}

interface ScheduledTask {
  task: MaintenanceTask;
  availableAt: number;
}

export class MaintenanceQueue {
  private readonly maxRunsPerProvider: number;
  private readonly backoffMs: number;
  private readonly maintenanceWindow?: MaintenanceQueueOptions['maintenanceWindow'];
  private readonly tasks = new Map<string, ScheduledTask>();
  private readonly providerRuns = new Map<string, number>();

  constructor(options: MaintenanceQueueOptions = {}) {
    this.maxRunsPerProvider = options.maxRunsPerProvider ?? 1;
    this.backoffMs = options.backoffMs ?? 60_000;
    this.maintenanceWindow = options.maintenanceWindow;
  }

  enqueue(task: MaintenanceTask, now = Date.now()): void {
    const existing = this.tasks.get(task.key);
    if (existing) {
      this.tasks.set(task.key, {
        task,
        availableAt: Math.min(existing.availableAt, now),
      });
      return;
    }

    this.tasks.set(task.key, {
      task,
      availableAt: now,
    });
  }

  getPendingTasks(): MaintenanceTask[] {
    return Array.from(this.tasks.values()).map((entry) => entry.task);
  }

  getRunnableTasks(now = Date.now()): MaintenanceTask[] {
    if (!this.isWithinMaintenanceWindow(now)) {
      return [];
    }

    return Array.from(this.tasks.values())
      .filter((entry) => entry.availableAt <= now)
      .filter((entry) => (this.providerRuns.get(entry.task.provider) ?? 0) < this.maxRunsPerProvider)
      .map((entry) => entry.task);
  }

  markStarted(task: MaintenanceTask): void {
    const runs = this.providerRuns.get(task.provider) ?? 0;
    this.providerRuns.set(task.provider, runs + 1);
  }

  markCompleted(task: MaintenanceTask): void {
    this.tasks.delete(task.key);
    const runs = this.providerRuns.get(task.provider) ?? 0;
    this.providerRuns.set(task.provider, Math.max(0, runs - 1));
  }

  markFailed(task: MaintenanceTask, now = Date.now()): void {
    const existing = this.tasks.get(task.key);
    if (!existing) {
      return;
    }

    existing.availableAt = now + this.backoffMs;
    const runs = this.providerRuns.get(task.provider) ?? 0;
    this.providerRuns.set(task.provider, Math.max(0, runs - 1));
  }

  private isWithinMaintenanceWindow(now: number): boolean {
    if (!this.maintenanceWindow) {
      return true;
    }

    const hour = new Date(now).getUTCHours();
    const { startHourUtc, endHourUtc } = this.maintenanceWindow;

    if (startHourUtc <= endHourUtc) {
      return hour >= startHourUtc && hour < endHourUtc;
    }

    return hour >= startHourUtc || hour < endHourUtc;
  }
}
