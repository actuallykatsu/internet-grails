import { test, expect, type Page } from '@playwright/test';

// Islands ignore clicks until React hydrates; Astro removes the `ssr` attribute when done.
async function hydrated(page: Page) {
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
}

// Skip the boot screen in every test, like a returning visitor.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('ig-booted', '1'));
});

test('desktop loads with icons and taskbar', async ({ page, isMobile }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Memes' })).toBeVisible();
  // Phones swap the Start button for a status bar (D20).
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible({ visible: !isMobile });
  await expect(page.locator('.ig-phone-status')).toBeVisible({ visible: isMobile });
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
  for (const url of ['/?w=news,contact,about,memes', '/posts/sample-trend-roundup/']) {
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
