export type TimerPhase = 'study' | 'break';

export type AppTab = 'focus' | 'marathon' | 'calendar' | 'analytics';

export interface StudySession {
  id: string;
  /** Data local no formato YYYY-MM-DD */
  date: string;
  /** Duração efetiva em minutos */
  durationMinutes: number;
  /** Etiqueta/atividade opcional */
  label: string;
  /** Categoria / tag opcional */
  category?: string;
  /** ID do bloco do calendário caso tenha vindo de uma pendência */
  eventId?: string;
  /** Anotação livre sobre o que foi feito */
  notes?: string;
  /** Tempo total de descanso acumulado (para sessões de Maratona) */
  breakMinutes?: number;
  /** Quantidade de pausas feitas (para sessões de Maratona) */
  breakCount?: number;
  /** Timestamp ISO do término ou registro */
  completedAt: string;
  /** Origem da sessão */
  source: 'timer' | 'manual' | 'marathon';
}

export const DEFAULT_CATEGORIES = ['Estudo', 'Trabalho', 'Família', 'Amigos'] as const;

export interface CalendarEvent {
  id: string;
  /** Data local no formato YYYY-MM-DD */
  date: string;
  /** Horário de início no formato HH:MM */
  time: string;
  /** Previsão de término no formato HH:MM */
  endTime?: string;
  title: string;
  /** Categoria / nicho da pendência (ex: Estudo, Trabalho, Família, Amigos ou personalizada) */
  category?: string;
  /** Duração planejada em minutos (calculada ou usada na ponte para o Timer) */
  durationMinutes: number;
  /** Quantos minutos antes avisar (0 = na hora exata, null = sem aviso) */
  reminderMinutesBefore: number | null;
  completed: boolean;
  /** Se o usuário desmarcou manualmente uma pendência já vencida, evita remarcar sozinho */
  manualUncompleted?: boolean;
  /** Evita disparar o mesmo aviso duas vezes */
  notifiedAt?: string;
}

export interface DailyPriority {
  id: string;
  text: string;
  done: boolean;
}

export interface DailyPrioritiesRecord {
  /** Data local no formato YYYY-MM-DD */
  date: string;
  items: DailyPriority[];
}

export interface ApexSettings {
  defaultStudyMinutes: number;
  defaultBreakMinutes: number;
  autoStartBreak: boolean;
  autoCompleteExpiredEvents: boolean;
  soundEnabled: boolean;
  brownNoiseVolume: number;
  demoModeActive: boolean;
  customCategories: string[];
}

export interface ApexSnapshot {
  version: 1;
  exportedAt: string;
  sessions: StudySession[];
  events: CalendarEvent[];
  priorities: DailyPrioritiesRecord[];
  settings: ApexSettings;
}

export const DEFAULT_SETTINGS: ApexSettings = {
  defaultStudyMinutes: 30,
  defaultBreakMinutes: 10,
  autoStartBreak: false,
  autoCompleteExpiredEvents: true,
  soundEnabled: true,
  brownNoiseVolume: 0.28,
  demoModeActive: false,
  customCategories: [],
};
