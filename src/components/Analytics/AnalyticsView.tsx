import { useMemo, useState, type FormEvent } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock,
  Flame,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import type { CalendarEvent, StudySession } from '../../types/models';
import { getCategoryTone } from '../../utils/categoryStyle';
import {
  formatLocalDate,
  formatMinutesHuman,
  offsetLocalDate,
  parseLocalDate,
  uid,
} from '../../utils/date';
import { Modal } from '../ui/Modal';
import { SlidingTabs } from '../ui/SlidingTabs';
import './AnalyticsView.css';

interface AnalyticsViewProps {
  sessions: StudySession[];
  events: CalendarEvent[];
  onOpenPending: () => void;
  onSaveSession: (session: StudySession, isEdit: boolean) => void;
  onDeleteSession: (id: string) => void;
}

type ChartRange = '7d' | '30d';

const MONTH_LABELS_PT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

export function AnalyticsView({
  sessions,
  events,
  onOpenPending,
  onSaveSession,
  onDeleteSession,
}: AnalyticsViewProps) {
  const [range, setRange] = useState<ChartRange>('7d');
  const [heatmapYear, setHeatmapYear] = useState<number>(() => new Date().getFullYear());
  const [hoveredCell, setHoveredCell] = useState<{ date: string; minutes: number } | null>(null);

  // Modal unificado para criar ou editar sessão (com anotação)
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<StudySession | null>(null);
  const [formDate, setFormDate] = useState(formatLocalDate(new Date()));
  const [formMinutes, setFormMinutes] = useState(30);
  const [formLabel, setFormLabel] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Confirmações antes de excluir ou salvar edição de sessão
  const [pendingDeleteSession, setPendingDeleteSession] = useState<StudySession | null>(null);
  const [pendingEditSession, setPendingEditSession] = useState<StudySession | null>(null);

  const minutesByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sessions) {
      map.set(s.date, (map.get(s.date) ?? 0) + s.durationMinutes);
    }
    return map;
  }, [sessions]);

  const stats = useMemo(() => {
    const today = new Date();
    const daysCount = range === '7d' ? 7 : 30;
    let periodMinutes = 0;
    let activeDaysInPeriod = 0;

    for (let i = 0; i < daysCount; i++) {
      const key = offsetLocalDate(today, -i);
      const mins = minutesByDate.get(key) ?? 0;
      periodMinutes += mins;
      if (mins > 0) activeDaysInPeriod += 1;
    }

    let streak = 0;
    const todayMins = minutesByDate.get(formatLocalDate(today)) ?? 0;
    let cursorOffset = todayMins > 0 ? 0 : -1;
    while (true) {
      const key = offsetLocalDate(today, cursorOffset);
      if ((minutesByDate.get(key) ?? 0) > 0) {
        streak += 1;
        cursorOffset -= 1;
      } else {
        break;
      }
    }

    const totalAllTime = sessions.reduce((acc, s) => acc + s.durationMinutes, 0);

    const todayKey = formatLocalDate(today);
    const resolvedEvents = events.filter((e) => e.completed).length;
    const openEvents = events.filter((e) => !e.completed).length;
    const overdueEvents = events.filter((e) => !e.completed && e.date < todayKey).length;
    const totalEvents = events.length;

    return {
      periodMinutes,
      streak,
      totalAllTime,
      resolvedEvents,
      openEvents,
      overdueEvents,
      totalEvents,
    };
  }, [minutesByDate, range, sessions, events]);

  // Heatmap do ano inteiro (1º de janeiro a 31 de dezembro), alinhado por semana (Dom..Sáb)
  const { heatmapCells, monthMarkers } = useMemo(() => {
    const startOfYear = new Date(heatmapYear, 0, 1);
    const endOfYear = new Date(heatmapYear, 11, 31);
    const leadingEmpty = startOfYear.getDay(); // 0 (Dom) .. 6 (Sáb)

    const cells: {
      key: string;
      date: string | null;
      minutes: number;
      level: number;
    }[] = [];

    for (let i = 0; i < leadingEmpty; i++) {
      cells.push({ key: `pad-start-${i}`, date: null, minutes: 0, level: 0 });
    }

    const cursor = new Date(startOfYear);
    while (cursor <= endOfYear) {
      const date = formatLocalDate(cursor);
      const minutes = minutesByDate.get(date) ?? 0;
      const level =
        minutes === 0 ? 0 : minutes < 30 ? 1 : minutes < 60 ? 2 : minutes < 120 ? 3 : 4;
      cells.push({ key: date, date, minutes, level });
      cursor.setDate(cursor.getDate() + 1);
    }

    const trailingEmpty = (7 - (cells.length % 7)) % 7;
    for (let i = 0; i < trailingEmpty; i++) {
      cells.push({ key: `pad-end-${i}`, date: null, minutes: 0, level: 0 });
    }

    const totalWeeks = Math.ceil(cells.length / 7);
    const markers: string[] = Array.from({ length: totalWeeks }, () => '');

    for (let m = 0; m < 12; m++) {
      const firstOfMonth = new Date(heatmapYear, m, 1);
      const dayOfYearIndex = Math.round(
        (firstOfMonth.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)
      );
      const weekIndex = Math.floor((leadingEmpty + dayOfYearIndex) / 7);
      if (weekIndex >= 0 && weekIndex < totalWeeks && !markers[weekIndex]) {
        markers[weekIndex] = MONTH_LABELS_PT[m];
      }
    }

    return { heatmapCells: cells, monthMarkers: markers };
  }, [minutesByDate, heatmapYear]);

  const barData = useMemo(() => {
    const today = new Date();
    const count = range === '7d' ? 7 : 30;
    const items: { date: string; label: string; minutes: number }[] = [];

    for (let i = count - 1; i >= 0; i--) {
      const date = offsetLocalDate(today, -i);
      const parsed = parseLocalDate(date);
      const label =
        range === '7d'
          ? new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
              .format(parsed)
              .replace('.', '')
          : String(parsed.getDate());
      items.push({ date, label, minutes: minutesByDate.get(date) ?? 0 });
    }
    return items;
  }, [minutesByDate, range]);

  const maxBarMinutes = Math.max(60, ...barData.map((d) => d.minutes));

  // Tempo acumulado por categoria (tag) registrada nas pendências e sessões vinculadas
  const categoryStats = useMemo(() => {
    const totals = new Map<string, number>();
    const countedEventIds = new Set<string>();

    for (const ev of events) {
      if (!ev.category) continue;
      totals.set(ev.category, (totals.get(ev.category) ?? 0) + ev.durationMinutes);
      countedEventIds.add(ev.id);
    }

    for (const s of sessions) {
      if (!s.category) continue;
      if (s.eventId && countedEventIds.has(s.eventId)) continue;
      totals.set(s.category, (totals.get(s.category) ?? 0) + s.durationMinutes);
    }

    const list = Array.from(totals.entries())
      .map(([category, minutes]) => ({
        category,
        minutes,
        tone: getCategoryTone(category),
      }))
      .sort((a, b) => b.minutes - a.minutes);

    const totalMinutes = list.reduce((acc, item) => acc + item.minutes, 0);
    return { list, totalMinutes };
  }, [events, sessions]);

  const openNewManualModal = () => {
    setEditingSession(null);
    setFormDate(formatLocalDate(new Date()));
    setFormMinutes(30);
    setFormLabel('');
    setFormNotes('');
    setSessionModalOpen(true);
  };

  const openEditModal = (session: StudySession) => {
    setEditingSession(session);
    setFormDate(session.date);
    setFormMinutes(session.durationMinutes);
    setFormLabel(session.label);
    setFormNotes(session.notes ?? '');
    setSessionModalOpen(true);
  };

  const handleSubmitSession = (e: FormEvent) => {
    e.preventDefault();
    const mins = Math.max(1, Math.min(720, formMinutes || 1));
    const trimmedNotes = formNotes.trim();

    if (editingSession) {
      setPendingEditSession({
        ...editingSession,
        date: formDate || editingSession.date,
        durationMinutes: mins,
        label: formLabel.trim() || 'Atividade',
        notes: trimmedNotes || undefined,
      });
      setSessionModalOpen(false);
      return;
    }

    onSaveSession(
      {
        id: uid('sess'),
        date: formDate || formatLocalDate(new Date()),
        durationMinutes: mins,
        label: formLabel.trim() || 'Atividade registrada',
        notes: trimmedNotes || undefined,
        completedAt: new Date().toISOString(),
        source: 'manual',
      },
      false
    );

    setSessionModalOpen(false);
  };

  const confirmEditSession = () => {
    if (!pendingEditSession) return;
    onSaveSession(pendingEditSession, true);
    setPendingEditSession(null);
    setEditingSession(null);
  };

  const cancelEditConfirmation = () => {
    setPendingEditSession(null);
    setSessionModalOpen(true);
  };

  const confirmDeleteSession = () => {
    if (!pendingDeleteSession) return;
    onDeleteSession(pendingDeleteSession.id);
    setPendingDeleteSession(null);
  };

  return (
    <section className="analytics-layout" aria-label="Constância e gráficos de estudo">
      <div className="analytics-top">
        <h2 className="analytics-heading">Sua constância</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <SlidingTabs
            ariaLabel="Período do gráfico"
            value={range}
            onChange={setRange}
            items={[
              { value: '7d', label: '7 dias' },
              { value: '30d', label: '30 dias' },
            ]}
          />
          <button type="button" className="btn btn-primary" onClick={openNewManualModal}>
            <Plus size={16} />
            <span>Registro manual</span>
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">
            <Clock size={14} /> Total ({range === '7d' ? '7 dias' : '30 dias'})
          </span>
          <span className="kpi-value accent">{formatMinutesHuman(stats.periodMinutes)}</span>
          <span className="kpi-sub">Acumulado geral: {formatMinutesHuman(stats.totalAllTime)}</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">
            <CheckCircle2 size={14} /> Pendências resolvidas
          </span>
          <span className="kpi-value">{stats.resolvedEvents}</span>
          <span className="kpi-sub">
            {stats.totalEvents > 0
              ? `${Math.round((stats.resolvedEvents / stats.totalEvents) * 100)}% de ${stats.totalEvents} registradas`
              : 'Nenhuma pendência registrada'}
          </span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">
            <CircleDot size={14} /> Pendências em aberto
          </span>
          <span className="kpi-value">{stats.openEvents}</span>
          <span className="kpi-sub">
            {stats.overdueEvents > 0
              ? `${stats.overdueEvents} ${stats.overdueEvents === 1 ? 'atrasada' : 'atrasadas'}`
              : stats.openEvents > 0
                ? 'Dentro do prazo'
                : 'Tudo em dia'}
          </span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">
            <Flame size={14} /> Sequência atual
          </span>
          <span className="kpi-value">
            {stats.streak} {stats.streak === 1 ? 'dia' : 'dias'}
          </span>
          <span className="kpi-sub">Dias consecutivos ativos</span>
        </div>
      </div>

      <div className="card">
        <div className="chart-card-head">
          <div>
            <h3 className="chart-title">Mapa de constância · {heatmapYear}</h3>
            <span className="chart-sub">Ano inteiro (Jan – Dez) · passe o mouse em um dia</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span className="chart-sub" style={{ color: 'var(--accent)' }}>
              {hoveredCell
                ? `${parseLocalDate(hoveredCell.date).toLocaleDateString('pt-BR')} · ${formatMinutesHuman(hoveredCell.minutes)}`
                : 'Cada quadrado representa um dia'}
            </span>
            <div className="heatmap-year-nav">
              <button
                type="button"
                className="heatmap-year-btn"
                onClick={() => setHeatmapYear((y) => y - 1)}
                aria-label="Ano anterior"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="heatmap-year-label">{heatmapYear}</span>
              <button
                type="button"
                className="heatmap-year-btn"
                onClick={() => setHeatmapYear((y) => y + 1)}
                aria-label="Próximo ano"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        <div className="heatmap-scroll">
          <div className="heatmap-container">
            <div className="heatmap-months" aria-hidden="true">
              {monthMarkers.map((label, idx) => (
                <span key={idx} className="heatmap-month-label">
                  {label}
                </span>
              ))}
            </div>

            <div className="heatmap-body">
              <div className="heatmap-weekdays" aria-hidden="true">
                <span />
                <span>Seg</span>
                <span />
                <span>Qua</span>
                <span />
                <span>Sex</span>
                <span />
              </div>

              <div
                className="heatmap-grid"
                role="img"
                aria-label={`Mapa de calor de dias estudados em ${heatmapYear}`}
              >
                {heatmapCells.map((cell) =>
                  cell.date === null ? (
                    <div key={cell.key} className="heatmap-cell is-spacer" aria-hidden="true" />
                  ) : (
                    <div
                      key={cell.key}
                      className={`heatmap-cell ${cell.level > 0 ? `lvl-${cell.level}` : ''}`}
                      title={`${parseLocalDate(cell.date).toLocaleDateString('pt-BR')}: ${formatMinutesHuman(cell.minutes)}`}
                      onMouseEnter={() =>
                        setHoveredCell({ date: cell.date!, minutes: cell.minutes })
                      }
                      onMouseLeave={() => setHoveredCell(null)}
                    />
                  )
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="heatmap-footer">
          <span>Consistência vale mais que perfeição.</span>
          <div className="heatmap-legend">
            <span>Menos</span>
            <span className="heatmap-cell" />
            <span className="heatmap-cell lvl-1" />
            <span className="heatmap-cell lvl-2" />
            <span className="heatmap-cell lvl-3" />
            <span className="heatmap-cell lvl-4" />
            <span>Mais</span>
          </div>
        </div>
      </div>

      <div className="charts-row">
        <div className="card">
          <div className="chart-card-head">
            <div>
              <h3 className="chart-title">Tempo de atividade por dia</h3>
              <span className="chart-sub">
                {range === '7d' ? 'Últimos 7 dias' : 'Últimos 30 dias'} (em minutos)
              </span>
            </div>
          </div>

          <div className="bar-chart-wrap">
            <svg
              className="bar-chart-svg"
              viewBox="0 0 460 210"
              role="img"
              aria-label="Gráfico de barras de tempo de atividade por dia"
            >
              {[0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = 175 - ratio * 145;
                const val = Math.round(maxBarMinutes * ratio);
                return (
                  <g key={ratio}>
                    <line x1="36" y1={y} x2="450" y2={y} className="bar-grid-line" />
                    <text x="30" y={y + 3} textAnchor="end" className="bar-axis-text">
                      {val}m
                    </text>
                  </g>
                );
              })}

              {barData.map((d, idx) => {
                const chartWidth = 408;
                const step = chartWidth / barData.length;
                const barWidth = Math.max(6, Math.min(30, step * 0.56));
                const x = 40 + idx * step + (step - barWidth) / 2;
                const h = Math.max(d.minutes > 0 ? 4 : 2, (d.minutes / maxBarMinutes) * 145);
                const y = 175 - h;
                const showLabel = range === '7d' || idx % 4 === 0 || idx === barData.length - 1;

                return (
                  <g key={d.date}>
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={h}
                      rx={Math.min(5, barWidth / 2)}
                      className={`bar-rect ${d.minutes > 0 ? 'has-value' : ''}`}
                    >
                      <title>
                        {parseLocalDate(d.date).toLocaleDateString('pt-BR')}:{' '}
                        {formatMinutesHuman(d.minutes)}
                      </title>
                    </rect>

                    {range === '7d' && d.minutes > 0 && (
                      <text
                        x={x + barWidth / 2}
                        y={y - 6}
                        textAnchor="middle"
                        className="bar-value-text"
                      >
                        {d.minutes}m
                      </text>
                    )}

                    {showLabel && (
                      <text
                        x={x + barWidth / 2}
                        y={196}
                        textAnchor="middle"
                        className="bar-axis-text"
                      >
                        {d.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        <div
          className="card card-clickable"
          role="button"
          tabIndex={0}
          onClick={onOpenPending}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpenPending();
            }
          }}
          title="Abrir aba de Pendências no Calendário"
        >
          <div className="chart-card-head">
            <div>
              <h3 className="chart-title">Tempo por categoria</h3>
              <span className="chart-sub">Tags adicionadas nas suas pendências</span>
            </div>
            <span className="chart-link-hint">
              <span>Ver pendências</span>
              <ArrowUpRight size={14} />
            </span>
          </div>

          {categoryStats.list.length === 0 ? (
            <div className="empty-state" style={{ marginBlock: 'auto' }}>
              Nenhuma categoria registrada ainda. Adicione uma <strong>Categoria</strong> ao agendar
              suas pendências para visualizar a distribuição aqui.
            </div>
          ) : (
            <div className="category-chart-body">
              <div className="donut-wrap">
                <svg
                  className="donut-svg"
                  viewBox="0 0 140 140"
                  role="img"
                  aria-label="Distribuição de tempo por categoria"
                >
                  <circle
                    cx="70"
                    cy="70"
                    r="52"
                    fill="none"
                    stroke="#1c1c1c"
                    strokeWidth="14"
                  />
                  {(() => {
                    const radius = 52;
                    const circumference = 2 * Math.PI * radius;
                    let cumulative = 0;
                    return categoryStats.list.map((item) => {
                      const pct =
                        categoryStats.totalMinutes > 0
                          ? item.minutes / categoryStats.totalMinutes
                          : 0;
                      const segLength = Math.max(2, pct * circumference - 2);
                      const offset = -cumulative * circumference;
                      cumulative += pct;
                      return (
                        <circle
                          key={item.category}
                          cx="70"
                          cy="70"
                          r={radius}
                          fill="none"
                          stroke={item.tone.accent}
                          strokeWidth="14"
                          strokeLinecap="round"
                          strokeDasharray={`${segLength} ${circumference}`}
                          strokeDashoffset={offset}
                        >
                          <title>
                            {item.category}: {formatMinutesHuman(item.minutes)} (
                            {Math.round(pct * 100)}%)
                          </title>
                        </circle>
                      );
                    });
                  })()}
                </svg>
                <div className="donut-center">
                  <span className="donut-total">
                    {formatMinutesHuman(categoryStats.totalMinutes)}
                  </span>
                  <span className="donut-caption">Total</span>
                </div>
              </div>

              <div className="category-breakdown">
                {categoryStats.list.map((item) => {
                  const pct =
                    categoryStats.totalMinutes > 0
                      ? Math.round((item.minutes / categoryStats.totalMinutes) * 100)
                      : 0;
                  return (
                    <div key={item.category} className="cat-row">
                      <div className="cat-row-top">
                        <span className="cat-row-name">
                          <span
                            className="cat-dot"
                            style={{ background: item.tone.accent }}
                            aria-hidden="true"
                          />
                          {item.category}
                        </span>
                        <span className="cat-row-val">
                          <strong>{formatMinutesHuman(item.minutes)}</strong> · {pct}%
                        </span>
                      </div>
                      <div className="cat-track">
                        <div
                          className="cat-fill"
                          style={{
                            width: `${Math.max(4, pct)}%`,
                            background: item.tone.accent,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="chart-card-head">
          <div>
            <h3 className="chart-title">Sessões recentes</h3>
            <span className="chart-sub">
              {sessions.length} registros · salvos automaticamente (clique no lápis para editar ou
              anotar)
            </span>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className="empty-state">
            Nenhuma sessão registrada ainda. Assim que você estudar pelo menos 1 minuto no{' '}
            <strong>Foco</strong>, o progresso já aparece aqui automaticamente.
          </div>
        ) : (
          <div className="session-list">
            {sessions.slice(0, 20).map((s) => (
              <div key={s.id} className="session-row">
                <div className="session-content">
                  <div className="session-main">
                    <span className="session-tag">{s.label || 'Atividade'}</span>
                    <span
                      className={`session-source ${s.source === 'marathon' ? 'is-marathon' : ''}`}
                    >
                      {s.source === 'marathon'
                        ? 'Maratona'
                        : s.source === 'manual'
                          ? 'Manual'
                          : 'Timer'}
                    </span>
                    {s.source === 'marathon' &&
                      (s.breakCount !== undefined || s.breakMinutes !== undefined) && (
                        <span style={{ fontSize: '0.74rem', color: 'var(--muted-soft)' }}>
                          {s.breakCount && s.breakCount > 0
                            ? `${s.breakCount} ${s.breakCount === 1 ? 'pausa' : 'pausas'}${
                                s.breakMinutes ? ` · ${formatMinutesHuman(s.breakMinutes)} descanso` : ''
                              }`
                            : 'sem pausas'}
                        </span>
                      )}
                  </div>
                  {s.notes && <div className="session-notes">{s.notes}</div>}
                </div>

                <div className="session-right">
                  <span>{parseLocalDate(s.date).toLocaleDateString('pt-BR')}</span>
                  <strong>{formatMinutesHuman(s.durationMinutes)}</strong>
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ padding: 5 }}
                    onClick={() => openEditModal(s)}
                    title="Editar sessão e anotação"
                    aria-label="Editar sessão"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ padding: 5 }}
                    onClick={() => setPendingDeleteSession(s)}
                    title="Excluir sessão"
                    aria-label="Excluir sessão"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={sessionModalOpen}
        onClose={() => setSessionModalOpen(false)}
        title={editingSession ? 'Editar sessão' : 'Registrar atividade manual'}
      >
        <form
          onSubmit={handleSubmitSession}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          <div className="form-grid-2">
            <div className="field">
              <label htmlFor="sess-date">Data</label>
              <input
                id="sess-date"
                type="date"
                className="input"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="sess-mins">Tempo de atividade (min)</label>
              <input
                id="sess-mins"
                type="number"
                className="input"
                min={1}
                max={720}
                value={formMinutes}
                onChange={(e) => setFormMinutes(parseInt(e.target.value, 10) || 1)}
                required
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="sess-label">Atividade</label>
            <input
              id="sess-label"
              type="text"
              className="input"
              value={formLabel}
              onChange={(e) => setFormLabel(e.target.value)}
              placeholder="Ex: Algoritmos, Reunião, Leitura, Projeto..."
              maxLength={60}
            />
          </div>

          <div className="field">
            <label htmlFor="sess-notes">Anotação da sessão (opcional)</label>
            <textarea
              id="sess-notes"
              className="textarea"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="O que você fez, onde parou ou pontos para retomar depois..."
              maxLength={500}
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setSessionModalOpen(false)}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              {editingSession ? 'Salvar alterações' : 'Registrar atividade'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={pendingEditSession !== null}
        onClose={cancelEditConfirmation}
        title="Confirmar edição da sessão?"
      >
        {pendingEditSession && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--muted)' }}>
              Tem certeza que deseja salvar as alterações em{' '}
              <strong style={{ color: 'var(--text)' }}>
                &ldquo;{pendingEditSession.label || 'Atividade'}&rdquo;
              </strong>{' '}
              ({formatMinutesHuman(pendingEditSession.durationMinutes)} em{' '}
              {parseLocalDate(pendingEditSession.date).toLocaleDateString('pt-BR')})?
            </p>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={cancelEditConfirmation}
              >
                Voltar
              </button>
              <button type="button" className="btn btn-primary" onClick={confirmEditSession}>
                Sim, salvar
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={pendingDeleteSession !== null}
        onClose={() => setPendingDeleteSession(null)}
        title="Excluir sessão?"
      >
        {pendingDeleteSession && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--muted)' }}>
              Tem certeza que deseja excluir a sessão{' '}
              <strong style={{ color: 'var(--text)' }}>
                &ldquo;{pendingDeleteSession.label || 'Atividade'}&rdquo;
              </strong>{' '}
              ({formatMinutesHuman(pendingDeleteSession.durationMinutes)} em{' '}
              {parseLocalDate(pendingDeleteSession.date).toLocaleDateString('pt-BR')})? Essa ação
              não pode ser desfeita.
            </p>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPendingDeleteSession(null)}
              >
                Cancelar
              </button>
              <button type="button" className="btn btn-danger" onClick={confirmDeleteSession}>
                Sim, excluir
              </button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
