import { useRef, useState, type FormEvent } from 'react';
import {
  Calendar,
  Check,
  Clock,
  FileText,
  ListChecks,
  Pause,
  PictureInPicture2,
  Play,
  Plus,
  RotateCcw,
  Zap,
} from 'lucide-react';
import type { CalendarEvent, DailyPriority, TimerPhase } from '../../types/models';
import { getCategoryTone } from '../../utils/categoryStyle';
import { addMinutesToTime, formatClock, formatMinutesHuman } from '../../utils/date';
import { Hourglass } from '../ui/Hourglass';
import { SlidingTabs } from '../ui/SlidingTabs';
import './FocusView.css';

interface FocusViewProps {
  phase: TimerPhase;
  remainingSeconds: number;
  totalSeconds: number;
  running: boolean;
  otherPhaseRunning: boolean;
  otherPhaseRemainingSeconds: number;
  label: string;
  sessionNotes: string;
  autoSavedMinutes: number;
  todayStudiedMinutes: number;
  pipOpen: boolean;
  pipSupported: boolean;
  todayEvents: CalendarEvent[];
  todayPriorities: DailyPriority[];
  onPhaseChange: (phase: TimerPhase) => void;
  onToggleRun: () => void;
  onReset: () => void;
  onLabelChange: (label: string) => void;
  onSessionNotesChange: (notes: string) => void;
  onSetExactSeconds: (seconds: number) => void;
  onQuickStartAntiInertia: () => void;
  onTogglePip: () => void;
  onToggleEventComplete: (event: CalendarEvent) => void;
  onToggleTodayPriority: (id: string) => void;
  onStartFocusFromEvent: (event: CalendarEvent) => void;
  onAddTodayEvent: () => void;
  onOpenCalendar: () => void;
}

