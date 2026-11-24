# Internet Grails

The daily hub for internet culture, dressed as a late-90s desktop. See
[Internet Grails Phased Build Plan.md](Internet%20Grails%20Phased%20Build%20Plan.md) for the full roadmap.

## Stack

Astro 7 + TypeScript, React islands for the desktop/window manager, Markdown content collections.

## Commands

| Command              | What it does                                   |
| -------------------- | ---------------------------------------------- |
| `npm run dev`        | Dev server at http://localhost:4321            |
| `npm run build`      | Type-check (`astro check`) and build to `dist` |
| `npm run preview`    | Serve the built site                           |
| `npm run lint`       | ESLint                                         |
| `npm run format`     | Prettier                                       |
| `npm run test:e2e`   | Playwright smoke tests (desktop + mobile)      |

## Where things live

- `src/lib/site.ts`: business identity (name, email, X, TikTok) and desktop sections. Edit contact details here only.
- `src/content.config.ts`: the content model. Six post types: `news`, `meme-gallery`, `music-pick`, `trend-roundup`, `interview`, `daily-roundup`.
- `src/content/posts/*.md`: posts (samples for now). `src/content/authors/*.json`: authors.
- `src/components/desktop/`: window manager, desktop and taskbar. Open windows are mirrored to `?w=` so they can be linked.
- `src/layouts/WindowPage.astro`: real-URL pages (articles, Contact, About) shown as a maximized window.
- `src/styles/tokens.css`: design tokens.
- `/mockups/trend-roundup`: Phase 0 mockup.
- `src/components/Logo.astro`: the logo (`full` wordmark or compact `mark`). Its paths come from `nostalgia_logo_v1.png`; after changing the artwork, run `node scripts/trace-logo.mjs` (and update `SPARKLE_HINTS` / `FOREGROUND_HINTS` there if sparkles or the pieces in front of the globe move). The spinning globe lives in `src/components/logo/globe.ts`; set `LOGO_VARIANT = 'classic'` in `src/lib/site.ts` to go back to the flat logo.

## Placeholders to replace

- TikTok handle in `src/lib/site.ts`.
- About page copy.
- Contact form currently uses `mailto:`; needs a form backend + Turnstile.
- Sample posts and `public/samples/` images.
