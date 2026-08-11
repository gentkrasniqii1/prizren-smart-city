import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Load apps/api/.env without requiring dotenv at import time before Prisma boots. */
function loadEnv() {
  const envPath = join(__dirname, '..', '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@prizren.local';
  const password = 'password123';
  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { role: Role.SUPER_ADMIN, passwordHash, name: existing.name || 'Demo Admin' },
    });
    console.log('UPDATED', email, '→ SUPER_ADMIN');
  } else {
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: 'Demo Admin',
        role: Role.SUPER_ADMIN,
      },
    });
    console.log('CREATED', email, '→ SUPER_ADMIN');
  }
  console.log('Login: email=%s password=%s', email, password);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
