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
- `src/content/posts/*.md`: posts (samples for now). Add `breaking: true` to a post's front matter to put it in the taskbar ticker; remove it when the story is no longer breaking. After breaking posts, the ticker shows the newest day's drops (D32), up to five headlines in all (`src/lib/ticker.ts`). `src/content/authors/*.json`: authors.
- `src/components/desktop/`: window manager, desktop and taskbar. Open windows are mirrored to `?w=` so they can be linked.
- `src/components/ContactForm.tsx`: the contact form, used on `/contact` and in the desktop Contact window. It posts to the forms service in `PUBLIC_CONTACT_ENDPOINT` (see `.env.example`), or opens the email app when that is unset.
- `src/components/Search.tsx`: the Search window. Pagefind indexes article text (pages with `searchable` on `WindowPage`) after the build.
- `src/content/drops/*.json`: drops, one per X post (D25). The iPhone Shortcut adds them (setup: `docs/drops-iphone-shortcut.md`); `scripts/sync-drops.mjs` and the "Sync drops" GitHub Action copy in the post's text and media. Add `"draft": true` to hide one, `"kind"` to override meme/video, `"embedOnly": true` to always use X's embed. Prettier skips this folder because the phone and the sync script write it.
- `tests/fixtures/drops/*.json`: fixed sample drops the tests use instead of the real ones (`DROPS_DIR`), so new posts never change what the tests see. CI builds the real site too, to check every real drop.
- `src/components/drops/`: the retro post card (`XPost.tsx`), X's official embed fallback (`XEmbed.tsx`), the feed and the day view. Day pages are in `src/pages/today/`.
- `src/lib/shareCards.ts` and `src/lib/shareImage.ts`: share images (D29), the picture shown when a link is shared on X, iMessage or Discord. Every page gets a 1200×630 PNG at `/og/<path>.png`, drawn at build time as a retro window with the page's title bar, title and summary. Add a page to `buildShareCards` to give it its own; pages left out use the homepage's. Each drop's card shows the drop's picture (a video's poster with a play button), downloaded from X at build time and kept in `.cache/share-pictures/` (git-ignored; CI caches it); if the download fails, the card is drawn as text only (D34).
- `src/pages/rss.xml.ts`: the RSS feed of articles at `/rss.xml`. `src/pages/drops.xml.ts`: the drops feed at `/drops.xml` (D32), the newest 60 drops with their pictures, each linking to the drop's own page. `src/pages/drops/[id].astro`: a page per drop at `/drops/<id>/` (D34), the link to share; every drop card has a Share button (the share sheet on phones, copy link elsewhere) and its title bar's time links there.
- `src/layouts/WindowPage.astro`: real-URL pages (articles, Contact, About) shown as a maximized window.
- `src/styles/tokens.css`: design tokens.
- `/mockups/trend-roundup`, `/mockups/mobile`: Phase 0 mockups.
- `src/components/player/GrailPlayer.tsx`: the background player, kept alive across pages from `Base.astro`. Playlist in `src/lib/tracks.ts` (add `src` to a track for real audio); shared open/minimize/mute state in `src/lib/player.ts`.
- `src/components/icons/pixelIcons.ts`: the pixel icons, one text grid per icon (D16).
- `src/components/Logo.astro`: the logo (`full` wordmark or compact `mark`). Its paths come from `nostalgia_logo_v1.png`; after changing the artwork, run `node scripts/trace-logo.mjs` (and update `SPARKLE_HINTS` / `FOREGROUND_HINTS` there if sparkles or the pieces in front of the globe move). The spinning globe lives in `src/components/logo/globe.ts`; set `LOGO_VARIANT = 'classic'` in `src/lib/site.ts` to go back to the flat logo.

## Preview deploy

Every push to `main` (and every finished "Sync drops" run, so new drops show up) builds the site and publishes it to GitHub Pages at https://preview.internetgrails.com (`.github/workflows/deploy.yml`, D30). The preview is built with `SITE_URL` set to that address, so its links and share images point at the preview, and every page says `noindex` so search engines leave it alone. internetgrails.com keeps its coming-soon page until launch (D22).

Work happens on branches (D31): `main` is what's on the preview, so each feature gets its own branch and is merged into `main` when it's finished. CI checks every branch push; only `main` deploys. A push that only adds drops doesn't deploy by itself: the deploy runs once "Sync drops" has filled the drop in.

To build the preview locally: `SITE_URL=https://preview.internetgrails.com npm run build`.

One-time setup (already done once it's live):

1. GitHub repo → Settings → Pages → Build and deployment → Source: **GitHub Actions**.
2. Same page → Custom domain: `preview.internetgrails.com` → Save.
3. At Network Solutions, add a DNS record: type **CNAME**, host `preview`, value `actuallykatsu.github.io`. Leave the other records alone, so the coming-soon page stays.
4. Once GitHub has issued the certificate (minutes to an hour), tick **Enforce HTTPS**.
5. Optional: in GitHub's account settings → Pages, verify `internetgrails.com` so no other GitHub account can claim its subdomains.
6. For the contact form, set `PUBLIC_CONTACT_ENDPOINT` and `PUBLIC_CONTACT_ACCESS_KEY` under Settings → Secrets and variables → Actions → **Variables**.

## Placeholders to replace

- TikTok handle in `src/lib/site.ts`.
- About page copy.
- Contact form: set `PUBLIC_CONTACT_ENDPOINT` (and `PUBLIC_CONTACT_ACCESS_KEY` for Web3Forms) once a forms-service account exists. Copy `.env.example` to `.env` locally; for the deployed site, set them as build environment variables. Until then it opens the email app.
- Sample posts and `public/samples/` media. (Sample drops are test fixtures now and stay.)
