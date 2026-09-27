import type { MockMessenger } from './messengers.ts';

export interface MockHistoryEntry {
  chatId: string;
  idMessage: string;
  senderName?: string;
  statusMessage?: string;
  textMessage: string;
  timestamp: number;
  type: 'incoming' | 'outgoing';
  typeMessage: 'textMessage';
}

interface MockNotification {
  body: Record<string, unknown>;
  receiptId: number;
}

export interface MockInstance {
  apiTokenInstance: string;
  history: MockHistoryEntry[];
  messenger: MockMessenger;
  nextReceiptId: number;
  notifications: MockNotification[];
  waiters: Set<() => void>;
}

export function createInstanceStore(maxInstances: number) {
  const instances = new Map<string, MockInstance>();

  function evictOldestInstance() {
    const oldest = instances.keys().next();
    if (!oldest.done) {
      instances.delete(oldest.value);
    }
  }

  return {
    authorize(idInstance: string, messenger: MockMessenger, apiTokenInstance: string) {
      const instance: MockInstance = instances.get(idInstance) ?? {
        apiTokenInstance,
        history: [],
        messenger,
        nextReceiptId: 1,
        notifications: [],
        waiters: new Set(),
      };
      if (instance.apiTokenInstance !== apiTokenInstance) {
        return null;
      }
      instances.delete(idInstance);
      if (instances.size >= maxInstances) {
        evictOldestInstance();
      }
      instances.set(idInstance, instance);
      return instance;
    },
  };
}
