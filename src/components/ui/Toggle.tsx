import { useState } from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}

export function Toggle({ checked, onChange, ariaLabel }: ToggleProps) {
  const [interacted, setInteracted] = useState(false);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      data-on={checked ? 'true' : 'false'}
      className={`t-toggle ${interacted ? 'is-init' : ''}`.trim()}
      onClick={() => {
        setInteracted(true);
        onChange(!checked);
      }}
    >
      <span className="t-toggle-thumb" />
    </button>
  );
}
