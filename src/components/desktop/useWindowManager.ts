import { useCallback, useEffect, useState } from 'react';

export interface WinState {
  id: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minimized: boolean;
  maximized: boolean;
}

export interface WinSpec {
  id: string;
  title: string;
  w?: number;
  h?: number;
}

const URL_PARAM = 'w';

function readUrlWindows(): string[] {
  const v = new URLSearchParams(window.location.search).get(URL_PARAM);
  return v ? v.split(',').filter(Boolean) : [];
}

function writeUrlWindows(ids: string[]) {
  const url = new URL(window.location.href);
  if (ids.length) url.searchParams.set(URL_PARAM, ids.join(','));
  else url.searchParams.delete(URL_PARAM);
  window.history.replaceState(window.history.state, '', url);
}

/**
 * Window manager state: open, focus order (last = top), drag position,
 * minimize to taskbar, maximize, close. Open windows are mirrored into
 * ?w=a,b so any desktop arrangement can be linked to.
 */
export function useWindowManager(resolve: (id: string) => WinSpec | undefined) {
  const [wins, setWins] = useState<WinState[]>([]);

  const open = useCallback(
    (id: string) => {
      setWins((prev) => {
        const existing = prev.find((w) => w.id === id);
        if (existing) {
          return [...prev.filter((w) => w.id !== id), { ...existing, minimized: false }];
        }
        const spec = resolve(id);
        if (!spec) return prev;
        const n = prev.length;
        const vw = window.innerWidth;
        const narrow = vw < 700;
        const w = Math.min(spec.w ?? 520, vw - 24);
        const h = Math.min(spec.h ?? 420, window.innerHeight - 100);
        return [
          ...prev,
          {
            id,
            title: spec.title,
            w,
            h,
            x: Math.max(12, Math.min(140 + n * 28, vw - w - 12)),
            y: 40 + n * 28,
            minimized: false,
            maximized: narrow,
          },
        ];
      });
    },
    [resolve],
  );

  const close = useCallback((id: string) => {
    setWins((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const focus = useCallback((id: string) => {
    setWins((prev) => {
      const target = prev.find((w) => w.id === id);
      if (!target || prev[prev.length - 1]?.id === id) return prev;
      return [...prev.filter((w) => w.id !== id), target];
    });
  }, []);

  const patch = useCallback((id: string, p: Partial<WinState>) => {
    setWins((prev) => prev.map((w) => (w.id === id ? { ...w, ...p } : w)));
  }, []);

  const minimize = useCallback((id: string) => patch(id, { minimized: true }), [patch]);
  const toggleMax = useCallback(
    (id: string) =>
      setWins((prev) => prev.map((w) => (w.id === id ? { ...w, maximized: !w.maximized } : w))),
    [],
  );
  const moveTo = useCallback((id: string, x: number, y: number) => patch(id, { x, y }), [patch]);

  // Taskbar click: focus if hidden or behind, minimize if already on top.
  const taskbarToggle = useCallback((id: string) => {
    setWins((prev) => {
      const target = prev.find((w) => w.id === id);
      if (!target) return prev;
      const top = [...prev].reverse().find((w) => !w.minimized);
      if (top?.id === id) return prev.map((w) => (w.id === id ? { ...w, minimized: true } : w));
      return [...prev.filter((w) => w.id !== id), { ...target, minimized: false }];
    });
  }, []);

  // Restore windows named in the URL on first load.
  useEffect(() => {
    readUrlWindows().forEach(open);
  }, [open]);

  useEffect(() => {
    writeUrlWindows(wins.map((w) => w.id));
  }, [wins]);

  const activeId = [...wins].reverse().find((w) => !w.minimized)?.id ?? null;

  return { wins, activeId, open, close, focus, minimize, toggleMax, moveTo, taskbarToggle };
}
