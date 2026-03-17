/**
 * CLISYS Event Bus
 * 类型安全的事件发布/订阅系统
 */

import type { CLISYSEventType, CLISYSEvent } from '../adapter/types.js';
import { createChildLogger } from '../logger/index.js';

const logger = createChildLogger('bus');

export type EventCallback<T = unknown> = (event: CLISYSEvent & { payload: T }) => void | Promise<void>;

export interface BusStats {
  eventTypes: CLISYSEventType[];
  listenerCount: number;
  totalEventsEmitted: number;
}

class EventBus {
  private listeners: Map<CLISYSEventType, Set<EventCallback>> = new Map();
  private onceListeners: Map<CLISYSEventType, Set<EventCallback>> = new Map();
  private eventHistory: CLISYSEvent[] = [];
  private maxHistorySize: number = 100;
  private totalEventsEmitted: number = 0;

  /**
   * 订阅事件
   */
  on<T = unknown>(eventType: CLISYSEventType, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback as EventCallback);

    logger.debug({ eventType }, 'Event listener registered');

    // 返回取消订阅函数
    return () => this.off(eventType, callback);
  }

  /**
   * 订阅一次性事件
   */
  once<T = unknown>(eventType: CLISYSEventType, callback: EventCallback<T>): () => void {
    if (!this.onceListeners.has(eventType)) {
      this.onceListeners.set(eventType, new Set());
    }
    this.onceListeners.get(eventType)!.add(callback as EventCallback);

    logger.debug({ eventType }, 'Once listener registered');

    return () => {
      this.onceListeners.get(eventType)?.delete(callback as EventCallback);
    };
  }

  /**
   * 取消订阅
   */
  off<T = unknown>(eventType: CLISYSEventType, callback: EventCallback<T>): void {
    this.listeners.get(eventType)?.delete(callback as EventCallback);
    this.onceListeners.get(eventType)?.delete(callback as EventCallback);
    logger.debug({ eventType }, 'Event listener removed');
  }

  /**
   * 发射事件
   */
  async emit<T = unknown>(
    eventType: CLISYSEventType,
    payload: T,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const event: CLISYSEvent & { payload: T } = {
      type: eventType,
      timestamp: new Date(),
      payload,
      metadata,
    };

    this.totalEventsEmitted++;
    this.addToHistory(event);

    logger.debug({ eventType }, 'Event emitted');

    // 获取所有监听器
    const listeners = this.listeners.get(eventType) || new Set();
    const onceListeners = this.onceListeners.get(eventType) || new Set();

    // 执行常规监听器
    const promises: Promise<void>[] = [];

    for (const callback of listeners) {
      try {
        const result = callback(event);
        if (result instanceof Promise) {
          promises.push(result);
        }
      } catch (error) {
        logger.error({ eventType, error }, 'Event listener error');
      }
    }

    // 执行一次性监听器
    for (const callback of onceListeners) {
      try {
        const result = callback(event);
        if (result instanceof Promise) {
          promises.push(result);
        }
      } catch (error) {
        logger.error({ eventType, error }, 'Once listener error');
      }
    }

    // 清除一次性监听器
    this.onceListeners.delete(eventType);

    // 等待所有异步监听器完成
    await Promise.all(promises);
  }

  /**
   * 同步发射事件（不等待异步监听器）
   */
  emitSync<T = unknown>(
    eventType: CLISYSEventType,
    payload: T,
    metadata?: Record<string, unknown>
  ): void {
    const event: CLISYSEvent & { payload: T } = {
      type: eventType,
      timestamp: new Date(),
      payload,
      metadata,
    };

    this.totalEventsEmitted++;
    this.addToHistory(event);

    const listeners = this.listeners.get(eventType) || new Set();

    for (const callback of listeners) {
      try {
        callback(event);
      } catch (error) {
        logger.error({ eventType, error }, 'Event listener error');
      }
    }
  }

  /**
   * 获取事件历史
   */
  getHistory(eventType?: CLISYSEventType): CLISYSEvent[] {
    if (eventType) {
      return this.eventHistory.filter(e => e.type === eventType);
    }
    return [...this.eventHistory];
  }

  /**
   * 清除所有监听器
   */
  clearAll(): void {
    this.listeners.clear();
    this.onceListeners.clear();
    logger.info('All event listeners cleared');
  }

  /**
   * 获取总线统计信息
   */
  getStats(): BusStats {
    const eventTypes = new Set<CLISYSEventType>();
    let listenerCount = 0;

    for (const [type, listeners] of this.listeners) {
      eventTypes.add(type);
      listenerCount += listeners.size;
    }

    return {
      eventTypes: Array.from(eventTypes),
      listenerCount,
      totalEventsEmitted: this.totalEventsEmitted,
    };
  }

  private addToHistory(event: CLISYSEvent): void {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }
}

// 全局单例
let globalBus: EventBus | null = null;

/**
 * 获取全局事件总线
 */
export function getEventBus(): EventBus {
  if (!globalBus) {
    globalBus = new EventBus();
  }
  return globalBus;
}

/**
 * 创建新的事件总线实例
 */
export function createEventBus(): EventBus {
  return new EventBus();
}

export { EventBus };
