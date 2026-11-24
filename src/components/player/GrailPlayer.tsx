import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as RPointerEvent,
} from 'react';
import { closePlayer, minimizePlayer, openPlayer, playerStore } from '../../lib/player';
import { usePrefersReducedMotion } from '../../lib/motion';
import type { Track } from '../../lib/tracks';

/**
 * The background player (D19): an original skin in the spirit of early-2000s desktop
 * players. It lives in Base.astro with transition:persist, so it keeps playing while
 * visitors move between pages. Tracks with `src` play real audio; placeholders fake
 * playback. On narrow screens a minimized player becomes a mini bar.
 */

const BARS = 24;

function clock(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

/** A calm, fixed bar shape: what the visualizer shows when paused or reduced. */
const RESTING = Array.from({ length: BARS }, (_, i) => 0.18 + 0.5 * Math.sin((i / BARS) * Math.PI));

function pickNext(index: number, count: number, shuffle: boolean) {
  if (!shuffle || count < 2) return (index + 1) % count;
  return (index + 1 + Math.floor(Math.random() * (count - 1))) % count;
}

export default function GrailPlayer({ tracks }: { tracks: Track[] }) {
  const ui = useSyncExternalStore(playerStore.subscribe, playerStore.get, playerStore.getServer);
  // Track and position move together, so the clock can roll over to the next track.
  const [{ index, pos }, setNow] = useState({ index: 0, pos: 0 });
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(70);
  const [shuffle, setShuffle] = useState(false);
  const [lengths, setLengths] = useState<Record<number, number>>({});
  const [walk, setWalk] = useState(RESTING);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const reduce = usePrefersReducedMotion();

  const track = tracks[index];
  const length = lengths[index] ?? track.length;
  const animate = playing && !reduce && ui.open;
  const bars = animate ? walk : RESTING;

  const go = (next: number) =>
    setNow({ index: ((next % tracks.length) + tracks.length) % tracks.length, pos: 0 });
  const next = () => go(pickNext(index, tracks.length, shuffle));
  const seek = (p: number) => {
    if (track.src && audio.current) audio.current.currentTime = p;
    setNow((n) => ({ ...n, pos: p }));
  };

  // Real audio: follow the play state, track and volume.
  useEffect(() => {
    const el = audio.current;
    if (!el || !track.src) return;
    if (playing) el.play().catch(() => setPlaying(false));
    else el.pause();
  }, [playing, track.src, index]);

  useEffect(() => {
    if (audio.current) audio.current.volume = ui.muted ? 0 : volume / 100;
  }, [volume, ui.muted]);

  // Placeholder tracks: a simulated clock.
  useEffect(() => {
    if (!playing || track.src) return;
    const id = window.setInterval(() => {
      setNow((n) =>
        n.pos + 1 < tracks[n.index].length
          ? { ...n, pos: n.pos + 1 }
          : { index: pickNext(n.index, tracks.length, shuffle), pos: 0 },
      );
    }, 1000);
    return () => window.clearInterval(id);
  }, [playing, shuffle, tracks, track.src]);

  // Visualizer: random-walk bars while playing; still under reduced motion.
  useEffect(() => {
    if (!animate) return;
    const id = window.setInterval(() => {
      setWalk((prev) =>
        prev.map((h, i) => {
          const bias = 0.25 + 0.45 * Math.sin((i / BARS) * Math.PI);
          const n = h + (Math.random() - 0.5) * 0.35 + (bias - h) * 0.25;
          return Math.min(1, Math.max(0.05, n));
        }),
      );
    }, 90);
    return () => window.clearInterval(id);
  }, [animate]);

  const onGrab = (e: RPointerEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('button') || window.innerWidth < 700) return;
    const box = e.currentTarget.closest('.ig-player')!.getBoundingClientRect();
    drag.current = { dx: e.clientX - box.left, dy: e.clientY - box.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onDrag = (e: RPointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    setAt({
      x: Math.max(-200, Math.min(window.innerWidth - 80, e.clientX - drag.current.dx)),
      y: Math.max(0, Math.min(window.innerHeight - 80, e.clientY - drag.current.dy)),
    });
  };
  const onDrop = () => {
    drag.current = null;
  };

  const playButton = (
    <button
      type="button"
      className="ig-player__btn ig-player__btn--play"
      aria-pressed={playing}
      onClick={() => setPlaying((p) => !p)}
    >
      <span aria-hidden="true">{playing ? '⏸' : '▶'}</span>
      <span className="sr-only">{playing ? 'Pause' : 'Play'}</span>
    </button>
  );
  const nextButton = (
    <button type="button" className="ig-player__btn" onClick={next}>
      <span aria-hidden="true">⏭</span>
      <span className="sr-only">Next track</span>
    </button>
  );

  return (
    <>
      <audio
        ref={audio}
        src={track.src}
        preload="none"
        onTimeUpdate={(e) => setNow((n) => ({ ...n, pos: e.currentTarget.currentTime }))}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d)) setLengths((l) => ({ ...l, [index]: d }));
        }}
        onEnded={next}
      />

      {ui.open && (
        <section
          className="ig-player ig-player--floating"
          aria-label="Grail Player"
          hidden={ui.minimized}
          style={at ? { left: at.x, top: at.y, right: 'auto', bottom: 'auto' } : undefined}
          onKeyDown={(e) => {
            if (e.key === 'Escape') minimizePlayer();
          }}
        >
          <header
            className="ig-player__top"
            onPointerDown={onGrab}
            onPointerMove={onDrag}
            onPointerUp={onDrop}
            onPointerCancel={onDrop}
          >
            <span className="ig-player__brand">Grail Player</span>
            <span className="ig-player__led" data-on={playing} aria-hidden="true" />
            <button
              type="button"
              className="ig-player__win-btn"
              aria-label="Minimize player"
              onClick={minimizePlayer}
            >
              _
            </button>
            <button
              type="button"
              className="ig-player__win-btn"
              aria-label="Close player"
              onClick={() => {
                setPlaying(false);
                closePlayer();
              }}
            >
              ×
            </button>
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
              {clock(pos)} / {clock(length)}
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
              max={Math.floor(length)}
              value={Math.floor(pos)}
              onChange={(e) => seek(Number(e.target.value))}
            />
          </label>

          <div className="ig-player__controls">
            <button type="button" className="ig-player__btn" onClick={() => go(index - 1)}>
              <span aria-hidden="true">⏮</span>
              <span className="sr-only">Previous track</span>
            </button>
            {playButton}
            {nextButton}
            <button
              type="button"
              className="ig-player__btn ig-player__btn--small"
              aria-pressed={shuffle}
              onClick={() => setShuffle((s) => !s)}
            >
              Shuffle
            </button>
            <label className="ig-player__vol">
              <span>{ui.muted ? 'Muted' : 'Vol'}</span>
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
                  <span>{clock(lengths[i] ?? t.length)}</span>
                </button>
              </li>
            ))}
          </ol>
          {tracks.every((t) => !t.src) && (
            <p className="ig-player__note">Placeholder tracks: no sound yet.</p>
          )}
        </section>
      )}

      {ui.open && ui.minimized && (
        <div className="ig-player-mini" role="region" aria-label="Now playing">
          <button type="button" className="ig-player-mini__title" onClick={openPlayer}>
            {track.artist} – {track.title}
          </button>
          {playButton}
          {nextButton}
        </div>
      )}
    </>
  );
}
