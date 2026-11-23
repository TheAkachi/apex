import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';

export interface SlidingTabItem<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface SlidingTabsProps<T extends string> {
  items: SlidingTabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

export function SlidingTabs<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  className = '',
}: SlidingTabsProps<T>) {
  const barRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const tabRefs = useRef<Map<T, HTMLButtonElement>>(new Map());
  const mountedRef = useRef(false);

  const syncPill = (animate: boolean) => {
    const pill = pillRef.current;
    const activeTab = tabRefs.current.get(value);
    if (!pill || !activeTab) return;

    if (!animate) {
      pill.style.transition = 'none';
    }

    pill.style.transform = `translate3d(${activeTab.offsetLeft}px, ${activeTab.offsetTop}px, 0)`;
    pill.style.width = `${activeTab.offsetWidth}px`;
    pill.style.height = `${activeTab.offsetHeight}px`;

    if (!animate) {
      // Reflow forçado para posicionar sem animação no primeiro paint e resize
      void pill.offsetWidth;
      pill.style.transition = '';
    }
  };

  useLayoutEffect(() => {
    syncPill(mountedRef.current);
    mountedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, items.length]);

  useEffect(() => {
    const handleResize = () => syncPill(false);
    window.addEventListener('resize', handleResize);

    // Garante realinhamento exato assim que as fontes terminarem de carregar
    let cancelled = false;
    if (document.fonts && document.fonts.ready) {
      void document.fonts.ready.then(() => {
        if (!cancelled) syncPill(false);
      });
    }

    const bar = barRef.current;
    let observer: ResizeObserver | null = null;
    if (bar && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => syncPill(false));
      observer.observe(bar);
    }

    return () => {
      cancelled = true;
      window.removeEventListener('resize', handleResize);
      observer?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div ref={barRef} className={`t-tabs ${className}`.trim()} role="tablist" aria-label={ariaLabel}>
      <span ref={pillRef} className="t-tabs-pill" aria-hidden="true" />
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              if (el) tabRefs.current.set(item.value, el);
              else tabRefs.current.delete(item.value);
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            className="t-tab"
            onClick={() => onChange(item.value)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
