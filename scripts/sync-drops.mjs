#!/usr/bin/env node
/**
 * Fills in drops (D25). For each src/content/drops/<id>.json that has no `post` yet,
 * fetches the post's public embed data from X's syndication CDN (the same data X's own
 * embed widget uses, no API key) and saves the text, author and media links into the
 * file, so the site can draw the post in its own style.
 *
 * If the fetch fails (deleted post, protected account, X changed something) the file
 * is left alone and the site shows X's official embed for it. Run it again later to
 * retry.
 *
 *   npm run drops:sync              fill in drops that have no `post`
 *   npm run drops:sync -- --force   refresh every drop (likes, avatars)
 *   npm run drops:sync -- 1234 5678 just these post ids
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DIR = path.resolve(import.meta.dirname, '../src/content/drops');
const args = process.argv.slice(2);
const force = args.includes('--force');
const only = new Set(args.filter((a) => /^\d+$/.test(a)));

/** The token X's embed widget sends with each request. */
function token(id) {
  return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
}

async function fetchPost(id) {
  const url = `https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=en&token=${token(id)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'internet-grails-drops-sync' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (!text) throw new Error('empty response (deleted, protected or age-restricted post?)');
  const json = JSON.parse(text);
  if (json.__typename && json.__typename !== 'Tweet') throw new Error(json.__typename);
  return json;
}

/** The post's own words: media links dropped, t.co links expanded. */
function cleanText(tweet) {
  const chars = [...(tweet.text ?? '')];
  const [start, end] = tweet.display_text_range ?? [0, chars.length];
  let text = chars.slice(start, end).join('');
  for (const m of tweet.entities?.media ?? []) text = text.replaceAll(m.url, '');
  for (const u of tweet.entities?.urls ?? []) text = text.replaceAll(u.url, u.expanded_url);
  return text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

function bestMp4(variants = []) {
  return variants
    .filter((v) => v.content_type === 'video/mp4')
    .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0]?.url;
}

function normalize(tweet) {
  const media = [];
  for (const m of tweet.mediaDetails ?? []) {
    const w = m.original_info?.width;
    const h = m.original_info?.height;
    if (!w || !h) continue;
    if (m.type === 'photo') {
      media.push({
        type: 'photo',
        url: m.media_url_https,
        w,
        h,
        ...(m.ext_alt_text ? { alt: m.ext_alt_text } : {}),
      });
    } else if (m.type === 'video' || m.type === 'animated_gif') {
      const src = bestMp4(m.video_info?.variants);
      if (!src) continue;
      media.push({
        type: m.type === 'video' ? 'video' : 'gif',
        src,
        poster: m.media_url_https,
        w,
        h,
      });
    }
  }
  return {
    text: cleanText(tweet),
    createdAt: tweet.created_at,
    author: {
      name: tweet.user.name,
      handle: `@${tweet.user.screen_name}`,
      // _normal is 48px; _bigger is 73px and still tiny.
      avatar: tweet.user.profile_image_url_https.replace('_normal.', '_bigger.'),
    },
    likes: tweet.favorite_count ?? 0,
    media,
  };
}

/**
 * Reads a drop the way the iPhone Shortcut might have written it. Phones turn straight
 * quotes curly (Smart Punctuation), and a misconfigured date step can put line breaks
 * inside a value; both make the file invalid JSON, so undo them before parsing.
 */
function readDrop(raw) {
  try {
    return { drop: JSON.parse(raw), repaired: false };
  } catch {
    const fixed = raw.replace(/[“”„‟″]/g, '"').replace(/[\r\n\t]+/g, ' ');
    return { drop: JSON.parse(fixed), repaired: true };
  }
}

/** addedAt must be one date. If it isn't, use now: the sync runs right after a drop lands. */
function fixAddedAt(drop) {
  const value = drop.addedAt;
  if (typeof value === 'string' && /^\S+$/.test(value) && !isNaN(Date.parse(value))) return false;
  drop.addedAt = new Date().toISOString();
  return true;
}

const save = (full, drop) => writeFile(full, JSON.stringify(drop, null, 2) + '\n');

const files = (await readdir(DIR)).filter((f) => f.endsWith('.json')).sort();
let filled = 0;
let failed = 0;
let broken = 0;
for (const file of files) {
  const id = path.basename(file, '.json');
  if (only.size && !only.has(id)) continue;
  const full = path.join(DIR, file);
  let drop;
  try {
    const read = readDrop(await readFile(full, 'utf8'));
    drop = read.drop;
    if (fixAddedAt(drop) || read.repaired) {
      await save(full, drop);
      console.warn(`fix  ${id}  repaired the file the Shortcut wrote`);
    }
  } catch (err) {
    broken++;
    console.warn(`fail ${file}  not valid JSON, fix it by hand: ${err.message}`);
    continue;
  }
  if (drop.embedOnly || (drop.post && !force)) continue;
  if (!/^\d+$/.test(id)) {
    console.warn(`skip ${file}: name it after the post id`);
    continue;
  }
  try {
    drop.post = normalize(await fetchPost(id));
    await save(full, drop);
    filled++;
    console.log(`ok   ${id}  ${drop.post.media.map((m) => m.type).join(',') || 'text'}`);
  } catch (err) {
    failed++;
    console.warn(`fail ${id}  ${err.message}  (will show X's embed)`);
  }
  await new Promise((r) => setTimeout(r, 300));
}
console.log(`${filled} filled, ${failed} failed, ${broken} unreadable, ${files.length} drops`);
// A post X won't share still works (it shows X's embed); only an unreadable file fails the run.
if (broken) process.exitCode = 1;
