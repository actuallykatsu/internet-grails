import { getCollection, type CollectionEntry } from 'astro:content';
import { dayOf, type Drop, type DropKind } from './drop';

/** Server-side loading for drops (D25). See drop.ts for the shape. */

function kindOf({ kind, post }: CollectionEntry<'drops'>['data']): DropKind {
  if (kind) return kind;
  return post?.media.some((m) => m.type !== 'photo') ? 'video' : 'meme';
}

function toDrop(entry: CollectionEntry<'drops'>): Drop {
  const { data } = entry;
  // A drop the sync hasn't seen yet has neither; it's brand new, so the build time is close.
  const date = data.post?.createdAt ?? data.addedAt ?? new Date();
  return {
    id: entry.id,
    url: data.url,
    kind: kindOf(data),
    date: date.toISOString(),
    day: dayOf(date),
    embed: data.embedOnly || !data.post,
    post: data.post && {
      ...data.post,
      createdAt: data.post.createdAt.toISOString(),
    },
  };
}

/** Published drops, newest first. Drafts show only in dev. */
export async function getDrops(): Promise<Drop[]> {
  const entries = await getCollection('drops', ({ data }) => import.meta.env.DEV || !data.draft);
  return entries.map(toDrop).sort((a, b) => b.date.localeCompare(a.date));
}

/** Drops grouped by day, newest day first; each day's drops newest first. */
export async function getDropDays(): Promise<{ day: string; drops: Drop[] }[]> {
  const days = new Map<string, Drop[]>();
  for (const drop of await getDrops()) {
    days.set(drop.day, [...(days.get(drop.day) ?? []), drop]);
  }
  return [...days].map(([day, drops]) => ({ day, drops }));
}
