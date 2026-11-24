import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/** Who wrote it. One JSON file per author in src/content/authors. */
const authors = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/authors' }),
  schema: z.object({
    name: z.string(),
    role: z.string().optional(),
    bio: z.string().optional(),
    x: z.url().optional(),
  }),
});

const credit = z.object({ name: z.string(), url: z.url().optional() });

const embed = z.object({
  kind: z.enum(['youtube', 'spotify', 'soundcloud', 'tiktok', 'x']),
  url: z.url(),
  caption: z.string().optional(),
});

/** Fields every post type shares. */
const base = z.object({
  title: z.string(),
  summary: z.string(),
  date: z.coerce.date(),
  author: reference('authors'),
  tags: z.array(z.string()).default([]),
  heroImage: z.string().optional(),
  heroAlt: z.string().optional(),
  embeds: z.array(embed).default([]),
  /** Where the story, clip or meme came from. */
  credits: z.array(credit).default([]),
  draft: z.boolean().default(false),
  /** Shows in the taskbar's breaking-news ticker until unset (D23). */
  breaking: z.boolean().default(false),
});

const news = base.extend({ type: z.literal('news') });

const memeGallery = base.extend({
  type: z.literal('meme-gallery'),
  memes: z
    .array(
      z.object({
        src: z.string(),
        alt: z.string(),
        caption: z.string().optional(),
        credit, // every meme is credited
      }),
    )
    .min(1),
});

const musicPick = base.extend({
  type: z.literal('music-pick'),
  spotify: z.url().optional(),
  tracks: z.array(z.object({ artist: z.string(), title: z.string() })).default([]),
});

const trendRoundup = base.extend({
  type: z.literal('trend-roundup'),
  trends: z
    .array(
      z.object({
        name: z.string(),
        /** online = rising, away = peaking, signed-off = dead */
        status: z.enum(['online', 'away', 'signed-off']),
        heat: z.number().int().min(1).max(5),
        explainer: z.string(),
        example: embed.optional(),
      }),
    )
    .min(1)
    .max(10),
});

const interview = base.extend({
  type: z.literal('interview'),
  youtubeId: z.string(),
  highlights: z.array(z.object({ time: z.string(), label: z.string() })).default([]),
});

const dailyRoundup = base.extend({
  type: z.literal('daily-roundup'),
  items: z.array(z.object({ headline: z.string(), blurb: z.string(), url: z.string().optional() })),
});

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.discriminatedUnion('type', [
    news,
    memeGallery,
    musicPick,
    trendRoundup,
    interview,
    dailyRoundup,
  ]),
});

/**
 * Drops (D25): one file per X post, src/content/drops/<post id>.json. The iPhone
 * Shortcut writes `url` and `addedAt`; scripts/sync-drops.mjs then copies the
 * post's text and media into `post` so the site can draw it in its own style. A drop
 * without `post` (or with `embedOnly`) shows X's official embed instead.
 */
const dropMedia = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('photo'),
    url: z.string(),
    w: z.number().int().positive(),
    h: z.number().int().positive(),
    alt: z.string().optional(),
  }),
  z.object({
    type: z.enum(['video', 'gif']),
    src: z.string(),
    poster: z.string(),
    w: z.number().int().positive(),
    h: z.number().int().positive(),
  }),
]);

const drops = defineCollection({
  // Tests point DROPS_DIR at fixed sample drops (tests/fixtures/drops) so real posts can't move them.
  loader: glob({ pattern: '*.json', base: process.env.DROPS_DIR ?? './src/content/drops' }),
  schema: z.object({
    url: z.url(),
    /** Leave out to go by the media: anything with a video or GIF is a video. */
    kind: z.enum(['meme', 'video']).optional(),
    addedAt: z.coerce.date(),
    embedOnly: z.boolean().default(false),
    draft: z.boolean().default(false),
    post: z
      .object({
        text: z.string(),
        createdAt: z.coerce.date(),
        author: z.object({ name: z.string(), handle: z.string(), avatar: z.string() }),
        likes: z.number().int().nonnegative().optional(),
        media: z.array(dropMedia).default([]),
      })
      .optional(),
  }),
});

export const collections = { authors, posts, drops };
