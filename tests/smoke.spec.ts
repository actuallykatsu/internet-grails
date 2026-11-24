import { test, expect, type Page } from '@playwright/test';

// Islands ignore clicks until React hydrates; Astro removes the `ssr` attribute when done.
async function hydrated(page: Page) {
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
}

// Skip the boot screen in every test, like a returning visitor.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('ig-booted', '1'));
});

test('desktop loads with icons and taskbar', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Memes' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
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

test('media player mockup plays and changes track', async ({ page }) => {
  await page.goto('/mockups/media-player/');
  await hydrated(page);
  const player = page.getByRole('region', { name: /Media player/ });
  await player.getByRole('button', { name: 'Play' }).click();
  await expect(player).toContainText('0:01 /');
  await player.getByRole('button', { name: 'Next track' }).click();
  await expect(player.getByRole('button', { name: /Away Message/ })).toHaveAttribute(
    'aria-current',
    'true',
  );
});

test('mobile wireframes render three screens', async ({ page }) => {
  await page.goto('/mockups/mobile/');
  await expect(page.locator('.ig-phone')).toHaveCount(3);
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
