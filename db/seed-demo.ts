import "reflect-metadata";
import dataSource from "./typeorm.config";
import { addDays, todayIST } from "../src/lib/dates";

/**
 * Realistic demo data — a fortnight of a working plant.
 *
 * Two reasons this exists beyond convenience:
 *
 *  1. **Dashboards and reports cannot be built against an empty database.**
 *     A KPI strip of zeros proves nothing; a chart with no series cannot be
 *     told from a broken one.
 *  2. **It drives every write path through the SERVICE layer**, exactly as the
 *     UI does. Seeding with raw INSERTs would skip the triggers, produce an
 *     unbalanced coin ledger, and let a day disappear debugging a bug that
 *     exists only in seed data. See db/seed.ts.
 *
 * Idempotent by convention: it refuses to run if transactional data already
 * exists, rather than doubling it.
 *
 *   npm run db:seed:demo          # add demo data
 *   npm run db:seed:demo -- --force   # even if data exists
 */

const FORCE = process.argv.includes("--force");

/**
 * Deterministic pseudo-random, so a rerun produces the same shop.
 *
 * Takes the HIGH bits. An LCG's low bits have a period as short as the modulus
 * they are taken against — `seed % 4` on this generator cycles with period 4
 * and can return the same value forever, which silently produced a fortnight
 * of orders with not one payment against them.
 */
let seed = 20260814;
function rnd(max: number): number {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return Math.floor(seed / 65536) % max;
}
function pick<T>(items: readonly T[]): T {
  return items[rnd(items.length)];
}

