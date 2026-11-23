import { useMemo, useState, type FormEvent } from 'react';
import {
  Bell,
  Calendar as CalendarIcon,
  CalendarRange,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock,
  Pencil,
  Play,
  Plus,
  Trash2,
} from 'lucide-react';
import type { NotificationStatus } from '../../services/notifications';
import {
  DEFAULT_CATEGORIES,
  type CalendarEvent,
  type DailyPrioritiesRecord,
  type DailyPriority,
  type StudySession,
} from '../../types/models';
import { getCategoryTone } from '../../utils/categoryStyle';
import {
  addMinutesToTime,
  crossesMidnight,
  diffTimeMinutes,
  formatDateLongPt,
  formatLocalDate,
  formatMinutesHuman,
  formatMonthYearPt,
  parseLocalDate,
  uid,
} from '../../utils/date';
import { Modal } from '../ui/Modal';
import { SlidingTabs } from '../ui/SlidingTabs';
import { TimePicker } from '../ui/TimePicker';
import { Toggle } from '../ui/Toggle';
import { WeekSchedule } from './WeekSchedule';
import './CalendarView.css';

interface CalendarViewProps {
  subView: CalendarSubView;
  onSubViewChange: (next: CalendarSubView) => void;
  events: CalendarEvent[];
  sessions: StudySession[];
  selectedDate: string;
  allPriorities: DailyPrioritiesRecord[];
  customCategories: string[];
  notificationStatus: NotificationStatus;
  onSelectDate: (date: string) => void;
  onSaveEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (id: string) => void;
  onSavePriorities: (date: string, items: DailyPriority[]) => void;
  onAddCustomCategory: (category: string) => void;
  onStartFocusFromEvent: (event: CalendarEvent) => void;
  onRequestNotificationPermission: () => void;
}

