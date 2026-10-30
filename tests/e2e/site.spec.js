// The same scenarios run on every project (phone, tablet, desktop); layout checks branch on the viewport width.
const { test, expect } = require('@playwright/test');

const layout = page => { const w = page.viewportSize().width; return w < 700 ? 'phone' : w < 1100 ? 'tablet' : 'desktop'; };

// Fail on any console error or uncaught exception.
test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  page.errors = errors;
});
test.afterEach(async ({ page }) => { expect(page.errors, 'console errors').toEqual([]); });

async function noHorizontalScroll(page) {
  const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  expect(sw, 'page must not scroll sideways').toBeLessThanOrEqual(iw);
}
const visibleCols = page => page.locator('#cols .col:visible');

test('opens on the latest year with the real winner and each model\'s pick', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/2026/);
  await expect(page.locator('.year-title h1')).toHaveText('2026');
  await expect(page.locator('#winner strong')).toHaveText('Harry Kane');
  await expect(page.locator('#picks .pick')).toHaveCount(3);
  await expect(page.locator('#picks')).toContainText('Prediction picks');
  await noHorizontalScroll(page);
});

test('year navigation: arrows, year picker and old links', async ({ page }) => {
  await page.goto('/#/2026');
  await page.getByRole('button', { name: 'Previous year' }).click();
  await expect(page).toHaveURL(/#\/2025$/);
  await expect(page.locator('.year-title h1')).toHaveText('2025');
  await expect(page.locator('#winner strong')).toHaveText('Ousmane Dembélé');
  await expect(page.getByRole('button', { name: 'Next year' })).toBeEnabled();

  await page.locator('#year-select').selectOption('1998');
  await expect(page).toHaveURL(/#\/1998$/);
  await expect(page.locator('#winner strong')).toHaveText('Zinedine Zidane');

  await page.goto('/#a1956');
  await expect(page.locator('.year-title h1')).toHaveText('1956');
  await expect(page.getByRole('button', { name: 'Previous year' })).toBeDisabled();

  await page.goto('/#/2020');
  await expect(page.locator('#winner strong')).toHaveText('Not awarded');
});

test('layout matches the device', async ({ page }) => {
  await page.goto('/#/2018');
  const L = layout(page);
  if (L === 'phone') {
    await expect(page.locator('.tab-bar')).toBeVisible();
    await expect(page.locator('.top-nav')).toBeHidden();
    await expect(page.locator('#timeline')).toBeHidden();
    await expect(visibleCols(page)).toHaveCount(1);
    await expect(page.getByRole('tab', { name: 'Actual' })).toHaveAttribute('aria-selected', 'true');
  } else {
    await expect(page.locator('.tab-bar')).toBeHidden();
    await expect(page.locator('.top-nav')).toBeVisible();
    await expect(page.locator('#timeline')).toBeVisible();
    await expect(visibleCols(page)).toHaveCount(4);
    const boxes = await visibleCols(page).evaluateAll(cs => cs.map(c => c.getBoundingClientRect().top));
    const rows = new Set(boxes.map(Math.round)).size;
    expect(rows).toBe(L === 'tablet' ? 2 : 1);
  }
  if (L === 'desktop') await expect(page.locator('#detail .empty-detail')).toBeVisible();
  else await expect(page.locator('#detail')).toBeHidden();
  await noHorizontalScroll(page);
});

test('phone: model tabs switch the visible list', async ({ page }) => {
  await page.goto('/#/2018');
  test.skip(layout(page) !== 'phone', 'phone only');
  await page.getByRole('tab', { name: 'Fair' }).click();
  await expect(visibleCols(page)).toHaveCount(1);
  await expect(page.locator('#col-fair')).toBeVisible();
  await expect(page.locator('#col-real')).toBeHidden();
  await page.getByRole('tab', { name: 'Fair' }).press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Mine' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#col-mine')).toBeVisible();
});

test('phone: swiping sideways changes model', async ({ page, browserName }) => {
  await page.goto('/#/2018');
  test.skip(layout(page) !== 'phone' || browserName !== 'chromium', 'touch events constructed in Chromium only');
  const swipe = dx => page.locator('#cols').evaluate((el, dx) => {
    const t = (x) => [new Touch({ identifier: 1, target: el, clientX: x, clientY: 300 })];
    el.dispatchEvent(new TouchEvent('touchstart', { touches: t(200), changedTouches: t(200), bubbles: true }));
    el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: t(200 + dx), bubbles: true }));
  }, dx);
  await swipe(-120);
  await expect(page.getByRole('tab', { name: 'Prediction' })).toHaveAttribute('aria-selected', 'true');
  await swipe(120);
  await expect(page.getByRole('tab', { name: 'Actual' })).toHaveAttribute('aria-selected', 'true');
});

