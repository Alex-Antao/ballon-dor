// Layout guard: no visible text may spill out of the box that holds it (cards, tiles, badges, buttons),
// on every device project. The detail panel is opened for every player of every year.
const { test, expect } = require('@playwright/test');

// Runs in the page. For each visible text node, find the nearest ancestor that draws a box (border or background)
// or clips its content, and report the text if its line boxes stick out of that box. Deliberate truncation
// (text-overflow: ellipsis) and scrolling containers are allowed.
function findOverflow(rootSel) {
  const root = document.querySelector(rootSel);
  if (!root) return [`missing ${rootSel}`];
  const TOL = 1;
  const clear = c => c === 'transparent' || /^rgba\(.*,\s*0\)$/.test(c);
  const drawsBox = cs => (cs.borderTopStyle !== 'none' && parseFloat(cs.borderTopWidth) > 0) || !clear(cs.backgroundColor);
  const name = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
    (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : '');
  const out = [];
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.data.trim() ? 1 : 2) });
  for (let n; (n = walk.nextNode());) {
    const el = n.parentElement;
    if (el.closest('svg, script, style, [hidden]')) continue;
    // the body of a closed <details> is not rendered, but WebKit and Chromium may still report its old line boxes
    if (el.closest('details:not([open]) > :not(summary)')) continue;
    const cs0 = getComputedStyle(el);
    if (cs0.visibility === 'hidden' || cs0.display === 'none' || (el.checkVisibility && !el.checkVisibility())) continue;
    const range = document.createRange(); range.selectNodeContents(n);
    const rects = [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0);
    if (!rects.length) continue;
    let box = null;
    for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.overflowX !== 'visible') {
        if (cs.overflowX === 'auto' || cs.overflowX === 'scroll' || a === el && cs.textOverflow === 'ellipsis') box = 'skip';
        else box = a;
        break;
      }
      if (drawsBox(cs)) { box = a; break; }
    }
    if (!box || box === 'skip') continue;
    const b = box.getBoundingClientRect();
    if (b.width <= 1 || b.height <= 1) continue;   // visually hidden text for screen readers (.sr-only)
    const bad = rects.find(r => r.left < b.left - TOL || r.right > b.right + TOL || r.top < b.top - TOL || r.bottom > b.bottom + TOL);
    if (bad) out.push(`"${n.data.trim().slice(0, 50)}" sticks out of ${name(box)} by ` +
      `${Math.round(Math.max(b.left - bad.left, bad.right - b.right, b.top - bad.top, bad.bottom - b.bottom))}px`);
  }
  return out;
}

// Closed <details> (About, Tune Custom, Data notes) are opened so their text is checked too.
const check = async (page, sel, what) => {
  await page.evaluate(s => { document.querySelectorAll(s + ' details').forEach(d => { d.open = true; }); return document.fonts.ready; }, sel);
  expect(await page.evaluate(findOverflow, sel), `text outside its box (${what})`).toEqual([]);
};

test('pages keep their text inside cards and buttons', async ({ page }) => {
  for (const route of ['/#/forecast', '/#/2026', '/#/2012', '/#/1956', '/#/summary', '/#/method']) {
    await page.goto(route);
    await expect(page.locator('#main h1')).toBeVisible();
    await check(page, '#main', route);
  }
});

test('player detail keeps its text inside the boxes for every player of every year', async ({ page }) => {
  test.slow();
  await page.goto('/#/2026');
  // "Everyone" adds the ineligible players; open one detail first so sources.json is loaded before the sweep.
  await page.getByRole('button', { name: 'Everyone' }).click();
  await page.locator('#col-pred .row').first().evaluate(b => b.click());
  await expect(page.locator('#detail .src a').first()).toBeAttached();
  await page.evaluate(() => document.fonts.ready);
  const years = await page.locator('#year-select option').evaluateAll(os => os.map(o => o.value));
  const problems = [];
  for (const y of years) {
    await page.goto('/#/' + y);
    await expect(page.locator('.year-title h1')).toHaveText(y);
    problems.push(...await page.evaluate(([fn, y]) => {
      const find = new Function('return ' + fn)();
      const found = [];
      for (const b of document.querySelectorAll('#col-pred .row')) {
        b.click();
        if (!document.querySelector('#detail h2')) b.click();   // desktop toggles the same player off
        document.querySelectorAll('#detail details').forEach(d => { d.open = true; });
        found.push(...find('#detail').map(p => `${y} ${b.dataset.n}: ${p}`));
      }
      return found;
    }, [findOverflow.toString(), y]));
  }
  expect(problems, 'text outside its box in the player detail').toEqual([]);
});
