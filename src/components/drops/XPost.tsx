import { useState, type ReactNode } from 'react';
import XEmbed from './XEmbed';
import GrailButton from '../GrailButton';
import {
  dropAnchor,
  dropHeadline,
  dropHref,
  formatDropTime,
  type Drop,
  type DropMedia,
} from '../../lib/drop';
import { usePrefersReducedMotion } from '../../lib/motion';

/**
 * One drop drawn in the site's own style (D25): a little window with the post's text,
 * photos and video, served from X's media servers. Photos open in the image viewer.
 * If we have no copy of the post, or its media fails to load (say the post was
 * deleted), it shows X's official embed instead.
 */

interface Props {
  drop: Drop;
  onOpenPhoto?: (drop: Drop, index: number) => void;
}

const URL_RE = /(https?:\/\/[^\s]+)/g;

/** Plain text with its links made clickable. */
function linkify(text: string): ReactNode[] {
  return text.split(URL_RE).map((part, i) =>
    i % 2 ? (
      <a key={i} href={part} rel="noopener nofollow" target="_blank">
        {part.replace(/^https?:\/\/(www\.)?/, '')}
      </a>
    ) : (
      part
    ),
  );
}

function Media({
  media,
  label,
  onPhoto,
  onError,
}: {
  media: DropMedia[];
  label: string;
  onPhoto: (index: number) => void;
  onError: () => void;
}) {
  const reduce = usePrefersReducedMotion();
  const photos = media.filter((m) => m.type === 'photo');
  return (
    <div className="ig-xpost__media" data-count={media.length}>
      {media.map((m, i) => {
        const ratio = `${m.w} / ${m.h}`;
        if (m.type === 'photo') {
          const n = photos.indexOf(m);
          return (
            <button
              key={m.url}
              type="button"
              className="ig-xpost__photo"
              aria-label={`Open image ${n + 1}${m.alt ? `: ${m.alt}` : ''}`}
              onClick={() => onPhoto(n)}
            >
              <img
                src={m.url}
                alt={m.alt ?? ''}
                width={m.w}
                height={m.h}
                loading="lazy"
                style={{ aspectRatio: ratio }}
                onError={onError}
              />
            </button>
          );
        }
        const gif = m.type === 'gif';
        return (
          <video
            key={m.src + i}
            className="ig-xpost__video"
            src={m.src}
            poster={m.poster}
            width={m.w}
            height={m.h}
            style={{ aspectRatio: ratio }}
            controls={!gif}
            preload="none"
            playsInline
            muted={gif}
            loop={gif}
            autoPlay={gif && !reduce}
            aria-label={gif ? `GIF from ${label}` : `Video from ${label}`}
            onError={onError}
          />
        );
      })}
    </div>
  );
}

/**
 * Shares the drop's own page (D34): the phone's share sheet on touch screens, otherwise
 * the link is copied.
 */
function ShareButton({ drop }: { drop: Drop }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = new URL(dropHref(drop), location.origin).href;
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      // Cancelling the share sheet rejects; nothing to do.
      await navigator.share({ title: dropHeadline(drop), url }).catch(() => {});
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      location.href = url;
    }
  };
  return (
    <>
      <button type="button" className="ig-btn" onClick={share}>
        {copied ? 'Link copied' : 'Share'}
      </button>
      <span className="sr-only" role="status">
        {copied ? 'Link copied' : ''}
      </span>
    </>
  );
}

export default function XPost({ drop, onOpenPhoto }: Props) {
  const [broken, setBroken] = useState(false);
  const { post } = drop;

  if (drop.embed || !post || broken) {
    return (
      <article id={dropAnchor(drop.id)} className="ig-xpost ig-xpost--embed" aria-label="Post on X">
        <XEmbed url={drop.url} />
        <div className="ig-xpost__foot ig-xpost__foot--embed">
          <GrailButton target={`drop:${drop.id}`} />
        </div>
      </article>
    );
  }

  const label = `${post.author.name} (${post.author.handle})`;
  return (
    <article
      id={dropAnchor(drop.id)}
      className="ig-xpost ig-window"
      data-active="true"
      aria-label={`Post by ${label}`}
    >
      <div className="ig-titlebar">
        <a className="ig-titlebar__title ig-xpost__permalink" href={dropHref(drop)}>
          {drop.kind === 'video' ? 'Video' : 'Meme'} · {formatDropTime(post.createdAt)}
        </a>
      </div>
      <div className="ig-xpost__body">
        <header className="ig-xpost__author">
          <img src={post.author.avatar} alt="" width={36} height={36} loading="lazy" />
          <span>
            <strong>{post.author.name}</strong>
            <span className="ig-xpost__handle">{post.author.handle}</span>
          </span>
        </header>
        {post.text && <p className="ig-xpost__text">{linkify(post.text)}</p>}
        {post.media.length > 0 && (
          <Media
            media={post.media}
            label={label}
            onPhoto={(i) => onOpenPhoto?.(drop, i)}
            onError={() => setBroken(true)}
          />
        )}
        <footer className="ig-xpost__foot">
          <GrailButton target={`drop:${drop.id}`} />
          {post.likes !== undefined && (
            <span className="ig-xpost__likes">
              <span aria-hidden="true">♥</span> {post.likes.toLocaleString('en-US')}
              <span className="sr-only"> likes</span>
            </span>
          )}
          <span className="ig-xpost__actions">
            <ShareButton drop={drop} />
            <a className="ig-btn" href={drop.url} rel="noopener" target="_blank">
              View on X ↗
            </a>
          </span>
        </footer>
      </div>
    </article>
  );
}
