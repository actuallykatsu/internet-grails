// Client-safe: no astro:content import, so islands can use it.
import type { PostSummary } from './posts';

/** A headline in the taskbar ticker (D23). */
export interface TickerItem {
  title: string;
  href: string;
}

/** The newest few breaking posts, for the ticker. */
export function tickerItems(posts: PostSummary[], max = 5): TickerItem[] {
  return posts
    .filter((p) => p.breaking)
    .slice(0, max)
    .map((p) => ({ title: p.title, href: `/posts/${p.slug}/` }));
}