async function main() {
  const ds = await dataSource.initialize();

  try {
    const { userRepository } = await import("../src/lib/repositories/user.repository");
    const owner = await userRepository.findActiveByEmail("owner@marutijal.com");
    if (!owner) throw new Error("No owner account. Run `npm run db:seed` first.");
    const by = owner.id;

    const existing = await ds.query(
      `SELECT (SELECT count(*) FROM delivery_orders) +
              (SELECT count(*) FROM direct_sales) +
              (SELECT count(*) FROM coin_issues) AS n`,
    );
    if (Number(existing[0].n) > 0 && !FORCE) {
      console.log(
        `✓ ${existing[0].n} transactional rows already exist — nothing to do.\n` +
          `  Re-run with --force to add more anyway.`,
      );
      return;
    }

    const staffSvc = await import("../src/lib/services/staff.service");
    const productSvc = await import("../src/lib/services/product.service");
    const coinTypeSvc = await import("../src/lib/services/coin-type.service");
    const coinIssueSvc = await import("../src/lib/services/coin-issue.service");
    const orderSvc = await import("../src/lib/services/delivery-order.service");
    const saleSvc = await import("../src/lib/services/direct-sale.service");
    const expenseSvc = await import("../src/lib/services/expense.service");

    /* ── Staff ────────────────────────────────────────────────────────── */
    const staffSpecs = [
      { name: "રમેશ પટેલ", phone: "9825011001", address: "Vatva Road, Ahmedabad" },
      { name: "Suresh Bhai", phone: "9825011002", address: "Naroda, Ahmedabad" },
      { name: "Mahesh Solanki", phone: "9825011003", address: "Odhav, Ahmedabad" },
      { name: "દિનેશ શાહ", phone: "9825011004", address: "Nikol, Ahmedabad" },
    ];
    const { staffRepository } = await import("../src/lib/repositories/staff.repository");
    const staff = [];
    for (const spec of staffSpecs) {
      const found = await staffRepository.findByPhone(spec.phone);
      staff.push(
        found ??
          (await staffSvc.createStaff(by, {
            ...spec,
            altPhone: null,
            note: null,
            joinedOn: addDays(todayIST(), -120),
          } as never)),
      );
    }
    console.log(`✓ Staff: ${staff.length}`);

    /* ── Products ─────────────────────────────────────────────────────── */
    const productSpecs = [
      { title: "20L Jar", litres: 20, basePrice: 35, tagCode: "NORMAL", filterTypeCode: "DOUBLE_FILTERED", isReturnable: true },
      { title: "20L Jar (Cold)", litres: 20, basePrice: 45, tagCode: "COLD", filterTypeCode: "DOUBLE_FILTERED", isReturnable: true },
      { title: "10L Can", litres: 10, basePrice: 22, tagCode: "NORMAL", filterTypeCode: "FILTERED", isReturnable: true },
      { title: "1L Bottle", litres: 1, basePrice: 10, tagCode: "NORMAL", filterTypeCode: "FILTERED", isReturnable: false },
      { title: "500ml Bottle", litres: 0.5, basePrice: 6, tagCode: "COLD", filterTypeCode: "FILTERED", isReturnable: false },
    ];
    const { productRepository } = await import("../src/lib/repositories/product.repository");
    const products = [];
    for (const [i, spec] of productSpecs.entries()) {
      const found = await productRepository.findOneBy({ title: spec.title });
      products.push(
        found ??
          (await productSvc.createProduct(by, {
            ...spec,
            description: null,
            sortOrder: (i + 1) * 10,
            isActive: true,
          } as never)),
      );
    }
    console.log(`✓ Products: ${products.length}`);

    /* ── Coin types, with opening stock ───────────────────────────────── */
    const coinSpecs = [
      { name: "Blue Token", coinsPerPacket: 100, packetAmount: 1000, openingStock: 3000 },
      { name: "Green Token", coinsPerPacket: 50, packetAmount: 1000, openingStock: 1500 },
    ];
    const { coinTypeRepository } = await import("../src/lib/repositories/coin-type.repository");
    const coinTypes = [];
    for (const spec of coinSpecs) {
      const found = await coinTypeRepository.findOneBy({ name: spec.name });
      coinTypes.push(
        found ?? (await coinTypeSvc.createCoinType({ ...spec, isActive: true } as never, by)),
      );
    }
    console.log(`✓ Coin types: ${coinTypes.length} (with opening ledger entries)`);

    /* ── A fortnight of trading ───────────────────────────────────────── */
    const returnable = products.filter((p) => p.isReturnable);
    let orderCount = 0;
    let returnCount = 0;
    let paymentCount = 0;

    for (let dayOffset = 13; dayOffset >= 0; dayOffset -= 1) {
      const date = addDays(todayIST(), -dayOffset);

      // Two or three route orders a day.
      for (const member of staff.slice(0, 2 + rnd(2))) {
        const lines = [];
        for (const product of returnable.slice(0, 1 + rnd(2))) {
          const qty = 20 + rnd(40);
          // Roughly one line in three is bargained below the base price.
          const bargained = rnd(3) === 0;
          lines.push({
            productId: product.id,
            quantity: qty,
            unitPrice: bargained ? product.basePrice - 2 - rnd(3) : product.basePrice,
          });
        }

        const order = await orderSvc.createDeliveryOrder(
          { staffId: member.id, orderDate: date, discountAmount: 0, notes: null, items: lines,
            payment: null, clientRequestId: null } as never,
          by,
        );
        orderCount += 1;

        // Older orders have mostly come back and been paid; recent ones are open.
        if (dayOffset > 2) {
          const detail = order as { id: string; lines: { id: string; quantity: number }[] };
          const returnLines = detail.lines.map((line) => {
            const filled = rnd(4) === 0 ? 1 + rnd(3) : 0; // some unsold stock returns
            const empty = Math.max(0, line.quantity - filled - rnd(4));
            return { orderItemId: line.id, emptyQty: empty, filledQty: filled, lostQty: 0 };
          });

          const afterReturn = await orderSvc.recordOrderReturn(
            detail.id,
            { returnDate: addDays(date, 1), lines: returnLines, allocations: [], note: null } as never,
            by,
          );
          returnCount += 1;

          if (rnd(4) > 0) {
            const due = afterReturn.outstandingAmount;
            if (due > 0) {
              await orderSvc.recordOrderPayment(
                detail.id,
                {
                  direction: "IN",
                  paidOn: addDays(date, 1),
                  // Sometimes a part payment, so the register has real variety.
                  amount: rnd(5) === 0 ? Math.round(due / 2) : due,
                  mode: "CASH",
                  coins: [],
                  referenceNo: null,
                  note: null,
                } as never,
                by,
              );
              paymentCount += 1;
            }
          }
        }
      }

      // Walk-ins — the plant's steady background trade.
      const walkIns = ["Kiran bhai", "પ્રકાશ", "Jayesh", "Nita ben", "Ramila"];
      for (let i = 0; i < 2 + rnd(4); i += 1) {
        await saleSvc.createDirectSale(by, {
          customerName: pick(walkIns),
          amount: 20 + rnd(9) * 10,
          saleDate: date,
          phone: null,
          address: null,
          productId: null,
          litres: null,
          note: null,
        } as never);
      }
    }
    console.log(
      `✓ Delivery orders: ${orderCount} · returns: ${returnCount} · payments: ${paymentCount}`,
    );

    /* ── Coin issues ──────────────────────────────────────────────────── */
    let issueCount = 0;
    for (const member of staff.slice(0, 3)) {
      await coinIssueSvc.createCoinIssue(
        {
          staffId: member.id,
          issueDate: addDays(todayIST(), -7 - rnd(5)),
          notes: null,
          items: [{ coinTypeId: coinTypes[0].id, packets: 1 + rnd(3) }],
          payment: null,
        } as never,
        by,
      );
      issueCount += 1;
    }
    console.log(`✓ Coin issues: ${issueCount}`);

    /* ── Expenses ─────────────────────────────────────────────────────── */
    const { expenseCategoryRepository } = await import(
      "../src/lib/repositories/expense-category.repository"
    );
    const categories = await expenseCategoryRepository.findManyBy({ isActive: true });
    let expenseCount = 0;
    for (let dayOffset = 13; dayOffset >= 0; dayOffset -= 2) {
      const category = pick(categories);
      await expenseSvc.createExpense(by, {
        expenseDate: addDays(todayIST(), -dayOffset),
        categoryId: category.id,
        amount: 200 + rnd(40) * 50,
        paymentMode: pick(["CASH", "UPI"] as const),
        paidTo: pick(["Shakti Petroleum", "Torrent Power", "Local mechanic", null]),
        staffId: null,
        note: null,
        receiptUrl: null,
      } as never);
      expenseCount += 1;
    }
    console.log(`✓ Expenses: ${expenseCount}`);

    console.log("\nDemo data seeded. Sign in and the dashboards have something to show.");
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error("✗ Demo seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
