/**
 * Drops (D25) as the browser sees them: plain, serializable data with no astro:content
 * import, so React islands can use it. Loading lives in drops.ts (server only).
 */

export type DropKind = 'meme' | 'video';

export type DropMedia =
  | { type: 'photo'; url: string; w: number; h: number; alt?: string }
  | { type: 'video' | 'gif'; src: string; poster: string; w: number; h: number };

export interface DropPost {
  text: string;
  createdAt: string;
  author: { name: string; handle: string; avatar: string };
  likes?: number;
  media: DropMedia[];
}

export interface Drop {
  id: string;
  url: string;
  kind: DropKind;
  /** When it was posted (or added, if we have no copy of the post), ISO string. */
  date: string;
  /** The site's calendar day for it, YYYY-MM-DD (see DROPS_TIMEZONE). */
  day: string;
  /** Draw X's official embed instead of our own card. */
  embed: boolean;
  post?: DropPost;
}

/** Days roll over at midnight here. */
export const DROPS_TIMEZONE = 'America/New_York';

export function dayOf(date: Date): string {
  // en-CA formats as YYYY-MM-DD.
  return date.toLocaleDateString('en-CA', { timeZone: DROPS_TIMEZONE });
}

export function formatDay(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatDropTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
    timeZone: DROPS_TIMEZONE,
  });
}

export function dayHref(day: string): string {
  return `/today/${day}/`;
}

/** The id of a drop's card on its day page. */
export function dropAnchor(id: string): string {
  return `drop-${id}`;
}

/** A drop's own page (D34), the link to share. */
export function dropHref(drop: Pick<Drop, 'id'>): string {
  return `/drops/${drop.id}/`;
}

/** A drop on its day page, scrolled to its card. */
export function dropDayHref(drop: Pick<Drop, 'id' | 'day'>): string {
  return `${dayHref(drop.day)}#${dropAnchor(drop.id)}`;
}

/** "Meme" or "Video". */
export function dropKindLabel(drop: Pick<Drop, 'kind'>): string {
  return drop.kind === 'video' ? 'Video' : 'Meme';
}

/** The first picture to show for a drop: its first photo, or a video's poster. */
export function dropPicture(drop: Drop): { src: string; alt: string } | undefined {
  const m = drop.post?.media[0];
  if (!m) return undefined;
  return m.type === 'photo' ? { src: m.url, alt: m.alt ?? '' } : { src: m.poster, alt: '' };
}

/**
 * A one-line title for a drop, for the ticker and the drops feed: the post's first line
 * without links, cut to `max` characters, or "Meme from @handle" when it has no text.
 */
export function dropHeadline(drop: Drop, max = 80): string {
  const line = (drop.post?.text ?? '')
    .replace(/https?:\/\/\S+/g, '')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .find(Boolean);
  const kind = dropKindLabel(drop);
  if (!line)
    return drop.post ? `${kind} from ${drop.post.author.handle}` : `New ${kind.toLowerCase()}`;
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}
