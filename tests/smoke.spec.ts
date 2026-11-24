import { test, expect, type Page } from '@playwright/test';

// Islands ignore clicks until React hydrates; Astro removes the `ssr` attribute when done.
async function hydrated(page: Page) {
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
}

// Skip the boot screen in every test, like a returning visitor.
// Keep tests off X's servers: the official embed then stays a plain link (D25).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('ig-booted', '1'));
  await page.route('https://platform.twitter.com/**', (route) => route.abort());
});

test('desktop loads with icons and taskbar', async ({ page, isMobile }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Memes' })).toBeVisible();
  // Phones swap the Start button for a status bar (D20).
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible({ visible: !isMobile });
  await expect(page.locator('.ig-phone-status')).toBeVisible({ visible: isMobile });
});

test('?boot plays the boot screen even for a returning, reduced-motion visitor', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?boot');
  const boot = page.getByRole('dialog', { name: 'Starting Internet Grails' });
  await expect(boot).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(boot).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Memes' })).toBeVisible();
});

// X's video server refuses requests that name another site as the referrer (D28).
test('pages send no referrer to other sites, so X videos play', async ({ page }) => {
  for (const url of ['/', '/today/']) {
    await page.goto(url);
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'same-origin');
  }
});

// Share images (D29): each page points at its own 1200×630 PNG, and it exists.
test('pages have their own share image', async ({ page, request }) => {
  const pages = {
    '/': '/og/index.png',
    '/about/': '/og/about.png',
    '/today/': '/og/today.png',
    '/posts/welcome-to-the-grails/': '/og/posts/welcome-to-the-grails.png',
    '/mockups/mobile/': '/og/index.png',
    '/drops/sample-meme-1/': '/og/drops/sample-meme-1.png',
    '/drops/sample-video-1/': '/og/drops/sample-video-1.png',
  };
  for (const [url, image] of Object.entries(pages)) {
    await page.goto(url);
    const content = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(new URL(content ?? '').pathname, url).toBe(image);
    const res = await request.get(image);
    expect(res.ok(), image).toBe(true);
    expect(res.headers()['content-type']).toContain('image/png');
    // A PNG's width and height sit at bytes 16-23 of its header.
    const png = await res.body();
    expect([png.readUInt32BE(16), png.readUInt32BE(20)], image).toEqual([1200, 630]);
  }
});

test('phone layout: apps fill the screen and back goes home', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout only');
  await page.goto('/?w=news');
  await hydrated(page);
  const news = page.getByRole('dialog', { name: /News/ });
  // Poll: the window scales in with an open animation.
  await expect
    .poll(async () => Math.round((await news.boundingBox())?.width ?? 0))
    .toBe(page.viewportSize()?.width);
  await news.getByRole('link', { name: /Welcome to Internet Grails/ }).tap();
  await expect(page).toHaveURL(/\/posts\//);
  await page.getByRole('link', { name: 'Back', exact: true }).tap();
  await expect(page).toHaveURL(/\?w=news/);
  await hydrated(page);
  await page.getByRole('button', { name: 'Back to home' }).tap();
  await expect(news).toBeHidden();
  await expect(page).not.toHaveURL(/\?w=/);
});

test('opening a section window updates the URL', async ({ page, isMobile }) => {
  await page.goto('/');
  await hydrated(page);
  const icon = page.getByRole('button', { name: 'News' });
  if (isMobile) await icon.tap();
  else await icon.dblclick();
  await expect(page.getByRole('dialog', { name: /News/ })).toBeVisible();
  await expect(page).toHaveURL(/\?w=news/);
});

