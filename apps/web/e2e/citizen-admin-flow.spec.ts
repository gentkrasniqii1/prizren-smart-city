import { expect, test, type APIRequestContext } from '@playwright/test';

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3001';
const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:3000';
const ADMIN_EMAIL = 'admin@prizren.local';
const ADMIN_PASSWORD = 'password123';
const PASSWORD = 'Password1!';

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

async function registerCitizen(request: APIRequestContext, email: string): Promise<string> {
  const registerRes = await request.post(`${API_URL}/auth/register`, {
    data: {
      email,
      password: PASSWORD,
      firstName: 'E2E',
      lastName: 'Citizen',
      acceptedTerms: true,
    },
  });
  expect(registerRes.ok(), await registerRes.text()).toBeTruthy();
  const registered = (await registerRes.json()) as { devVerifyToken?: string };
  expect(registered.devVerifyToken).toBeTruthy();

  const verifyRes = await request.post(`${API_URL}/auth/verify-email`, {
    data: { token: registered.devVerifyToken },
  });
  expect(verifyRes.ok(), await verifyRes.text()).toBeTruthy();
  const loginBody = (await verifyRes.json()) as { accessToken: string };
  return loginBody.accessToken;
}

async function adminToken(request: APIRequestContext): Promise<string | null> {
  const adminLogin = await request.post(`${API_URL}/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (!adminLogin.ok()) return null;
  const body = (await adminLogin.json()) as { accessToken: string };
  return body.accessToken;
}

async function firstCategoryId(request: APIRequestContext): Promise<string | null> {
  const res = await request.get(`${API_URL}/categories`);
  if (!res.ok()) return null;
  const rows = (await res.json()) as { id: string }[];
  return rows[0]?.id ?? null;
}

async function createReport(
  request: APIRequestContext,
  token: string,
  description: string,
  categoryId: string,
): Promise<{ id: string; publicId: string; status: string } | null> {
  const reportRes = await request.post(`${API_URL}/reports`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      photo: { name: 'e2e.jpg', mimeType: 'image/jpeg', buffer: tinyJpeg() },
      description,
      lat: '42.2130',
      lng: '20.7390',
      categoryId,
      website: '',
    },
  });
  if (!reportRes.ok()) return null;
  return (await reportRes.json()) as { id: string; publicId: string; status: string };
}

test.describe('Phase 10 civic reporting path', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!(await apiHealthy(request)), `API not reachable at ${API_URL}`);
  });

  test('submit stays private until staff approve, then the official case is public', async ({
    request,
    page,
  }) => {
    const ts = Date.now();
    const citizenToken = await registerCitizen(request, `e2e_civic_${ts}@test.local`);
    const categoryId = await firstCategoryId(request);
    test.skip(!categoryId, 'No categories seeded');

    const report = await createReport(
      request,
      citizenToken,
      `E2E civic path ${ts} — broken streetlight`,
      categoryId!,
    );
    test.skip(!report, 'Could not create report (Cloudinary may be unconfigured)');
    expect(['SUBMITTED', 'UNDER_REVIEW']).toContain(report!.status);

    const anonymous = await request.get(`${API_URL}/reports/${report!.id}`);
    expect(anonymous.status()).toBe(404);

    const publicList = await request.get(`${API_URL}/reports?limit=50`);
    expect(publicList.ok()).toBeTruthy();
    const listed = (await publicList.json()) as { data: { id: string }[] };
    expect(listed.data.some((row) => row.id === report!.id)).toBe(false);

    const citizenApprove = await request.post(`${API_URL}/reports/${report!.id}/moderate`, {
      headers: {
        Authorization: `Bearer ${citizenToken}`,
        'Content-Type': 'application/json',
      },
      data: { action: 'approve', categoryId },
    });
    expect(citizenApprove.status()).toBe(403);

    const citizenQueue = await request.get(`${API_URL}/reports/queue?lane=incoming`, {
      headers: { Authorization: `Bearer ${citizenToken}` },
    });
    expect(citizenQueue.status()).toBe(403);

    const staffToken = await adminToken(request);
    test.skip(!staffToken, `Demo ${ADMIN_EMAIL} not seeded`);

    const approveRes = await request.post(`${API_URL}/reports/${report!.id}/moderate`, {
      headers: {
        Authorization: `Bearer ${staffToken}`,
        'Content-Type': 'application/json',
      },
      data: { action: 'approve', categoryId },
    });
    expect(approveRes.ok(), await approveRes.text()).toBeTruthy();
    const official = (await approveRes.json()) as { status: string; publicId: string };
    expect(official.status).toBe('ASSIGNED');
    expect(official.publicId).toBe(report!.publicId);

    const publicCase = await request.get(`${API_URL}/reports/${report!.publicId}`);
    expect(publicCase.ok(), await publicCase.text()).toBeTruthy();
    const publicBody = (await publicCase.json()) as {
      status: string;
      publicId: string;
      userId?: string;
    };
    expect(publicBody.status).toBe('ASSIGNED');
    expect(publicBody.publicId).toBe(report!.publicId);
    expect(publicBody.userId).toBeUndefined();

    const queueRes = await request.get(`${API_URL}/reports/queue?lane=incoming`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    expect(queueRes.ok(), await queueRes.text()).toBeTruthy();
    const queue = (await queueRes.json()) as { data: { id: string }[] };
    expect(queue.data.some((row) => row.id === report!.id)).toBe(true);

    const mailRes = await request.get(`${API_URL}/outbound-emails?limit=100`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    expect(mailRes.ok(), await mailRes.text()).toBeTruthy();
    const mail = (await mailRes.json()) as {
      data: { reportId: string; publicId: string; status: string }[];
    };
    const ledger = mail.data.find(
      (row) => row.reportId === report!.id || row.publicId === report!.publicId,
    );
    expect(ledger).toBeTruthy();
    expect(ledger!.status).not.toBe('SENT');

    await page.goto(`${WEB_URL}/reports/${report!.publicId}`);
    await expect(page.getByText(report!.publicId).first()).toBeVisible({ timeout: 20_000 });
  });

  test('spam stays off public surfaces', async ({ request }) => {
    const ts = Date.now();
    const citizenToken = await registerCitizen(request, `e2e_spam_${ts}@test.local`);
    const categoryId = await firstCategoryId(request);
    test.skip(!categoryId, 'No categories seeded');
    const staffToken = await adminToken(request);
    test.skip(!staffToken, `Demo ${ADMIN_EMAIL} not seeded`);

    const report = await createReport(request, citizenToken, `E2E spam path ${ts}`, categoryId!);
    test.skip(!report, 'Could not create report (Cloudinary may be unconfigured)');

    const spamRes = await request.post(`${API_URL}/reports/${report!.id}/moderate`, {
      headers: {
        Authorization: `Bearer ${staffToken}`,
        'Content-Type': 'application/json',
      },
      data: { action: 'reject_spam', note: 'meme photo' },
    });
    expect(spamRes.ok(), await spamRes.text()).toBeTruthy();
    const rejected = (await spamRes.json()) as { status: string };
    expect(rejected.status).toBe('REJECTED');

    expect((await request.get(`${API_URL}/reports/${report!.id}`)).status()).toBe(404);
    expect((await request.get(`${API_URL}/reports/${report!.publicId}`)).status()).toBe(404);
  });
});
