import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPublishedPosts, POST_TYPE_LABELS } from '../lib/posts';
import { SITE } from '../lib/site';

/** One feed of every published post, newest first (Phase 2). */
export async function GET(context: APIContext) {
  const posts = await getPublishedPosts();
  return rss({
    title: SITE.name,
    description: SITE.tagline,
    site: context.site ?? SITE.url,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.summary,
      pubDate: post.data.date,
      link: `/posts/${post.id}/`,
      categories: [POST_TYPE_LABELS[post.data.type], ...post.data.tags],
    })),
    customData: '<language>en-us</language>',
  });
}
