import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { DEFAULT_CATEGORIES, type CalendarEvent } from '../../types/models';
import { getCategoryTone } from '../../utils/categoryStyle';
import {
  addMinutesToTime,
  crossesMidnight,
  diffTimeMinutes,
  formatMinutesHuman,
  uid,
} from '../../utils/date';
import { Modal } from '../ui/Modal';
import { TimePicker } from '../ui/TimePicker';
import { Toggle } from '../ui/Toggle';

interface EventModalProps {
  open: boolean;
  onClose: () => void;
  editingEvent: CalendarEvent | null;
  defaultDate: string;
  defaultStartTime?: string;
  customCategories: string[];
  onSaveEvent: (event: CalendarEvent) => void;
  onDeleteEvent?: (id: string) => void;
  onAddCustomCategory: (category: string) => void;
}

export function EventModal({
  open,
  onClose,
  editingEvent,
  defaultDate,
  defaultStartTime = '09:00',
  customCategories,
  onSaveEvent,
  onDeleteEvent,
  onAddCustomCategory,
}: EventModalProps) {
  const [eventDate, setEventDate] = useState(defaultDate);
  const [eventTitle, setEventTitle] = useState('');
  const [eventCategory, setEventCategory] = useState('');
  const [customCategoryDraft, setCustomCategoryDraft] = useState('');
  const [saveAsNewCategory, setSaveAsNewCategory] = useState(false);
  const [eventStartTime, setEventStartTime] = useState(defaultStartTime);
  const [eventEndTime, setEventEndTime] = useState(() => addMinutesToTime(defaultStartTime, 60));
  const [eventReminder, setEventReminder] = useState('10');

  const availableCategories = useMemo(() => {
    const merged: string[] = [...DEFAULT_CATEGORIES];
    for (const c of customCategories) {
      if (!merged.some((item) => item.toLowerCase() === c.toLowerCase())) {
        merged.push(c);
      }
    }
    return merged;
  }, [customCategories]);

  useEffect(() => {
    if (!open) return;

    if (editingEvent) {
      setEventDate(editingEvent.date);
      setEventTitle(editingEvent.title);
      const cat = editingEvent.category ?? '';
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
      setEventStartTime(editingEvent.time);
      setEventEndTime(
        editingEvent.endTime || addMinutesToTime(editingEvent.time, editingEvent.durationMinutes)
      );
      setEventReminder(
        editingEvent.reminderMinutesBefore === null
          ? 'none'
          : String(editingEvent.reminderMinutesBefore)
      );
    } else {
      setEventDate(defaultDate);
      setEventTitle('');
      setEventCategory('');
      setCustomCategoryDraft('');
      setSaveAsNewCategory(false);
      setEventStartTime(defaultStartTime);
      setEventEndTime(addMinutesToTime(defaultStartTime, 60));
      setEventReminder('10');
    }
  }, [open, editingEvent, defaultDate, defaultStartTime, availableCategories]);

  const computedDuration = diffTimeMinutes(eventStartTime, eventEndTime);
  const endsNextDay = crossesMidnight(eventStartTime, eventEndTime);

  const handleStartTimeChange = (nextStart: string) => {
    const currentDur = diffTimeMinutes(eventStartTime, eventEndTime);
    setEventStartTime(nextStart);
    if (nextStart) {
      const keepDuration = currentDur > 0 ? currentDur : 60;
      setEventEndTime(addMinutesToTime(nextStart, keepDuration));
    }
  };

  const handleSubmit = (e: FormEvent) => {
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
        notifiedAt:
          editingEvent.date !== eventDate || editingEvent.time !== eventStartTime
            ? undefined
            : editingEvent.notifiedAt,
      });
    } else {
      onSaveEvent({
        id: uid('evt'),
        date: eventDate || defaultDate,
        time: eventStartTime,
        endTime: eventEndTime,
        title,
        category: resolvedCategory,
        durationMinutes: Math.min(480, computedDuration),
        reminderMinutesBefore,
        completed: false,
      });
    }

    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingEvent ? 'Editar bloco / aviso' : 'Nova pendência / aviso'}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
              onClick={() => setEventCategory(eventCategory === '__other__' ? '' : '__other__')}
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
              <span>Duração prevista{endsNextDay ? ' (termina no dia seguinte)' : ''}</span>
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

        <div
          className="modal-actions"
          style={{ justifyContent: editingEvent && onDeleteEvent ? 'space-between' : 'flex-end' }}
        >
          {editingEvent && onDeleteEvent && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                onDeleteEvent(editingEvent.id);
                onClose();
              }}
            >
              <Trash2 size={15} />
              <span>Excluir</span>
            </button>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={computedDuration < 1}>
              {editingEvent ? 'Salvar alterações' : 'Salvar pendência'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
