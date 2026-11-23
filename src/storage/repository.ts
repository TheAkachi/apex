import type {
  ApexSettings,
  ApexSnapshot,
  CalendarEvent,
  DailyPrioritiesRecord,
  StudySession,
} from '../types/models';

/**
 * Seam de persistência do Apex.
 * Hoje atendido pelo adapter local IndexedDB; no futuro pode receber um adapter
 * de sincronização em nuvem sem alterar a interface dos módulos consumidores.
 */
export interface ApexRepository {
  getSessions(): Promise<StudySession[]>;
  saveSession(session: StudySession): Promise<void>;
  deleteSession(id: string): Promise<void>;

  getEvents(): Promise<CalendarEvent[]>;
  saveEvent(event: CalendarEvent): Promise<void>;
  deleteEvent(id: string): Promise<void>;

  getPriorities(date: string): Promise<DailyPrioritiesRecord>;
  getAllPriorities(): Promise<DailyPrioritiesRecord[]>;
  savePriorities(record: DailyPrioritiesRecord): Promise<void>;

  getSettings(): Promise<ApexSettings>;
  saveSettings(settings: ApexSettings): Promise<void>;

  exportSnapshot(): Promise<ApexSnapshot>;
  importSnapshot(snapshot: ApexSnapshot): Promise<void>;
  clearAll(): Promise<void>;
}
