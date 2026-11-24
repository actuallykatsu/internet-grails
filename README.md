# Internet Grails

The daily hub for internet culture, dressed as a late-90s desktop. See
[Internet Grails Phased Build Plan.md](Internet%20Grails%20Phased%20Build%20Plan.md) for the full roadmap.

## Stack

Astro 7 + TypeScript, React islands for the desktop/window manager, Markdown content collections.

## Commands

| Command              | What it does                                   |
| -------------------- | ---------------------------------------------- |
| `npm run dev`        | Dev server at http://localhost:4321            |
| `npm run build`      | Type-check, build to `dist`, then index search (Pagefind) |
| `npm run preview`    | Serve the built site (search only works here, not in dev) |
| `npm run lint`       | ESLint                                         |
| `npm run format`     | Prettier                                       |
| `npm run test:e2e`   | Playwright smoke tests (desktop + mobile): builds the site with the sample drops and serves it on port 4322, so it runs alongside `npm run dev` |
| `npm run drops:sync` | Fill in new drops from X (`-- --force` refreshes all) |

Demo tip: the boot screen plays once per tab and never with reduced motion on. Open http://localhost:4321/?boot to play it anyway.

## Where things live

- `src/lib/site.ts`: business identity (name, email, X, TikTok) and desktop sections. Edit contact details here only.
- `src/content.config.ts`: the content model. Six post types: `news`, `meme-gallery`, `music-pick`, `trend-roundup`, `interview`, `daily-roundup`.
- `src/content/posts/*.md`: posts (samples for now). Add `breaking: true` to a post's front matter to put it in the taskbar ticker; remove it when the story is no longer breaking. `src/content/authors/*.json`: authors.
- `src/components/desktop/`: window manager, desktop and taskbar. Open windows are mirrored to `?w=` so they can be linked.
- `src/components/ContactForm.tsx`: the contact form, used on `/contact` and in the desktop Contact window. It posts to the forms service in `PUBLIC_CONTACT_ENDPOINT` (see `.env.example`), or opens the email app when that is unset.
- `src/components/Search.tsx`: the Search window. Pagefind indexes article text (pages with `searchable` on `WindowPage`) after the build.
- `src/content/drops/*.json`: drops, one per X post (D25). The iPhone Shortcut adds them (setup: `docs/drops-iphone-shortcut.md`); `scripts/sync-drops.mjs` and the "Sync drops" GitHub Action copy in the post's text and media. Add `"draft": true` to hide one, `"kind"` to override meme/video, `"embedOnly": true` to always use X's embed. Prettier skips this folder because the phone and the sync script write it.
- `tests/fixtures/drops/*.json`: fixed sample drops the tests use instead of the real ones (`DROPS_DIR`), so new posts never change what the tests see. CI builds the real site too, to check every real drop.
- `src/components/drops/`: the retro post card (`XPost.tsx`), X's official embed fallback (`XEmbed.tsx`), the feed and the day view. Day pages are in `src/pages/today/`.
- `src/pages/rss.xml.ts`: the RSS feed at `/rss.xml`.
- `src/layouts/WindowPage.astro`: real-URL pages (articles, Contact, About) shown as a maximized window.
- `src/styles/tokens.css`: design tokens.
- `/mockups/trend-roundup`, `/mockups/mobile`: Phase 0 mockups.
- `src/components/player/GrailPlayer.tsx`: the background player, kept alive across pages from `Base.astro`. Playlist in `src/lib/tracks.ts` (add `src` to a track for real audio); shared open/minimize/mute state in `src/lib/player.ts`.
- `src/components/icons/pixelIcons.ts`: the pixel icons, one text grid per icon (D16).
- `src/components/Logo.astro`: the logo (`full` wordmark or compact `mark`). Its paths come from `nostalgia_logo_v1.png`; after changing the artwork, run `node scripts/trace-logo.mjs` (and update `SPARKLE_HINTS` / `FOREGROUND_HINTS` there if sparkles or the pieces in front of the globe move). The spinning globe lives in `src/components/logo/globe.ts`; set `LOGO_VARIANT = 'classic'` in `src/lib/site.ts` to go back to the flat logo.

## Placeholders to replace

- TikTok handle in `src/lib/site.ts`.
- About page copy.
- Contact form: set `PUBLIC_CONTACT_ENDPOINT` (and `PUBLIC_CONTACT_ACCESS_KEY` for Web3Forms) once a forms-service account exists. Copy `.env.example` to `.env` locally; for the deployed site, set them as build environment variables. Until then it opens the email app.
- Sample posts and `public/samples/` media. (Sample drops are test fixtures now and stay.)
