import { useState } from 'react';
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Coffee,
  FileText,
  ListChecks,
  PictureInPicture2,
  Play,
  Plus,
  RotateCcw,
} from 'lucide-react';
import type { CalendarEvent, DailyPriority } from '../../types/models';
import { getCategoryTone } from '../../utils/categoryStyle';
import { addMinutesToTime, formatStopwatch } from '../../utils/date';
import { Hourglass } from '../ui/Hourglass';
import { Modal } from '../ui/Modal';
import './MarathonView.css';

export type MarathonStatus = 'idle' | 'flowing' | 'resting';

interface MarathonViewProps {
  status: MarathonStatus;
  flowSeconds: number;
  currentBreakSeconds: number;
  totalBreakSeconds: number;
  breakCount: number;
  label: string;
  notes: string;
  autoSavedMinutes: number;
  pipOpen: boolean;
  pipSupported: boolean;
  todayEvents: CalendarEvent[];
  todayPriorities: DailyPriority[];
  onStartOrResume: () => void;
  onStartBreak: () => void;
  onFinishMarathon: () => void;
  onDiscardMarathon: () => void;
  onLabelChange: (label: string) => void;
  onNotesChange: (notes: string) => void;
  onTogglePip: () => void;
  onToggleEventComplete: (event: CalendarEvent) => void;
  onToggleTodayPriority: (id: string) => void;
  onLoadEventIntoMarathon: (event: CalendarEvent) => void;
  onAddTodayEvent: () => void;
  onOpenCalendar: () => void;
}

