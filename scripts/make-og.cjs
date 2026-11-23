/**
 * Genera public/og-rpe.jpg (1200×630, JPEG leggero: WhatsApp scarta le immagini pesanti): l'anteprima del link RPE nelle chat (WhatsApp, Telegram…).
 * Uso: node scripts/make-og.cjs   (richiede Playwright)
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const font = (pkg, file) => 'data:font/woff2;base64,' + fs.readFileSync(path.join(ROOT, 'node_modules/@fontsource', pkg, 'files', file)).toString('base64');
const icon = 'data:image/svg+xml;base64,' + Buffer.from(fs.readFileSync(path.join(ROOT, 'assets/app-icon.svg'), 'utf8').replace('SCALE', '1').replace(/<!--.*?-->/s, '')).toString('base64');

// stessa scala di colori dell'app: bianco → giallo → arancio → rosso
const stops = [[0, [255, 255, 255]], [0.35, [255, 214, 10]], [0.65, [255, 140, 26]], [1, [255, 46, 46]]];
const color = (x) => {
  for (let i = 1; i < stops.length; i++) {
    const [b, cb] = stops[i];
    const [a, ca] = stops[i - 1];
    if (x <= b) return `rgb(${ca.map((c, k) => Math.round(c + (cb[k] - c) * ((x - a) / (b - a)))).join(',')})`;
  }
  return 'rgb(255,46,46)';
};
const chips = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => `<span style="color:${color(v / 10)}">${v}</span>`).join('');

const html = `<!doctype html><html><head><style>
@font-face{font-family:BC;font-weight:800;src:url(${font('barlow-condensed', 'barlow-condensed-latin-800-normal.woff2')})}
@font-face{font-family:BC;font-weight:700;src:url(${font('barlow-condensed', 'barlow-condensed-latin-700-normal.woff2')})}
@font-face{font-family:B;font-weight:500;src:url(${font('barlow', 'barlow-latin-500-normal.woff2')})}
@font-face{font-family:B;font-weight:600;src:url(${font('barlow', 'barlow-latin-600-normal.woff2')})}
html,body{margin:0}
.c{width:1200px;height:630px;box-sizing:border-box;padding:72px 80px;display:flex;align-items:center;gap:64px;color:#E8ECF4;
  background:radial-gradient(900px 520px at 85% 110%,rgba(255,140,26,.22),transparent 60%),radial-gradient(700px 500px at 0% 0%,rgba(57,135,229,.28),transparent 60%),linear-gradient(160deg,#0b2547,#050f1a)}
.logo{width:250px;height:250px;border-radius:56px;overflow:hidden;flex:none;box-shadow:0 30px 80px -20px rgba(0,0,0,.7)}
.logo img{width:100%;height:100%;display:block}
.brand{font:600 30px B;letter-spacing:6px;text-transform:uppercase;color:#9AA6BF}
h1{margin:10px 0 0;font:800 118px/0.95 BC;letter-spacing:1px}
p{margin:22px 0 0;font:500 34px/1.3 B;color:#C9D2E3}
.scale{margin-top:34px;display:flex;gap:10px;font:800 40px BC}
.scale span{width:58px;height:58px;display:grid;place-items:center;border-radius:14px;background:rgba(255,255,255,.07)}
</style></head><body><div class="c">
<div class="logo"><img src="${icon}"></div>
<div><div class="brand">Courtlab</div><h1>RPE allenamento</h1><p>Scegli il tuo nome e indica la fatica.<br>Bastano 10 secondi.</p><div class="scale">${chips}</div></div>
</div></body></html>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(ROOT, 'public/og-rpe.jpg'), type: 'jpeg', quality: 84 });
  await browser.close();
  console.log('Creato public/og-rpe.jpg');
})();
