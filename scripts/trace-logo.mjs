/**
 * Traces the logo PNG into SVG path data for src/components/logo/paths.ts.
 *
 *   node scripts/trace-logo.mjs [path/to/logo.png]
 *
 * Produces two stacked layers so the chrome treatment can be applied:
 *   - silhouette: every opaque pixel (drawn in ink, gives the black outlines)
 *   - light: the white areas inside the outlines (drawn in metal)
 * Sparkles that stand alone are split out so they can twinkle independently.
 * Re-run this whenever the source artwork changes.
 */
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import potrace from 'potrace';

const SRC = process.argv[2] ?? 'nostalgia_logo_v1.png';
const OUT = 'src/components/logo/paths.ts';
const LIGHT_MIN = 140; // luminance above this counts as "white fill"
const STAR_MAX_AREA = 3000; // safety cap so a hint can never grab a letter

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const H = info.height;
const N = W * H;

const opaque = new Uint8Array(N);
const light = new Uint8Array(N);
for (let i = 0; i < N; i++) {
  const a = data[i * 4 + 3];
  const l = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
  opaque[i] = a >= 128 ? 1 : 0;
  light[i] = a >= 128 && l > LIGHT_MIN ? 1 : 0;
}

/** Connected components (4-neighbour) of a mask. */
function components(mask) {
  const label = new Int32Array(N);
  const stack = new Int32Array(N);
  const out = [];
  for (let s = 0; s < N; s++) {
    if (!mask[s] || label[s]) continue;
    const id = out.length + 1;
    let sp = 0;
    stack[sp++] = s;
    label[s] = id;
    let area = 0;
    let x0 = W;
    let y0 = H;
    let x1 = 0;
    let y1 = 0;
    while (sp) {
      const p = stack[--sp];
      area++;
      const x = p % W;
      const y = (p / W) | 0;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      const nb = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W];
      for (const q of nb) {
        if (q >= 0 && q < N && mask[q] && !label[q]) {
          label[q] = id;
          stack[sp++] = q;
        }
      }
    }
    out.push({ id, area, x0, y0, x1, y1 });
  }
  return { label, comps: out };
}

/**
 * Approximate centres of the free-standing sparkles in the source PNG.
 * Update these if the artwork changes. The sparkle touching the orbit ring
 * (top right) is part of the ring and stays static.
 */
const SPARKLE_HINTS = [
  [215, 260],
  [898, 129],
  [1414, 178],
  [542, 597],
  [2023, 525],
];

const isSparkle = (c) =>
  c.area <= STAR_MAX_AREA &&
  SPARKLE_HINTS.some(([x, y]) => x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1);

const { label, comps } = components(light);
const stars = comps.filter(isSparkle);
const starIds = new Set(stars.map((s) => s.id));

const lightMain = new Uint8Array(N);
for (let i = 0; i < N; i++) lightMain[i] = light[i] && !starIds.has(label[i]) ? 1 : 0;

/**
 * Globe split for the spinning-globe logo. The globe's ocean is transparent up to
 * GLOBE_R; beyond it sit the classic rings (ink, white rim, ink). Pieces that pass
 * in front of the globe (the orbit band and the letters "ls") are traced again on
 * their own so a new, rotating globe can be drawn between the base and them.
 */
const GLOBE = { cx: 1756.7, cy: 334.9, r: 243 };
// Redraw the front pieces well past the globe edge (r 243) so their cut edge lands on
// identical artwork; ending right at the edge leaves an anti-aliased hairline.
const FG_LIMIT = 256;
/** Points on the pieces that sit in front of the globe. */
const FOREGROUND_HINTS = [
  [1800, 305], // orbit band
  [1565, 420], // "l"
  [1538, 248], // sliver of the letter left of "l"
  [1710, 480], // "s"
];
const FG_ERODE = 3; // breaks the thin contact between North America and the orbit
const FG_INK = 14; // outline width redrawn around foreground pieces

const dist = (i) => Math.hypot((i % W) - GLOBE.cx, ((i / W) | 0) - GLOBE.cy);
const disc = new Uint8Array(N);
for (let i = 0; i < N; i++) disc[i] = dist(i) < FG_LIMIT ? 1 : 0;

/** Breadth-first grow from `seeds` through `mask`, at most `steps` px. */
function grow(seeds, mask, steps) {
  const out = new Uint8Array(N);
  let front = [];
  for (let i = 0; i < N; i++) {
    if (!seeds[i]) continue;
    out[i] = 1;
    front.push(i);
  }
  for (let k = 0; k < steps && front.length; k++) {
    const next = [];
    for (const p of front) {
      for (const q of [p - 1, p + 1, p - W, p + W]) {
        if (q < 0 || q >= N || !mask[q] || out[q]) continue;
        out[q] = 1;
        next.push(q);
      }
    }
    front = next;
  }
  return out;
}

