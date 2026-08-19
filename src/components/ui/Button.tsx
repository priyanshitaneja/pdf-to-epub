import type { ReactNode } from 'react';

export interface ButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'quiet';
  children: ReactNode;
  type?: 'button' | 'submit';
  /**
   * Stretches the button to fill its container, capped at 24rem. For the one or two actions that
   * carry a whole step, where shrink-to-fit reads as incidental next to a full-width dropzone.
   */
  wide?: boolean;
}

/**
 * Solid near-black primary action, 6px radius, no shadow, `scale(0.98)` on press — per the taste
 * protocol. `quiet` is the same geometry with a hairline border instead of a fill.
 */
export function Button({
  onClick,
  disabled,
  variant = 'primary',
  children,
  type = 'button',
  wide = false,
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm transition-[background-color,transform,border-color] duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40';
  const skin =
    variant === 'primary'
      ? 'bg-action text-canvas hover:bg-action-hover'
      : 'border border-line bg-surface hover:border-line-strong';
  /*
   * Full width on small screens for a comfortable tap target, capped from there. The cap matters
   * for the same reason the page container is capped: a button spanning 70% of an ultrawide
   * display stops reading as a button.
   */
  const width = wide ? 'w-full max-w-sm' : '';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={[base, skin, width].filter(Boolean).join(' ')}
    >
      {children}
    </button>
  );
}
