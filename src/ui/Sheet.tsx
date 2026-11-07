import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { PixelIcon } from './PixelIcon';

interface SheetProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** called on swipe-down or close button; omit to make the sheet non-dismissable */
  onDismiss?: () => void;
  footer?: ReactNode;
  children: ReactNode;
  /** full = covers the whole screen */
  size?: 'full' | 'auto';
  className?: string;
}

const DISMISS_DISTANCE = 110;

/** Bottom sheet / full-screen dialog. Swipe down on the header to dismiss ("Wegwischen"). */
export function Sheet({ title, subtitle, onDismiss, footer, children, size = 'full', className }: SheetProps) {
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);

  const onPointerDown = (e: PointerEvent) => {
    if (!onDismiss) return;
    start.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (start.current === null) return;
    setDrag(Math.max(0, e.clientY - start.current));
  };
  const onPointerUp = () => {
    if (start.current === null) return;
    start.current = null;
    if (drag > DISMISS_DISTANCE) onDismiss?.();
    setDrag(0);
  };

  return (
    <div className="sheet-backdrop" style={{ opacity: Math.max(0.3, 1 - drag / 400) }}>
      <div
        className={`sheet sheet-${size} ${className ?? ''}`}
        style={{ transform: drag ? `translateY(${drag}px)` : undefined, transition: drag ? 'none' : undefined }}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="sheet-header"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {onDismiss && <div className="sheet-grabber" aria-hidden />}
          <div className="sheet-titles">
            <h2 className="display">{title}</h2>
            {subtitle && <div className="sheet-subtitle">{subtitle}</div>}
          </div>
          {onDismiss && (
            <button
              className="icon-btn sheet-close"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onDismiss}
              aria-label="Schließen"
            >
              <PixelIcon name="close" size={14} />
            </button>
          )}
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </div>
  );
}

interface ModalProps {
  title?: ReactNode;
  children: ReactNode;
  actions: ReactNode;
  className?: string;
  /** decoration rendered behind the dialog (e.g. level-up rays) */
  effect?: ReactNode;
}

/** Small centred dialog */
export function Modal({ title, children, actions, className, effect }: ModalProps) {
  return (
    <div className="modal-backdrop">
      {effect}
      <div className={`modal ${className ?? ''}`} role="dialog" aria-modal="true">
        {title && <h2 className="display modal-title">{title}</h2>}
        <div className="modal-body">{children}</div>
        <div className="modal-actions">{actions}</div>
      </div>
    </div>
  );
}
