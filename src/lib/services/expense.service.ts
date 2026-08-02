import "server-only";
import type { EntityManager } from "typeorm";
import { withTx } from "@/lib/db/data-source";
import { expenseRepository } from "@/lib/repositories/expense.repository";
import { expenseCategoryRepository } from "@/lib/repositories/expense-category.repository";
import { staffRepository } from "@/lib/repositories/staff.repository";
import { dailySalesRepository } from "@/lib/repositories/insights/daily-sales.repository";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { monthBounds, todayIST } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { expenseTableConfig } from "@/lib/table/configs/expense";
import type {
  CreateExpenseInput,
  ExpenseListQuery,
  UpdateExpenseInput,
} from "@/lib/validation/expense";
import type { ExpenseSearchQuery } from "@/lib/repositories/expense.repository";
import { toPeriodProfitDto } from "@/lib/dto/insights.dto";
import {
  toExpenseDto,
  toExpenseListItemDto,
  type ExpenseCategoryChipDto,
  type ExpenseCategorySpendDto,
  type ExpenseDetailDto,
  type ExpenseDto,
  type ExpenseKpisDto,
  type ExpenseLabels,
  type ExpenseListResponseDto,
  type ExpenseOptionDto,
  type ExpenseTrendDirection,
} from "@/lib/dto/expense.dto";

/**
 * The cash-out register.
 *
 * This layer NEVER touches the database — every read and write goes through
 * `expenseRepository`, `expenseCategoryRepository` or `staffRepository`. It
 * owns transaction boundaries, and it maps entities to DTOs before anything
 * leaves. See .claude/ARCHITECTURE.md §4
 *
 * **Not one rupee is added up in TypeScript.** Every total, every month
 * comparison and every per-category subtotal on this page is a SQL aggregate.
 * The moment one monetary figure is derived here, the next one is too, and the
 * rule stops being enforceable. See .claude/DATA-MODEL.md D-4
 *
 * **The month is the unit.** The list opens on the current month in IST because
 * that is the frame the owner thinks in; "all time" is almost never what he
 * wants, and asking him to pick a range every visit costs more than it gives.
 * See design/MODULES/07-expenses.md §3.1
 */

// ─────────────────────────────────────────────────────────────────────────────
// Month arithmetic
// ─────────────────────────────────────────────────────────────────────────────

/** `YYYY-MM` in IST. The default frame for the whole page. */
function currentMonth(): string {
  return todayIST().slice(0, 7);
}

/**
 * The month before `month`, as `YYYY-MM`.
 *
 * String arithmetic, like everything else date-shaped in this app: `new
 * Date(iso)` parses as UTC midnight, so stepping back a month through a `Date`
 * can land in the wrong one when read east of UTC.
 * See .claude/ARCHITECTURE.md §9.2
 */
function previousMonthOf(month: string): string {
  const [year, index] = month.split("-").map(Number);
  return index === 1
    ? `${year - 1}-12`
    : `${year}-${String(index - 1).padStart(2, "0")}`;
}

