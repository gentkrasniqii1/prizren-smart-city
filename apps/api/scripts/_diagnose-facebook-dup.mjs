import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

config({ path: resolve(import.meta.dirname, '../.env') });

const prisma = new PrismaClient();
const email = 'gentkrass21@gmail.com';

try {
  const original = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      googleId: true,
      facebookId: true,
      emailVerified: true,
      passwordHash: true,
      createdAt: true,
      lastLoginAt: true,
      _count: { select: { reports: true, comments: true, votes: true, notifications: true } },
    },
  });

  const placeholders = await prisma.user.findMany({
    where: { email: { endsWith: '@oauth.invalid' } },
    select: {
      id: true,
      email: true,
      name: true,
      googleId: true,
      facebookId: true,
      emailVerified: true,
      passwordHash: true,
      createdAt: true,
      lastLoginAt: true,
      _count: { select: { reports: true, comments: true, votes: true, notifications: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const facebookUsers = await prisma.user.findMany({
    where: { facebookId: { not: null } },
    select: {
      id: true,
      email: true,
      name: true,
      facebookId: true,
      googleId: true,
      createdAt: true,
      _count: { select: { reports: true } },
    },
  });

  function summarize(u) {
    if (!u) return null;
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      googleId: u.googleId,
      facebookId: u.facebookId,
      emailVerified: u.emailVerified,
      hasPassword: Boolean(u.passwordHash),
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      counts: u._count,
    };
  }

  console.log(
    JSON.stringify(
      {
        original: summarize(original),
        placeholders: placeholders.map(summarize),
        facebookUsers: facebookUsers.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          facebookId: u.facebookId,
          googleId: u.googleId,
          createdAt: u.createdAt,
          reports: u._count.reports,
        })),
      },
      null,
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
}