test('logo globe spins, slowly for reduced motion', async ({ browser }) => {
  const land = '.ig-desktop__wordmark .ig-globe__land';
  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    const context = await browser.newContext({ reducedMotion });
    await context.addInitScript(() => sessionStorage.setItem('ig-booted', '1'));
    const page = await context.newPage();
    await page.goto('/');
    const first = await page.locator(land).getAttribute('d');
    expect(first?.length).toBeGreaterThan(100);
    await page.waitForTimeout(1200);
    const later = await page.locator(land).getAttribute('d');
    // Reduced motion still turns (D15), just at a quarter of the speed.
    expect(later).not.toBe(first);
    await context.close();
  }
});

test('background player plays, minimizes and survives navigation', async ({ page, isMobile }) => {
  await page.goto('/?w=contact');
  await hydrated(page);
  if (isMobile) {
    // Phones have no Start menu (D20): close the app, then tap the home-screen icon.
    await page.getByRole('button', { name: 'Back to home' }).tap();
    await page.getByRole('button', { name: 'Grail Player' }).tap();
  } else {
    await page.getByRole('button', { name: 'Start' }).click();
    await page.getByRole('menuitem', { name: 'Grail Player' }).click();
  }
  const player = page.getByRole('region', { name: 'Grail Player' });
  await player.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(player).toContainText('0:01 /');
  await player.getByRole('button', { name: 'Next track' }).click();
  await expect(player.getByRole('button', { name: /Away Message/ })).toHaveAttribute(
    'aria-current',
    'true',
  );

  // Minimize, restore, and change page client-side: the same player keeps playing.
  await player.getByRole('button', { name: 'Minimize player' }).click();
  await expect(player).toBeHidden();
  const miniBar = page.getByRole('region', { name: 'Now playing' });
  if (isMobile) {
    // Phones get a mini player bar instead of a taskbar button; reopen Contact behind it.
    await page.getByRole('button', { name: 'Contact' }).tap();
  } else {
    await page
      .getByRole('navigation', { name: 'Open windows' })
      .getByRole('button', { name: 'Grail Player' })
      .click();
    await expect(player).toBeVisible();
  }

  await page.evaluate(() => ((window as unknown as { igMarker: boolean }).igMarker = true));
  await page.getByRole('link', { name: /full Contact page/ }).click();
  await expect(page).toHaveURL(/\/contact\/$/);
  const marker = await page.evaluate(() => (window as unknown as { igMarker?: boolean }).igMarker);
  expect(marker, 'navigation should not reload the page').toBe(true);
  if (isMobile) await miniBar.getByRole('button', { name: /Away Message/ }).tap();
  await expect(player).toBeVisible();
  await expect(player).toContainText('Away Message');
  await expect(player.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
});

test('mobile wireframes render three screens', async ({ page }) => {
  await page.goto('/mockups/mobile/');
  await expect(page.locator('.ig-phone')).toHaveCount(3);
});

// D18: one font per region. Inside window content panes everything reads in the body
// font; only chrome (title bars, buttons) uses the pixel font.
test('window contents use a single font', async ({ page }) => {
  for (const url of [
    '/?w=news,contact,about,memes,search',
    '/?w=videos',
    '/posts/sample-trend-roundup/',
    '/today/',
  ]) {
    await page.goto(url);
    const offenders = await page.evaluate(() => {
      const bad: string[] = [];
      for (const body of document.querySelectorAll('.ig-window__body')) {
        for (const el of body.querySelectorAll<HTMLElement>('*')) {
          if (el.closest('.ig-titlebar, .ig-btn, svg')) continue;
          const hasText = [...el.childNodes].some(
            (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
          );
          if (hasText && !getComputedStyle(el).fontFamily.includes('Inter')) {
            bad.push(el.tagName + '.' + el.className + ': ' + el.textContent?.trim().slice(0, 30));
          }
        }
      }
      return bad;
    });
    expect(offenders, url).toEqual([]);
  }
});

test('window is restorable from a link', async ({ page }) => {
  await page.goto('/?w=contact');
  await expect(page.getByRole('dialog', { name: 'Contact' })).toBeVisible();
});

test('boot screen can be skipped', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/');
  const boot = page.getByRole('dialog', { name: 'Starting Internet Grails' });
  await expect(boot).toBeVisible();
  await page.keyboard.press('Space');
  await expect(boot).toBeHidden();
  await context.close();
});

test('contact page shows official details without the desktop', async ({ page }) => {
  await page.goto('/contact/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Contact Internet Grails');
  await expect(page.getByRole('main')).toContainText('marketing@internetgrails.com');
  await expect(page.getByRole('main')).toContainText('@internetgrails');
});

test('policy pages are linked from About and link to each other', async ({ page }) => {
  await page.goto('/about/');
  const policies = [
    ['Privacy policy', '/privacy/'],
    ['Terms of use', '/terms/'],
    ['Community guidelines', '/guidelines/'],
  ] as const;
  for (const [label, href] of policies) {
    await expect(page.getByRole('main').getByRole('link', { name: label })).toHaveAttribute(
      'href',
      href,
    );
  }
  for (const [label, href] of policies) {
    await page.goto(href);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(label);
    const nav = page.getByRole('navigation', { name: 'Policies' });
    await expect(nav).toContainText('Last updated');
    await expect(nav.locator('[aria-current="page"]')).toHaveText(label);
    await expect(nav.getByRole('link')).toHaveCount(policies.length - 1);
  }
  await page.goto('/contact/');
  await expect(page.getByRole('link', { name: 'privacy policy' })).toHaveAttribute(
    'href',
    '/privacy/',
  );
});

test('every page carries Organization structured data', async ({ page }) => {
  await page.goto('/about/');
  const json = await page.locator('script[type="application/ld+json"]').first().textContent();
  expect(JSON.parse(json ?? '{}')).toMatchObject({
    '@type': 'Organization',
    name: 'Internet Grails',
  });
});

test('article renders and the meme viewer opens', async ({ page }) => {
  await page.goto('/posts/sample-meme-drop/');
  await hydrated(page);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Meme Drop');
  await page.getByRole('button', { name: /Placeholder caption one/ }).click();
  await expect(page.getByRole('dialog', { name: 'Image viewer' })).toContainText('Credit:');
});

// D21: the contact form posts to a forms service when one is configured at build time
// (CI sets a fake one and intercepts it); otherwise it falls back to the email app.
test('contact form sends a message', async ({ page }) => {
  await page.goto('/contact/');
  await hydrated(page);
  const form = page.locator('form.ig-form');
  const mode = await form.getAttribute('data-mode');
  if (mode === 'email') {
    await expect(form).toHaveAttribute('action', 'mailto:marketing@internetgrails.com');
    await expect(form).toContainText('Opens your email app');
    return;
  }

  let sent: Record<string, string> = {};
  let fail = true;
  await page.route(String(await form.getAttribute('action')), async (route) => {
    sent = route.request().postDataJSON();
    if (fail) await route.fulfill({ status: 500, json: { success: false } });
    else await route.fulfill({ json: { success: true } });
  });
  await form.getByLabel('Name').fill('Test Person');
  await form.getByLabel('Email').fill('test@example.com');
  await form.getByLabel('Message').fill('Hello from the smoke test.');

  // A failed send keeps the message and offers the email address.
  await form.getByRole('button', { name: 'Send' }).click();
  await expect(form).toContainText('didn’t go through');
  await expect(form.getByLabel('Message')).toHaveValue('Hello from the smoke test.');

  fail = false;
  await form.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByRole('status')).toContainText('Message sent');
  await expect(page.getByRole('status')).toContainText('test@example.com');
  expect(sent).toMatchObject({ name: 'Test Person', message: 'Hello from the smoke test.' });
  expect(sent.website).toBeUndefined();
});

