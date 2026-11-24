import { useEffect } from 'react';

export interface ViewerImage {
  src: string;
  alt: string;
  caption?: string;
  credit?: { name: string; url?: string };
}

interface Props {
  images: ViewerImage[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}

/** The old-school image viewer: a modal window with prev/next. Arrow keys and Esc work. */
export default function ImageViewer({ images, index, onIndex, onClose }: Props) {
  const count = images.length;
  const current = images[index];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (count < 2) return;
      if (e.key === 'ArrowRight') onIndex((index + 1) % count);
      if (e.key === 'ArrowLeft') onIndex((index - 1 + count) % count);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, count, onIndex, onClose]);

  if (!current) return null;

  return (
    <div
      className="ig-viewer"
      role="dialog"
      aria-label="Image viewer"
      aria-modal="true"
      onKeyDown={(e) => {
        // Close just the viewer, not the desktop window it sits in.
        if (e.key !== 'Escape') return;
        e.stopPropagation();
        onClose();
      }}
    >
      <div className="ig-window" data-active="true">
        <div className="ig-titlebar">
          <span className="ig-titlebar__title">
            Image Viewer ({index + 1} of {count})
          </span>
          <button
            className="ig-titlebar__btn"
            type="button"
            aria-label="Close"
            autoFocus
            onClick={onClose}
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
            disabled={count < 2}
            onClick={() => onIndex((index - 1 + count) % count)}
          >
            ◀ Prev
          </button>
          <p>
            {current.caption}
            {current.caption && current.credit && ' · '}
            {current.credit && (
              <>
                Credit:{' '}
                {current.credit.url ? (
                  <a href={current.credit.url} rel="noopener" target="_blank">
                    {current.credit.name}
                  </a>
                ) : (
                  current.credit.name
                )}
              </>
            )}
          </p>
          <button
            className="ig-btn"
            type="button"
            disabled={count < 2}
            onClick={() => onIndex((index + 1) % count)}
          >
            Next ▶
          </button>
        </div>
      </div>
    </div>
  );
}
