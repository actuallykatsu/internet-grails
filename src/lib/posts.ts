import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;
export type PostType = Post['data']['type'];

export const POST_TYPE_LABELS: Record<PostType, string> = {
  news: 'News',
  'meme-gallery': 'Meme Gallery',
  'music-pick': 'Music Pick',
  'trend-roundup': 'Trend Roundup',
  interview: 'Interview Spotlight',
  'daily-roundup': "Today's Grails",
};

/** Published posts, newest first. Drafts show only in dev. */
export async function getPublishedPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', ({ data }) => import.meta.env.DEV || !data.draft);
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

/** Small serializable summary for the desktop island. */
export interface PostSummary {
  slug: string;
  title: string;
  summary: string;
  type: PostType;
  typeLabel: string;
  date: string;
  breaking: boolean;
}

export function toSummary(post: Post): PostSummary {
  return {
    slug: post.id,
    title: post.data.title,
    summary: post.data.summary,
    type: post.data.type,
    typeLabel: POST_TYPE_LABELS[post.data.type],
    date: post.data.date.toISOString().slice(0, 10),
    breaking: post.data.breaking,
  };
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
