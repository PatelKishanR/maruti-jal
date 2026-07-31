import "reflect-metadata";
import bcrypt from "bcryptjs";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type { DataSource } from "typeorm";
import dataSource from "./typeorm.config";
import {
  User,
  ProductTag,
  ProductFilterType,
  ExpenseCategory,
  AppSetting,
} from "../src/lib/db/entities";

/**
 * Idempotent seed — safe to re-run. Upserts by natural key.
 *
 * Reference data (lookups, settings) is always seeded. The owner account is
 * created only if absent, because there is no sign-up screen
 * (MODULES/00-auth.md §5.5). Demo transactional data is gated behind
 * SEED_DEMO=1 and goes through the SERVICE layer, never raw inserts — a seed
 * that writes ledger rows directly can produce an unbalanced ledger, and
 * you'd lose a day debugging a bug that exists only in seed data.
 */

async function seedLookups(ds: DataSource) {
  // Ship in English; fully editable. Rename to Gujarati if preferred and that
  // name is what everyone sees — there are no paired language columns.
  // See .claude/I18N.md §2
  const tags = [
    { code: "NORMAL", label: "Normal", sortOrder: 10 },
    { code: "COLD", label: "Cold", sortOrder: 20 },
  ];
  const filterTypes = [
    { code: "NORMAL", label: "Normal", sortOrder: 10 },
    { code: "FILTERED", label: "Filtered", sortOrder: 20 },
    { code: "DOUBLE_FILTERED", label: "Double Filtered", sortOrder: 30 },
  ];

  await ds
    .getRepository(ProductTag)
    .upsert(tags.map((t) => ({ ...t, isActive: true })), ["code"]);
  await ds
    .getRepository(ProductFilterType)
    .upsert(filterTypes.map((t) => ({ ...t, isActive: true })), ["code"]);

  console.log(
    `✓ Lookups: ${tags.length} product tags, ${filterTypes.length} filter types`,
  );
}

async function seedExpenseCategories(ds: DataSource) {
  const categories = [
    "Fuel",
    "Staff salary",
    "Staff advance",
    "Electricity",
    "Plant maintenance",
    "Bottle & jar purchase",
    "Coin printing",
    "Vehicle maintenance",
    "Rent",
    "Miscellaneous",
  ];

  const repo = ds.getRepository(ExpenseCategory);
  let created = 0;

  for (const [i, name] of categories.entries()) {
    const exists = await repo
      .createQueryBuilder("c")
      .where("lower(c.name) = lower(:name)", { name })
      .andWhere("c.deletedAt IS NULL")
      .getExists();

    if (!exists) {
      await repo.save(
        repo.create({ name, sortOrder: (i + 1) * 10, isActive: true }),
      );
      created += 1;
    }
  }

  console.log(
    `✓ Expense categories: ${created} created, ${categories.length - created} already present`,
  );
}

async function seedSettings(ds: DataSource) {
  const settings: { key: string; value: unknown; description: string }[] = [
    {
      key: "orders.charge_basis",
      value: "SOLD",
      description:
        "SOLD = staff is billed only for what he sold, so unsold filled jars are credited back (PRD decision D5). ISSUED = billed for everything that left the plant.",
    },
    {
      key: "coins.allow_negative_balance",
      value: false,
      description:
        "When false, the ledger trigger refuses any movement that would take a coin type's stock below zero.",
    },
    {
      key: "business.profile",
      value: {
        name: "Maruti Jal",
        tagline: "Water Supply",
        currency: "INR",
        timezone: "Asia/Kolkata",
      },
      description: "Shown on printed statements and PDF exports.",
    },
  ];

  const repo = ds.getRepository(AppSetting);
  for (const s of settings) {
    const existing = await repo.findOne({ where: { key: s.key } });
    if (!existing) {
      await repo.save(repo.create(s as never));
    }
  }
  console.log(`✓ App settings: ${settings.length} keys ensured`);
}

async function seedOwner(ds: DataSource) {
  const users = ds.getRepository(User);
  const email = (
    process.env.SEED_ADMIN_EMAIL ?? "owner@marutijal.com"
  ).toLowerCase();
  const name = process.env.SEED_ADMIN_NAME ?? "Owner";

  if (await users.findOne({ where: { email } })) {
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
    throw new Error("Password must be at least 8 characters.");
  }

  await users.save(
    users.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: "OWNER",
      locale: "en",
      theme: "system",
      isActive: true,
      passwordChangedAt: new Date(),
      sessionVersion: 1,
    }),
  );

  console.log(`✓ Created owner account: ${email}`);
}

async function main() {
  const ds = await dataSource.initialize();
  try {
    await seedOwner(ds);
    await seedLookups(ds);
    await seedExpenseCategories(ds);
    await seedSettings(ds);
    console.log("\nSeed complete. Sign in at http://localhost:3000/login");
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error("✗ Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