type CalendarSubView = 'agenda' | 'pending';
type PendingFilter = 'open' | 'resolved' | 'all';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function CalendarView({
  subView,
  onSubViewChange,
  events,
  sessions,
  selectedDate,
  allPriorities,
  customCategories,
  notificationStatus,
  onSelectDate,
  onSaveEvent,
  onDeleteEvent,
  onSavePriorities,
  onAddCustomCategory,
  onStartFocusFromEvent,
  onRequestNotificationPermission,
}: CalendarViewProps) {
  const todayStr = formatLocalDate(new Date());
  const selectedParsed = parseLocalDate(selectedDate);
  const [pendingFilter, setPendingFilter] = useState<PendingFilter>('open');
  const [viewYear, setViewYear] = useState(selectedParsed.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedParsed.getMonth());
  const [priorityDraft, setPriorityDraft] = useState('');

  // Modal de criar / editar bloco
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [eventDate, setEventDate] = useState(selectedDate);
  const [eventTitle, setEventTitle] = useState('');
  const [eventCategory, setEventCategory] = useState<string>('');
  const [customCategoryDraft, setCustomCategoryDraft] = useState('');
  const [saveAsNewCategory, setSaveAsNewCategory] = useState(false);
  const [eventStartTime, setEventStartTime] = useState('09:00');
  const [eventEndTime, setEventEndTime] = useState('09:45');
  const [eventReminder, setEventReminder] = useState<string>('10');

  const availableCategories = useMemo(() => {
    const merged: string[] = [...DEFAULT_CATEGORIES];
    for (const c of customCategories) {
      if (!merged.some((item) => item.toLowerCase() === c.toLowerCase())) {
        merged.push(c);
      }
    }
    return merged;
  }, [customCategories]);

  const priorities = useMemo(
    () => allPriorities.find((r) => r.date === selectedDate)?.items ?? [],
    [allPriorities, selectedDate]
  );

  const eventDatesSet = useMemo(() => new Set(events.map((e) => e.date)), [events]);
  const studyDatesSet = useMemo(() => new Set(sessions.map((s) => s.date)), [sessions]);

  const calendarCells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

    const cells: { dateStr: string; day: number; outside: boolean }[] = [];

    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = new Date(viewYear, viewMonth - 1, prevMonthDays - i);
      cells.push({ dateStr: formatLocalDate(d), day: d.getDate(), outside: true });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(viewYear, viewMonth, d);
      cells.push({ dateStr: formatLocalDate(dateObj), day: d, outside: false });
    }

    const trailing = (7 - (cells.length % 7)) % 7;
    for (let d = 1; d <= trailing; d++) {
      const dateObj = new Date(viewYear, viewMonth + 1, d);
      cells.push({ dateStr: formatLocalDate(dateObj), day: d, outside: true });
    }

    return cells;
  }, [viewYear, viewMonth]);

  const dayEvents = useMemo(
    () =>
      events
        .filter((e) => e.date === selectedDate)
        .sort((a, b) => a.time.localeCompare(b.time)),
    [events, selectedDate]
  );

  const pendingEventsCount = useMemo(
    () => events.filter((e) => !e.completed).length,
    [events]
  );

  const resolvedEventsCount = useMemo(
    () => events.filter((e) => e.completed).length,
    [events]
  );

  const overdueEventsCount = useMemo(
    () => events.filter((e) => !e.completed && e.date < todayStr).length,
    [events, todayStr]
  );

  const filteredReportEvents = useMemo(() => {
    const list =
      pendingFilter === 'open'
        ? events.filter((e) => !e.completed)
        : pendingFilter === 'resolved'
          ? events.filter((e) => e.completed)
          : events;
    return [...list].sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  }, [events, pendingFilter]);

  const shiftMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const jumpToToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    onSelectDate(formatLocalDate(now));
  };

  const handleAddPriority = (e: FormEvent) => {
    e.preventDefault();
    const text = priorityDraft.trim();
    if (!text || priorities.length >= 3) return;
    onSavePriorities(selectedDate, [...priorities, { id: uid('prio'), text, done: false }]);
    setPriorityDraft('');
  };

  const handleTogglePriorityForDate = (date: string, id: string) => {
    const list = allPriorities.find((r) => r.date === date)?.items ?? [];
    onSavePriorities(
      date,
      list.map((p) => (p.id === id ? { ...p, done: !p.done } : p))
    );
  };

  const handleDeletePriorityForDate = (date: string, id: string) => {
    const list = allPriorities.find((r) => r.date === date)?.items ?? [];
    onSavePriorities(
      date,
      list.filter((p) => p.id !== id)
    );
  };

  const getEventEndTime = (ev: CalendarEvent): string =>
    ev.endTime || addMinutesToTime(ev.time, ev.durationMinutes);

  const openNewEventModal = (defaultDate = selectedDate, defaultStartTime = '09:00') => {
    setEditingEvent(null);
    setEventDate(defaultDate);
    setEventTitle('');
    setEventCategory('');
    setCustomCategoryDraft('');
    setSaveAsNewCategory(false);
    setEventStartTime(defaultStartTime);
    setEventEndTime(addMinutesToTime(defaultStartTime, 60));
    setEventReminder('10');
    setModalOpen(true);
  };

  const openEditEventModal = (ev: CalendarEvent) => {
    setEditingEvent(ev);
    setEventDate(ev.date);
    setEventTitle(ev.title);
    const cat = ev.category ?? '';
    if (!cat) {
      setEventCategory('');
      setCustomCategoryDraft('');
    } else if (availableCategories.includes(cat)) {
      setEventCategory(cat);
      setCustomCategoryDraft('');
    } else {
      setEventCategory('__other__');
      setCustomCategoryDraft(cat === 'Outros' ? '' : cat);
    }
    setSaveAsNewCategory(false);
    setEventStartTime(ev.time);
    setEventEndTime(getEventEndTime(ev));
    setEventReminder(ev.reminderMinutesBefore === null ? 'none' : String(ev.reminderMinutesBefore));
    setModalOpen(true);
  };

  const computedDuration = diffTimeMinutes(eventStartTime, eventEndTime);
  const endsNextDay = crossesMidnight(eventStartTime, eventEndTime);

  const handleStartTimeChange = (nextStart: string) => {
    const currentDur = diffTimeMinutes(eventStartTime, eventEndTime);
    setEventStartTime(nextStart);
    if (nextStart) {
      const keepDuration = currentDur > 0 ? currentDur : 45;
      setEventEndTime(addMinutesToTime(nextStart, keepDuration));
    }
  };

  const handleSubmitEvent = (e: FormEvent) => {
    e.preventDefault();
    const title = eventTitle.trim();
    if (!title || computedDuration < 1) return;

    const reminderMinutesBefore = eventReminder === 'none' ? null : parseInt(eventReminder, 10);

    let resolvedCategory: string | undefined = eventCategory || undefined;
    if (eventCategory === '__other__') {
      const typed = customCategoryDraft.trim();
      resolvedCategory = typed || 'Outros';
      if (typed && saveAsNewCategory) {
        onAddCustomCategory(typed);
      }
    }

    if (editingEvent) {
      onSaveEvent({
        ...editingEvent,
        date: eventDate || editingEvent.date,
        time: eventStartTime,
        endTime: eventEndTime,
        title,
        category: resolvedCategory,
        durationMinutes: Math.min(480, computedDuration),
        reminderMinutesBefore,
        // Se mudou data ou horário, libera o lembrete novamente
        notifiedAt:
          editingEvent.date !== eventDate || editingEvent.time !== eventStartTime
            ? undefined
            : editingEvent.notifiedAt,
      });
    } else {
      onSaveEvent({
        id: uid('evt'),
        date: eventDate || selectedDate,
        time: eventStartTime,
        endTime: eventEndTime,
        title,
        category: resolvedCategory,
        durationMinutes: Math.min(480, computedDuration),
        reminderMinutesBefore,
        completed: false,
      });
    }

    setModalOpen(false);
  };

  const reminderLabel = (mins: number | null) => {
    if (mins === null) return null;
    if (mins === 0) return 'Na hora';
    return `${mins} min antes`;
  };

  const formatShortDateChip = (dateStr: string) => {
    if (dateStr === todayStr) return 'Hoje';
    return parseLocalDate(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
    });
  };

  const renderEventCard = (ev: CalendarEvent, showDateChip = false) => {
    const remText = reminderLabel(ev.reminderMinutesBefore);
    const end = getEventEndTime(ev);
    const tone = getCategoryTone(ev.category);
    const isOverdue = !ev.completed && ev.date < todayStr;
    const isToday = ev.date === todayStr;

    return (
      <div key={ev.id} className={`event-item ${ev.completed ? 'is-done' : ''}`}>
        <div className="event-left">
          <button
            type="button"
            className={`check-circle ${ev.completed ? 'checked' : ''}`}
            style={{ marginTop: 2 }}
            onClick={() =>
              onSaveEvent({
                ...ev,
                completed: !ev.completed,
                manualUncompleted: !ev.completed ? undefined : true,
              })
            }
            aria-label="Concluir bloco"
          >
            {ev.completed && <Check size={12} strokeWidth={3} />}
          </button>

          <div className="event-info">
            <div className="event-title">{ev.title}</div>
            <div className="event-meta">
              {showDateChip && (
                <span
                  className={`date-chip ${isOverdue ? 'is-overdue' : isToday ? 'is-today' : ''}`}
                >
                  {formatShortDateChip(ev.date)}
                </span>
              )}
              {ev.category && (
                <span
                  className="category-pill"
                  style={{
                    color: tone.accent,
                    background: tone.bg,
                    borderColor: tone.border,
                  }}
                >
                  {ev.category}
                </span>
              )}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Clock size={12} />
                {ev.time} – {end} · {formatMinutesHuman(ev.durationMinutes)}
              </span>
              {remText && (
                <span className="event-badge">
                  <Bell size={11} />
                  {remText}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="event-actions">
          <button
            type="button"
            className="mini-action accent"
            onClick={() => onStartFocusFromEvent(ev)}
            title="Iniciar este bloco no Timer"
          >
            <Play size={12} />
            <span>Focar</span>
          </button>
          <button
            type="button"
            className="mini-action"
            onClick={() => openEditEventModal(ev)}
            title="Editar horário e detalhes"
            aria-label="Editar compromisso"
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            className="mini-action"
            onClick={() => onDeleteEvent(ev.id)}
            aria-label="Excluir compromisso"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <section className="calendar-wrapper" aria-label="Calendário e pendências">
      <div className="calendar-top-bar">
        <SlidingTabs
          ariaLabel="Visão do calendário"
          value={subView}
          onChange={onSubViewChange}
          items={[
            { value: 'agenda', label: 'Mês', icon: <CalendarIcon size={14} /> },
            {
              value: 'pending',
              label: pendingEventsCount > 0 ? `Pendências (${pendingEventsCount})` : 'Pendências',
              icon: <CalendarRange size={14} />,
            },
          ]}
        />

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => openNewEventModal(subView === 'pending' ? todayStr : selectedDate)}
        >
          <Plus size={16} />
          <span>Agendar bloco</span>
        </button>
      </div>

      {subView === 'pending' ? (
        <div className="pending-section-stack">
          <div className="pending-summary-grid">
            <button
              type="button"
              className={`pending-stat-card ${pendingFilter === 'open' ? 'is-selected' : ''}`}
              onClick={() => setPendingFilter('open')}
            >
              <div className="pending-stat-info">
                <span className="pending-stat-label">
                  <CircleDot size={14} /> Pendências em aberto
                </span>
                <span className="pending-stat-sub">
                  {overdueEventsCount > 0
                    ? `${overdueEventsCount} ${overdueEventsCount === 1 ? 'atrasada' : 'atrasadas'}`
                    : pendingEventsCount > 0
                      ? 'Dentro do prazo'
                      : 'Tudo em dia'}
                </span>
              </div>
              <span className="pending-stat-value accent">{pendingEventsCount}</span>
            </button>

            <button
              type="button"
              className={`pending-stat-card ${pendingFilter === 'resolved' ? 'is-selected' : ''}`}
              onClick={() => setPendingFilter('resolved')}
            >
              <div className="pending-stat-info">
                <span className="pending-stat-label">
                  <CheckCircle2 size={14} /> Pendências resolvidas
                </span>
                <span className="pending-stat-sub">
                  {events.length > 0
                    ? `${Math.round((resolvedEventsCount / events.length) * 100)}% do total concluído`
                    : 'Nenhuma registrada'}
                </span>
              </div>
              <span className="pending-stat-value">{resolvedEventsCount}</span>
            </button>
          </div>

          <div className="card">
            <div className="pending-report-head">
              <h3 className="pending-report-title">Relatório de pendências</h3>
              <div className="pending-filter-pills" role="group" aria-label="Filtrar pendências">
                <button
                  type="button"
                  className={`pending-filter-pill ${pendingFilter === 'open' ? 'is-active' : ''}`}
                  onClick={() => setPendingFilter('open')}
                >
                  Em aberto ({pendingEventsCount})
                </button>
                <button
                  type="button"
                  className={`pending-filter-pill ${pendingFilter === 'resolved' ? 'is-active' : ''}`}
                  onClick={() => setPendingFilter('resolved')}
                >
                  Resolvidas ({resolvedEventsCount})
                </button>
                <button
                  type="button"
                  className={`pending-filter-pill ${pendingFilter === 'all' ? 'is-active' : ''}`}
                  onClick={() => setPendingFilter('all')}
                >
                  Todas ({events.length})
                </button>
              </div>
            </div>

            {filteredReportEvents.length === 0 ? (
              <div className="empty-state">
                {pendingFilter === 'open'
                  ? 'Nenhuma pendência em aberto no momento.'
                  : pendingFilter === 'resolved'
                    ? 'Nenhuma pendência resolvida ainda.'
                    : 'Nenhuma pendência registrada.'}
              </div>
            ) : (
              <div className="pending-report-list">
                {filteredReportEvents.map((ev) => renderEventCard(ev, true))}
              </div>
            )}
          </div>

          <WeekSchedule
            events={events}
            anchorDate={selectedDate}
            onSelectSlot={(date, startTime) => openNewEventModal(date, startTime)}
            onEditEvent={openEditEventModal}
            onToggleComplete={(ev) =>
              onSaveEvent({
                ...ev,
                completed: !ev.completed,
                manualUncompleted: !ev.completed ? undefined : true,
              })
            }
            onStartFocusFromEvent={onStartFocusFromEvent}
          />
        </div>
      ) : (
        <div className="calendar-layout">
          <div className="card calendar-panel">
            <div className="calendar-header">
              <div className="calendar-month-nav">
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => shiftMonth(-1)}
                  aria-label="Mês anterior"
                >
                  <ChevronLeft size={18} />
                </button>
                <h2 className="calendar-month-title">{formatMonthYearPt(viewYear, viewMonth)}</h2>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => shiftMonth(1)}
                  aria-label="Próximo mês"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              <button type="button" className="btn btn-secondary" onClick={jumpToToday}>
                Hoje
              </button>
            </div>

            <div className="calendar-weekdays">
              {WEEKDAYS.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>

            <div className="calendar-grid">
              {calendarCells.map((cell) => {
                const isSelected = cell.dateStr === selectedDate;
                const isToday = cell.dateStr === todayStr;
                const hasEvent = eventDatesSet.has(cell.dateStr);
                const hasStudy = studyDatesSet.has(cell.dateStr);

                return (
                  <button
                    key={cell.dateStr}
                    type="button"
                    className={[
                      'cal-day',
                      cell.outside ? 'is-outside' : '',
                      isToday ? 'is-today' : '',
                      isSelected ? 'is-selected' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => {
                      onSelectDate(cell.dateStr);
                      if (cell.outside) {
                        const parsed = parseLocalDate(cell.dateStr);
                        setViewYear(parsed.getFullYear());
                        setViewMonth(parsed.getMonth());
                      }
                    }}
                  >
                    <span>{cell.day}</span>
                    <span className="cal-dots" aria-hidden="true">
                      {hasEvent && <span className="cal-dot" />}
                      {hasStudy && <span className="cal-dot study" />}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="cal-legend">
              <span>
                <span className="cal-dot" /> Agenda / aviso
              </span>
              <span>
                <span className="cal-dot study" /> Atividade registrada
              </span>
            </div>
          </div>

          <aside className="day-sidebar">
            {notificationStatus === 'default' && (
              <div className="notif-banner">
                <span>Ative os avisos para receber lembretes na área de trabalho.</span>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: '6px 12px', fontSize: '0.78rem' }}
                  onClick={onRequestNotificationPermission}
                >
                  Ativar
                </button>
              </div>
            )}

            <div className="card">
              <div className="day-header">
                <div>
                  <h3 className="day-title">{formatDateLongPt(selectedDate)}</h3>
                  <p className="day-sub">
                    {dayEvents.length === 0
                      ? 'Nenhum bloco agendado'
                      : `${dayEvents.length} ${dayEvents.length === 1 ? 'bloco agendado' : 'blocos agendados'}`}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => openNewEventModal(selectedDate)}
                >
                  <Plus size={15} />
                  <span>Novo</span>
                </button>
              </div>
            </div>

            <div className="card">
              <p className="section-label">
                <span>Top 3 do dia</span>
                <span>{priorities.length}/3</span>
              </p>

              <div className="priority-list">
                {priorities.map((item) => (
                  <div key={item.id} className={`priority-item ${item.done ? 'is-done' : ''}`}>
                    <button
                      type="button"
                      className={`check-circle ${item.done ? 'checked' : ''}`}
                      onClick={() => handleTogglePriorityForDate(selectedDate, item.id)}
                      aria-label="Marcar prioridade"
                    >
                      {item.done && <Check size={12} strokeWidth={3} />}
                    </button>
                    <span className="priority-text">{item.text}</span>
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ padding: 4 }}
                      onClick={() => handleDeletePriorityForDate(selectedDate, item.id)}
                      aria-label="Remover prioridade"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {priorities.length < 3 && (
                <form className="priority-form" onSubmit={handleAddPriority}>
                  <input
                    type="text"
                    className="input"
                    value={priorityDraft}
                    onChange={(e) => setPriorityDraft(e.target.value)}
                    placeholder="Adicionar prioridade essencial..."
                    maxLength={70}
                  />
                  <button
                    type="submit"
                    className="btn btn-secondary"
                    aria-label="Adicionar prioridade"
                  >
                    <Plus size={16} />
                  </button>
                </form>
              )}
            </div>

            <div className="card">
              <p className="section-label">
                <span>Blocos e avisos</span>
              </p>

              {dayEvents.length === 0 ? (
                <div className="empty-state">
                  Nenhum compromisso neste dia. Clique em <strong>Agendar bloco</strong> para definir
                  horário de início, término e aviso.
                </div>
              ) : (
                <div className="event-list">{dayEvents.map((ev) => renderEventCard(ev))}</div>
              )}
            </div>
          </aside>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingEvent ? 'Editar bloco / aviso' : 'Novo bloco / aviso'}
      >
        <form
          onSubmit={handleSubmitEvent}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div className="field">
            <label htmlFor="evt-title">Atividade ou matéria</label>
            <input
              id="evt-title"
              type="text"
              className="input"
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              placeholder="Ex: Estudar Algoritmos, Reunião, Jantar..."
              required
              autoFocus
            />
          </div>

          <div className="field">
            <label>Categoria (opcional)</label>
            <div className="category-chips" role="group" aria-label="Categoria da pendência">
              {availableCategories.map((cat) => {
                const active = eventCategory === cat;
                const tone = getCategoryTone(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    aria-pressed={active}
                    className={`category-chip ${active ? 'is-active' : ''}`}
                    style={
                      active
                        ? {
                            color: tone.accent,
                            background: tone.bg,
                            borderColor: tone.accent,
                          }
                        : undefined
                    }
                    onClick={() => setEventCategory(active ? '' : cat)}
                  >
                    {cat}
                  </button>
                );
              })}

              <button
                type="button"
                aria-pressed={eventCategory === '__other__'}
                className={`category-chip ${eventCategory === '__other__' ? 'is-active' : ''}`}
                onClick={() =>
                  setEventCategory(eventCategory === '__other__' ? '' : '__other__')
                }
              >
                Outros
              </button>
            </div>

            {eventCategory === '__other__' && (
              <div className="custom-category-box">
                <input
                  type="text"
                  className="input"
                  value={customCategoryDraft}
                  onChange={(e) => setCustomCategoryDraft(e.target.value)}
                  placeholder="Nome da categoria (ex: Saúde, Finanças, Lazer...)"
                  maxLength={28}
                />
                <div className="save-category-row">
                  <span>Salvar como categoria fixa para próximas vezes?</span>
                  <Toggle
                    checked={saveAsNewCategory}
                    onChange={setSaveAsNewCategory}
                    ariaLabel="Salvar nova categoria para próximas vezes"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="field">
            <label htmlFor="evt-date">Data</label>
            <input
              id="evt-date"
              type="date"
              className="input"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              required
            />
          </div>

          <div className="form-grid-2">
            <div className="field">
              <label htmlFor="evt-start">Início</label>
              <TimePicker
                id="evt-start"
                value={eventStartTime}
                onChange={handleStartTimeChange}
                ariaLabel="Horário de início"
              />
            </div>

            <div className="field">
              <label htmlFor="evt-end">Previsão de término</label>
              <TimePicker
                id="evt-end"
                value={eventEndTime}
                onChange={setEventEndTime}
                ariaLabel="Previsão de término"
              />
            </div>
          </div>

          <div className={`duration-preview ${computedDuration < 1 ? 'is-invalid' : ''}`}>
            {computedDuration >= 1 ? (
              <>
                <span>
                  Duração prevista{endsNextDay ? ' (termina no dia seguinte)' : ''}
                </span>
                <strong>{formatMinutesHuman(computedDuration)}</strong>
              </>
            ) : (
              <span>Escolha um horário de término diferente do horário de início.</span>
            )}
          </div>

          <div className="field">
            <label htmlFor="evt-reminder">Aviso / Lembrete</label>
            <select
              id="evt-reminder"
              className="select"
              value={eventReminder}
              onChange={(e) => setEventReminder(e.target.value)}
            >
              <option value="0">Na hora exata</option>
              <option value="5">5 minutos antes</option>
              <option value="10">10 minutos antes</option>
              <option value="30">30 minutos antes</option>
              <option value="none">Sem aviso</option>
            </select>
          </div>

          {editingEvent && (
            <div className="save-category-row" style={{ padding: '4px 0' }}>
              <span>Marcar esta pendência como concluída</span>
              <Toggle
                checked={editingEvent.completed}
                onChange={(next) => {
                  const updated: CalendarEvent = {
                    ...editingEvent,
                    completed: next,
                    manualUncompleted: next ? undefined : true,
                  };
                  setEditingEvent(updated);
                  onSaveEvent(updated);
                }}
                ariaLabel="Marcar pendência como concluída"
              />
            </div>
          )}

          <div
            className="modal-actions"
            style={{ justifyContent: editingEvent ? 'space-between' : 'flex-end' }}
          >
            {editingEvent && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  onDeleteEvent(editingEvent.id);
                  setModalOpen(false);
                }}
              >
                <Trash2 size={15} />
                <span>Excluir</span>
              </button>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setModalOpen(false)}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={computedDuration < 1}>
                {editingEvent ? 'Salvar alterações' : 'Salvar bloco'}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </section>
  );
}
