import { getEntry } from 'astro:content';
import { SITE } from './site';
import { formatDate, getPublishedPosts, postWindowTitle, POST_TYPE_LABELS } from './posts';
import { getDropDays } from './drops';
import { dropHeadline, dropKindLabel, dropPicture, formatDay } from './drop';

/**
 * Share images (D29): the picture X, iMessage, Discord and others show when someone
 * shares a link. Each page gets one drawn as a retro window with the page's own title
 * bar, built at build time by src/pages/og/[...key].png.ts.
 */
export interface ShareCard {
  /** The page's path without slashes ('index' for the homepage); the image is /og/<key>.png. */
  key: string;
  windowTitle: string;
  kicker: string;
  title: string;
  description: string;
  /** A small line under the description, such as the date and author. */
  meta?: string;
  /**
   * A picture to show beside the text (D34): a drop's photo or video poster, as a URL or
   * a path in public/. A video gets a play button drawn over it.
   */
  picture?: { src: string; video: boolean };
}

export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 } as const;

export function shareKey(pathname: string): string {
  return pathname.replace(/^\/+|\/+$/g, '') || 'index';
}

export function shareImagePath(key: string): string {
  return `/og/${key}.png`;
}

function countDrops(kinds: string[]): string {
  const memes = kinds.filter((k) => k === 'meme').length;
  const videos = kinds.length - memes;
  const parts = [
    memes && `${memes} ${memes === 1 ? 'meme' : 'memes'}`,
    videos && `${videos} ${videos === 1 ? 'video' : 'videos'}`,
  ].filter(Boolean);
  return parts.join(' and ');
}

async function buildShareCards(): Promise<ShareCard[]> {
  const cards: ShareCard[] = [
    {
      key: 'index',
      windowTitle: 'C:\\Grails',
      kicker: 'Welcome',
      title: SITE.name,
      description: SITE.tagline,
    },
    {
      key: 'about',
      windowTitle: 'About - Internet Grails',
      kicker: 'About',
      title: `About ${SITE.name}`,
      description: SITE.tagline,
    },
    {
      key: 'contact',
      windowTitle: 'Contact - Internet Grails',
      kicker: 'Contact',
      title: `Contact ${SITE.name}`,
      description: 'Business and press inquiries welcome.',
      meta: `${SITE.email} · X ${SITE.x.handle}`,
    },
    {
      key: 'today',
      windowTitle: "Today's Grails",
      kicker: "Today's Grails",
      title: 'Every meme and video, day by day',
      description: `The latest drops from ${SITE.name}.`,
    },
  ];

  for (const { day, drops } of await getDropDays()) {
    for (const drop of drops) {
      const picture = dropPicture(drop);
      cards.push({
        key: `drops/${drop.id}`,
        windowTitle: `${dropKindLabel(drop)} - ${day}`,
        kicker: dropKindLabel(drop),
        title: dropHeadline(drop, 90),
        description: formatDay(day),
        meta: drop.post?.author.handle,
        picture: picture && { src: picture.src, video: drop.kind === 'video' },
      });
    }
    cards.push({
      key: `today/${day}`,
      windowTitle: `Today's Grails - ${day}`,
      kicker: "Today's Grails",
      title: formatDay(day),
      description: `${countDrops(drops.map((d) => d.kind))} from ${SITE.name}.`,
    });
  }

  for (const post of await getPublishedPosts()) {
    const { data } = post;
    const author = await getEntry(data.author);
    cards.push({
      key: `posts/${post.id}`,
      windowTitle: postWindowTitle(data),
      kicker: POST_TYPE_LABELS[data.type],
      title: data.title,
      description: data.summary,
      meta: [formatDate(data.date), author && `by ${author.data.name}`].filter(Boolean).join(' · '),
    });
  }
  return cards;
}

let cached: Promise<ShareCard[]> | undefined;

/** Every page's share card. Cached for a build; rebuilt each time in dev, where content changes. */
export function getShareCards(): Promise<ShareCard[]> {
  if (import.meta.env.DEV) return buildShareCards();
  return (cached ??= buildShareCards());
}

/** The share image for a page, or the homepage's for pages without their own (mockups). */
export async function shareImageFor(pathname: string): Promise<string> {
  const key = shareKey(pathname);
  const cards = await getShareCards();
  return shareImagePath(cards.some((c) => c.key === key) ? key : 'index');
}
