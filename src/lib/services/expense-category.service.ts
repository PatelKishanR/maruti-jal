import "server-only";
import { withTx } from "@/lib/db/data-source";
import { expenseCategoryRepository } from "@/lib/repositories/expense-category.repository";
import { AppError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  toExpenseCategoryDto,
  toExpenseCategoryOption,
  type ExpenseCategoryDto,
  type LookupOptionDto,
} from "@/lib/dto/expense-category.dto";
import type {
  CreateExpenseCategoryInput,
  ListExpenseCategoriesQuery,
  UpdateExpenseCategoryInput,
} from "@/lib/validation/expense-category";

/**
 * Expense categories — the owner's own vocabulary for where money goes.
 *
 * This layer NEVER touches the database: every read and write goes through
 * `expenseCategoryRepository`. It owns transaction boundaries, and it maps
 * entities to DTOs before anything leaves.
 * See .claude/ARCHITECTURE.md §4
 */

/** `sort_order` is a smallint; refuse to overflow it rather than crash on save. */
const SORT_ORDER_MAX = 32_767;

/**
 * The database holds two partial unique indexes on `expense_categories` —
 * `(name)` and `(lower(name))`, both `WHERE deleted_at IS NULL`. The service
 * checks first, but a check plus a write is still two statements: two
 * concurrent creates can both pass and one will hit the index.
 *
 * Catching 23505 turns that race into the same clean field error the check
 * produces, instead of a 500 that reads as "the app is broken".
 */
function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; driverError?: { code?: string } };
  return err?.driverError?.code === "23505" || err?.code === "23505";
}

/**
 * A clean 409 with the message on the `name` field — never a 500.
 *
 * Carries BOTH a `messageKey` and `fieldErrors`, so an inline row editor and a
 * dialog form can each render it their own way without a second error path.
 */
