import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import satori from 'satori';
import sharp from 'sharp';
import { SITE } from './site';
import { SHARE_IMAGE_SIZE, type ShareCard } from './shareCards';

/**
 * Draws a share card (D29) as a 1200×630 PNG: the page as a window on the teal desktop,
 * with the logo underneath. Satori lays it out to SVG (it takes plain element objects,
 * no JSX needed) and sharp turns that into a PNG. Build time only (Node).
 */

// Colors from src/styles/tokens.css.
const C = {
  desktop: '#0f5c63',
  desktopDeep: '#083a40',
  chrome: '#d4d0c8',
  light: '#ffffff',
  mid: '#a6a29a',
  dark: '#4a4844',
  paper: '#fbfaf7',
  ink: '#141414',
  inkSoft: '#4b4b4b',
  titleA: '#0b1f6b',
  titleB: '#3a76d8',
  accent: '#ff3ea5',
};

type Style = Record<string, string | number>;
interface El {
  type: string;
  props: { style?: Style; children?: El | string | (El | string)[]; [key: string]: unknown };
}

const el = (type: string, style: Style, children?: El['props']['children'], extra = {}): El => ({
  type,
  props: { style: { display: 'flex', ...style }, children, ...extra },
});

const root = createRequire(path.join(process.cwd(), 'package.json'));
const fontFile = (pkg: string) => readFile(root.resolve(pkg));

let assets:
  | Promise<{ fonts: Parameters<typeof satori>[1]['fonts']; logo: string; logoRatio: number }>
  | undefined;

function loadAssets() {
  return (assets ??= (async () => {
    const [vt323, inter400, inter800, logo] = await Promise.all([
      fontFile('@fontsource/vt323/files/vt323-latin-400-normal.woff'),
      fontFile('@fontsource/inter/files/inter-latin-400-normal.woff'),
      fontFile('@fontsource/inter/files/inter-latin-800-normal.woff'),
      readFile(path.join(process.cwd(), 'public/logo.png')),
    ]);
    const { width = 1200, height = 402 } = await sharp(logo).metadata();
    return {
      fonts: [
        { name: 'VT323', data: vt323, weight: 400 as const, style: 'normal' as const },
        { name: 'Inter', data: inter400, weight: 400 as const, style: 'normal' as const },
        { name: 'Inter', data: inter800, weight: 800 as const, style: 'normal' as const },
      ],
      logo: `data:image/png;base64,${logo.toString('base64')}`,
      logoRatio: width / height,
    };
  })());
}

/** Raised (out) or sunken (in) Windows-style edges. */
function bevel(raised: boolean, size = 3): Style {
  const [hi, lo] = raised ? [C.light, C.dark] : [C.dark, C.light];
  return {
    borderTop: `${size}px solid ${hi}`,
    borderLeft: `${size}px solid ${hi}`,
    borderRight: `${size}px solid ${lo}`,
    borderBottom: `${size}px solid ${lo}`,
  };
}

function titleSize(title: string): number {
  if (title.length <= 28) return 72;
  if (title.length <= 48) return 60;
  return 50;
}

function card(c: ShareCard, logo: string, logoRatio: number): El {
  // VT323 has no box glyph, so the maximize button's square is drawn.
  const square = el('div', {
    width: 18,
    height: 15,
    border: `2px solid ${C.ink}`,
    borderTopWidth: 4,
  });
  const button = (glyph: El | string) =>
    el(
      'div',
      {
        width: 40,
        height: 34,
        marginLeft: 6,
        background: C.chrome,
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'VT323',
        fontSize: 30,
        color: C.ink,
        ...bevel(true, 2),
      },
      glyph,
    );

  const titleBar = el(
    'div',
    {
      height: 56,
      padding: '0 8px 0 16px',
      alignItems: 'center',
      backgroundImage: `linear-gradient(90deg, ${C.titleA}, ${C.titleB})`,
      color: '#fff',
      fontFamily: 'VT323',
      fontSize: 38,
    },
    [
      el(
        'div',
        { flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
        c.windowTitle,
      ),
      button('_'),
      button(square),
      button('×'),
    ],
  );

  const body = el(
    'div',
    {
      flex: 1,
      flexDirection: 'column',
      // With no meta line at the bottom, center the text instead of leaving a gap.
      justifyContent: c.meta ? 'flex-start' : 'center',
      marginTop: 5,
      padding: '34px 44px',
      background: C.paper,
      fontFamily: 'Inter',
      color: C.ink,
      ...bevel(false, 2),
    },
    [
      el(
        'div',
        {
          fontSize: 24,
          fontWeight: 800,
          letterSpacing: 3,
          textTransform: 'uppercase',
          color: C.accent,
        },
        c.kicker,
      ),
      el(
        'div',
        {
          marginTop: 12,
          fontSize: titleSize(c.title),
          fontWeight: 800,
          lineHeight: 1.08,
          letterSpacing: -1.5,
          lineClamp: 2,
        },
        c.title,
      ),
      el(
        'div',
        { marginTop: 18, fontSize: 28, lineHeight: 1.35, color: C.inkSoft, lineClamp: 2 },
        c.description,
      ),
      ...(c.meta
        ? [
            el(
              'div',
              { marginTop: 'auto', fontSize: 22, fontWeight: 800, color: C.inkSoft },
              c.meta,
            ),
          ]
        : []),
    ],
  );

  const window = el(
    'div',
    {
      position: 'absolute',
      top: 34,
      left: 44,
      width: SHARE_IMAGE_SIZE.width - 88,
      height: 446,
      flexDirection: 'column',
      padding: 4,
      background: C.chrome,
      boxShadow: '10px 12px 0 rgba(0, 0, 0, 0.35)',
      ...bevel(true),
    },
    [titleBar, body],
  );

  const logoHeight = 104;
  const footer = el(
    'div',
    {
      position: 'absolute',
      left: 44,
      right: 44,
      bottom: 18,
      height: logoHeight,
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    [
      el('img', { width: logoHeight * logoRatio, height: logoHeight }, undefined, {
        src: logo,
        width: logoHeight * logoRatio,
        height: logoHeight,
      }),
      el(
        'div',
        {
          flexDirection: 'column',
          alignItems: 'flex-end',
          fontFamily: 'VT323',
          fontSize: 40,
          color: '#fff',
          lineHeight: 1.05,
        },
        [
          el('div', {}, SITE.url.replace('https://', '')),
          el('div', { color: '#9fe8f2' }, SITE.x.handle),
        ],
      ),
    ],
  );

  return el(
    'div',
    {
      position: 'relative',
      width: SHARE_IMAGE_SIZE.width,
      height: SHARE_IMAGE_SIZE.height,
      backgroundImage: `linear-gradient(160deg, ${C.desktop}, ${C.desktopDeep})`,
    },
    [window, footer],
  );
}

export async function renderShareImage(c: ShareCard): Promise<Buffer> {
  const { fonts, logo, logoRatio } = await loadAssets();
  // Satori's types expect React nodes; these plain objects are what JSX would produce.
  const svg = await satori(card(c, logo, logoRatio) as unknown as Parameters<typeof satori>[0], {
    ...SHARE_IMAGE_SIZE,
    fonts,
  });
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}
