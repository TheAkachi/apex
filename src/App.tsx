import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Calendar, Flame, Settings, Timer, Volume2, VolumeX, X } from 'lucide-react';
import { AnalyticsView } from './components/Analytics/AnalyticsView';
import { CalendarView } from './components/Calendar/CalendarView';
import { EventModal } from './components/Calendar/EventModal';
import { FocusView } from './components/Focus/FocusView';
import { MarathonView, type MarathonStatus } from './components/Marathon/MarathonView';
import { SettingsModal } from './components/Settings/SettingsModal';
import { SlidingTabs } from './components/ui/SlidingTabs';
import { brownNoise } from './services/brownNoise';
import { playChime } from './services/chime';
import {
  getNotificationStatus,
  requestNotificationPermission,
  sendSystemNotification,
  type NotificationStatus,
} from './services/notifications';
import { pipTimer, type PipPhase } from './services/pipTimer';
import {
  buildDemoSnapshot,
  consumeRealBackup,
  hasRealBackup,
  saveRealBackupBeforeDemo,
} from './storage/demoData';
import { apexRepo } from './storage/indexedDb';
import {
  DEFAULT_SETTINGS,
  type ApexSettings,
  type ApexSnapshot,
  type AppTab,
  type CalendarEvent,
  type DailyPrioritiesRecord,
  type StudySession,
  type TimerPhase,
} from './types/models';
import { formatClock, formatLocalDate, formatStopwatch, uid } from './utils/date';

interface ToastItem {
  id: string;
  title: string;
  body: string;
  open: boolean;
}

interface PhaseTimer {
  totalSeconds: number;
  remainingSeconds: number;
  running: boolean;
}

type TimersMap = Record<TimerPhase, PhaseTimer>;

