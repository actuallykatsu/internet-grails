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
