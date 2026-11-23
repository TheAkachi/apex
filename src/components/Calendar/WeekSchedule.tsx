import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import type { CalendarEvent } from '../../types/models';
import { getCategoryTone } from '../../utils/categoryStyle';
import {
  addMinutesToTime,
  formatLocalDate,
  formatMinutesHuman,
  offsetLocalDate,
  parseLocalDate,
  timeToMinutes,
} from '../../utils/date';
import './WeekSchedule.css';

interface WeekScheduleProps {
  events: CalendarEvent[];
  anchorDate: string;
  onSelectSlot: (date: string, startTime: string) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onToggleComplete: (event: CalendarEvent) => void;
  onStartFocusFromEvent: (event: CalendarEvent) => void;
}

const HOUR_HEIGHT = 48;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function getStartOfWeek(date: Date): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

export function WeekSchedule({
  events,
  anchorDate,
  onSelectSlot,
  onEditEvent,
  onToggleComplete,
  onStartFocusFromEvent,
}: WeekScheduleProps) {
  const [weekStart, setWeekStart] = useState<Date>(() =>
    getStartOfWeek(parseLocalDate(anchorDate))
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const todayStr = formatLocalDate(new Date());
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

  // Rola inicialmente para 07:00 para mostrar o horário principal do dia
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 7 * HOUR_HEIGHT;
    }
  }, []);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i);
      const dateStr = formatLocalDate(d);
      const prevDateStr = offsetLocalDate(d, -1);

      const segments: {
        key: string;
        event: CalendarEvent;
        startMins: number;
        durationMins: number;
        continuation: boolean;
      }[] = [];

      // Blocos iniciados neste dia
      for (const ev of events) {
        if (ev.date === dateStr) {
          const startMins = timeToMinutes(ev.time);
          const sameDayDur = Math.min(ev.durationMinutes, 1440 - startMins);
          if (sameDayDur > 0) {
            segments.push({
              key: ev.id,
              event: ev,
              startMins,
              durationMins: sameDayDur,
              continuation: false,
            });
          }
        }
        // Continuação de blocos do dia anterior que viraram a meia-noite (ex: 23:30 -> 00:30)
        if (ev.date === prevDateStr) {
          const startMins = timeToMinutes(ev.time);
          const overflow = startMins + ev.durationMinutes - 1440;
          if (overflow > 0) {
            segments.push({
              key: `${ev.id}-cont`,
              event: ev,
              startMins: 0,
              durationMins: Math.min(1440, overflow),
              continuation: true,
            });
          }
        }
      }

      segments.sort((a, b) => a.startMins - b.startMins);
      const busyMinutes = segments.reduce((acc, seg) => acc + seg.durationMins, 0);

      return {
        dateStr,
        weekday: WEEKDAY_SHORT[d.getDay()],
        dayNum: d.getDate(),
        segments,
        busyMinutes,
      };
    });
  }, [weekStart, events]);

  const rangeLabel = useMemo(() => {
    const first = weekStart;
    const last = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6);
    const fmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
    return `${fmt.format(first)} – ${fmt.format(last)} · ${last.getFullYear()}`;
  }, [weekStart]);

  const shiftWeek = (deltaWeeks: number) => {
    setWeekStart(
      (prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + deltaWeeks * 7)
    );
  };

  const jumpToCurrentWeek = () => {
    setWeekStart(getStartOfWeek(new Date()));
  };

  return (
    <div className="card week-card">
      <div className="week-toolbar">
        <div className="week-nav">
          <button
            type="button"
            className="icon-btn"
            onClick={() => shiftWeek(-1)}
            aria-label="Semana anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="week-range-title">{rangeLabel}</h2>
          <button
            type="button"
            className="icon-btn"
            onClick={() => shiftWeek(1)}
            aria-label="Próxima semana"
          >
            <ChevronRight size={18} />
          </button>
          <button type="button" className="btn btn-secondary" onClick={jumpToCurrentWeek}>
            Esta semana
          </button>
        </div>

        <div className="week-legend">
          <span className="week-legend-item">
            <span className="week-swatch busy" /> Ocupado
          </span>
          <span className="week-legend-item">
            <span className="week-swatch" /> Livre (clique no horário para agendar)
          </span>
        </div>
      </div>

      <div className="week-grid-shell">
        <div ref={headerRef} className="week-header-row">
          <div className="week-gutter-head" />
          {weekDays.map((day) => {
            const isToday = day.dateStr === todayStr;
            return (
              <div key={day.dateStr} className={`week-day-head ${isToday ? 'is-today' : ''}`}>
                <span className="week-day-name">{day.weekday}</span>
                <span className="week-day-num">{day.dayNum}</span>
                <span className={`week-day-load ${day.busyMinutes > 0 ? 'has-busy' : ''}`}>
                  {day.busyMinutes > 0 ? formatMinutesHuman(day.busyMinutes) : 'Livre'}
                </span>
              </div>
            );
          })}
        </div>

        <div
          ref={scrollRef}
          className="week-scroll-area"
          onScroll={(e) => {
            if (headerRef.current) {
              headerRef.current.scrollLeft = e.currentTarget.scrollLeft;
            }
          }}
        >
          <div className="week-body-grid">
            <div className="week-time-col" aria-hidden="true">
              {HOURS.map((h) => (
                <div key={h} className="week-time-label">
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {weekDays.map((day) => {
              const isToday = day.dateStr === todayStr;
              return (
                <div key={day.dateStr} className={`week-day-col ${isToday ? 'is-today' : ''}`}>
                  {HOURS.map((h) => {
                    const hhmm = `${String(h).padStart(2, '0')}:00`;
                    return (
                      <button
                        key={h}
                        type="button"
                        className="week-hour-slot"
                        onClick={() => onSelectSlot(day.dateStr, hhmm)}
                        title={`Agendar em ${day.weekday} ${day.dayNum} às ${hhmm}`}
                      >
                        + {hhmm}
                      </button>
                    );
                  })}

                  {isToday && (
                    <div
                      className="week-now-line"
                      style={{ top: `${(nowMinutes / 60) * HOUR_HEIGHT}px` }}
                      aria-hidden="true"
                    />
                  )}

                  {day.segments.map((seg) => {
                    const ev = seg.event;
                    const endStr = ev.endTime || addMinutesToTime(ev.time, ev.durationMinutes);
                    const top = (seg.startMins / 60) * HOUR_HEIGHT;
                    const height = Math.max(24, (seg.durationMins / 60) * HOUR_HEIGHT - 2);
                    const tone = getCategoryTone(ev.category);

                    return (
                      <div
                        key={seg.key}
                        role="button"
                        tabIndex={0}
                        className={`week-event-block ${ev.completed ? 'is-done' : ''}`}
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          ...(ev.completed
                            ? {}
                            : {
                                background: tone.bg,
                                borderColor: tone.border,
                                borderLeftColor: tone.accent,
                              }),
                        }}
                        onClick={() => onEditEvent(ev)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onEditEvent(ev);
                          }
                        }}
                        title={`${ev.title}${ev.category ? ` [${ev.category}]` : ''} (${ev.time} – ${endStr}) · Clique para editar`}
                      >
                        <div className="week-event-top">
                          <span className="week-event-title">
                            {seg.continuation ? `↳ ${ev.title}` : ev.title}
                          </span>
                          <div className="week-event-actions">
                            <button
                              type="button"
                              className={`week-event-play ${ev.completed ? 'is-checked' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleComplete(ev);
                              }}
                              title={ev.completed ? 'Desmarcar conclusão' : 'Marcar como concluída'}
                              aria-label={
                                ev.completed
                                  ? `Desmarcar ${ev.title}`
                                  : `Concluir ${ev.title}`
                              }
                            >
                              <Check size={11} strokeWidth={3} />
                            </button>
                            {!ev.completed && (
                              <button
                                type="button"
                                className="week-event-play"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onStartFocusFromEvent(ev);
                                }}
                                title="Iniciar este bloco no Timer"
                                aria-label={`Focar em ${ev.title}`}
                              >
                                <Play size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                        {height >= 36 && (
                          <span
                            className="week-event-time"
                            style={ev.completed ? undefined : { color: tone.accent }}
                          >
                            {seg.continuation ? `00:00 – ${endStr}` : `${ev.time} – ${endStr}`}
                            {ev.category ? ` · ${ev.category}` : ''}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
