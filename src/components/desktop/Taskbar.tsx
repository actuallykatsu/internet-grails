import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { openPlayer, playerStore, togglePlayerMinimized, toggleMuted } from '../../lib/player';
import { SITE } from '../../lib/site';
import PixelIcon from '../icons/PixelIcon';
import type { IconName } from '../icons/pixelIcons';

export interface StartItem {
  label: string;
  icon: IconName;
  /** Opens a desktop window when on the desktop... */
  windowId?: string;
  /** ...or navigates to a real URL... */
  href?: string;
  /** ...or opens the background player (D19). */
  player?: true;
}

/** Start menu entry for the background player, shared by every page. */
export const PLAYER_START_ITEM: StartItem = { label: 'Grail Player', icon: 'player', player: true };

interface Props {
  startItems: StartItem[];
  windows?: { id: string; title: string; active: boolean }[];
  onStartItem?: (item: StartItem) => void;
  onWindowButton?: (id: string) => void;
}

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0); // after hydration, avoids a server/client mismatch
    const t = setInterval(tick, 15_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  return (
    <time className="ig-tray__clock" dateTime={now?.toISOString()}>
      {now ? now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '--:--'}
    </time>
  );
}

export default function Taskbar({ startItems, windows = [], onStartItem, onWindowButton }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const player = useSyncExternalStore(
    playerStore.subscribe,
    playerStore.get,
    playerStore.getServer,
  );
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey);
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <footer className="ig-taskbar">
      <div className="ig-start" ref={menuRef}>
        <button
          type="button"
          className="ig-btn ig-start__btn"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-pressed={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <img className="ig-start__orb" src="/favicon.svg" alt="" width="22" height="22" />
          Start
        </button>
        {menuOpen && (
          <div className="ig-start__menu" role="menu" aria-label="Start menu">
            <div className="ig-start__rail" aria-hidden="true">
              Internet Grails
            </div>
            <ul>
              {startItems.map((item) => (
                <li key={item.label}>
                  {item.player ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        openPlayer();
                      }}
                    >
                      <PixelIcon name={item.icon} size={16} /> {item.label}
                    </button>
                  ) : item.windowId && onStartItem ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        onStartItem(item);
                      }}
                    >
                      <PixelIcon name={item.icon} size={16} /> {item.label}
                    </button>
                  ) : (
                    <a role="menuitem" href={item.href ?? `/?w=${item.windowId}`}>
                      <PixelIcon name={item.icon} size={16} /> {item.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <nav className="ig-taskbar__windows" aria-label="Open windows">
        {windows.map((w) => (
          <button
            key={w.id}
            type="button"
            className="ig-btn ig-taskbar__win"
            aria-pressed={w.active}
            onClick={() => onWindowButton?.(w.id)}
          >
            {w.title}
          </button>
        ))}
        {player.open && (
          <button
            type="button"
            className="ig-btn ig-taskbar__win"
            aria-pressed={!player.minimized}
            onClick={togglePlayerMinimized}
          >
            Grail Player
          </button>
        )}
      </nav>

      <div className="ig-tray">
        <p className="ig-contact-strip ig-tray__contact">
          Official X: <a href={SITE.x.url}>{SITE.x.handle}</a> ·{' '}
          <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
        </p>
        <button
          type="button"
          className="ig-tray__sound"
          aria-label={player.muted ? 'Sound off. Turn sound on' : 'Sound on. Turn sound off'}
          aria-pressed={!player.muted}
          onClick={toggleMuted}
        >
          {player.muted ? '🔇' : '🔊'}
        </button>
        <Clock />
      </div>
    </footer>
  );
}
