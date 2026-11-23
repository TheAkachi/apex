import {
  DEFAULT_SETTINGS,
  type ApexSettings,
  type ApexSnapshot,
  type CalendarEvent,
  type DailyPrioritiesRecord,
  type StudySession,
} from '../types/models';
import type { ApexRepository } from './repository';

const DB_NAME = 'apex-db';
const DB_VERSION = 1;

const STORES = {
  sessions: 'sessions',
  events: 'events',
  priorities: 'priorities',
  meta: 'meta',
} as const;

const SETTINGS_KEY = 'settings';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.sessions)) {
        const store = db.createObjectStore(STORES.sessions, { keyPath: 'id' });
        store.createIndex('by-date', 'date', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.events)) {
        const store = db.createObjectStore(STORES.events, { keyPath: 'id' });
        store.createIndex('by-date', 'date', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.priorities)) {
        db.createObjectStore(STORES.priorities, { keyPath: 'date' });
      }
      if (!db.objectStoreNames.contains(STORES.meta)) {
        db.createObjectStore(STORES.meta, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Falha ao abrir IndexedDB'));
  });
}

function runTx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const req = operation(store);

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('Erro na operação IndexedDB'));
        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();
      })
  );
}

export class IndexedDbRepository implements ApexRepository {
  async getSessions(): Promise<StudySession[]> {
    const list = await runTx<StudySession[]>(STORES.sessions, 'readonly', (s) => s.getAll());
    return list.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  }

  async saveSession(session: StudySession): Promise<void> {
    await runTx(STORES.sessions, 'readwrite', (s) => s.put(session));
  }

  async deleteSession(id: string): Promise<void> {
    await runTx(STORES.sessions, 'readwrite', (s) => s.delete(id));
  }

  async getEvents(): Promise<CalendarEvent[]> {
    const list = await runTx<CalendarEvent[]>(STORES.events, 'readonly', (s) => s.getAll());
    return list.sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  }

  async saveEvent(event: CalendarEvent): Promise<void> {
    await runTx(STORES.events, 'readwrite', (s) => s.put(event));
  }

  async deleteEvent(id: string): Promise<void> {
    await runTx(STORES.events, 'readwrite', (s) => s.delete(id));
  }

  async getPriorities(date: string): Promise<DailyPrioritiesRecord> {
    const found = await runTx<DailyPrioritiesRecord | undefined>(
      STORES.priorities,
      'readonly',
      (s) => s.get(date)
    );
    return found ?? { date, items: [] };
  }

  async getAllPriorities(): Promise<DailyPrioritiesRecord[]> {
    return runTx<DailyPrioritiesRecord[]>(STORES.priorities, 'readonly', (s) => s.getAll());
  }

  async savePriorities(record: DailyPrioritiesRecord): Promise<void> {
    await runTx(STORES.priorities, 'readwrite', (s) => s.put(record));
  }

  async getSettings(): Promise<ApexSettings> {
    const entry = await runTx<{ key: string; value: Partial<ApexSettings> } | undefined>(
      STORES.meta,
      'readonly',
      (s) => s.get(SETTINGS_KEY)
    );
    return { ...DEFAULT_SETTINGS, ...(entry?.value ?? {}) };
  }

  async saveSettings(settings: ApexSettings): Promise<void> {
    await runTx(STORES.meta, 'readwrite', (s) =>
      s.put({ key: SETTINGS_KEY, value: settings })
    );
  }

  async exportSnapshot(): Promise<ApexSnapshot> {
    const [sessions, events, priorities, settings] = await Promise.all([
      this.getSessions(),
      this.getEvents(),
      this.getAllPriorities(),
      this.getSettings(),
    ]);

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      sessions,
      events,
      priorities,
      settings,
    };
  }

  async importSnapshot(snapshot: ApexSnapshot): Promise<void> {
    await this.clearAll();
    const db = await openDatabase();

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(
        [STORES.sessions, STORES.events, STORES.priorities, STORES.meta],
        'readwrite'
      );

      const sessionStore = tx.objectStore(STORES.sessions);
      for (const s of snapshot.sessions ?? []) {
        sessionStore.put(s);
      }

      const eventStore = tx.objectStore(STORES.events);
      for (const e of snapshot.events ?? []) {
        eventStore.put(e);
      }

      const priorityStore = tx.objectStore(STORES.priorities);
      for (const p of snapshot.priorities ?? []) {
        priorityStore.put(p);
      }

      const metaStore = tx.objectStore(STORES.meta);
      metaStore.put({
        key: SETTINGS_KEY,
        value: { ...DEFAULT_SETTINGS, ...(snapshot.settings ?? {}) },
      });

      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error ?? new Error('Erro ao importar snapshot'));
      };
    });
  }

  async clearAll(): Promise<void> {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(
        [STORES.sessions, STORES.events, STORES.priorities, STORES.meta],
        'readwrite'
      );
      tx.objectStore(STORES.sessions).clear();
      tx.objectStore(STORES.events).clear();
      tx.objectStore(STORES.priorities).clear();
      tx.objectStore(STORES.meta).clear();

      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error ?? new Error('Erro ao limpar banco local'));
      };
    });
  }
}

export const apexRepo: ApexRepository = new IndexedDbRepository();
