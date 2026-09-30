const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { mkdirSync, readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const fingerprint = file => createHash('sha256').update(readFileSync(`site/${file}`)).digest('hex').slice(0, 8);

test('five sections are readable, accessible, and usable without JavaScript', async ({ page }, testInfo) => {
  const failures = [];
  const externalRequests = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
  });
  page.on('request', request => {
    if (!request.url().startsWith('http://127.0.0.1:4173/')) externalRequests.push(request.url());
  });
  await page.goto('/');

  await expect(page).toHaveTitle('Luke Pionk — AI agents and data systems for work that has to be trusted');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('I build AI agents and data systems for work that has to be trusted.');
  await expect(page.locator('main > section')).toHaveCount(5);
  await expect(page.getByRole('heading', { level: 2 })).toHaveText([
    'Work',
    'Lessons I build by.',
    'Learning',
    'What are you trying to make better?',
  ]);
  await expect(page.locator('.lesson')).toHaveCount(4);
  await expect(page.locator('.learning-panel')).toHaveCount(3);
  await expect(page.locator('.learning-panel li')).toHaveCount(13);
  await expect(page.locator('.hero-links a')).toHaveCount(3);
  await expect(page.locator('address')).toHaveCount(1);
  await expect(page.locator('body > footer')).toHaveCount(1);
  await expect(page.locator('form, script, iframe')).toHaveCount(0);
  expect(externalRequests).toEqual([]);
  expect(failures).toEqual([]);

  // Check both the normal viewport and a narrow phone / 200% desktop zoom equivalent.
  for (const width of [testInfo.project.use.viewport?.width || 390, 320, 720, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, `horizontal overflow at ${width}px`).toBe(false);
  }

  for (const viewport of [testInfo.project.use.viewport || { width: 390, height: 844 }, { width: 320, height: 900 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(viewport);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
    expect(results.violations, `accessibility violations at ${viewport.width}px`).toEqual([]);
    const heroActionBox = await page.locator('.hero-links a').first().boundingBox();
    const contactEmailBox = await page.locator('.contact-email').boundingBox();
    expect(heroActionBox.height).toBeGreaterThanOrEqual(44);
    expect(contactEmailBox.height).toBeGreaterThanOrEqual(44);
  }

  await page.setViewportSize({ width: 320, height: 900 });
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
  await page.getByRole('navigation').getByRole('link', { name: 'Learning' }).click();
  await expect(page).toHaveURL(/#learning$/);
  await expect(page.locator('.contact-email')).toHaveAttribute('href', 'mailto:l.a.pionk@gmail.com');

  const brokenAnchors = await page.evaluate(() => [...document.querySelectorAll('a[href^="#"]')]
    .map(a => a.getAttribute('href').slice(1))
    .filter(id => !document.getElementById(id)));
  expect(brokenAnchors).toEqual([]);

  await expect(page.locator('.panel-read')).toBeVisible();
  await expect(page.locator('.panel-watch')).toBeHidden();
  await page.locator('label[for="tab-watch"]').click();
  await expect(page.locator('.panel-watch')).toBeVisible();
  await expect(page.locator('.panel-read')).toBeHidden();
  await page.locator('#tab-read').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#tab-listen')).toBeChecked();
  await expect(page.locator('.panel-listen')).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');

  await page.goto('/');
  mkdirSync('.agent-scratch', { recursive: true });
  await page.setViewportSize(testInfo.project.use.viewport || { width: 390, height: 844 });
  await page.screenshot({ path: `.agent-scratch/${testInfo.project.name}.png`, fullPage: true });
});

test('asset links carry current fingerprints and icons have intrinsic sizes', async ({ page }) => {
  for (const path of ['/', '/404.html']) {
    await page.goto(path);
    await expect(page.locator('link[rel="stylesheet"]')).toHaveAttribute('href', `/styles.css?v=${fingerprint('styles.css')}`);
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', `/favicon.svg?v=${fingerprint('favicon.svg')}`);
    expect(await page.locator('svg:not([width])').count()).toBe(0);
  }
});

test('missing-page document gives a useful route home', async ({ page }) => {
  await page.goto('/404.html');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('A wrong turn.');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
  expect(results.violations).toEqual([]);
  await page.getByRole('link', { name: 'Back to Luke Pionk’s website' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('I build AI agents and data systems for work that has to be trusted.');
});