/** First and last business date of a `YYYY-MM`. */
function boundsOf(month: string): { from: string; to: string } {
  return monthBounds(`${month}-01`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `chk_expenses_amount_positive` fired.
 *
 * The Zod schema already refuses a non-positive amount, so reaching this means
 * a caller that never came through the form. It still has to land as a FIELD
 * error rather than a 500 — an owner who somehow submits `0` should be told
 * "Amount must be more than ₹0.00" under the box, not shown a broken page.
 */
function isCheckViolation(e: unknown): boolean {
  const err = e as {
    code?: string;
    constraint?: string;
    driverError?: { code?: string; constraint?: string };
  };
  const code = err?.driverError?.code ?? err?.code;
  if (code !== "23514") return false;

  const constraint = err?.driverError?.constraint ?? err?.constraint;
  // An unnamed CHECK on this table can only be the amount one; anything else
  // is re-thrown so a real bug is not swallowed as a field error.
  return constraint === undefined || constraint.includes("amount");
}

function amountNotPositive(): ValidationError {
  return new ValidationError(
    { amount: ["expenses.errors.amountPositive"] },
    "expenses.errors.couldNotSave",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Label loading
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every category name, retired ones included, keyed by id.
 *
 * A table in the low tens of rows read once per request rather than joined per
 * row — `expenseRepository` queries its own table only, so the join it would
 * otherwise need lives here as a second repository call.
 * See .claude/ARCHITECTURE.md §4.1 rule 4
 */
async function loadCategoryLabels(
  em?: EntityManager,
): Promise<ExpenseLabels["categories"]> {
  const rows = await expenseCategoryRepository.findAllOrdered(em);
  return new Map(
    rows.map((row) => [row.id, { name: row.name, isActive: row.isActive }]),
  );
}

/** One staff name, for the single row a detail page renders. */
async function loadStaffLabel(
  staffId: string | null,
  em?: EntityManager,
): Promise<ExpenseLabels["staff"]> {
  if (!staffId) return new Map();
  const staff = await staffRepository.findById(staffId, em);
  return new Map(staff ? [[staff.id, staff.name]] : []);
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The register, its foot total, the KPI strip and the chip band — one call.
 *
 * All four describe the same filtered set, so they are fetched together: two
 * round trips would only let the strip and the table disagree while one of them
 * was in flight, which is exactly the moment the owner is reading both.
 * See .claude/MODULE-RECIPE.md §7
 */
export async function listExpenses(
  query: ExpenseListQuery,
): Promise<ExpenseListResponseDto> {
  /**
   * The injection defence, restated at the point of use: `query.sort` has
   * already been narrowed to a key of the allowlist by Zod, and here it is used
   * ONLY as a lookup key. A value that somehow missed both falls back to the
   * default rather than reaching the query builder.
   * See .claude/ARCHITECTURE.md §6.2
   */
  const sort = Object.hasOwn(expenseTableConfig.sortable, query.sort)
    ? query.sort
    : expenseTableConfig.defaultSort.key;

  // Only the server can compute "this month" honestly — a schema evaluated at
  // boot would freeze it at whatever day the process started.
  const month = query.month ?? currentMonth();
  const bounds = boundsOf(month);
  const previousMonth = previousMonthOf(month);

  // An explicit range overrides the month for the ROWS, never for the KPIs:
  // the strip always describes a whole month, or it is comparing a fortnight
  // against a month and reporting the difference as a trend.
  const fromDate = query.from ?? bounds.from;
  const toDate = query.to ?? bounds.to;

  const filters: ExpenseSearchQuery = {
    search: query.q || undefined,
    categoryId: query.category,
    staffId: query.staff,
    paymentMode: query.mode,
    fromDate,
    toDate,
    minAmount: query.minAmount,
    maxAmount: query.maxAmount,
    hasAttachment:
      query.receipt === "any" ? undefined : query.receipt === "with",
  };

  const [[rows, total], totals, comparison, byCategory, categories, totalRecorded] =
    await Promise.all([
      expenseRepository.searchPaginated({
        ...filters,
        sort,
        dir: query.dir === "asc" ? "ASC" : "DESC",
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      // Same predicates, minus paging — the foot row totals the whole filtered
      // set, not the page on screen.
      expenseRepository.sumFiltered(filters),
      expenseRepository.monthComparison(bounds, boundsOf(previousMonth)),
      expenseRepository.sumByCategoryBetween(bounds.from, bounds.to),
      expenseCategoryRepository.findAllOrdered(),
      expenseRepository.count(),
    ]);

  const labels: ExpenseLabels = {
    categories: new Map(
      categories.map((c) => [c.id, { name: c.name, isActive: c.isActive }]),
    ),
  };

  const spendByCategory = new Map(byCategory.map((row) => [row.categoryId, row]));

  /** Share of the month, not of the filtered set — the card says "of Aug". */
  const share = (amount: number): number | null =>
    comparison.current === 0
      ? null
      : Math.round((amount / comparison.current) * 1000) / 10;

  /**
   * The profit card: what came in this month, less what went out.
   *
   * Income is `v_daily_sales` across all three channels — delivery, party and
   * walk-in — over the same month bounds the expense figures use, so the two
   * halves of the card cover the same days.
   *
   * REVENUE, NOT COLLECTION. Profit is an accrual question: what the month
   * EARNED against what it SPENT. Collection is when the cash physically
   * arrived, which for a delivery billed on the 2nd and paid on the 9th is a
   * different month entirely at a month boundary.
   *
   * THE SUBTRACTION HAPPENS IN POSTGRESQL. Income lives in a view and spend
   * lives in `expenses`, so no single relation can subtract them — but that is
   * an argument for passing the expense total down as a bound `numeric`, not
   * for deriving a rupee figure in JavaScript. See DATA-MODEL D-4 and
   * `dailySalesRepository.profitBetween`.
   */
  const profit = toPeriodProfitDto(
    await dailySalesRepository.profitBetween(
      bounds.from,
      bounds.to,
      comparison.current.toFixed(2),
    ),
  );

  // `sumByCategoryBetween` already orders by total DESC, so the biggest is the
  // first row. Sorting again here would be a second opinion on a settled fact.
  const leader = byCategory[0];
  const biggestCategory: ExpenseCategorySpendDto | null = leader
    ? {
        categoryId: leader.categoryId,
        categoryName: labels.categories.get(leader.categoryId)?.name ?? "—",
        total: leader.total,
        count: leader.count,
        sharePercent: share(leader.total),
      }
    : null;

  const kpis: ExpenseKpisDto = {
    month,
    previousMonth,
    thisMonthTotal: comparison.current,
    thisMonthCount: comparison.currentCount,
    previousMonthTotal: comparison.previous,
    deltaAmount: comparison.delta,
    // A rise from nothing has no meaningful percentage — say so rather than
    // divide by zero and render `Infinity%`.
    deltaPercent:
      comparison.previous === 0
        ? null
        : Math.round((comparison.delta / comparison.previous) * 1000) / 10,
    trend: direction(comparison.delta),
    biggestCategory,
    profit: {
      month,
      income: profit.income,
      expenses: profit.expenses,
      profit: profit.profit,
      // The aggregate is live. A zero income month is now a fact about the
      // month, not an admission that the figure cannot be computed.
      available: true,
    },
  };

  // Every active category gets a chip, plus any retired one that still has
  // spend this month — a chip missing for a category the owner can SEE in the
  // rows below would read as a filter that lost some money.
  const chips: ExpenseCategoryChipDto[] = categories
    .filter((c) => c.isActive || spendByCategory.has(c.id))
    .map((c) => ({
      id: c.id,
      name: c.name,
      isActive: c.isActive,
      monthTotal: spendByCategory.get(c.id)?.total ?? 0,
      monthCount: spendByCategory.get(c.id)?.count ?? 0,
    }));

  return {
    result: {
      rows: rows.map((row) => toExpenseListItemDto(row, labels)),
      total,
      page: query.page,
      pageSize: query.pageSize,
      pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
    },
    kpis,
    totals: {
      total: totals.total,
      count: totals.count,
      // The label has to state what it is totalling, so the foot row knows
      // whether it is "Aug 2026 total" or "Fuel in Aug 2026 total".
      filtered:
        !!query.q ||
        query.category !== undefined ||
        query.mode !== undefined ||
        query.staff !== undefined ||
        query.minAmount !== undefined ||
        query.maxAmount !== undefined ||
        query.receipt !== "any" ||
        query.from !== undefined ||
        query.to !== undefined,
    },
    categories: chips,
    totalRecorded,
    month,
    from: fromDate,
    to: toDate,
  };
}

function direction(delta: number): ExpenseTrendDirection {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "flat";
}

/**
 * One expense, INCLUDING a soft-deleted one.
 *
 * The detail page has to render a deleted expense — grey banner, `Restore`
 * button — so it cannot use the default scope, which hides them.
 * See design/MODULES/07-expenses.md §5.5
 */
export async function getExpense(id: string): Promise<ExpenseDetailDto> {
  const expense = await expenseRepository.findByIdWithDeleted(id);
  if (!expense) throw new NotFoundError("Expense", { id });

  const [categories, staff] = await Promise.all([
    loadCategoryLabels(),
    loadStaffLabel(expense.staffId),
  ]);

  const dto = toExpenseDto(expense, { categories, staff });

  /**
   * The rail is built from the row's OWN timestamps, which are facts.
   *
   * TODO(wave-5): field-level history (`Amount changed ₹4,500.00 → ₹4,850.00`)
   * lives in `document_revisions` and `audit_logs`, each with its own
   * repository. This service will call them and merge; `activityComplete` says
   * out loud that it hasn't yet, rather than implying nothing ever changed.
   */
  return {
    ...dto,
    activity: [
      ...(dto.deletedAt
        ? [
            {
              id: `${dto.id}-deleted`,
              at: dto.deletedAt,
              action: "deleted" as const,
              actorName: null,
            },
          ]
        : []),
      {
        id: `${dto.id}-created`,
        at: dto.createdAt,
        action: "created" as const,
        actorName: null,
      },
    ],
    activityComplete: false,
  };
}

/**
 * The picker. MODULE-RECIPE §5 — every module ships one.
 *
 * Newest recorded first, because the expense someone wants to reference is
 * almost always one just entered. `createdAt` is in `EXPENSE_SORT_COLUMNS` but
 * deliberately NOT in `EXPENSE_SORT_KEYS`: it is a service ordering, never a
 * column header the browser can ask for.
 */
export async function listExpenseOptions(
  q: string,
): Promise<ExpenseOptionDto[]> {
  const [rows] = await expenseRepository.searchPaginated({
    search: q || undefined,
    sort: "createdAt",
    dir: "DESC",
    skip: 0,
    // A picker returning 400 rows is a picker nobody scrolls.
    take: 50,
  });

  return rows.map((expense) => ({
    id: expense.id,
    label: expense.code,
    // Two expenses on the same day are told apart by the amount and the payee.
    hint: [formatINR(expense.amount), expense.paidTo]
      .filter(Boolean)
      .join(" · "),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A category can be retired, or a staff member deactivated, between the form
 * loading and the owner pressing Save.
 *
 * Failing as a FIELD error rather than a 500 is what lets the form say "the
 * category «Coin printing» was switched off while you were typing" instead of
 * surfacing a foreign-key violation. Both columns are ON DELETE RESTRICT, so
 * the database would refuse anyway — as a 500.
 */
async function assertReferencesSelectable(
  categoryId: string | undefined,
  staffId: string | null | undefined,
  em: EntityManager,
): Promise<void> {
  const fieldErrors: Record<string, string[]> = {};

  if (categoryId !== undefined) {
    const category = await expenseCategoryRepository.findById(categoryId, em);
    if (!category || category.deletedAt) {
      fieldErrors.categoryId = ["expenses.errors.categoryMissing"];
    } else if (!category.isActive) {
      fieldErrors.categoryId = ["expenses.errors.categoryRetired"];
    }
  }

  if (staffId !== undefined && staffId !== null) {
    const staff = await staffRepository.findById(staffId, em);
    if (!staff || staff.deletedAt) {
      fieldErrors.staffId = ["expenses.errors.staffMissing"];
    } else if (!staff.isActive) {
      fieldErrors.staffId = ["expenses.errors.staffInactive"];
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError(fieldErrors, "expenses.errors.couldNotSave");
  }
}

/**
 * TRANSACTIONAL: the reference checks and the insert must be atomic, or a
 * category retired a millisecond later leaves an expense pointing at one that
 * is no longer selectable — which the form would then be unable to explain.
 *
 * `receiptUrl` arrives as a STRING the caller already holds.
 * TODO(infra): no file-storage provider is configured — S3, R2 and UploadThing
 * are all live options and picking one is an infrastructure decision nobody has
 * made. Adding a storage dependency here would make that decision silently, so
 * the column is written from whatever string the client supplies and the
 * dropzone says out loud that uploads aren't wired yet.
 * See design/MODULES/07-expenses.md §4.3
 */
export async function createExpense(
  userId: string,
  input: CreateExpenseInput,
): Promise<ExpenseDto> {
  return withTx(async (em) => {
    await assertReferencesSelectable(input.categoryId, input.staffId, em);

    try {
      const expense = await expenseRepository.create(
        {
          expenseDate: input.expenseDate,
          categoryId: input.categoryId,
          amount: input.amount,
          paymentMode: input.paymentMode,
          paidTo: input.paidTo,
          staffId: input.staffId,
          note: input.note,
          attachmentUrl: input.receiptUrl,
          createdById: userId,
          updatedById: userId,
        },
        em,
      );

      logger.info({ userId, expenseId: expense.id }, "expense created");

      return toExpenseDto(expense, {
        categories: await loadCategoryLabels(em),
        staff: await loadStaffLabel(expense.staffId, em),
      });
    } catch (e) {
      // The DB CHECK is the last line, not the first — it must still surface as
      // a clean field error rather than a 500.
      if (isCheckViolation(e)) throw amountNotPositive();
      throw e;
    }
  }, userId);
}

/**
 * TRANSACTIONAL and row-locked: read-modify-write on a record the owner may be
 * editing in two tabs. Without the lock the later save silently discards the
 * earlier one's untouched fields.
 *
 * A field left `undefined` is UNTOUCHED, a field set to `null` is CLEARED — the
 * distinction is the whole reason a targeted PATCH of just `receiptUrl` does
 * not have to resend an amount it never looked at.
 *
 * The category is only re-checked when it CHANGES. An expense filed under a
 * since-retired category must stay editable — otherwise fixing a typo in its
 * note would be impossible. See design §4.5
 */
export async function updateExpense(
  userId: string,
  id: string,
  input: UpdateExpenseInput,
): Promise<ExpenseDto> {
  return withTx(async (em) => {
    const expense = await expenseRepository.findByIdForUpdate(id, em);
    if (!expense || expense.deletedAt) throw new NotFoundError("Expense", { id });

    await assertReferencesSelectable(
      input.categoryId !== undefined && input.categoryId !== expense.categoryId
        ? input.categoryId
        : undefined,
      input.staffId !== undefined && input.staffId !== expense.staffId
        ? input.staffId
        : undefined,
      em,
    );

    if (input.expenseDate !== undefined) expense.expenseDate = input.expenseDate;
    if (input.categoryId !== undefined) expense.categoryId = input.categoryId;
    if (input.amount !== undefined) expense.amount = input.amount;
    if (input.paymentMode !== undefined) expense.paymentMode = input.paymentMode;
    if (input.paidTo !== undefined) expense.paidTo = input.paidTo;
    if (input.staffId !== undefined) expense.staffId = input.staffId;
    if (input.note !== undefined) expense.note = input.note;
    if (input.receiptUrl !== undefined) {
      expense.attachmentUrl = input.receiptUrl;
    }

    expense.updatedById = userId;

    try {
      const saved = await expenseRepository.save(expense, em);
      logger.info({ userId, expenseId: id }, "expense updated");

      return toExpenseDto(saved, {
        categories: await loadCategoryLabels(em),
        staff: await loadStaffLabel(saved.staffId, em),
      });
    } catch (e) {
      if (isCheckViolation(e)) throw amountNotPositive();
      throw e;
    }
  }, userId);
}

/**
 * SOFT delete. The row stays.
 *
 * A deleted expense stops counting towards the month's profit and disappears
 * from the register, but it is still in the records and still restorable — the
 * detail page renders it behind a grey banner. Nothing transactional in this
 * app is ever hard-deleted. See .claude/DATA-MODEL.md §4
 *
 * `deletedById` is stamped BEFORE the soft delete so the two land in the same
 * transaction: a `deleted_at` with no `deleted_by_id` is an audit hole.
 */
export async function deleteExpense(
  userId: string,
  id: string,
): Promise<ExpenseDto> {
  return withTx(async (em) => {
    // The lock scope hides soft-deleted rows, so a null here means EITHER
    // already-deleted or genuinely missing. `readBack` tells them apart: it
    // sees deleted rows and throws only when there is nothing at all. A
    // double-clicked Delete is therefore a no-op, not an error toast.
    const expense = await expenseRepository.findByIdForUpdate(id, em);

    if (expense) {
      await expenseRepository.updateById(id, { deletedById: userId }, em);
      await expenseRepository.softDeleteById(id, em);
      logger.info({ userId, expenseId: id }, "expense deleted");
    }

    return readBack(id, em);
  }, userId);
}

/**
 * Undo. Backs the 8-second `Undo` on the delete toast and the `Restore` button
 * on a deleted expense's detail page. See design §3.4 and §5.4
 */
export async function restoreExpense(
  userId: string,
  id: string,
): Promise<ExpenseDto> {
  return withTx(async (em) => {
    const expense = await expenseRepository.findByIdWithDeleted(id, em);
    if (!expense) throw new NotFoundError("Expense", { id });

    if (expense.deletedAt) {
      await expenseRepository.restoreById(id, em);
      await expenseRepository.updateById(
        id,
        { deletedById: null, updatedById: userId },
        em,
      );
      logger.info({ userId, expenseId: id }, "expense restored");
    }

    return readBack(id, em);
  }, userId);
}

/**
 * Re-read after a partial update, deleted rows included.
 *
 * `updateById` and `softDeleteById` bypass entity subscribers and leave the
 * in-memory instance stale, so returning it would report a `deletedAt` that is
 * one state behind what the database now holds.
 */
async function readBack(id: string, em: EntityManager): Promise<ExpenseDto> {
  const fresh = await expenseRepository.findByIdWithDeleted(id, em);
  if (!fresh) throw new NotFoundError("Expense", { id });

  return toExpenseDto(fresh, {
    categories: await loadCategoryLabels(em),
    staff: await loadStaffLabel(fresh.staffId, em),
  });
}
