import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  const [rendered, setRendered] = useState(open);
  const [stateClass, setStateClass] = useState<'is-open' | 'is-closing' | ''>('');

  useEffect(() => {
    if (open) {
      setRendered(true);
      const raf = requestAnimationFrame(() => setStateClass('is-open'));
      return () => cancelAnimationFrame(raf);
    }

    if (!rendered) return;
    setStateClass('is-closing');
    const closeMs =
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--modal-close-dur')
      ) || 150;

    const timer = window.setTimeout(() => {
      setStateClass('');
      setRendered(false);
    }, closeMs);

    return () => window.clearTimeout(timer);
  }, [open, rendered]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!rendered) return null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal-panel t-modal ${stateClass}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