export function MarathonView({
  status,
  flowSeconds,
  currentBreakSeconds,
  totalBreakSeconds,
  breakCount,
  label,
  notes,
  autoSavedMinutes,
  pipOpen,
  pipSupported,
  todayEvents,
  todayPriorities,
  onStartOrResume,
  onStartBreak,
  onFinishMarathon,
  onDiscardMarathon,
  onLabelChange,
  onNotesChange,
  onTogglePip,
  onToggleEventComplete,
  onToggleTodayPriority,
  onLoadEventIntoMarathon,
  onAddTodayEvent,
  onOpenCalendar,
}: MarathonViewProps) {
  const [confirmFinishOpen, setConfirmFinishOpen] = useState(false);

  const hasStarted = status !== 'idle' || flowSeconds > 0;
  const displayedBreakTotal = totalBreakSeconds + (status === 'resting' ? currentBreakSeconds : 0);
  const pendingTodayCount =
    todayEvents.filter((e) => !e.completed).length +
    todayPriorities.filter((p) => !p.done).length;

  return (
    <section className="marathon-layout" aria-label="Modo Maratona (Flow State)">
      <div className="marathon-stage">
        <div className="stage-top-strip">
          {hasStarted ? (
            <button
              type="button"
              className="stage-micro-btn"
              onClick={onDiscardMarathon}
              title="Zerar cronômetro da maratona atual"
            >
              <RotateCcw size={13} />
              <span>Zerar</span>
            </button>
          ) : (
            <span />
          )}

          <button
            type="button"
            className={`stage-micro-btn ${pipOpen ? 'active' : ''}`}
            onClick={onTogglePip}
            disabled={!pipSupported}
            title="Abrir mini-timer flutuante por cima de outras abas"
          >
            <PictureInPicture2 size={13} />
            <span>{pipOpen ? 'Flutuante ativo' : 'Flutuante'}</span>
          </button>
        </div>

        {status === 'resting' && (
          <div className="marathon-status-pill is-resting">
            <span className="marathon-pulse-dot" aria-hidden="true" />
            <span>Descansando</span>
          </div>
        )}

        <div className="marathon-clock-box">
          <Hourglass running={status !== 'idle'} size={30} />

          {status === 'resting' ? (
            <>
              <div className="marathon-clock-primary is-resting">
                {formatStopwatch(currentBreakSeconds)}
              </div>
              <div className="marathon-clock-sub">
                Tempo em fluxo acumulado: <strong>{formatStopwatch(flowSeconds)}</strong>
              </div>
            </>
          ) : (
            <>
              <div className="marathon-clock-primary">{formatStopwatch(flowSeconds)}</div>
              <div className="marathon-clock-sub">
                {status === 'flowing'
                  ? 'O tempo cresce livremente — descanse quando quiser'
                  : 'Comece sem pressa e entre no fluxo'}
              </div>
            </>
          )}
        </div>

        <div className="focus-session-fields">
          <input
            type="text"
            className="focus-label-input"
            value={label}
            onChange={(e) => onLabelChange(e.target.value)}
            placeholder="No que você está imerso agora? (opcional)"
            maxLength={60}
            aria-label="Título da maratona"
          />
        </div>

        <div className="focus-primary-controls">
          {status === 'idle' && (
            <button
              type="button"
              className="btn btn-primary focus-play-btn"
              onClick={onStartOrResume}
            >
              <Play size={18} />
              <span>{flowSeconds > 0 ? 'Retomar maratona' : 'Iniciar maratona'}</span>
            </button>
          )}

          {status === 'flowing' && (
            <>
              <button
                type="button"
                className="btn btn-secondary focus-play-btn"
                onClick={onStartBreak}
              >
                <Coffee size={17} />
                <span>Descansar</span>
              </button>
              <button
                type="button"
                className="btn btn-primary focus-play-btn"
                onClick={() => setConfirmFinishOpen(true)}
              >
                <CheckCircle2 size={17} />
                <span>Concluir maratona</span>
              </button>
            </>
          )}

          {status === 'resting' && (
            <>
              <button
                type="button"
                className="btn btn-primary focus-play-btn"
                onClick={onStartOrResume}
              >
                <Play size={17} />
                <span>Retomar fluxo</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary focus-play-btn"
                onClick={() => setConfirmFinishOpen(true)}
              >
                <CheckCircle2 size={17} />
                <span>Concluir maratona</span>
              </button>
            </>
          )}
        </div>

        {autoSavedMinutes > 0 && (
          <div className="focus-autosave-pill">
            <Check size={13} />
            <span>Progresso protegido automaticamente ({autoSavedMinutes} min salvos)</span>
          </div>
        )}

        <div className="marathon-stats-strip">
          <div className="marathon-stat">
            <span className="marathon-stat-label">Em fluxo</span>
            <span className="marathon-stat-val">{formatStopwatch(flowSeconds)}</span>
          </div>
          <div className="marathon-stat">
            <span className="marathon-stat-label">Pausas</span>
            <span className="marathon-stat-val">{breakCount}</span>
          </div>
          <div className="marathon-stat">
            <span className="marathon-stat-label">Descanso total</span>
            <span className="marathon-stat-val">{formatStopwatch(displayedBreakTotal)}</span>
          </div>
        </div>
      </div>

      <aside className="marathon-side-col">
        <div className="side-card">
          <div className="side-card-head">
            <h2 className="side-card-title">
              <FileText size={16} />
              <span>Anotação da maratona</span>
            </h2>
            <span className="side-card-tag">Opcional · salva ao concluir</span>
          </div>

          <textarea
            className="focus-notes-area"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Anote ideias, progresso, capítulos concluídos ou onde parou durante o fluxo..."
            maxLength={500}
            aria-label="Anotação da maratona"
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
                        onClick={() => onLoadEventIntoMarathon(ev)}
                        title="Usar esta pendência como título da maratona"
                      >
                        <Play size={12} />
                        <span>Usar</span>
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

      <Modal
        open={confirmFinishOpen}
        onClose={() => setConfirmFinishOpen(false)}
        title="Encerrar maratona?"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--muted)' }}>
            Tem certeza que deseja encerrar e salvar esta maratona agora?
          </p>

          <div className="marathon-stats-strip" style={{ borderTop: 'none', paddingTop: 0 }}>
            <div className="marathon-stat">
              <span className="marathon-stat-label">Em fluxo</span>
              <span className="marathon-stat-val">{formatStopwatch(flowSeconds)}</span>
            </div>
            <div className="marathon-stat">
              <span className="marathon-stat-label">Pausas</span>
              <span className="marathon-stat-val">{breakCount}</span>
            </div>
            <div className="marathon-stat">
              <span className="marathon-stat-label">Descanso</span>
              <span className="marathon-stat-val">{formatStopwatch(displayedBreakTotal)}</span>
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setConfirmFinishOpen(false)}
            >
              Continuar na maratona
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setConfirmFinishOpen(false);
                onFinishMarathon();
              }}
            >
              Sim, encerrar
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
