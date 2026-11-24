import { useEffect, useState, useSyncExternalStore } from 'react';

/**
 * Phase 0 mockup of the Music section's player (D17). An original skin in the
 * spirit of early-2000s desktop players. No audio yet: playback is simulated
 * until there is a licensed source for tracks (see Open questions).
 */
export interface Track {
  title: string;
  artist: string;
  /** Length in seconds. */
  length: number;
}

const BARS = 24;

function clock(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

const REDUCE = '(prefers-reduced-motion: reduce)';
function subscribeReduce(on: () => void) {
  const mq = window.matchMedia(REDUCE);
  mq.addEventListener('change', on);
  return () => mq.removeEventListener('change', on);
}
const usePrefersReducedMotion = () =>
  useSyncExternalStore(
    subscribeReduce,
    () => window.matchMedia(REDUCE).matches,
    () => false,
  );

/** A calm, fixed bar shape: what the visualizer shows when paused or reduced. */
const RESTING = Array.from({ length: BARS }, (_, i) => 0.18 + 0.5 * Math.sin((i / BARS) * Math.PI));

function pickNext(index: number, count: number, shuffle: boolean) {
  if (!shuffle || count < 2) return (index + 1) % count;
  return (index + 1 + Math.floor(Math.random() * (count - 1))) % count;
}

export default function MediaPlayer({ tracks }: { tracks: Track[] }) {
  // Track and position move together, so the clock can roll over to the next track.
  const [{ index, pos }, setNow] = useState({ index: 0, pos: 0 });
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(70);
  const [shuffle, setShuffle] = useState(false);
  const [walk, setWalk] = useState(RESTING);
  const reduce = usePrefersReducedMotion();
  const track = tracks[index];
  const animate = playing && !reduce;
  const bars = animate ? walk : RESTING;

  const go = (next: number) =>
    setNow({ index: ((next % tracks.length) + tracks.length) % tracks.length, pos: 0 });
  const setPos = (p: number) => setNow((n) => ({ ...n, pos: p }));

  // Simulated playback clock.
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setNow((n) =>
        n.pos + 1 < tracks[n.index].length
          ? { ...n, pos: n.pos + 1 }
          : { index: pickNext(n.index, tracks.length, shuffle), pos: 0 },
      );
    }, 1000);
    return () => window.clearInterval(id);
  }, [playing, shuffle, tracks]);

  // Visualizer: random-walk bars while playing; still under reduced motion.
  useEffect(() => {
    if (!animate) return;
    const id = window.setInterval(() => {
      setWalk((prev) =>
        prev.map((h, i) => {
          const bias = 0.25 + 0.45 * Math.sin((i / BARS) * Math.PI);
          const next = h + (Math.random() - 0.5) * 0.35 + (bias - h) * 0.25;
          return Math.min(1, Math.max(0.05, next));
        }),
      );
    }, 90);
    return () => window.clearInterval(id);
  }, [animate]);

  return (
    <section className="ig-player" aria-label="Media player (mockup)">
      <header className="ig-player__top">
        <span className="ig-player__brand">Grail Player</span>
        <span className="ig-player__led" data-on={playing} aria-hidden="true" />
      </header>

      <div className="ig-player__lcd">
        <div className="ig-player__now" aria-live="polite">
          <span className="ig-player__state">{playing ? '▶' : '❚❚'}</span>
          <span className="ig-player__marquee">
            <span data-scroll={playing && !reduce}>
              {track.artist} – {track.title}
            </span>
          </span>
        </div>
        <div className="ig-player__time">
          {clock(pos)} / {clock(track.length)}
        </div>
        <div className="ig-player__viz" aria-hidden="true">
          {bars.map((h, i) => (
            <span key={i} style={{ transform: `scaleY(${h})` }} />
          ))}
        </div>
      </div>

      <label className="ig-player__seek">
        <span className="sr-only">Seek</span>
        <input
          type="range"
          min={0}
          max={track.length}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
        />
      </label>

      <div className="ig-player__controls">
        <button type="button" className="ig-player__btn" onClick={() => go(index - 1)}>
          <span aria-hidden="true">⏮</span>
          <span className="sr-only">Previous track</span>
        </button>
        <button
          type="button"
          className="ig-player__btn ig-player__btn--play"
          aria-pressed={playing}
          onClick={() => setPlaying((p) => !p)}
        >
          <span aria-hidden="true">{playing ? '⏸' : '▶'}</span>
          <span className="sr-only">{playing ? 'Pause' : 'Play'}</span>
        </button>
        <button
          type="button"
          className="ig-player__btn"
          onClick={() => go(pickNext(index, tracks.length, shuffle))}
        >
          <span aria-hidden="true">⏭</span>
          <span className="sr-only">Next track</span>
        </button>
        <button
          type="button"
          className="ig-player__btn ig-player__btn--small"
          aria-pressed={shuffle}
          onClick={() => setShuffle((s) => !s)}
        >
          Shuffle
        </button>
        <label className="ig-player__vol">
          <span>Vol</span>
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
          />
        </label>
      </div>

      <ol className="ig-player__list" aria-label="Playlist">
        {tracks.map((t, i) => (
          <li key={t.title}>
            <button
              type="button"
              aria-current={i === index ? 'true' : undefined}
              onClick={() => {
                go(i);
                setPlaying(true);
              }}
            >
              <span>
                {i + 1}. {t.artist} – {t.title}
              </span>
              <span>{clock(t.length)}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
