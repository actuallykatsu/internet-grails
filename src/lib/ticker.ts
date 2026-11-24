// Client-safe: no astro:content import, so islands can use it.
import type { PostSummary } from './posts';
import { dropHeadline, dropHref, type Drop } from './drop';

/** A headline in the taskbar ticker (D23). */
export interface TickerItem {
  title: string;
  href: string;
  /** Breaking posts come first; drops follow (D32). */
  kind: 'breaking' | 'drop';
}

/**
 * The ticker's headlines: the newest breaking posts, then the newest drops from the
 * latest day that has any (D32), `max` in all.
 */
export function tickerItems(posts: PostSummary[], drops: Drop[] = [], max = 5): TickerItem[] {
  const breaking: TickerItem[] = posts
    .filter((p) => p.breaking)
    .map((p) => ({ title: p.title, href: `/posts/${p.slug}/`, kind: 'breaking' }));
  const newest = [...drops].sort((a, b) => b.date.localeCompare(a.date));
  const latestDay = newest[0]?.day;
  const fresh: TickerItem[] = newest
    .filter((d) => d.day === latestDay)
    .map((d) => ({ title: `New drop: ${dropHeadline(d, 70)}`, href: dropHref(d), kind: 'drop' }));
  return [...breaking, ...fresh].slice(0, max);
}