// D23: breaking posts scroll in the tray ticker, which can be paused, and stay still
// (one headline at a time) for reduced motion.
test('breaking ticker scrolls, pauses and links to the post', async ({ page, browser }) => {
  await page.goto('/');
  await hydrated(page);
  const ticker = page.getByRole('region', { name: 'Breaking news' });
  const track = ticker.locator('.ig-ticker__track');
  await expect(track).toHaveCSS('animation-name', 'ig-ticker');
  await ticker.getByRole('button', { name: 'Pause ticker' }).click();
  await expect(track).toHaveCSS('animation-play-state', 'paused');
  await ticker.getByRole('button', { name: 'Resume ticker' }).click();
  await ticker.getByRole('link', { name: 'Welcome to Internet Grails' }).click();
  await expect(page).toHaveURL(/\/posts\/welcome-to-the-grails\/$/);

  const context = await browser.newContext({ reducedMotion: 'reduce' });
  await context.addInitScript(() => sessionStorage.setItem('ig-booted', '1'));
  const still = await context.newPage();
  await still.goto('/');
  await hydrated(still);
  const stillTicker = still.getByRole('region', { name: 'Breaking news' });
  await expect(stillTicker.locator('.ig-ticker__still')).toHaveText('Welcome to Internet Grails');
  await expect(stillTicker.locator('.ig-ticker__track')).toHaveCount(0);
  await context.close();
});

