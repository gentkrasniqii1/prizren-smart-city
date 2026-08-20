import { config } from 'dotenv';
import { resolve } from 'path';

/**
 * Local `.env` is only for development. In production (Render), system env
 * vars must win — Prisma CLI also auto-loads `.env` and can otherwise pick
 * up the Docker localhost default from a copied example file.
 */
export function loadLocalEnv(): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }
  config({
    path: resolve(__dirname, '../.env'),
    override: false,
  });
}
