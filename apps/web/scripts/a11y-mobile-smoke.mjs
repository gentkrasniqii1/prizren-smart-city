import { chromium, devices } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../.a11y-mobile-shots');
const pages = [
  { name: 'home', url: 'http://localhost:3000/' },
  { name: 'reports', url: 'http://localhost:3000/reports' },
  { name: 'login', url: 'http://localhost:3000/login' },
  { name: 'transparency', url: 'http://localhost:3000/transparency' },
  { name: 'account-redirect', url: 'http://localhost:3000/account' },
];

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...devices['iPhone 13'],
  });
  const page = await context.newPage();
  const results = [];

  for (const p of pages) {
    const cons = [];
    page.removeAllListeners('pageerror');
    page.removeAllListeners('console');
    page.on('pageerror', (e) => cons.push(`pageerror: ${e.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') cons.push(`console: ${msg.text()}`);
    });

    await page.goto(p.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1200);

    const shot = path.join(outDir, `${p.name}.png`);
    await page.screenshot({ path: shot, fullPage: true });

    const a11y = await page.evaluate(() => {
      const mains = document.querySelectorAll('main').length;
      const skip = Boolean(document.querySelector('a[href="#main-content"]'));
      const h1 = document.querySelectorAll('h1').length;
      const unlabeledButtons = [...document.querySelectorAll('button')].filter((b) => {
        const text = (b.textContent || '').trim();
        const aria = b.getAttribute('aria-label');
        return !text && !aria;
      }).length;
      return { mains, skip, h1, unlabeledButtons, title: document.title };
    });

    results.push({
      ...p,
      finalUrl: page.url(),
      screenshot: shot,
      a11y,
      consoleErrors: cons.slice(0, 5),
    });
  }

  await browser.close();
  console.log(JSON.stringify({ outDir, results }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
