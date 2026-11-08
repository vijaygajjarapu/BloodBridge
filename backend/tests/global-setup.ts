import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Builds a fresh test database (prisma/test.db) with the sample data before the tests run */
export default function setup() {
  const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const env = { ...process.env, DATABASE_URL: 'file:./test.db', NODE_ENV: 'test' };
  const run = (cmd: string) => execSync(cmd, { cwd: backendDir, env, stdio: 'inherit' });
  run('npx prisma db push --force-reset --skip-generate --accept-data-loss');
  run('npx tsx prisma/seed.ts');
}
