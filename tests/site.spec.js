const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { mkdirSync } = require('node:fs');

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

  await expect(page).toHaveTitle('Luke Pionk — Software, AI & operations');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Luke Pionk.');
  await expect(page.locator('main > section')).toHaveCount(5);
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Now', 'Resources', 'Work', 'Contact']);
  await expect(page.locator('#now li')).toHaveCount(4);
  await expect(page.locator('.resource-list li')).toHaveCount(8);
  await expect(page.getByRole('link', { name: 'View source on GitHub' })).toHaveAttribute('href', 'https://github.com/lukepionk/lukepionk.com');
  await expect(page.locator('form, script, iframe')).toHaveCount(0);
  expect(externalRequests).toEqual([]);
  expect(failures).toEqual([]);

  // Check both the normal viewport and a narrow phone / 200% desktop zoom equivalent.
  for (const width of [testInfo.project.use.viewport?.width || 390, 320, 720]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, `horizontal overflow at ${width}px`).toBe(false);
  }

  await page.setViewportSize(testInfo.project.use.viewport || { width: 390, height: 844 });
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']).analyze();
  expect(results.violations).toEqual([]);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
  await page.getByRole('navigation').getByRole('link', { name: 'Resources' }).click();
  await expect(page).toHaveURL(/#resources$/);
  await expect(page.getByRole('link', { name: 'l.a.pionk@gmail.com' })).toHaveAttribute('href', 'mailto:l.a.pionk@gmail.com');

  const brokenAnchors = await page.evaluate(() => [...document.querySelectorAll('a[href^="#"]')]
    .map(a => a.getAttribute('href').slice(1))
    .filter(id => !document.getElementById(id)));
  expect(brokenAnchors).toEqual([]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');

  await page.goto('/');
  mkdirSync('.agent-scratch', { recursive: true });
  await page.screenshot({ path: `.agent-scratch/${testInfo.project.name}.png`, fullPage: true });
});

test('missing-page document gives a useful route home', async ({ page }) => {
  await page.goto('/404.html');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('A wrong turn.');
  await page.getByRole('link', { name: 'Back to Luke Pionk’s website' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Luke Pionk.');
});
