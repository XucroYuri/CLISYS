export interface ToolchainLockHandle {
  key: string;
  owner: string;
}

export class ToolchainLockManager {
  private readonly locks = new Map<string, ToolchainLockHandle>();

  acquire(key: string, owner: string): ToolchainLockHandle {
    if (this.locks.has(key)) {
      throw new Error(`Toolchain lock "${key}" is already held`);
    }

    const handle: ToolchainLockHandle = {
      key,
      owner,
    };

    this.locks.set(key, handle);
    return handle;
  }

  release(handle: ToolchainLockHandle): void {
    const current = this.locks.get(handle.key);
    if (!current) {
      throw new Error(`Toolchain lock "${handle.key}" is not held`);
    }

    if (current.owner !== handle.owner) {
      throw new Error(`Toolchain lock "${handle.key}" is owned by "${current.owner}"`);
    }

    this.locks.delete(handle.key);
  }

  isLocked(key: string): boolean {
    return this.locks.has(key);
  }
}
