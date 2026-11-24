import { useEffect, useState } from 'react';

interface Meme {
  src: string;
  alt: string;
  caption?: string;
  credit: { name: string; url?: string };
}

/** "My Pictures" thumbnail folder plus an old-school image viewer with prev/next. */
export default function MemeGallery({ memes }: { memes: Meme[] }) {
  const [index, setIndex] = useState<number | null>(null);
  const current = index === null ? null : memes[index];

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIndex(null);
      if (e.key === 'ArrowRight') setIndex((i) => (i === null ? i : (i + 1) % memes.length));
      if (e.key === 'ArrowLeft')
        setIndex((i) => (i === null ? i : (i - 1 + memes.length) % memes.length));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, memes.length]);

  return (
    <div className="ig-gallery">
      <ul className="ig-gallery__grid">
        {memes.map((m, i) => (
          <li key={m.src}>
            <button type="button" onClick={() => setIndex(i)}>
              <img src={m.src} alt={m.alt} loading="lazy" />
              <span>{m.caption ?? `meme_${String(i + 1).padStart(3, '0')}.jpg`}</span>
            </button>
          </li>
        ))}
      </ul>

      {current && index !== null && (
        <div className="ig-viewer" role="dialog" aria-label="Image viewer" aria-modal="true">
          <div className="ig-window" data-active="true">
            <div className="ig-titlebar">
              <span className="ig-titlebar__title">
                Image Viewer ({index + 1} of {memes.length})
              </span>
              <button
                className="ig-titlebar__btn"
                type="button"
                aria-label="Close"
                autoFocus
                onClick={() => setIndex(null)}
              >
                ×
              </button>
            </div>
            <div className="ig-viewer__stage">
              <img src={current.src} alt={current.alt} />
            </div>
            <div className="ig-viewer__bar">
              <button
                className="ig-btn"
                type="button"
                onClick={() => setIndex((index - 1 + memes.length) % memes.length)}
              >
                ◀ Prev
              </button>
              <p>
                {current.caption && <>{current.caption} · </>}
                Credit:{' '}
                {current.credit.url ? (
                  <a href={current.credit.url} rel="noopener" target="_blank">
                    {current.credit.name}
                  </a>
                ) : (
                  current.credit.name
                )}
              </p>
              <button
                className="ig-btn"
                type="button"
                onClick={() => setIndex((index + 1) % memes.length)}
              >
                Next ▶
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
