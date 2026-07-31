import 'reflect-metadata';
import bcrypt from 'bcryptjs';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import dataSource from './typeorm.config';
import { User } from '../src/lib/db/entities';

/**
 * Idempotent seed. Safe to re-run — it upserts by email.
 *
 * There is no sign-up screen (MODULES/00-auth.md §5.5), so the first account
 * is created here.
 */
async function main() {
  const ds = await dataSource.initialize();

  try {
    const users = ds.getRepository(User);
    const email = (process.env.SEED_ADMIN_EMAIL ?? 'owner@marutijal.com').toLowerCase();
    const name = process.env.SEED_ADMIN_NAME ?? 'Owner';

    const existing = await users.findOne({ where: { email } });
    if (existing) {
      console.log(`✓ Owner account already exists: ${email}`);
      return;
    }

    let password = process.env.SEED_ADMIN_PASSWORD;

    if (!password) {
      const rl = readline.createInterface({ input: stdin, output: stdout });
      password = await rl.question(`Password for ${email}: `);
      rl.close();
    }

    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters.');
    }

    const user = users.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: 'OWNER',
      locale: 'en',
      theme: 'system',
      isActive: true,
      passwordChangedAt: new Date(),
      sessionVersion: 1,
    });

    await users.save(user);

    console.log(`✓ Created owner account: ${email}`);
    console.log('  Sign in at http://localhost:3000/login');
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error('✗ Seed failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
