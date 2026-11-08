import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders overlays (sheets, modals, chest opening) directly into <body>.
 * iOS Safari clips / layers fixed elements that live inside the scrolling `.content` area,
 * so a sheet opened from a screen only showed partly (feedback Phase 4).
 */
export function Portal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}