export function App() {
  const [tab, setTab] = useState<AppTab>('focus');
  const [calendarSubView, setCalendarSubView] = useState<'agenda' | 'pending'>('agenda');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickEventModalOpen, setQuickEventModalOpen] = useState(false);

  // Dados persistidos automaticamente no IndexedDB
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => formatLocalDate(new Date()));
  const [allPriorities, setAllPriorities] = useState<DailyPrioritiesRecord[]>([]);
  const [settings, setSettings] = useState<ApexSettings>(DEFAULT_SETTINGS);
  const [notificationStatus, setNotificationStatus] = useState<NotificationStatus>(() =>
    getNotificationStatus()
  );
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Atividade e Descanso possuem timers independentes: trocar de aba nunca para nem zera o outro
  const [viewedPhase, setViewedPhase] = useState<TimerPhase>('study');
  const [timers, setTimers] = useState<TimersMap>(() => ({
    study: {
      totalSeconds: DEFAULT_SETTINGS.defaultStudyMinutes * 60,
      remainingSeconds: DEFAULT_SETTINGS.defaultStudyMinutes * 60,
      running: false,
    },
    break: {
      totalSeconds: DEFAULT_SETTINGS.defaultBreakMinutes * 60,
      remainingSeconds: DEFAULT_SETTINGS.defaultBreakMinutes * 60,
      running: false,
    },
  }));

  const [label, setLabel] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [autoSavedMinutes, setAutoSavedMinutes] = useState(0);
  const [pipOpen, setPipOpen] = useState(false);
  const [brownNoiseOn, setBrownNoiseOn] = useState(false);

  // Estado independente do Modo Maratona (Flow State — ambos os timers crescentes)
  const [marathonStatus, setMarathonStatus] = useState<MarathonStatus>('idle');
  const [marathonFlowSeconds, setMarathonFlowSeconds] = useState(0);
  const [marathonCurrentBreakSeconds, setMarathonCurrentBreakSeconds] = useState(0);
  const [marathonTotalBreakSeconds, setMarathonTotalBreakSeconds] = useState(0);
  const [marathonBreakCount, setMarathonBreakCount] = useState(0);
  const [marathonLabel, setMarathonLabel] = useState('');
  const [marathonNotes, setMarathonNotes] = useState('');
  const [marathonAutoSavedMinutes, setMarathonAutoSavedMinutes] = useState(0);

  const marathonFlowBaseRef = useRef(0);
  const marathonFlowStartMsRef = useRef<number | null>(null);
  const marathonBreakBaseRef = useRef(0);
  const marathonBreakStartMsRef = useRef<number | null>(null);
  const marathonSessionIdRef = useRef<string | null>(null);
  const marathonSessionDateRef = useRef<string | null>(null);
  const marathonSavedMinsRef = useRef(0);
  const marathonStatusRef = useRef<MarathonStatus>(marathonStatus);
  const marathonLabelRef = useRef(marathonLabel);
  const marathonNotesRef = useRef(marathonNotes);
  const marathonBreakCountRef = useRef(marathonBreakCount);

  marathonStatusRef.current = marathonStatus;
  marathonLabelRef.current = marathonLabel;
  marathonNotesRef.current = marathonNotes;
  marathonBreakCountRef.current = marathonBreakCount;

  const endTimesRef = useRef<Record<TimerPhase, number | null>>({
    study: null,
    break: null,
  });
  const timersRef = useRef<TimersMap>(timers);
  const viewedPhaseRef = useRef<TimerPhase>(viewedPhase);
  const labelRef = useRef<string>(label);
  const sessionNotesRef = useRef<string>(sessionNotes);
  const settingsRef = useRef<ApexSettings>(settings);

  // Controle de salvamento automático contínuo da sessão de atividade
  const activeSessionIdRef = useRef<string | null>(null);
  const activeSessionDateRef = useRef<string | null>(null);
  const activeSavedMinutesRef = useRef<number>(0);
  const activeCategoryRef = useRef<string | undefined>(undefined);
  const activeEventIdRef = useRef<string | undefined>(undefined);

  timersRef.current = timers;
  viewedPhaseRef.current = viewedPhase;
  labelRef.current = label;
  sessionNotesRef.current = sessionNotes;
  settingsRef.current = settings;

  const pushToast = useCallback((title: string, body: string) => {
    const id = uid('toast');
    setToasts((prev) => [...prev, { id, title, body, open: false }]);
    requestAnimationFrame(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, open: true } : t)));
    });
    window.setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, open: false } : t)));
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 280);
    }, 5200);
  }, []);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, open: false } : t)));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 260);
  };

  const upsertSession = useCallback(async (session: StudySession) => {
    await apexRepo.saveSession(session);
    setSessions((prev) => {
      const exists = prev.some((s) => s.id === session.id);
      if (exists) {
        return prev.map((s) => (s.id === session.id ? session : s));
      }
      return [session, ...prev];
    });
  }, []);

  const syncActiveStudySession = useCallback(
    async (elapsedMinutes: number, force = false) => {
      if (elapsedMinutes < 1) return;
      if (!force && elapsedMinutes <= activeSavedMinutesRef.current) return;

      if (!activeSessionIdRef.current) {
        activeSessionIdRef.current = uid('sess');
        activeSessionDateRef.current = formatLocalDate(new Date());
      }

      const minutesToSave = Math.max(activeSavedMinutesRef.current, elapsedMinutes);
      activeSavedMinutesRef.current = minutesToSave;
      setAutoSavedMinutes(minutesToSave);

      const trimmedNotes = sessionNotesRef.current.trim();
      const session: StudySession = {
        id: activeSessionIdRef.current,
        date: activeSessionDateRef.current ?? formatLocalDate(new Date()),
        durationMinutes: minutesToSave,
        label: labelRef.current.trim() || 'Atividade',
        category: activeCategoryRef.current,
        eventId: activeEventIdRef.current,
        notes: trimmedNotes || undefined,
        completedAt: new Date().toISOString(),
        source: 'timer',
      };

      await upsertSession(session);
    },
    [upsertSession]
  );

  const resetActiveSessionTracking = useCallback(() => {
    activeSessionIdRef.current = null;
    activeSessionDateRef.current = null;
    activeSavedMinutesRef.current = 0;
    activeCategoryRef.current = undefined;
    activeEventIdRef.current = undefined;
    setAutoSavedMinutes(0);
  }, []);

  const syncActiveMarathonSession = useCallback(
    async (flowMinutes: number, totalBreakSecs: number, force = false) => {
      if (flowMinutes < 1) return;
      if (!force && flowMinutes <= marathonSavedMinsRef.current) return;

      if (!marathonSessionIdRef.current) {
        marathonSessionIdRef.current = uid('mar');
        marathonSessionDateRef.current = formatLocalDate(new Date());
      }

      const minutesToSave = Math.max(marathonSavedMinsRef.current, flowMinutes);
      marathonSavedMinsRef.current = minutesToSave;
      setMarathonAutoSavedMinutes(minutesToSave);

      const trimmedNotes = marathonNotesRef.current.trim();
      const session: StudySession = {
        id: marathonSessionIdRef.current,
        date: marathonSessionDateRef.current ?? formatLocalDate(new Date()),
        durationMinutes: minutesToSave,
        label: marathonLabelRef.current.trim() || 'Maratona',
        notes: trimmedNotes || undefined,
        breakCount: marathonBreakCountRef.current,
        breakMinutes: Math.round(totalBreakSecs / 60),
        completedAt: new Date().toISOString(),
        source: 'marathon',
      };

      await upsertSession(session);
    },
    [upsertSession]
  );

  const resetMarathonState = useCallback(() => {
    marathonFlowBaseRef.current = 0;
    marathonFlowStartMsRef.current = null;
    marathonBreakBaseRef.current = 0;
    marathonBreakStartMsRef.current = null;
    marathonSessionIdRef.current = null;
    marathonSessionDateRef.current = null;
    marathonSavedMinsRef.current = 0;
    setMarathonStatus('idle');
    setMarathonFlowSeconds(0);
    setMarathonCurrentBreakSeconds(0);
    setMarathonTotalBreakSeconds(0);
    setMarathonBreakCount(0);
    setMarathonAutoSavedMinutes(0);
  }, []);

  const loadAllData = useCallback(async () => {
    const [loadedSessions, loadedEvents, loadedPriorities, loadedSettings] = await Promise.all([
      apexRepo.getSessions(),
      apexRepo.getEvents(),
      apexRepo.getAllPriorities(),
      apexRepo.getSettings(),
    ]);

    setSessions(loadedSessions);
    setEvents(loadedEvents);
    setAllPriorities(loadedPriorities);
    setSettings(loadedSettings);
    setTimers({
      study: {
        totalSeconds: loadedSettings.defaultStudyMinutes * 60,
        remainingSeconds: loadedSettings.defaultStudyMinutes * 60,
        running: false,
      },
      break: {
        totalSeconds: loadedSettings.defaultBreakMinutes * 60,
        remainingSeconds: loadedSettings.defaultBreakMinutes * 60,
        running: false,
      },
    });
  }, []);

  useEffect(() => {
    void loadAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      brownNoise.stop();
      pipTimer.close();
    };
  }, []);

  useEffect(() => {
    if (activeSavedMinutesRef.current > 0) {
      const timer = window.setTimeout(() => {
        void syncActiveStudySession(activeSavedMinutesRef.current, true);
      }, 450);
      return () => window.clearTimeout(timer);
    }
  }, [label, sessionNotes, syncActiveStudySession]);

  useEffect(() => {
    if (marathonSavedMinsRef.current > 0) {
      const timer = window.setTimeout(() => {
        const liveBreak =
          marathonBreakBaseRef.current +
          (marathonBreakStartMsRef.current
            ? Math.floor((Date.now() - marathonBreakStartMsRef.current) / 1000)
            : 0);
        void syncActiveMarathonSession(marathonSavedMinsRef.current, liveBreak, true);
      }, 450);
      return () => window.clearTimeout(timer);
    }
  }, [marathonLabel, marathonNotes, syncActiveMarathonSession]);

  // Loop de tick da Maratona (baseado em timestamp real — continua em qualquer aba)
  useEffect(() => {
    if (marathonStatus !== 'flowing' && marathonStatus !== 'resting') return;

    const tick = () => {
      const now = Date.now();
      if (marathonStatusRef.current === 'flowing' && marathonFlowStartMsRef.current !== null) {
        const totalFlow =
          marathonFlowBaseRef.current + Math.floor((now - marathonFlowStartMsRef.current) / 1000);
        setMarathonFlowSeconds(totalFlow);

        const completedMins = Math.floor(totalFlow / 60);
        if (completedMins >= 1 && completedMins > marathonSavedMinsRef.current) {
          void syncActiveMarathonSession(completedMins, marathonBreakBaseRef.current);
        }
      } else if (
        marathonStatusRef.current === 'resting' &&
        marathonBreakStartMsRef.current !== null
      ) {
        const currBreak = Math.floor((now - marathonBreakStartMsRef.current) / 1000);
        setMarathonCurrentBreakSeconds(currBreak);
      }
    };

    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [marathonStatus, syncActiveMarathonSession]);

  const handlePhaseComplete = useCallback(
    async (finishedPhase: TimerPhase) => {
      const currentSettings = settingsRef.current;
      endTimesRef.current[finishedPhase] = null;

      if (finishedPhase === 'study') {
        const studiedMins = Math.max(1, Math.round(timersRef.current.study.totalSeconds / 60));
        await syncActiveStudySession(studiedMins, true);
        resetActiveSessionTracking();
        setSessionNotes('');

        if (currentSettings.soundEnabled) playChime('focus-done');
        sendSystemNotification(
          'Apex · Bloco de atividade concluído',
          `Você registrou ${studiedMins} min${labelRef.current ? ` em "${labelRef.current}"` : ''}. Hora do descanso!`
        );
        pushToast(
          'Atividade concluída!',
          `${studiedMins} min salvos automaticamente no seu histórico.`
        );

        const nextStudySecs = currentSettings.defaultStudyMinutes * 60;
        const nextBreakSecs = timersRef.current.break.totalSeconds;

        if (currentSettings.autoStartBreak) {
          endTimesRef.current.break = Date.now() + nextBreakSecs * 1000;
        }

        setViewedPhase('break');
        setTimers((prev) => ({
          study: {
            totalSeconds: nextStudySecs,
            remainingSeconds: nextStudySecs,
            running: false,
          },
          break: {
            totalSeconds: prev.break.totalSeconds,
            remainingSeconds: prev.break.totalSeconds,
            running: currentSettings.autoStartBreak,
          },
        }));
      } else {
        if (currentSettings.soundEnabled) playChime('break-done');
        sendSystemNotification('Apex · Descanso encerrado', 'Pronto para a próxima atividade?');
        pushToast('Descanso encerrado', 'Seu cronômetro já está pronto para a próxima atividade.');

        const nextBreakSecs = currentSettings.defaultBreakMinutes * 60;
        setViewedPhase('study');
        setTimers((prev) => ({
          ...prev,
          break: {
            totalSeconds: nextBreakSecs,
            remainingSeconds: nextBreakSecs,
            running: false,
          },
        }));
      }
    },
    [pushToast, resetActiveSessionTracking, syncActiveStudySession]
  );

  const anyRunning = timers.study.running || timers.break.running;

  // Loop de tick baseado em timestamp real (funciona independente da aba exibida)
  useEffect(() => {
    if (!anyRunning) return;

    const tick = () => {
      const now = Date.now();
      const phases: TimerPhase[] = ['study', 'break'];

      for (const p of phases) {
        const endTs = endTimesRef.current[p];
        if (endTs === null || !timersRef.current[p].running) continue;

        const diffMs = endTs - now;
        const nextSecs = Math.max(0, Math.ceil(diffMs / 1000));

        setTimers((prev) =>
          prev[p].remainingSeconds === nextSecs
            ? prev
            : { ...prev, [p]: { ...prev[p], remainingSeconds: nextSecs } }
        );

        if (p === 'study') {
          const elapsedSecs = Math.max(0, timersRef.current.study.totalSeconds - nextSecs);
          const completedMins = Math.floor(elapsedSecs / 60);
          if (completedMins >= 1 && completedMins > activeSavedMinutesRef.current) {
            void syncActiveStudySession(completedMins);
          }
        }

        if (diffMs <= 0) {
          void handlePhaseComplete(p);
        }
      }
    };

    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [anyRunning, handlePhaseComplete, syncActiveStudySession]);

  // Fase prioritária para título da aba e janela flutuante (Maratona ativa, Foco ativo ou aba exibida)
  const useMarathonForDisplay =
    marathonStatus === 'flowing' ||
    marathonStatus === 'resting' ||
    (tab === 'marathon' && !timers.study.running && !timers.break.running);

  const activeDisplayPhase: PipPhase = useMarathonForDisplay
    ? marathonStatus === 'resting'
      ? 'marathon-break'
      : 'marathon'
    : timers.study.running
      ? 'study'
      : timers.break.running
        ? 'break'
        : viewedPhase;

  const activeDisplaySeconds = useMarathonForDisplay
    ? marathonStatus === 'resting'
      ? marathonCurrentBreakSeconds
      : marathonFlowSeconds
    : timers[
        timers.study.running ? 'study' : timers.break.running ? 'break' : viewedPhase
      ].remainingSeconds;

  const activeDisplayTotalSeconds = useMarathonForDisplay
    ? 0
    : timers[
        timers.study.running ? 'study' : timers.break.running ? 'break' : viewedPhase
      ].totalSeconds;

  const activeDisplayRunning = useMarathonForDisplay
    ? marathonStatus === 'flowing' || marathonStatus === 'resting'
    : timers.study.running || timers.break.running;

  const activeDisplayLabel = useMarathonForDisplay ? marathonLabel : label;

  useEffect(() => {
    if (activeDisplayRunning) {
      const isMar =
        activeDisplayPhase === 'marathon' || activeDisplayPhase === 'marathon-break';
      const clockText = isMar
        ? formatStopwatch(activeDisplaySeconds)
        : formatClock(activeDisplaySeconds);
      const modeText =
        activeDisplayPhase === 'marathon'
          ? 'Maratona'
          : activeDisplayPhase === 'marathon-break'
            ? 'Maratona (Pausa)'
            : activeDisplayPhase === 'study'
              ? 'Atividade'
              : 'Descanso';
      document.title = `${clockText} · ${modeText} — Apex`;
    } else {
      document.title = 'Apex';
    }
  }, [activeDisplayRunning, activeDisplaySeconds, activeDisplayPhase]);

  useEffect(() => {
    if (pipTimer.isOpen()) {
      pipTimer.update({
        phase: activeDisplayPhase,
        remainingSeconds: activeDisplaySeconds,
        totalSeconds: activeDisplayTotalSeconds,
        running: activeDisplayRunning,
        label: activeDisplayLabel,
      });
    }
  }, [
    activeDisplayPhase,
    activeDisplaySeconds,
    activeDisplayTotalSeconds,
    activeDisplayRunning,
    activeDisplayLabel,
  ]);

  // Motor de avisos e conclusão automática após o horário previsto de término
  useEffect(() => {
    const checkRemindersAndExpiry = () => {
      const now = new Date();
      const todayKeyLocal = formatLocalDate(now);
      const nowMs = now.getTime();

      events.forEach((ev) => {
        if (ev.completed) return;

        const [y, mo, d] = ev.date.split('-').map(Number);
        const [hh, mm] = ev.time.split(':').map(Number);
        if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return;
        if (!Number.isFinite(hh) || !Number.isFinite(mm)) return;

        const startDate = new Date(y, mo - 1, d, hh, mm, 0);
        const endMs = startDate.getTime() + Math.max(1, ev.durationMinutes) * 60 * 1000;

        // 1. Conclusão automática se o horário de término já passou
        if (
          settingsRef.current.autoCompleteExpiredEvents &&
          !ev.manualUncompleted &&
          nowMs >= endMs
        ) {
          const updated: CalendarEvent = { ...ev, completed: true };
          void apexRepo.saveEvent(updated);
          setEvents((prev) => prev.map((item) => (item.id === ev.id ? updated : item)));
          return;
        }

        // 2. Lembrete do dia
        if (ev.notifiedAt || ev.reminderMinutesBefore === null) return;
        if (ev.date !== todayKeyLocal) return;

        const triggerMs = startDate.getTime() - ev.reminderMinutesBefore * 60 * 1000;

        if (nowMs >= triggerMs && nowMs <= startDate.getTime() + 10 * 60 * 1000) {
          const updated: CalendarEvent = { ...ev, notifiedAt: now.toISOString() };
          void apexRepo.saveEvent(updated);
          setEvents((prev) => prev.map((item) => (item.id === ev.id ? updated : item)));

          if (settingsRef.current.soundEnabled) playChime('reminder');
          const msg =
            ev.reminderMinutesBefore === 0
              ? `Agora (${ev.time}) · ${ev.durationMinutes} min`
              : `Começa às ${ev.time} (em ${ev.reminderMinutesBefore} min)`;
          sendSystemNotification(`Apex · ${ev.title}`, msg);
          pushToast(ev.title, msg);
        }
      });
    };

    checkRemindersAndExpiry();
    const id = window.setInterval(checkRemindersAndExpiry, 15000);
    return () => window.clearInterval(id);
  }, [events, pushToast, settings.autoCompleteExpiredEvents]);

  const toggleRunForPhase = useCallback((target: TimerPhase) => {
    const other: TimerPhase = target === 'study' ? 'break' : 'study';
    setTimers((prev) => {
      const curr = prev[target];
      if (curr.running) {
        endTimesRef.current[target] = null;
        return { ...prev, [target]: { ...curr, running: false } };
      }

      // Ao iniciar esta fase, pausa a outra (sem zerar o progresso dela)
      endTimesRef.current[other] = null;
      const secs = curr.remainingSeconds > 0 ? curr.remainingSeconds : curr.totalSeconds;
      endTimesRef.current[target] = Date.now() + secs * 1000;

      return {
        ...prev,
        [other]: { ...prev[other], running: false },
        [target]: { ...curr, remainingSeconds: secs, running: true },
      };
    });
  }, []);

  const handleToggleRun = useCallback(() => {
    toggleRunForPhase(viewedPhaseRef.current);
  }, [toggleRunForPhase]);

  const handlePhaseChange = useCallback((nextPhase: TimerPhase) => {
    // Apenas troca a aba exibida — não para nem zera o timer da outra aba
    setViewedPhase(nextPhase);
  }, []);

  const handleReset = useCallback(() => {
    const target = viewedPhaseRef.current;
    endTimesRef.current[target] = null;
    if (target === 'study') {
      resetActiveSessionTracking();
    }
    const defaultMins =
      target === 'study'
        ? settingsRef.current.defaultStudyMinutes
        : settingsRef.current.defaultBreakMinutes;
    setTimers((prev) => ({
      ...prev,
      [target]: {
        totalSeconds: defaultMins * 60,
        remainingSeconds: defaultMins * 60,
        running: false,
      },
    }));
  }, [resetActiveSessionTracking]);

  const handleSetExactSeconds = useCallback(
    (seconds: number) => {
      const target = viewedPhaseRef.current;
      if (timersRef.current[target].running) return;

      const safeSecs = Math.max(1, Math.min(240 * 60, Math.round(seconds)));
      if (target === 'study') {
        resetActiveSessionTracking();
      }
      setTimers((prev) => ({
        ...prev,
        [target]: {
          totalSeconds: safeSecs,
          remainingSeconds: safeSecs,
          running: false,
        },
      }));

      // Salva automaticamente o novo tempo em minutos inteiros se for múltiplo de 60
      if (safeSecs % 60 === 0) {
        const mins = safeSecs / 60;
        const nextSettings: ApexSettings = {
          ...settingsRef.current,
          defaultStudyMinutes: target === 'study' ? mins : settingsRef.current.defaultStudyMinutes,
          defaultBreakMinutes: target === 'break' ? mins : settingsRef.current.defaultBreakMinutes,
        };
        setSettings(nextSettings);
        void apexRepo.saveSettings(nextSettings);
      }
    },
    [resetActiveSessionTracking]
  );

  const handleQuickStartAntiInertia = useCallback(() => {
    endTimesRef.current.study = null;
    resetActiveSessionTracking();
    setViewedPhase('study');
    setTimers((prev) => ({
      ...prev,
      study: {
        totalSeconds: 10 * 60,
        remainingSeconds: 10 * 60,
        running: false,
      },
    }));
    pushToast(
      'Modo Blitz (10 min)',
      'Timer pronto em 10 min. Clique em Iniciar — cada minuto já conta na sua constância.'
    );
  }, [pushToast, resetActiveSessionTracking]);

  const handleMarathonStartOrResume = useCallback(() => {
    const now = Date.now();
    if (marathonStatusRef.current === 'resting' && marathonBreakStartMsRef.current !== null) {
      const elapsedBreak = Math.floor((now - marathonBreakStartMsRef.current) / 1000);
      marathonBreakBaseRef.current += elapsedBreak;
      marathonBreakStartMsRef.current = null;
      setMarathonTotalBreakSeconds(marathonBreakBaseRef.current);
      setMarathonCurrentBreakSeconds(0);
    }

    marathonFlowStartMsRef.current = now;
    setMarathonStatus('flowing');
  }, []);

  const handleMarathonPause = useCallback(() => {
    const now = Date.now();
    if (marathonStatusRef.current === 'flowing') {
      if (marathonFlowStartMsRef.current !== null) {
        const elapsedFlow = Math.floor((now - marathonFlowStartMsRef.current) / 1000);
        marathonFlowBaseRef.current += elapsedFlow;
        marathonFlowStartMsRef.current = null;
        setMarathonFlowSeconds(marathonFlowBaseRef.current);
      }
      setMarathonStatus('paused');
    } else if (marathonStatusRef.current === 'resting') {
      if (marathonBreakStartMsRef.current !== null) {
        const elapsedBreak = Math.floor((now - marathonBreakStartMsRef.current) / 1000);
        marathonBreakBaseRef.current += elapsedBreak;
        marathonBreakStartMsRef.current = null;
        setMarathonTotalBreakSeconds(marathonBreakBaseRef.current);
        setMarathonCurrentBreakSeconds(0);
      }
      setMarathonStatus('paused');
    }
  }, []);

  const handleMarathonStartBreak = useCallback(() => {
    if (marathonStatusRef.current !== 'flowing' && marathonStatusRef.current !== 'paused') return;
    const now = Date.now();
    if (marathonStatusRef.current === 'flowing' && marathonFlowStartMsRef.current !== null) {
      const elapsedFlow = Math.floor((now - marathonFlowStartMsRef.current) / 1000);
      marathonFlowBaseRef.current += elapsedFlow;
      marathonFlowStartMsRef.current = null;
      setMarathonFlowSeconds(marathonFlowBaseRef.current);
    }
    marathonBreakStartMsRef.current = now;
    setMarathonBreakCount((c) => c + 1);
    setMarathonCurrentBreakSeconds(0);
    setMarathonStatus('resting');
  }, []);

  const handleLoadEventIntoMarathon = useCallback(
    (ev: CalendarEvent) => {
      setMarathonLabel(ev.title);
      pushToast('Atividade carregada', `"${ev.title}" pronta na Maratona.`);
    },
    [pushToast]
  );

  const handleFinishMarathon = useCallback(async () => {
    const now = Date.now();
    let finalFlowSecs = marathonFlowBaseRef.current;
    if (marathonStatusRef.current === 'flowing' && marathonFlowStartMsRef.current !== null) {
      finalFlowSecs += Math.floor((now - marathonFlowStartMsRef.current) / 1000);
    }

    let finalBreakSecs = marathonBreakBaseRef.current;
    if (marathonStatusRef.current === 'resting' && marathonBreakStartMsRef.current !== null) {
      finalBreakSecs += Math.floor((now - marathonBreakStartMsRef.current) / 1000);
    }

    const finalFlowMins = Math.max(1, Math.round(finalFlowSecs / 60));
    await syncActiveMarathonSession(finalFlowMins, finalBreakSecs, true);

    if (settingsRef.current.soundEnabled) playChime('focus-done');
    pushToast(
      'Maratona concluída!',
      `${finalFlowMins} min em fluxo salvos no seu histórico de constância.`
    );

    resetMarathonState();
    setMarathonNotes('');
  }, [pushToast, resetMarathonState, syncActiveMarathonSession]);

  const handleTogglePip = useCallback(async () => {
    if (pipTimer.isOpen()) {
      pipTimer.close();
      setPipOpen(false);
      return;
    }

    const opened = await pipTimer.open(
      {
        phase: activeDisplayPhase,
        remainingSeconds: activeDisplaySeconds,
        totalSeconds: activeDisplayTotalSeconds,
        running: activeDisplayRunning,
        label: activeDisplayLabel,
      },
      {
        onToggleRun: () => {
          if (marathonStatusRef.current === 'flowing') {
            handleMarathonPause();
          } else if (
            marathonStatusRef.current === 'paused' ||
            marathonStatusRef.current === 'resting'
          ) {
            handleMarathonStartOrResume();
          } else {
            const runningPhase: TimerPhase = timersRef.current.study.running
              ? 'study'
              : timersRef.current.break.running
                ? 'break'
                : viewedPhaseRef.current;
            toggleRunForPhase(runningPhase);
          }
        },
        onSwitchPhase: () => {
          if (
            marathonStatusRef.current === 'flowing' ||
            marathonStatusRef.current === 'paused'
          ) {
            handleMarathonStartBreak();
          } else if (marathonStatusRef.current === 'resting') {
            handleMarathonStartOrResume();
          } else {
            const next: TimerPhase = viewedPhaseRef.current === 'study' ? 'break' : 'study';
            setViewedPhase(next);
          }
        },
        onClose: () => setPipOpen(false),
      }
    );

    if (opened) {
      setPipOpen(true);
    } else {
      pushToast(
        'Janela flutuante indisponível',
        'Este navegador não liberou o modo Picture-in-Picture.'
      );
    }
  }, [
    activeDisplayPhase,
    activeDisplaySeconds,
    activeDisplayTotalSeconds,
    activeDisplayRunning,
    activeDisplayLabel,
    pushToast,
    toggleRunForPhase,
    handleMarathonPause,
    handleMarathonStartBreak,
    handleMarathonStartOrResume,
  ]);

  const handleToggleEventComplete = useCallback((ev: CalendarEvent) => {
    const nextCompleted = !ev.completed;
    const updated: CalendarEvent = {
      ...ev,
      completed: nextCompleted,
      manualUncompleted: nextCompleted ? undefined : true,
    };
    void apexRepo.saveEvent(updated);
    setEvents((prev) => prev.map((e) => (e.id === ev.id ? updated : e)));
  }, []);

  const handleToggleBrownNoise = (next: boolean) => {
    setBrownNoiseOn(next);
    if (next) {
      brownNoise.start(settings.brownNoiseVolume);
    } else {
      brownNoise.stop();
    }
  };

  const handleBrownNoiseVolumeChange = (vol: number) => {
    brownNoise.setVolume(vol);
    const nextSettings = { ...settings, brownNoiseVolume: vol };
    setSettings(nextSettings);
    void apexRepo.saveSettings(nextSettings);
  };

  const handleUpdateSettings = (partial: Partial<ApexSettings>) => {
    const next = { ...settings, ...partial };
    setSettings(next);
    void apexRepo.saveSettings(next);
  };

  const handleRequestNotifications = async () => {
    const status = await requestNotificationPermission();
    setNotificationStatus(status);
    if (status === 'granted') {
      pushToast('Avisos ativados', 'Você receberá lembretes do calendário e do timer.');
    }
  };

  const handleStartFocusFromEvent = (ev: CalendarEvent) => {
    endTimesRef.current.study = null;
    resetActiveSessionTracking();
    activeCategoryRef.current = ev.category;
    activeEventIdRef.current = ev.id;
    setViewedPhase('study');
    setLabel(ev.title);
    setTimers((prev) => ({
      ...prev,
      study: {
        totalSeconds: ev.durationMinutes * 60,
        remainingSeconds: ev.durationMinutes * 60,
        running: false,
      },
    }));
    setTab('focus');
    pushToast('Pronto para focar', `"${ev.title}" (${ev.durationMinutes} min) carregado no timer.`);
  };

  const handleExportBackup = async () => {
    const snapshot = await apexRepo.exportSnapshot();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apex-backup-${formatLocalDate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast('Backup exportado', 'Arquivo JSON salvo no seu dispositivo.');
  };

  const handleImportBackup = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as ApexSnapshot;
      if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.sessions)) {
        throw new Error('Formato inválido');
      }
      await apexRepo.importSnapshot(parsed);
      await loadAllData();
      pushToast('Backup restaurado', 'Seus dados foram importados com sucesso.');
    } catch {
      pushToast('Erro ao importar', 'Selecione um arquivo JSON válido exportado pelo Apex.');
    }
  };

  const handleLoadDemoData = async () => {
    const currentSnapshot = await apexRepo.exportSnapshot();
    saveRealBackupBeforeDemo(currentSnapshot);
    const demo = buildDemoSnapshot();
    await apexRepo.importSnapshot(demo);
    await loadAllData();
    setSettingsOpen(false);
    pushToast('Modo demonstração ativo', 'Gráficos e agenda preenchidos para visualização.');
  };

  const handleExitDemoData = async () => {
    const realBackup = consumeRealBackup();
    if (realBackup) {
      await apexRepo.importSnapshot({
        ...realBackup,
        settings: { ...realBackup.settings, demoModeActive: false },
      });
    } else {
      await apexRepo.clearAll();
      await apexRepo.saveSettings({ ...DEFAULT_SETTINGS, demoModeActive: false });
    }
    await loadAllData();
    setSettingsOpen(false);
    pushToast('Modo demo desativado', 'Seus dados reais foram restaurados.');
  };

  const todayKey = formatLocalDate(new Date());

  const todayStudiedMinutes = useMemo(() => {
    return sessions
      .filter((s) => s.date === todayKey)
      .reduce((acc, s) => acc + s.durationMinutes, 0);
  }, [sessions, todayKey]);

  const todayEvents = useMemo(
    () =>
      events
        .filter((ev) => ev.date === todayKey)
        .sort((a, b) => a.time.localeCompare(b.time)),
    [events, todayKey]
  );

  const todayPriorities = useMemo(
    () => allPriorities.find((r) => r.date === todayKey)?.items ?? [],
    [allPriorities, todayKey]
  );

  const currentTimer = timers[viewedPhase];
  const otherPhase: TimerPhase = viewedPhase === 'study' ? 'break' : 'study';
  const otherPhaseTimer = timers[otherPhase];

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          type="button"
          className="brand"
          onClick={() => setTab('focus')}
          title="Ir para Foco"
          aria-label="Apex — ir para Foco"
        >
          <span className="brand-mark" aria-hidden="true">
            <img src="/icon.svg" alt="" width={26} height={26} />
          </span>
          <span className="brand-name">Apex</span>
        </button>

        <SlidingTabs
          ariaLabel="Navegação principal"
          className="nav-tabs"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'focus', label: 'Foco', icon: <Timer size={15} /> },
            { value: 'marathon', label: 'Maratona', icon: <Flame size={15} /> },
            { value: 'calendar', label: 'Calendário', icon: <Calendar size={15} /> },
            { value: 'analytics', label: 'Constância', icon: <BarChart3 size={15} /> },
          ]}
        />

        <div className="topbar-actions">
          <button
            type="button"
            className={`icon-btn ${brownNoiseOn ? 'active' : ''}`}
            onClick={() => handleToggleBrownNoise(!brownNoiseOn)}
            aria-label={brownNoiseOn ? 'Desativar ruído marrom' : 'Ativar ruído marrom'}
            title={brownNoiseOn ? 'Ruído marrom ligado (clique para desligar)' : 'Ligar ruído marrom'}
          >
            {brownNoiseOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>

          <button
            type="button"
            className={`icon-btn ${settingsOpen ? 'active' : ''}`}
            onClick={() => setSettingsOpen(true)}
            aria-label="Configurações e backup"
            title="Configurações e backup"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      <main className="main-content">
        {tab === 'focus' && (
          <FocusView
            phase={viewedPhase}
            remainingSeconds={currentTimer.remainingSeconds}
            totalSeconds={currentTimer.totalSeconds}
            running={currentTimer.running}
            otherPhaseRunning={otherPhaseTimer.running}
            otherPhaseRemainingSeconds={otherPhaseTimer.remainingSeconds}
            label={label}
            sessionNotes={sessionNotes}
            autoSavedMinutes={autoSavedMinutes}
            todayStudiedMinutes={todayStudiedMinutes}
            pipOpen={pipOpen}
            pipSupported={pipTimer.isSupported()}
            todayEvents={todayEvents}
            todayPriorities={todayPriorities}
            onPhaseChange={handlePhaseChange}
            onToggleRun={handleToggleRun}
            onReset={handleReset}
            onLabelChange={setLabel}
            onSessionNotesChange={setSessionNotes}
            onSetExactSeconds={handleSetExactSeconds}
            onQuickStartAntiInertia={handleQuickStartAntiInertia}
            onTogglePip={() => void handleTogglePip()}
            onToggleEventComplete={handleToggleEventComplete}
            onToggleTodayPriority={(id) => {
              const nextItems = todayPriorities.map((p) =>
                p.id === id ? { ...p, done: !p.done } : p
              );
              const record: DailyPrioritiesRecord = { date: todayKey, items: nextItems };
              setAllPriorities((prev) => {
                const exists = prev.some((r) => r.date === todayKey);
                return exists
                  ? prev.map((r) => (r.date === todayKey ? record : r))
                  : [...prev, record];
              });
              void apexRepo.savePriorities(record);
            }}
            onStartFocusFromEvent={handleStartFocusFromEvent}
            onAddTodayEvent={() => setQuickEventModalOpen(true)}
            onOpenCalendar={() => setTab('calendar')}
          />
        )}

        {tab === 'marathon' && (
          <MarathonView
            status={marathonStatus}
            flowSeconds={marathonFlowSeconds}
            currentBreakSeconds={marathonCurrentBreakSeconds}
            totalBreakSeconds={marathonTotalBreakSeconds}
            breakCount={marathonBreakCount}
            label={marathonLabel}
            notes={marathonNotes}
            autoSavedMinutes={marathonAutoSavedMinutes}
            pipOpen={pipOpen}
            pipSupported={pipTimer.isSupported()}
            todayEvents={todayEvents}
            todayPriorities={todayPriorities}
            onStartOrResume={handleMarathonStartOrResume}
            onPause={handleMarathonPause}
            onStartBreak={handleMarathonStartBreak}
            onFinishMarathon={() => void handleFinishMarathon()}
            onDiscardMarathon={resetMarathonState}
            onLabelChange={setMarathonLabel}
            onNotesChange={setMarathonNotes}
            onTogglePip={() => void handleTogglePip()}
            onToggleEventComplete={handleToggleEventComplete}
            onToggleTodayPriority={(id) => {
              const nextItems = todayPriorities.map((p) =>
                p.id === id ? { ...p, done: !p.done } : p
              );
              const record: DailyPrioritiesRecord = { date: todayKey, items: nextItems };
              setAllPriorities((prev) => {
                const exists = prev.some((r) => r.date === todayKey);
                return exists
                  ? prev.map((r) => (r.date === todayKey ? record : r))
                  : [...prev, record];
              });
              void apexRepo.savePriorities(record);
            }}
            onLoadEventIntoMarathon={handleLoadEventIntoMarathon}
            onAddTodayEvent={() => setQuickEventModalOpen(true)}
            onOpenCalendar={() => setTab('calendar')}
          />
        )}

        {tab === 'calendar' && (
          <CalendarView
            subView={calendarSubView}
            onSubViewChange={setCalendarSubView}
            events={events}
            sessions={sessions}
            selectedDate={selectedDate}
            allPriorities={allPriorities}
            customCategories={settings.customCategories ?? []}
            notificationStatus={notificationStatus}
            onSelectDate={setSelectedDate}
            onSaveEvent={(ev) => {
              void apexRepo.saveEvent(ev);
              setEvents((prev) => {
                const exists = prev.some((e) => e.id === ev.id);
                return exists ? prev.map((e) => (e.id === ev.id ? ev : e)) : [...prev, ev];
              });
            }}
            onDeleteEvent={(id) => {
              void apexRepo.deleteEvent(id);
              setEvents((prev) => prev.filter((e) => e.id !== id));
            }}
            onSavePriorities={(date, items) => {
              const record: DailyPrioritiesRecord = { date, items };
              setAllPriorities((prev) => {
                const exists = prev.some((r) => r.date === date);
                return exists ? prev.map((r) => (r.date === date ? record : r)) : [...prev, record];
              });
              void apexRepo.savePriorities(record);
            }}
            onAddCustomCategory={(newCategory) => {
              const trimmed = newCategory.trim();
              if (!trimmed) return;
              const current = settings.customCategories ?? [];
              const exists = current.some((c) => c.toLowerCase() === trimmed.toLowerCase());
              if (exists) return;
              handleUpdateSettings({ customCategories: [...current, trimmed] });
            }}
            onStartFocusFromEvent={handleStartFocusFromEvent}
            onRequestNotificationPermission={() => void handleRequestNotifications()}
          />
        )}

        {tab === 'analytics' && (
          <AnalyticsView
            sessions={sessions}
            events={events}
            onOpenPending={() => {
              setCalendarSubView('pending');
              setTab('calendar');
            }}
            onSaveSession={(sess, isEdit) => {
              void upsertSession(sess);
              pushToast(
                isEdit ? 'Sessão atualizada' : 'Atividade registrada',
                isEdit
                  ? `"${sess.label}" atualizada automaticamente.`
                  : `${sess.durationMinutes} min adicionados ao histórico.`
              );
            }}
            onDeleteSession={(id) => {
              void apexRepo.deleteSession(id);
              setSessions((prev) => prev.filter((s) => s.id !== id));
            }}
          />
        )}
      </main>

      <EventModal
        open={quickEventModalOpen}
        onClose={() => setQuickEventModalOpen(false)}
        editingEvent={null}
        defaultDate={todayKey}
        defaultStartTime={`${String(new Date().getHours()).padStart(2, '0')}:00`}
        customCategories={settings.customCategories ?? []}
        onSaveEvent={(ev) => {
          void apexRepo.saveEvent(ev);
          setEvents((prev) => [...prev, ev]);
          pushToast('Pendência adicionada', `"${ev.title}" salva na sua agenda de hoje.`);
        }}
        onAddCustomCategory={(newCategory) => {
          const trimmed = newCategory.trim();
          if (!trimmed) return;
          const current = settings.customCategories ?? [];
          const exists = current.some((c) => c.toLowerCase() === trimmed.toLowerCase());
          if (exists) return;
          handleUpdateSettings({ customCategories: [...current, trimmed] });
        }}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        brownNoiseOn={brownNoiseOn}
        notificationStatus={notificationStatus}
        hasRealBackup={hasRealBackup()}
        onUpdateSettings={handleUpdateSettings}
        onToggleBrownNoise={handleToggleBrownNoise}
        onBrownNoiseVolumeChange={handleBrownNoiseVolumeChange}
        onRequestNotifications={() => void handleRequestNotifications()}
        onExportBackup={() => void handleExportBackup()}
        onImportBackup={(file) => void handleImportBackup(file)}
        onLoadDemoData={() => void handleLoadDemoData()}
        onExitDemoData={() => void handleExitDemoData()}
      />

      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast t-toast ${t.open ? 'is-open' : ''}`}>
            <div>
              <div className="toast-title">{t.title}</div>
              <div className="toast-body">{t.body}</div>
            </div>
            <button
              type="button"
              className="btn-ghost"
              style={{ padding: 2 }}
              onClick={() => dismissToast(t.id)}
              aria-label="Fechar aviso"
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
