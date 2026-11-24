import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getDrops } from '../lib/drops';
import { dropHeadline, dropHref, type Drop } from '../lib/drop';
import { SITE } from '../lib/site';

/**
 * The drops feed (D32): every meme and video from X, newest first, kept apart from
 * /rss.xml so a dozen drops a day don't bury the articles. Each item shows the post's
 * text and pictures (video posters) and links to the drop on its day page.
 */

const LIMIT = 60;

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function content(drop: Drop, site: URL): string {
  const post = drop.post;
  const viewOnX = `<p><a href="${escape(drop.url)}">View on X</a></p>`;
  if (!post) return viewOnX;
  const abs = (src: string) => new URL(src, site).href;
  const text = post.text ? `<p>${escape(post.text).replace(/\n/g, '<br>')}</p>` : '';
  const media = post.media
    .map((m) =>
      m.type === 'photo'
        ? `<p><img src="${escape(abs(m.url))}" alt="${escape(m.alt ?? '')}" width="${m.w}" height="${m.h}"></p>`
        : `<p><a href="${escape(abs(dropHref(drop)))}"><img src="${escape(abs(m.poster))}" alt="Play the video" width="${m.w}" height="${m.h}"></a></p>`,
    )
    .join('');
  return `${text}${media}<p>${escape(post.author.name)} (${escape(post.author.handle)})</p>${viewOnX}`;
}

export async function GET(context: APIContext) {
  const site = context.site ?? new URL(SITE.url);
  const drops = (await getDrops()).slice(0, LIMIT);
  return rss({
    title: `${SITE.name}: drops`,
    description: `Every meme and video from ${SITE.name}, as it drops.`,
    site,
    // The links already end in a slash or a #drop- anchor; don't add one after the anchor.
    trailingSlash: false,
    items: drops.map((drop) => ({
      title: dropHeadline(drop),
      description: dropHeadline(drop, 280),
      content: content(drop, site),
      pubDate: new Date(drop.date),
      link: dropHref(drop),
      categories: [drop.kind === 'video' ? 'Videos' : 'Memes'],
    })),
    customData: '<language>en-us</language>',
  });
}
