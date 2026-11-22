/**
 * Genera le icone dell'app Courtlab da assets/app-icon.svg (richiede Playwright: npx playwright install chromium).
 * Uscite in public/icons: icon-192/512 (any), maskable-512, apple-touch-icon, favicon-64, app-logo (angoli arrotondati).
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'assets/app-icon.svg'), 'utf8');
const OUT = path.join(ROOT, 'public/icons');
const svg = (scale) => SRC.replace('SCALE', String(scale)).replace(/<!--.*?-->/s, '');

const jobs = [
  ['icon-192.png', 192, 1, 0],
  ['icon-512.png', 512, 1, 0],
  ['maskable-512.png', 512, 0.78, 0], // disegno dentro la safe zone (cerchio dell'80%)
  ['apple-touch-icon.png', 180, 1, 0],
  ['favicon-64.png', 64, 1.08, 0.22],
  ['app-logo.png', 256, 1, 0.22],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const [name, size, scale, radius] of jobs) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}div{width:${size}px;height:${size}px;border-radius:${radius * size}px;overflow:hidden}svg{display:block;width:100%;height:100%}</style><div>${svg(scale)}</div>`,
    );
    await page.locator('div').screenshot({ path: path.join(OUT, name), omitBackground: true });
    console.log('ok', name);
  }
  await browser.close();
})();
