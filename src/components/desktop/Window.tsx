import { useRef, type ReactNode, type PointerEvent as RPointerEvent } from 'react';
import type { WinState } from './useWindowManager';

interface Props {
  win: WinState;
  z: number;
  active: boolean;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onToggleMax: () => void;
  onMove: (x: number, y: number) => void;
  children: ReactNode;
}

export default function Window({
  win,
  z,
  active,
  onFocus,
  onClose,
  onMinimize,
  onToggleMax,
  onMove,
  children,
}: Props) {
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (win.maximized || (e.target as HTMLElement).closest('button')) return;
    drag.current = { dx: e.clientX - win.x, dy: e.clientY - win.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const maxX = window.innerWidth - 80;
    const maxY = window.innerHeight - 80;
    onMove(
      Math.max(-win.w + 80, Math.min(maxX, e.clientX - drag.current.dx)),
      Math.max(0, Math.min(maxY, e.clientY - drag.current.dy)),
    );
  };
  const endDrag = () => {
    drag.current = null;
  };

  const style = win.maximized
    ? { left: 0, top: 0, width: '100%', height: 'calc(100% - var(--ig-taskbar-h))', zIndex: z }
    : { left: win.x, top: win.y, width: win.w, height: win.h, zIndex: z };

  return (
    <section
      className="ig-window ig-desk-window"
      role="dialog"
      aria-label={win.title}
      data-active={active}
      data-window-id={win.id}
      hidden={win.minimized}
      style={style}
      onPointerDownCapture={onFocus}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div
        className="ig-titlebar"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={onToggleMax}
        style={{ cursor: win.maximized ? 'default' : 'move', touchAction: 'none' }}
      >
        <span className="ig-titlebar__title">{win.title}</span>
        <button
          className="ig-titlebar__btn"
          type="button"
          aria-label="Minimize"
          onClick={onMinimize}
        >
          _
        </button>
        <button
          className="ig-titlebar__btn"
          type="button"
          aria-label={win.maximized ? 'Restore' : 'Maximize'}
          onClick={onToggleMax}
        >
          {win.maximized ? '❐' : '□'}
        </button>
        <button className="ig-titlebar__btn" type="button" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="ig-window__body">{children}</div>
    </section>
  );
}
