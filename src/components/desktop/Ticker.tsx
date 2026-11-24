import { useEffect, useState } from 'react';
import { usePrefersReducedMotion } from '../../lib/motion';
import type { TickerItem } from '../../lib/ticker';

/**
 * The system-tray ticker for breaking posts and the latest drops (D23, D32). Headlines scroll right to left and
 * stop while hovered, focused or paused with its button. With reduced motion it shows
 * one headline at a time and swaps every few seconds instead of scrolling. On phones it
 * sits in the status bar.
 */

const SWAP_MS = 6000;

export default function Ticker({ items }: { items: TickerItem[] }) {
  const reduce = usePrefersReducedMotion();
  const [paused, setPaused] = useState(false);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!reduce || paused || items.length < 2) return;
    const id = window.setInterval(() => setShown((i) => (i + 1) % items.length), SWAP_MS);
    return () => window.clearInterval(id);
  }, [reduce, paused, items.length]);

  if (!items.length) return null;

  const chars = items.reduce((n, it) => n + it.title.length + 4, 0);
  const list = (copy: boolean) => (
    <span className="ig-ticker__run" aria-hidden={copy || undefined}>
      {items.map((it) => (
        <span key={it.href} className="ig-ticker__item">
          <a href={it.href} tabIndex={copy ? -1 : undefined}>
            {it.title}
          </a>
          <span aria-hidden="true"> ◆ </span>
        </span>
      ))}
    </span>
  );
  const current = items[shown % items.length];
  const breaking = items.some((it) => it.kind === 'breaking');

  return (
    <section
      className="ig-ticker"
      aria-label={breaking ? 'Breaking news' : 'New drops'}
      data-paused={paused || undefined}
    >
      <span className="ig-ticker__label" aria-hidden="true">
        {breaking ? 'Breaking' : 'New'}
      </span>
      <div className="ig-ticker__window">
        {reduce ? (
          <a className="ig-ticker__still" href={current.href}>
            {current.title}
          </a>
        ) : (
          <div
            className="ig-ticker__track"
            style={{ animationDuration: `${Math.max(14, Math.round(chars * 0.22))}s` }}
          >
            {list(false)}
            {list(true)}
          </div>
        )}
      </div>
      {(!reduce || items.length > 1) && (
        <button
          type="button"
          className="ig-ticker__pause"
          aria-label={paused ? 'Resume ticker' : 'Pause ticker'}
          aria-pressed={paused}
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? '▶' : '❚❚'}
        </button>
      )}
    </section>
  );
}
