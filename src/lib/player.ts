/**
 * Shared state for the background player (D19). The player island persists across
 * page changes (transition:persist); the taskbar, Start menu and desktop icons are
 * re-created on every page and talk to it through this tiny store. ES modules are
 * evaluated once per visit, so the state survives client-side navigation.
 */
export interface PlayerUi {
  open: boolean;
  minimized: boolean;
  muted: boolean;
}

let state: PlayerUi = { open: false, minimized: false, muted: false };
const listeners = new Set<() => void>();

function set(patch: Partial<PlayerUi>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export const playerStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get: () => state,
  /** Server render: the player is always closed. */
  getServer: (): PlayerUi => ({ open: false, minimized: false, muted: false }),
};

export const openPlayer = () => set({ open: true, minimized: false });
export const closePlayer = () => set({ open: false, minimized: false });
export const minimizePlayer = () => set({ minimized: true });
/** Taskbar button: restore when minimized, minimize when showing. */
export const togglePlayerMinimized = () => set({ minimized: !state.minimized });
export const toggleMuted = () => set({ muted: !state.muted });
