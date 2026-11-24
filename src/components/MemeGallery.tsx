import { useState } from 'react';
import ImageViewer from './ImageViewer';

interface Meme {
  src: string;
  alt: string;
  caption?: string;
  credit: { name: string; url?: string };
}

/** "My Pictures" thumbnail folder plus an old-school image viewer with prev/next. */
export default function MemeGallery({ memes }: { memes: Meme[] }) {
  const [index, setIndex] = useState<number | null>(null);

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

      {index !== null && (
        <ImageViewer
          images={memes}
          index={index}
          onIndex={setIndex}
          onClose={() => setIndex(null)}
        />
      )}
    </div>
  );
}