function duplicateName(name: string): AppError {
  return new AppError(
    `Expense category "${name}" already exists`,
    "CONFLICT",
    409,
    "expenseCategories.errors.duplicate",
    { name },
    { name: ["expenseCategories.errors.duplicate"] },
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Reads
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * The whole list, switched-off rows included.
 *
 * Hiding inactive categories here would make reactivating one impossible from
 * the management screen — the owner has to see it to switch it back on.
 */
export async function listCategories(
  query: ListExpenseCategoriesQuery = { status: "all" },
): Promise<ExpenseCategoryDto[]> {
  const rows =
    query.status === "active"
      ? await expenseCategoryRepository.findActive()
      : await expenseCategoryRepository.findAllOrdered();

  const filtered =
    query.status === "inactive" ? rows.filter((r) => !r.isActive) : rows;

  return filtered.map(toExpenseCategoryDto);
}

/**
 * Options for the expense form's category picker.
 *
 * Active only — a retired category must not be selectable on a NEW expense,
 * while staying attached to the old ones. See MODULES/07-expenses.md §4.1
 *
 * The Expenses module (Wave 3) depends on this shape.
 */
export async function listCategoryOptions(
  search?: string,
): Promise<LookupOptionDto[]> {
  const rows = await expenseCategoryRepository.findActive();
  const options = rows.map(toExpenseCategoryOption);

  const term = search?.trim().toLocaleLowerCase();
  if (!term) return options;

  // Filtered in memory on purpose: this table is tens of rows, and a SQL LIKE
  // would need its own repository method for no measurable gain.
  return options.filter((o) => o.label.toLocaleLowerCase().includes(term));
}

export async function getCategory(id: string): Promise<ExpenseCategoryDto> {
  const category = await expenseCategoryRepository.findById(id);
  if (!category || category.deletedAt) throw new NotFoundError("Expense category");
  return toExpenseCategoryDto(category);
}

/* ═══════════════════════════════════════════════════════════════════════
   Writes
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Create.
 *
 * TRANSACTIONAL: the uniqueness check, the "what is the last sort order"
 * read and the insert must be atomic, or two concurrent creates can both pass
 * the check and land on the same position.
 */
export async function createCategory(
  userId: string,
  input: CreateExpenseCategoryInput,
): Promise<ExpenseCategoryDto> {
  const name = input.name.trim();

  return withTx(async (em) => {
    if (await expenseCategoryRepository.isNameTaken(name, undefined, em)) {
      throw duplicateName(name);
    }

    // New categories go to the END of the owner's order, never the top — a new
    // bucket is the least likely one to be picked next.
    const existing = await expenseCategoryRepository.findAllOrdered(em);
    const highest = existing.reduce((max, c) => Math.max(max, c.sortOrder), 0);
    const sortOrder = Math.min(highest + 1, SORT_ORDER_MAX);

    try {
      const created = await expenseCategoryRepository.create(
        { name, sortOrder, isActive: true, createdById: userId, updatedById: userId },
        em,
      );
      logger.info({ userId, categoryId: created.id }, "expense category created");
      return toExpenseCategoryDto(created);
    } catch (e) {
      if (isUniqueViolation(e)) throw duplicateName(name);
      throw e;
    }
  }, userId);
}

/**
 * Rename, switch on/off, or reposition.
 *
 * TRANSACTIONAL and row-locked: read-modify-write on a row two tabs can be
 * editing at once.
 */
export async function updateCategory(
  userId: string,
  id: string,
  input: UpdateExpenseCategoryInput,
): Promise<ExpenseCategoryDto> {
  return withTx(async (em) => {
    const category = await expenseCategoryRepository.findByIdForUpdate(id, em);
    if (!category || category.deletedAt) {
      throw new NotFoundError("Expense category");
    }

    if (input.name !== undefined) {
      const name = input.name.trim();
      // Case-only renames ("fuel" → "Fuel") must be allowed, so compare
      // case-insensitively against OTHER rows, never against this one.
      if (name.toLocaleLowerCase() !== category.name.toLocaleLowerCase()) {
        if (await expenseCategoryRepository.isNameTaken(name, id, em)) {
          throw duplicateName(name);
        }
      }
      category.name = name;
    }

    if (input.isActive !== undefined) {
      if (!input.isActive) assertDeactivatable(id);
      category.isActive = input.isActive;
    }

    if (input.sortOrder !== undefined) category.sortOrder = input.sortOrder;

    category.updatedById = userId;

    try {
      const saved = await expenseCategoryRepository.save(category, em);
      logger.info({ userId, categoryId: id }, "expense category updated");
      return toExpenseCategoryDto(saved);
    } catch (e) {
      if (isUniqueViolation(e)) throw duplicateName(category.name);
      throw e;
    }
  }, userId);
}

/**
 * Switch off. NOT a delete.
 *
 * A category in use can never be removed — deleting one would silently rewrite
 * a past month's profit breakdown. Switching off keeps it on every historical
 * expense and takes it out of the dropdown for new ones.
 * See MODULES/07-expenses.md §6
 */
export async function deactivateCategory(
  userId: string,
  id: string,
): Promise<ExpenseCategoryDto> {
  return updateCategory(userId, id, { isActive: false });
}

export async function reactivateCategory(
  userId: string,
  id: string,
): Promise<ExpenseCategoryDto> {
  return updateCategory(userId, id, { isActive: true });
}

/**
 * Persist a new order.
 *
 * TRANSACTIONAL, and this is the case that most needs it: one write per row
 * means a failure halfway leaves the list in an order nobody chose — not the
 * old one and not the new one. See .claude/ARCHITECTURE.md §4.3
 *
 * `ids` is the full list as the client sees it. Rows the client didn't know
 * about (someone added one in another tab) keep their relative order and are
 * appended after — forgiving beats rejecting the drag the owner just made.
 */
export async function reorderCategories(
  userId: string,
  ids: string[],
): Promise<ExpenseCategoryDto[]> {
  return withTx(async (em) => {
    const existing = await expenseCategoryRepository.findAllOrdered(em);
    const byId = new Map(existing.map((c) => [c.id, c]));

    const unknown = ids.filter((id) => !byId.has(id));
    if (unknown.length > 0) {
      throw new NotFoundError("Expense category", { ids: unknown });
    }

    const listed = new Set(ids);
    const ordered = [
      ...ids,
      ...existing.filter((c) => !listed.has(c.id)).map((c) => c.id),
    ];

    for (const [index, id] of ordered.entries()) {
      const position = Math.min(index + 1, SORT_ORDER_MAX);
      const category = byId.get(id);
      if (!category || category.sortOrder === position) continue;
      // Same transaction — every row moves or none does.
      await expenseCategoryRepository.updateById(
        id,
        { sortOrder: position, updatedById: userId },
        em,
      );
    }

    logger.info({ userId, count: ordered.length }, "expense categories reordered");

    const refreshed = await expenseCategoryRepository.findAllOrdered(em);
    return refreshed.map(toExpenseCategoryDto);
  }, userId);
}

/**
 * TODO(wave-3): refuse to switch off a category that still has expenses filed
 * under it this month, or offer to move them. The count lives on
 * `expenseRepository` (a repository queries its own table only), so this check
 * becomes `await expenseRepository.countByCategory(id, em)` once the Expenses
 * module exists. Until then every category is switchable — which is harmless,
 * because switching off is reversible and touches no expense row.
 */
function assertDeactivatable(_categoryId: string): void {
  // Intentionally empty until Wave 3.
}
