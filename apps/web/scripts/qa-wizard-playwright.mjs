import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const photo = path.join(__dirname, '../public/images/prizren/stone-bridge.jpg');
const email = `wizard.e2e.${Date.now()}@example.com`;
const password = 'TestPass123!';

const network = [];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('response', (res) => {
    const url = res.url();
    if (url.includes(':3001/') && (url.includes('/auth/') || url.includes('/reports'))) {
      network.push({ url: url.replace(/https?:\/\/[^/]+/, ''), status: res.status() });
    }
  });
  page.on('requestfailed', (req) => {
    const url = req.url();
    if (url.includes(':3001/')) {
      network.push({
        url: url.replace(/https?:\/\/[^/]+/, ''),
        failed: true,
        error: req.failure()?.errorText,
      });
    }
  });

  await page.goto('http://localhost:3000/register', { waitUntil: 'networkidle' });
  // Wait for client hydration so onSubmit preventDefault runs (inputs lack name= except honeypot).
  await page.waitForFunction(
    () => Boolean(document.querySelector('#register-name')?.__reactFiber$ || document.querySelector('form')),
  ).catch(() => {});
  await page.waitForTimeout(1500);
  await page.locator('#register-name').fill('Wizard E2E');
  await page.locator('#register-email').fill(email);
  await page.locator('#register-password').fill(password);
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/auth/register') && r.request().method() === 'POST',
      { timeout: 25000 },
    ),
    page.locator('form button[type="submit"]').click(),
  ]).catch(async (e) => {
    const alert = await page.locator('[role="alert"]').allTextContents();
    console.error(JSON.stringify({ stage: 'register-post', url: page.url(), alert, network }, null, 2));
    throw e;
  });
  try {
    await page.waitForURL(/\/account/, { timeout: 25000 });
  } catch (e) {
    const alert = await page.locator('[role="alert"]').allTextContents();
    console.error(JSON.stringify({ stage: 'register', url: page.url(), alert, network }, null, 2));
    throw e;
  }

  await page.goto('http://localhost:3000/report', { waitUntil: 'networkidle' });
  await page.locator('#report-description').fill(
    'Test automatik i wizard-it: gropë në rrugë pranë Urës së Gurit. Ju lutem rregulloni.',
  );
  await page.getByRole('button', { name: /vazhdo|next/i }).click();

  await page.locator('input[type="file"]').setInputFiles(photo);
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /vazhdo|next/i }).click();

  // Pick location on map
  await page.waitForSelector('.leaflet-container', { timeout: 15000 });
  await page.waitForTimeout(800);
  const map = page.locator('.leaflet-container');
  const box = await map.boundingBox();
  if (!box) throw new Error('Map has no box');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(400);
  await page.locator('#report-address').fill('Ura e Gurit, Prizren');
  await page.getByRole('button', { name: /vazhdo|next/i }).click();

  // Category step
  await page.getByRole('button', { name: /vazhdo|next/i }).click();

  // Review submit
  await page.getByRole('button', { name: /dërgo raportin|submit report/i }).click();

  let ok = false;
  let alertText = null;
  try {
    await page.waitForURL(/\/reports\/[a-zA-Z0-9-]+/, { timeout: 60000 });
    ok = true;
  } catch {
    alertText = await page.locator('[role="alert"]').allTextContents();
  }

  const result = {
    ok,
    email,
    finalUrl: page.url(),
    alertText,
    network,
  };
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