test('player detail opens, loads sources and closes', async ({ page }) => {
  await page.goto('/#/2018');
  const row = page.locator('#col-real .row', { hasText: 'Luka Modrić' });
  await row.click();
  const detail = page.locator('#detail');
  await expect(detail.locator('h2')).toHaveText('Luka Modrić');
  await expect(detail).toContainText('League + Europe');
  await expect(detail.locator('.brk h3')).toHaveCount(3);
  await expect(detail.locator('.src a').first()).toBeVisible();   // sources.json fetched on demand
  await expect(row).toHaveAttribute('aria-pressed', 'true');
  if (layout(page) === 'desktop') {
    await expect(detail.locator('.close')).toBeHidden();
  } else {
    await expect(detail).toBeInViewport();
    await expect(detail.locator('.close')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(detail).toBeHidden();
    await expect(row).toBeFocused();
    await row.click();
    await expect(detail).toBeInViewport();
    await page.locator('#detail .close').click();
    await expect(detail).toBeHidden();
  }
});

test('"Everyone" list shows retroactive winners and is remembered', async ({ page }) => {
  await page.goto('/#/1986');
  await expect(page.locator('#winner strong')).toHaveText('Igor Belanov');
  await page.getByRole('button', { name: 'Everyone' }).click();
  await expect(page.locator('#winner')).toContainText('Retroactive winner');
  await expect(page.locator('#winner strong')).toHaveText('Diego Maradona');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Everyone' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Eligible only' }).click();
  await expect(page.locator('#winner strong')).toHaveText('Igor Belanov');
});

test('tuning "My model" re-ranks it without losing the slider', async ({ page }) => {
  await page.goto('/#/2018');
  const tune = page.locator('#tune');
  if (!(await tune.evaluate(d => d.open))) await tune.locator('summary').click();
  const before = await page.locator('#col-mine .row .sc').allTextContents();
  const slider = page.locator('#s_wTeam');
  await slider.fill('0.6');
  await expect(page.locator('#v_wTeam')).toHaveText('60%');
  await expect.poll(() => page.locator('#col-mine .row .sc').allTextContents()).not.toEqual(before);
  await page.getByRole('button', { name: 'Reset to defaults' }).click();
  await expect(page.locator('#v_wTeam')).toHaveText('20%');
  await expect.poll(() => page.locator('#col-mine .row .sc').allTextContents()).toEqual(before);
});

test('summary: cards, chart and every year', async ({ page }) => {
  await page.goto('/#/summary');
  await expect(page.locator('h1')).toHaveText('How often each model gets it right');
  await expect(page.locator('.stat')).toHaveCount(3);
  await expect(page.locator('#cum-chart svg path')).toHaveCount(3);
  await expect(page.locator('.years-table tbody tr')).toHaveCount(71);
  if (layout(page) === 'desktop') {
    const box = await page.locator('#cum-hit').boundingBox();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await expect(page.locator('#cum-tip')).toBeVisible();
    await expect(page.locator('#cum-tip b')).toHaveText(/^\d{4}$/);
  }
  await page.locator('.years-table a', { hasText: '2010' }).click();
  await expect(page).toHaveURL(/#\/2010$/);
  await page.goto('/#resumo');
  await expect(page.locator('.stat')).toHaveCount(3);
  await noHorizontalScroll(page);
});

test('method page shows the weights for the next award', async ({ page }) => {
  await page.goto('/#/method');
  await expect(page.locator('h1')).toHaveText('How it works');
  expect(await page.locator('.wbar').count()).toBeGreaterThan(5);
  await expect(page.locator('aside h2')).toContainText('2027');
  await noHorizontalScroll(page);
});

test('navigation bar reaches every section', async ({ page }) => {
  await page.goto('/');
  const nav = layout(page) === 'phone' ? page.locator('.tab-bar') : page.locator('.top-nav');
  await nav.getByRole('link', { name: 'Summary' }).click();
  await expect(page).toHaveURL(/#\/summary$/);
  await expect(nav.getByRole('link', { name: 'Summary' })).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('link', { name: 'Method' }).click();
  await expect(page.locator('h1')).toHaveText('How it works');
  await nav.getByRole('link', { name: 'Years' }).click();
  await expect(page.locator('.year-title h1')).toHaveText('2026');
});