const RING_RADIUS = 122;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function FocusView({
  phase,
  remainingSeconds,
  totalSeconds,
  running,
  otherPhaseRunning,
  otherPhaseRemainingSeconds,
  label,
  sessionNotes,
  autoSavedMinutes,
  todayStudiedMinutes,
  pipOpen,
  pipSupported,
  todayEvents,
  todayPriorities,
  onPhaseChange,
  onToggleRun,
  onReset,
  onLabelChange,
  onSessionNotesChange,
  onSetExactSeconds,
  onQuickStartAntiInertia,
  onTogglePip,
  onToggleEventComplete,
  onToggleTodayPriority,
  onStartFocusFromEvent,
  onAddTodayEvent,
  onOpenCalendar,
}: FocusViewProps) {
  const [editingClock, setEditingClock] = useState(false);
  const [clockMinDraft, setClockMinDraft] = useState('');
  const [clockSecDraft, setClockSecDraft] = useState('');
  const secInputRef = useRef<HTMLInputElement>(null);

  const progress =
    totalSeconds > 0 ? Math.max(0, Math.min(1, (totalSeconds - remainingSeconds) / totalSeconds)) : 0;
  const dashOffset = RING_CIRCUMFERENCE * (1 - progress);

  const openClockEditor = () => {
    if (running) return;
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    setClockMinDraft(String(mins).padStart(2, '0'));
    setClockSecDraft(String(secs).padStart(2, '0'));
    setEditingClock(true);
  };

  const commitClockEditor = (e?: FormEvent) => {
    e?.preventDefault();
    const minTrim = clockMinDraft.trim();
    const secTrim = clockSecDraft.trim();

    if (!minTrim && !secTrim) {
      const fallbackMins = phase === 'study' ? 30 : 10;
      onSetExactSeconds(fallbackMins * 60);
      setEditingClock(false);
      return;
    }

    const mins = minTrim ? Math.min(240, parseInt(minTrim, 10) || 0) : 0;
    const secs = secTrim ? Math.min(59, parseInt(secTrim, 10) || 0) : 0;
    const total = mins * 60 + secs;

    if (total >= 1) {
      onSetExactSeconds(total);
    } else {
      const fallbackMins = phase === 'study' ? 30 : 10;
      onSetExactSeconds(fallbackMins * 60);
    }
    setEditingClock(false);
  };

  const pendingTodayCount =
    todayEvents.filter((e) => !e.completed).length +
    todayPriorities.filter((p) => !p.done).length;

  const otherPhaseName = phase === 'study' ? 'Descanso' : 'Atividade';

  return (
    <section className="focus-layout" aria-label="Timer de atividade e descanso">
      <div className="focus-main-col">
        <div className="focus-stage">
          <div className="stage-top-strip">
            <button
              type="button"
              className="stage-micro-btn"
              onClick={onQuickStartAntiInertia}
              title="Modo Blitz: ajustar o timer para 10 minutos"
            >
              <Zap size={13} />
              <span>Blitz</span>
            </button>

            <button
              type="button"
              className={`stage-micro-btn ${pipOpen ? 'active' : ''}`}
              onClick={onTogglePip}
              disabled={!pipSupported}
              title={
                pipSupported
                  ? 'Abrir mini-timer flutuante por cima de outras abas'
                  : 'Seu navegador não suporta janela flutuante Picture-in-Picture'
              }
            >
              <PictureInPicture2 size={13} />
              <span>{pipOpen ? 'Flutuante ativo' : 'Flutuante'}</span>
            </button>
          </div>

          <SlidingTabs
            ariaLabel="Modo do cronômetro"
            value={phase}
            onChange={(next) => {
              setEditingClock(false);
              onPhaseChange(next);
            }}
            items={[
              { value: 'study', label: 'Atividade' },
              { value: 'break', label: 'Descanso' },
            ]}
          />

          {otherPhaseRunning && (
            <button
              type="button"
              className="chip-btn active"
              style={{ padding: '5px 12px', fontSize: '0.75rem' }}
              onClick={() => onPhaseChange(phase === 'study' ? 'break' : 'study')}
            >
              <span>
                {otherPhaseName} em andamento: {formatClock(otherPhaseRemainingSeconds)}
              </span>
            </button>
          )}

          <div className="focus-ring-wrap">
            <svg className="focus-ring-svg" viewBox="0 0 272 272" aria-hidden="true">
              <circle className="focus-ring-track" cx="136" cy="136" r={RING_RADIUS} />
              <circle
                className={`focus-ring-progress ${phase === 'break' ? 'is-break' : ''}`}
                cx="136"
                cy="136"
                r={RING_RADIUS}
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
              />
            </svg>

            <div className="focus-clock-center">
              <Hourglass running={running} size={24} />

              <span className={`focus-phase-hint ${phase === 'break' ? 'is-break' : ''}`}>
                {phase === 'study' ? 'Atividade' : 'Descanso'}
              </span>

              {editingClock ? (
                <form
                  className="focus-clock-edit-form"
                  onSubmit={commitClockEditor}
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                      commitClockEditor();
                    }
                  }}
                >
                  <div className="focus-clock-split">
                    <input
                      type="text"
                      inputMode="numeric"
                      className="focus-clock-part"
                      value={clockMinDraft}
                      placeholder={phase === 'study' ? '30' : '10'}
                      onChange={(e) =>
                        setClockMinDraft(e.target.value.replace(/\D/g, '').slice(0, 3))
                      }
                      onKeyDown={(e) => {
                        if (e.key === ':' || e.key === 'ArrowRight') {
                          e.preventDefault();
                          secInputRef.current?.focus();
                          secInputRef.current?.select();
                        }
                      }}
                      autoFocus
                      aria-label="Minutos"
                    />
                    <span className="focus-clock-colon" aria-hidden="true">
                      :
                    </span>
                    <input
                      ref={secInputRef}
                      type="text"
                      inputMode="numeric"
                      className="focus-clock-part"
                      value={clockSecDraft}
                      placeholder="00"
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '').slice(0, 2);
                        const num = parseInt(digits, 10);
                        setClockSecDraft(
                          digits !== '' && Number.isFinite(num) && num > 59 ? '59' : digits
                        );
                      }}
                      aria-label="Segundos"
                    />
                  </div>
                  <button type="submit" style={{ display: 'none' }} aria-hidden="true" />
                  <span className="focus-edit-caption">Min : Seg · Enter para confirmar</span>
                </form>
              ) : (
                <>
                  <button
                    type="button"
                    className="focus-clock-button"
                    onClick={openClockEditor}
                    disabled={running}
                    title={running ? 'Pause para editar o tempo' : 'Clique para digitar o tempo'}
                  >
                    {formatClock(remainingSeconds)}
                  </button>
                  <span className="focus-edit-caption">
                    {running ? 'Em andamento' : 'Clique no tempo para digitar'}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="focus-session-fields">
            <input
              type="text"
              className="focus-label-input"
              value={label}
              onChange={(e) => onLabelChange(e.target.value)}
              placeholder="Qual atividade você vai fazer agora? (opcional)"
              maxLength={60}
              aria-label="Atividade atual"
            />
          </div>

          <div className="focus-primary-controls">
            <button
              type="button"
              className="btn btn-primary focus-play-btn"
              onClick={onToggleRun}
            >
              {running ? <Pause size={18} /> : <Play size={18} />}
              <span>{running ? 'Pausar' : 'Iniciar'}</span>
            </button>

            <button
              type="button"
              className="icon-btn"
              onClick={onReset}
              title="Reiniciar cronômetro"
              aria-label="Reiniciar cronômetro"
            >
              <RotateCcw size={17} />
            </button>
          </div>

          {autoSavedMinutes > 0 && (
            <div className="focus-autosave-pill">
              <Check size={13} />
              <span>Progresso salvo automaticamente ({autoSavedMinutes} min nesta sessão)</span>
            </div>
          )}
        </div>

        <div className="focus-today-foot">
          <span>Hoje:</span>
          <strong>{formatMinutesHuman(todayStudiedMinutes)}</strong>
          <span>salvos automaticamente</span>
        </div>
      </div>

      <aside className="focus-side-col">
        <div className="side-card">
          <div className="side-card-head">
            <h2 className="side-card-title">
              <FileText size={16} />
              <span>Anotação da sessão</span>
            </h2>
            <span className="side-card-tag">Opcional · salva automático</span>
          </div>

          <textarea
            className="focus-notes-area"
            value={sessionNotes}
            onChange={(e) => onSessionNotesChange(e.target.value)}
            placeholder="Anote aqui o que quiser sobre este tempo: resumo, onde parou, dúvidas ou próximos passos..."
            maxLength={500}
            aria-label="Anotação sobre a sessão atual"
          />
        </div>

        <div className="side-card">
          <div className="side-card-head">
            <h2 className="side-card-title">
              <ListChecks size={16} />
              <span>Pendências de hoje</span>
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="side-card-tag">
                {pendingTodayCount === 0
                  ? 'Tudo livre'
                  : `${pendingTodayCount} ${pendingTodayCount === 1 ? 'pendente' : 'pendentes'}`}
              </span>
              <button
                type="button"
                className="mini-action accent"
                onClick={onAddTodayEvent}
                title="Adicionar nova pendência para hoje"
              >
                <Plus size={13} />
                <span>Nova</span>
              </button>
            </div>
          </div>

          {todayEvents.length === 0 && todayPriorities.length === 0 ? (
            <div className="today-empty">
              <span>Nenhuma pendência agendada para hoje.</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: '7px 13px', fontSize: '0.8rem' }}
                  onClick={onAddTodayEvent}
                >
                  <Plus size={14} />
                  <span>Adicionar pendência</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '7px 13px', fontSize: '0.8rem' }}
                  onClick={onOpenCalendar}
                >
                  <Calendar size={14} />
                  <span>Ver calendário</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="today-pending-list">
              {todayEvents.map((ev) => {
                const end = ev.endTime || addMinutesToTime(ev.time, ev.durationMinutes);
                const tone = getCategoryTone(ev.category);
                return (
                  <div
                    key={ev.id}
                    className={`today-pending-item ${ev.completed ? 'is-done' : ''}`}
                  >
                    <div className="today-pending-left">
                      <button
                        type="button"
                        className={`check-circle ${ev.completed ? 'checked' : ''}`}
                        style={{ marginTop: 2 }}
                        onClick={() => onToggleEventComplete(ev)}
                        aria-label="Concluir pendência"
                      >
                        {ev.completed && <Check size={12} strokeWidth={3} />}
                      </button>
                      <div className="today-pending-info">
                        <span className="today-pending-title">{ev.title}</span>
                        <div className="today-pending-meta">
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
                            <Clock size={11} />
                            {ev.time} – {end}
                          </span>
                        </div>
                      </div>
                    </div>

                    {!ev.completed && (
                      <button
                        type="button"
                        className="mini-action accent"
                        onClick={() => onStartFocusFromEvent(ev)}
                        title="Carregar esta pendência no timer"
                      >
                        <Play size={12} />
                        <span>Focar</span>
                      </button>
                    )}
                  </div>
                );
              })}

              {todayPriorities.length > 0 && (
                <>
                  <p className="today-pending-section-label">Top 3 de hoje</p>
                  {todayPriorities.map((prio) => (
                    <div
                      key={prio.id}
                      className={`today-pending-item ${prio.done ? 'is-done' : ''}`}
                    >
                      <div className="today-pending-left">
                        <button
                          type="button"
                          className={`check-circle ${prio.done ? 'checked' : ''}`}
                          onClick={() => onToggleTodayPriority(prio.id)}
                          aria-label="Concluir prioridade"
                        >
                          {prio.done && <Check size={12} strokeWidth={3} />}
                        </button>
                        <span className="today-pending-title">{prio.text}</span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </aside>
    </section>
  );
}