const discLight = new Uint8Array(N);
for (let i = 0; i < N; i++) discLight[i] = light[i] && disc[i] ? 1 : 0;
const eroded = new Uint8Array(N);
for (let i = 0; i < N; i++) {
  if (!discLight[i]) continue;
  const x = i % W;
  const y = (i / W) | 0;
  let ok = 1;
  for (let dy = -FG_ERODE; dy <= FG_ERODE && ok; dy++) {
    for (let dx = -FG_ERODE; dx <= FG_ERODE; dx++) {
      if (dx * dx + dy * dy > FG_ERODE * FG_ERODE) continue;
      if (!discLight[(y + dy) * W + x + dx]) {
        ok = 0;
        break;
      }
    }
  }
  eroded[i] = ok;
}
const er = components(eroded);
const fgIds = new Set();
for (const [hx, hy] of FOREGROUND_HINTS) {
  // Snap each hint to the nearest eroded pixel.
  let best = 0;
  let bd = Infinity;
  for (let dy = -20; dy <= 20; dy++) {
    for (let dx = -20; dx <= 20; dx++) {
      const q = (hy + dy) * W + hx + dx;
      if (!er.label[q] || dx * dx + dy * dy >= bd) continue;
      bd = dx * dx + dy * dy;
      best = er.label[q];
    }
  }
  if (!best) throw new Error(`Foreground hint ${hx},${hy} is not on a light shape`);
  fgIds.add(best);
}
const fgSeed = new Uint8Array(N);
for (let i = 0; i < N; i++) fgSeed[i] = fgIds.has(er.label[i]) ? 1 : 0;
const fgLight = grow(fgSeed, discLight, FG_ERODE + 1);
const discInk = new Uint8Array(N);
for (let i = 0; i < N; i++) discInk[i] = opaque[i] && !light[i] && disc[i] ? 1 : 0;
const fgInkGrown = grow(fgLight, discInk, FG_INK);
const fgInk = new Uint8Array(N);
// Stop the outline layer short of the chrome layer: if both ended at the same radius,
// their anti-aliased edges would stack into a grey hairline across the letters.
for (let i = 0; i < N; i++) {
  fgInk[i] = (fgInkGrown[i] || fgLight[i]) && dist(i) < FG_LIMIT - 6 ? 1 : 0;
}

if (process.env.FG_PREVIEW) {
  const px = Buffer.alloc(N * 3, 0x2a);
  for (let i = 0; i < N; i++) {
    const c = fgLight[i]
      ? [255, 255, 255]
      : fgInk[i]
        ? [0, 0, 0]
        : opaque[i]
          ? [140, 70, 70]
          : null;
    if (c) px.set(c, i * 3);
  }
  await sharp(px, { raw: { width: W, height: H, channels: 3 } })
    .extract({ left: 1440, top: 40, width: 720, height: 620 })
    .png()
    .toFile(process.env.FG_PREVIEW);
}

async function trace(mask) {
  const gray = Buffer.alloc(N);
  for (let i = 0; i < N; i++) gray[i] = mask[i] ? 0 : 255;
  const png = await sharp(gray, { raw: { width: W, height: H, channels: 1 } })
    .png()
    .toBuffer();
  const svg = await new Promise((resolve, reject) =>
    potrace.trace(png, { threshold: 128, turdSize: 6, optTolerance: 0.35 }, (err, out) =>
      err ? reject(err) : resolve(out),
    ),
  );
  const ds = [...svg.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]);
  // Round coordinates to 1 decimal to keep the file small.
  return ds.join(' ').replace(/-?\d+\.\d+/g, (n) => String(Math.round(parseFloat(n) * 10) / 10));
}

const silhouette = await trace(opaque);
const lightPath = await trace(lightMain);
const fgInkPath = await trace(fgInk);
const fgLightPath = await trace(fgLight);
const starPaths = [];
for (const s of stars) {
  const m = new Uint8Array(N);
  for (let i = 0; i < N; i++) m[i] = label[i] === s.id ? 1 : 0;
  starPaths.push({
    d: await trace(m),
    cx: Math.round((s.x0 + s.x1) / 2),
    cy: Math.round((s.y0 + s.y1) / 2),
  });
}

const file = `// Generated by scripts/trace-logo.mjs from ${SRC}. Do not edit by hand.
export const LOGO_WIDTH = ${W};
export const LOGO_HEIGHT = ${H};
/** Every opaque pixel. Drawn in ink to give the outlines. */
/** Paths use inner subpaths for holes: render with fill-rule="evenodd". */
export const SILHOUETTE = ${JSON.stringify(silhouette)};
/** White fill areas (letters, crown, orbit, continents). Drawn in chrome. */
export const LIGHT = ${JSON.stringify(lightPath)};
/** The globe's ocean disc (inside the classic rings), in viewBox units. */
export const GLOBE = ${JSON.stringify(GLOBE)};
/** Pieces in front of the globe (orbit band, "ls"): outline layer, then chrome layer. */
export const FG_INK = ${JSON.stringify(fgInkPath)};
export const FG_LIGHT = ${JSON.stringify(fgLightPath)};
/** Free-standing sparkles, with centres for the twinkle transform. */
export const STARS: { d: string; cx: number; cy: number }[] = ${JSON.stringify(starPaths, null, 2)};
`;
await writeFile(OUT, file);
console.log(
  `Wrote ${OUT}: ${W}x${H}, ${stars.length} sparkles, ${(file.length / 1024).toFixed(0)} KB`,
);