test('RSS feed lists published posts', async ({ request }) => {
  const res = await request.get('/rss.xml');
  expect(res.ok()).toBe(true);
  const xml = await res.text();
  expect(xml).toContain('<title>Internet Grails</title>');
  expect(xml).toContain('/posts/welcome-to-the-grails/');
});

// D34: every drop has its own page to share; its card links there and copies the link.
test('each drop has its own page with a share button', async ({ page, context, isMobile }) => {
  await page.goto('/today/2026-11-24/');
  await hydrated(page);
  await page
    .locator('#drop-sample-meme-1')
    .getByRole('link', { name: /^Meme ·/ })
    .click();
  await expect(page).toHaveURL(/\/drops\/sample-meme-1\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sample meme drop: one image.');
  await expect(page).toHaveTitle('Sample meme drop: one image. · Internet Grails');
  await expect(
    page.getByRole('link', { name: /More from Tuesday, November 24, 2026/ }),
  ).toHaveAttribute('href', '/today/2026-11-24/#drop-sample-meme-1');
  // Phones open the share sheet instead of copying.
  test.skip(isMobile, 'copying the link is the desktop behavior');
  await hydrated(page);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Share' }).click();
  await expect(page.getByRole('button', { name: 'Link copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
    /\/drops\/sample-meme-1\/$/,
  );
});

// D32: drops get their own feed, apart from the articles.
test('drops feed lists drops, newest first, linking to their day', async ({ request }) => {
  const res = await request.get('/drops.xml');
  expect(res.ok()).toBe(true);
  const xml = await res.text();
  expect(xml).toContain('<title>Internet Grails: drops</title>');
  const titles = [...xml.matchAll(/<item><title>([^<]*)<\/title>/g)].map((m) => m[1]);
  expect(titles[0]).toMatch(/^Sample video drop/);
  expect(titles[1]).toBe('Sample meme drop: one image.');
  expect(xml).toContain('/drops/sample-meme-1/</link>');
  expect(xml).not.toContain('/posts/welcome-to-the-grails/');
  const rssXml = await (await request.get('/rss.xml')).text();
  expect(rssXml).not.toContain('#drop-');
});

// D32: after breaking posts, the ticker shows the newest day's drops, each linking to its page.
test('ticker shows the latest drops after breaking posts', async ({ page }) => {
  await page.goto('/about/');
  await hydrated(page);
  const ticker = page.getByRole('region', { name: 'Breaking news' });
  const links = ticker.locator('.ig-ticker__run:not([aria-hidden]) a');
  await expect(links.first()).toHaveText('Welcome to Internet Grails');
  await expect(links).toHaveCount(3);
  const meme = ticker.getByRole('link', { name: 'New drop: Sample meme drop: one image.' }).first();
  await expect(meme).toHaveAttribute('href', '/drops/sample-meme-1/');
});

// D24: Pagefind builds the index after `astro build`, so this needs the built site
// (CI runs tests against `astro preview`). Under `astro dev` the window says so instead.
test('search finds posts by their text', async ({ page }) => {
  await page.goto('/?w=search');
  await hydrated(page);
  const win = page.getByRole('dialog', { name: 'Find: All Posts' });
  await win.getByRole('searchbox').fill('interview');
  await expect(win.locator('.ig-search__results')).not.toBeEmpty();
  if (await win.getByText('Search runs on the built site').isVisible()) {
    test.skip(true, 'no search index under astro dev');
  }
  const hit = win.getByRole('link', { name: /Now Showing/ });
  await expect(hit).toBeVisible();
  await expect(hit.locator('mark').first()).toHaveText(/interview/i);
  await win.getByRole('searchbox').fill('zzzqqqnothing');
  await expect(win).toContainText('No posts match');
});

// D25: X posts are drawn in the site's own style, photos open in the image viewer, and a
// drop we have no copy of shows X's official embed.
test('memes window draws drops and falls back to the X embed', async ({ page }) => {
  await page.goto('/?w=memes');
  await hydrated(page);
  const win = page.getByRole('dialog', { name: /Memes/ });
  const card = win.getByRole('article', { name: /Post by Internet Grails/ }).first();
  await expect(card).toContainText('Sample meme drop: one image.');
  await expect(card.getByRole('link', { name: /View on X/ })).toHaveAttribute('href', /x.com/);
  await card.getByRole('button', { name: /Open image 1/ }).click();
  const viewer = page.getByRole('dialog', { name: 'Image viewer' });
  await expect(viewer).toContainText('Credit: @internetgrails');
  // Esc closes the viewer but not the window it opened from.
  await page.keyboard.press('Escape');
  await expect(viewer).toBeHidden();
  await expect(win).toBeVisible();

  const embed = win.getByRole('article', { name: 'Post on X' });
  await expect(embed.locator('blockquote.twitter-tweet a')).toHaveAttribute(
    'href',
    'https://x.com/jack/status/20',
  );
  // Videos stay out of Memes.
  await expect(win.locator('video')).toHaveCount(0);
});

test('a drop whose media fails shows the X embed instead', async ({ page }) => {
  await page.route('**/samples/meme-1.svg', (route) => route.fulfill({ status: 404 }));
  await page.goto('/?w=memes');
  await hydrated(page);
  const win = page.getByRole('dialog', { name: /Memes/ });
  await expect(win.getByText('Sample meme drop: one image.')).toHaveCount(0);
  await expect(win.getByRole('article', { name: 'Post on X' })).toHaveCount(2);
});

test('videos window plays video drops on the site', async ({ page }) => {
  await page.goto('/?w=videos');
  await hydrated(page);
  const win = page.getByRole('dialog', { name: /Videos/ });
  const video = win.getByLabel(/Video from Internet Grails/);
  await expect(video).toHaveAttribute('poster', /drop-video-poster/);
  await video.evaluate((v: HTMLVideoElement) => {
    v.muted = true;
    return v.play();
  });
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime))
    .toBeGreaterThan(0);
});

test("Today's Grails shows the latest day and links to earlier ones", async ({ page }) => {
  await page.goto('/today/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tuesday, November 24, 2026');
  await expect(page.getByRole('main')).toContainText('1 video · 1 meme');
  await page.getByRole('link', { name: /Older: Monday, November 23/ }).click();
  await expect(page).toHaveURL(/\/today\/2026-11-23\/$/);
  await expect(page.getByRole('main')).toContainText('Sample meme drop with two images');
  await expect(page.getByRole('link', { name: /Newer: Tuesday/ })).toHaveAttribute(
    'href',
    '/today/2026-11-24/',
  );
});
