import { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import './TimePicker.css';

interface TimePickerProps {
  id?: string;
  value: string;
  onChange: (nextHHMM: string) => void;
  ariaLabel?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

function normalizeHHMM(raw: string, fallback: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 0) return fallback;
  let h = 0;
  let m = 0;
  if (digits.length <= 2) {
    h = parseInt(digits, 10) || 0;
  } else if (digits.length === 3) {
    h = parseInt(digits.slice(0, 1), 10) || 0;
    m = parseInt(digits.slice(1, 3), 10) || 0;
  } else {
    h = parseInt(digits.slice(0, 2), 10) || 0;
    m = parseInt(digits.slice(2, 4), 10) || 0;
  }
  const safeH = Math.max(0, Math.min(23, h));
  const safeM = Math.max(0, Math.min(59, m));
  return `${String(safeH).padStart(2, '0')}:${String(safeM).padStart(2, '0')}`;
}

export function TimePicker({ id, value, onChange, ariaLabel }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const rootRef = useRef<HTMLDivElement>(null);
  const hourColRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Centraliza a hora selecionada ao abrir o popover
  useEffect(() => {
    if (!open || !hourColRef.current) return;
    const [hh] = value.split(':');
    const idx = parseInt(hh, 10);
    if (Number.isFinite(idx)) {
      hourColRef.current.scrollTop = Math.max(0, idx * 32 - 64);
    }
  }, [open, value]);

  const [currentH = '09', currentM = '00'] = value.split(':');

  const commitDraft = () => {
    const normalized = normalizeHHMM(draft, value);
    setDraft(normalized);
    if (normalized !== value) {
      onChange(normalized);
    }
  };

  return (
    <div ref={rootRef} className="tp-root">
      <div className={`tp-input-wrap ${open ? 'is-open' : ''}`}>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          className="tp-text-input"
          value={draft}
          onChange={(e) => {
            const clean = e.target.value.replace(/[^0-9:]/g, '').slice(0, 5);
            setDraft(clean);
            if (/^\d{2}:\d{2}$/.test(clean)) {
              const normalized = normalizeHHMM(clean, value);
              if (normalized !== value) onChange(normalized);
            }
          }}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitDraft();
              setOpen(false);
            }
          }}
          placeholder="09:00"
          aria-label={ariaLabel}
        />
        <button
          type="button"
          className="tp-trigger"
          onClick={() => setOpen((o) => !o)}
          aria-label="Escolher horário"
          aria-expanded={open}
        >
          <Clock size={15} />
        </button>
      </div>

      {open && (
        <div className="tp-popover" role="dialog" aria-label="Seletor de horário">
          <div className="tp-cols-head">
            <span>Hora</span>
            <span>Min</span>
          </div>
          <div className="tp-cols">
            <div ref={hourColRef} className="tp-col">
              {HOURS.map((h) => (
                <button
                  key={h}
                  type="button"
                  className={`tp-option ${h === currentH ? 'is-selected' : ''}`}
                  onClick={() => onChange(`${h}:${currentM}`)}
                >
                  {h}
                </button>
              ))}
            </div>
            <div className="tp-col">
              {MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`tp-option ${m === currentM ? 'is-selected' : ''}`}
                  onClick={() => {
                    onChange(`${currentH}:${m}`);
                    setOpen(false);
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
