import {
  DEFAULT_SETTINGS,
  type ApexSnapshot,
  type CalendarEvent,
  type DailyPrioritiesRecord,
  type StudySession,
} from '../types/models';
import { formatLocalDate, offsetLocalDate } from '../utils/date';

const DEMO_BACKUP_KEY = 'apex:real-data-backup';

const SUBJECTS = ['Algoritmos', 'TypeScript', 'Inglês', 'Arquitetura', 'Banco de Dados'];

export function buildDemoSnapshot(): ApexSnapshot {
  const today = new Date();
  const sessions: StudySession[] = [];

  // Gera histórico consistente nos últimos 90 dias (com variação natural)
  for (let i = 89; i >= 0; i--) {
    const date = offsetLocalDate(today, -i);
    // Simula ritmo realista: estuda ~72% dos dias e mantém sequência recente
    const hash = (i * 2654435761) >>> 0;
    const studied = i <= 6 ? true : hash % 10 < 7;
    if (!studied) continue;

    const blocks = (hash % 3) + 1;
    for (let b = 0; b < blocks; b++) {
      const duration = [25, 30, 45, 50, 20][(hash + b) % 5];
      const label = SUBJECTS[(hash + b) % SUBJECTS.length];
      sessions.push({
        id: `demo-s-${i}-${b}`,
        date,
        durationMinutes: duration,
        label,
        completedAt: `${date}T${String(9 + b * 3).padStart(2, '0')}:30:00.000Z`,
        source: b === 2 ? 'manual' : 'timer',
      });
    }
  }

  const todayStr = formatLocalDate(today);
  const tomorrowStr = offsetLocalDate(today, 1);

  const events: CalendarEvent[] = [
    {
      id: 'demo-e-1',
      date: todayStr,
      time: '09:00',
      title: 'Revisão de Estruturas de Dados',
      durationMinutes: 45,
      reminderMinutesBefore: 10,
      completed: true,
    },
    {
      id: 'demo-e-2',
      date: todayStr,
      time: '15:00',
      title: 'Prática de TypeScript & PWA',
      durationMinutes: 50,
      reminderMinutesBefore: 5,
      completed: false,
    },
    {
      id: 'demo-e-3',
      date: todayStr,
      time: '19:30',
      title: 'Leitura técnica (Inglês)',
      durationMinutes: 25,
      reminderMinutesBefore: 10,
      completed: false,
    },
    {
      id: 'demo-e-4',
      date: tomorrowStr,
      time: '10:00',
      title: 'Projeto de Portfólio — Testes',
      durationMinutes: 60,
      reminderMinutesBefore: 15,
      completed: false,
    },
  ];

  const priorities: DailyPrioritiesRecord[] = [
    {
      date: todayStr,
      items: [
        { id: 'demo-p-1', text: 'Concluir 2 blocos de foco profundo', done: true },
        { id: 'demo-p-2', text: 'Revisar anotações de arquitetura', done: false },
        { id: 'demo-p-3', text: 'Organizar agenda da semana', done: false },
      ],
    },
  ];

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    sessions,
    events,
    priorities,
    settings: {
      ...DEFAULT_SETTINGS,
      demoModeActive: true,
    },
  };
}

export function saveRealBackupBeforeDemo(snapshot: ApexSnapshot): void {
  try {
    localStorage.setItem(DEMO_BACKUP_KEY, JSON.stringify(snapshot));
  } catch {
    // Se exceder quota do localStorage, segue sem travar
  }
}

export function consumeRealBackup(): ApexSnapshot | null {
  try {
    const raw = localStorage.getItem(DEMO_BACKUP_KEY);
    if (!raw) return null;
    localStorage.removeItem(DEMO_BACKUP_KEY);
    return JSON.parse(raw) as ApexSnapshot;
  } catch {
    return null;
  }
}

export function hasRealBackup(): boolean {
  try {
    return localStorage.getItem(DEMO_BACKUP_KEY) !== null;
  } catch {
    return false;
  }
}
