import { expect, test, type APIRequestContext } from '@playwright/test';

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3001';
const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:3000';

async function apiHealthy(request: APIRequestContext): Promise<boolean> {
  try {
    const res = await request.get(`${API_URL}/health`, { timeout: 3000 });
    if (!res.ok()) return false;
    const body = (await res.json()) as { status?: string };
    return body.status === 'ok';
  } catch {
    return false;
  }
}

/** Minimal valid JPEG (1x1). */
function tinyJpeg(): Buffer {
  return Buffer.from(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z',
    'base64',
  );
}

test.describe('Phase 10 citizen → admin flow', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await apiHealthy(request)), `API not reachable at ${API_URL}`);
  });

  test('register → create report → admin updates status', async ({ request, page }) => {
    const ts = Date.now();
    const citizenEmail = `e2e_citizen_${ts}@test.local`;
    const password = 'Password1!';

    await page.goto(`${WEB_URL}/register`);
    await page.getByLabel('Emri').fill('E2E');
    await page.getByLabel('Mbiemri').fill('Citizen');
    await page.getByLabel('Email').fill(citizenEmail);
    await page.getByLabel('Fjalëkalimi', { exact: true }).fill(password);
    await page.getByLabel('Konfirmo fjalëkalimin').fill(password);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /Krijo llogari/i }).click();
    await expect(page).toHaveURL(/\/verify-email/, { timeout: 20_000 });

    const registerRes = await request.post(`${API_URL}/auth/register`, {
      data: {
        email: `e2e_api_${ts}@test.local`,
        password,
        firstName: 'E2E',
        lastName: 'Citizen',
        acceptedTerms: true,
      },
    });
    expect(registerRes.ok(), await registerRes.text()).toBeTruthy();
    const registered = (await registerRes.json()) as { email: string; devVerifyToken?: string };
    expect(registered.devVerifyToken).toBeTruthy();

    const verifyRes = await request.post(`${API_URL}/auth/verify-email`, {
      data: { token: registered.devVerifyToken },
    });
    expect(verifyRes.ok(), await verifyRes.text()).toBeTruthy();
    const loginBody = (await verifyRes.json()) as { accessToken: string };
    const citizenToken = loginBody.accessToken;

    // 2) Create report (API multipart — photo + location)
    const jpeg = tinyJpeg();
    const reportRes = await request.post(`${API_URL}/reports`, {
      headers: { Authorization: `Bearer ${citizenToken}` },
      multipart: {
        photo: {
          name: 'e2e.jpg',
          mimeType: 'image/jpeg',
          buffer: jpeg,
        },
        description: 'E2E report description for Phase 10 testing flow',
        lat: '42.2130',
        lng: '20.7390',
        website: '',
      },
    });
    expect(reportRes.ok(), await reportRes.text()).toBeTruthy();
    const report = (await reportRes.json()) as { id: string; status: string };
    expect(report.id).toBeTruthy();

    // 3) Admin updates status
    const adminLogin = await request.post(`${API_URL}/auth/login`, {
      data: { email: 'admin@prizren.local', password: 'password123' },
    });
    test.skip(!adminLogin.ok(), 'Demo admin@prizren.local not seeded');
    const adminBody = (await adminLogin.json()) as { accessToken: string };

    const nextStatus = report.status === 'IN_PROGRESS' ? 'UNDER_REVIEW' : 'IN_PROGRESS';
    const statusRes = await request.patch(`${API_URL}/reports/${report.id}/status`, {
      headers: {
        Authorization: `Bearer ${adminBody.accessToken}`,
        'Content-Type': 'application/json',
      },
      data: { status: nextStatus },
    });
    expect(statusRes.ok(), await statusRes.text()).toBeTruthy();
    const updated = (await statusRes.json()) as { status: string };
    expect(updated.status).toBe(nextStatus);

    // 4) Citizen can open report detail in UI
    await page.goto(`${WEB_URL}/reports/${report.id}`);
    await expect(page).not.toHaveURL(/404/);
    await expect(
      page.getByText(/Detajet e raportit|Duke ngarkuar|Nuk u gjet/i).first(),
    ).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(nextStatus).first()).toBeVisible({ timeout: 20_000 });
  });
});
