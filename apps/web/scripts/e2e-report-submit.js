const fs = require('fs');
const path = require('path');
const http = require('http');
const { URL } = require('url');

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const photoPath =
  process.env.E2E_PHOTO || path.join(__dirname, '../public/images/prizren/stone-bridge.jpg');

function request(method, urlStr, { headers = {}, body, jar } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const setCookie = res.headers['set-cookie'] || [];
          if (jar) {
            for (const c of setCookie) {
              const [pair] = c.split(';');
              const eq = pair.indexOf('=');
              jar[pair.slice(0, eq)] = pair.slice(eq + 1);
            }
          }
          resolve({
            status: res.statusCode,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function cookieHeader(jar) {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function multipart(fields, fileField) {
  const boundary = `----PrizrenE2E${Date.now()}`;
  const chunks = [];
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
      ),
    );
  }
  chunks.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${fileField.name}"; filename="${fileField.filename}"\r\nContent-Type: ${fileField.type}\r\n\r\n`,
    ),
  );
  chunks.push(fileField.buffer);
  chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  return { boundary, body: Buffer.concat(chunks) };
}

async function main() {
  if (!fs.existsSync(photoPath)) {
    console.error('Missing photo', photoPath);
    process.exit(1);
  }
  console.log('PHOTO', photoPath, fs.statSync(photoPath).size);
  console.log('HEALTH', (await request('GET', `${API}/health`)).status);

  const jar = {};
  const email = `e2e_${Date.now()}@test.local`;
  const reg = await request('POST', `${API}/auth/register`, {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: 'password123',
      name: 'E2E Tester',
      website: '',
    }),
    jar,
  });
  console.log('REGISTER', reg.status, Object.keys(jar));
  if (reg.status >= 400) {
    console.log(reg.body);
    process.exit(1);
  }

  const ref = await request('POST', `${API}/auth/refresh`, {
    headers: { Cookie: cookieHeader(jar) },
    jar,
  });
  console.log('REFRESH', ref.status);
  if (ref.status >= 400) {
    console.log(ref.body);
    process.exit(1);
  }

  const cookieBeforeRace = cookieHeader(jar);
  const [p1, p2] = await Promise.all([
    request('POST', `${API}/auth/refresh`, {
      headers: { Cookie: cookieBeforeRace },
      jar: {},
    }),
    request('POST', `${API}/auth/refresh`, {
      headers: { Cookie: cookieBeforeRace },
      jar: {},
    }),
  ]);
  console.log('PARALLEL_REFRESH_STATUSES', p1.status, p2.status);

  const jar2 = {};
  const email2 = `e2e2_${Date.now()}@test.local`;
  const reg2 = await request('POST', `${API}/auth/register`, {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: email2,
      password: 'password123',
      name: 'E2E Two',
      website: '',
    }),
    jar: jar2,
  });
  if (reg2.status >= 400) {
    console.log(reg2.body);
    process.exit(1);
  }
  const token = JSON.parse(reg2.body).accessToken;
  console.log('REGISTER2', reg2.status, Object.keys(jar2));

  const file = fs.readFileSync(photoPath);
  const { boundary, body } = multipart(
    {
      description: 'E2E test pothole near stone bridge for wizard verification path',
      lat: '42.2139',
      lng: '20.7397',
      website: '',
    },
    { name: 'photo', filename: 'e2e.jpg', type: 'image/jpeg', buffer: file },
  );

  const report = await request('POST', `${API}/reports`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Cookie: cookieHeader(jar2),
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': String(body.length),
    },
    body,
  });
  console.log('REPORT', report.status);
  console.log(report.body.slice(0, 500));

  const ref2 = await request('POST', `${API}/auth/refresh`, {
    headers: { Cookie: cookieHeader(jar2) },
    jar: jar2,
  });
  console.log('REFRESH2', ref2.status);
  if (ref2.status >= 400) {
    console.log(ref2.body);
    process.exit(1);
  }
  const token2 = JSON.parse(ref2.body).accessToken;

  const { boundary: b2, body: body2 } = multipart(
    {
      description: 'E2E second report after proactive-style refresh',
      lat: '42.2140',
      lng: '20.7398',
      website: '',
    },
    { name: 'photo', filename: 'e2e2.jpg', type: 'image/jpeg', buffer: file },
  );

  const report2 = await request('POST', `${API}/reports`, {
    headers: {
      Authorization: `Bearer ${token2}`,
      Cookie: cookieHeader(jar2),
      'Content-Type': `multipart/form-data; boundary=${b2}`,
      'Content-Length': String(body2.length),
    },
    body: body2,
  });
  console.log('REPORT_AFTER_REFRESH', report2.status);
  console.log(report2.body.slice(0, 300));

  if (report.status < 200 || report.status >= 300) process.exit(1);
  if (report2.status < 200 || report2.status >= 300) process.exit(1);
  console.log('E2E_OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
