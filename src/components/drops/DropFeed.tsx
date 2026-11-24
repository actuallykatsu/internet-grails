import { useState } from 'react';
import XPost from './XPost';
import ImageViewer, { type ViewerImage } from '../ImageViewer';
import type { Drop } from '../../lib/drop';

/** A column of drops with one shared image viewer (D25). */
export default function DropFeed({ drops, empty }: { drops: Drop[]; empty?: string }) {
  const [open, setOpen] = useState<{ images: ViewerImage[]; index: number } | null>(null);

  if (!drops.length) return <p>{empty ?? 'Nothing here yet. Check back soon.'}</p>;

  const openPhoto = (drop: Drop, index: number) => {
    const post = drop.post;
    if (!post) return;
    const credit = { name: post.author.handle, url: drop.url };
    const images = post.media.flatMap((m) =>
      m.type === 'photo' ? [{ src: m.url, alt: m.alt ?? '', caption: post.text, credit }] : [],
    );
    setOpen({ images, index });
  };

  return (
    <div className="ig-dropfeed">
      {drops.map((drop) => (
        <XPost key={drop.id} drop={drop} onOpenPhoto={openPhoto} />
      ))}
      {open && (
        <ImageViewer
          images={open.images}
          index={open.index}
          onIndex={(index) => setOpen({ ...open, index })}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
