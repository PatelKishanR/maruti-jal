import 'reflect-metadata';
import bcrypt from 'bcryptjs';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import dataSource from './typeorm.config';
import { User } from '../src/lib/db/entities';

/**
 * Server-side password reset.
 *
 * This is the recovery path the "Forgot password?" dialog points at. Version 1
 * has no email-based reset because the app has no email provider configured,
 * and adding one is a real infrastructure decision rather than a small
 * feature. See MODULES/00-auth.md §5.7
 *
 * Bumping session_version signs out every existing session.
 */
async function main() {
  const ds = await dataSource.initialize();
  const rl = readline.createInterface({ input: stdin, output: stdout });

  try {
    const users = ds.getRepository(User);

    const email = (await rl.question('Email address: ')).trim().toLowerCase();
    const user = await users.findOne({ where: { email } });

    if (!user) {
      console.error(`✗ No account found for ${email}`);
      process.exitCode = 1;
      return;
    }

    const password = await rl.question('New password (min 8 characters): ');
    if (password.length < 8) {
      console.error('✗ Password must be at least 8 characters.');
      process.exitCode = 1;
      return;
    }

    const confirm = await rl.question('Confirm new password: ');
    if (password !== confirm) {
      console.error("✗ Passwords don't match.");
      process.exitCode = 1;
      return;
    }

    user.passwordHash = await bcrypt.hash(password, 12);
    user.passwordChangedAt = new Date();
    user.sessionVersion += 1; // invalidates all existing sessions
    await users.save(user);

    console.log(`✓ Password updated for ${email}`);
    console.log('  All existing sessions have been signed out.');
  } finally {
    rl.close();
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error('✗ Reset failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
