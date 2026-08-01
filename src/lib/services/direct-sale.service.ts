import "server-only";
import { withTx } from "@/lib/db/data-source";
import { directSaleRepository } from "@/lib/repositories/direct-sale.repository";
import { userRepository } from "@/lib/repositories/user.repository";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { parseListQuery } from "@/lib/table";
import { addDays, monthBounds, todayIST } from "@/lib/dates";
import { parseRupees } from "@/lib/money";
import {
  DEFAULT_DIRECT_SALE_RANGE,
  DIRECT_SALE_FILTERS,
  DIRECT_SALE_GROUPED_SORTS,
  directSaleTableConfig,
  type DirectSaleRange,
  type DirectSaleSortKey,
} from "@/lib/table/configs/direct-sale";
import {
  toDirectSaleDto,
  toDirectSaleListItemDto,
  toDirectSaleSiblingDto,
  type DirectSaleDayGroupDto,
  type DirectSaleDetailDto,
  type DirectSaleDto,
  type DirectSaleListDto,
  type DirectSaleListItemDto,
  type DirectSaleStatsDto,
} from "@/lib/dto/direct-sale.dto";
import type { DirectSale } from "@/lib/db/entities";
import type { DirectSaleCustomerKey } from "@/lib/repositories/direct-sale.repository";
import type {
  CreateDirectSaleInput,
  DirectSaleListQuery,
  UpdateDirectSaleInput,
  VoidDirectSaleInput,
} from "@/lib/validation/direct-sale";

/**
 * Walk-in sale business rules. Spec: .claude/MODULES/06-direct-sales.md §6
 *
 * Three rules live here and nowhere else, because this is the only layer that
 * can see both what was sent and what is already on disk:
 *
 *   1. **Same-day entries can be edited.** A counter mistake is normal on the
 *      day it is made.
 *   2. **Older entries can only be voided, with a reason.** Once a day's cash
 *      has been tallied, its total must not change quietly.
 *   3. **A void is never a delete.** The row stays, struck through, so the
 *      receipt numbering is provably untampered.
 *
 * Never touches the database directly, never returns an entity, and never adds
 * up money — every figure below came out of a SQL aggregate.
 * See .claude/ARCHITECTURE.md §4, §9.1
 */

/* ═══════════════════════════════════════════════════════════════════════
   Reads
   ═══════════════════════════════════════════════════════════════════════ */

function pickFilter(
  filters: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = filters[key];
  return typeof value === "string" ? value : undefined;
}

/** The chip presets, resolved to concrete bounds so no date maths reaches SQL. */
function resolveRange(
  range: DirectSaleRange,
  from: string | undefined,
  to: string | undefined,
): { fromDate?: string; toDate?: string } {
  // An explicit From/To from the filter popover always wins over the chip:
  // the owner typed a date, and silently overriding it with "today" is how a
  // filter earns a reputation for not working.
  if (from || to) return { fromDate: from, toDate: to };

  // `todayIST()`, never `new Date().toISOString().slice(0,10)` — the latter is
  // a day out east of UTC, which files an evening sale under tomorrow and
  // empties the Today chip at 5:30pm. See lib/dates.ts
  const today = todayIST();

  switch (range) {
    case "today":
      return { fromDate: today, toDate: today };
    case "yesterday": {
      const yesterday = addDays(today, -1);
      return { fromDate: yesterday, toDate: yesterday };
    }
    case "week":
      // Last 7 days INCLUDING today, matching the filter popover's preset.
      return { fromDate: addDays(today, -6), toDate: today };
    case "month":
      return { fromDate: monthBounds(today).from, toDate: today };
    case "all":
      return {};
  }
}

/** A filter value that isn't a number is dropped, not coerced to zero. */
function toAmount(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = parseRupees(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

/**
 * The four KPI cards. Three SQL aggregates, run together.
 *
 * `today` and `yesterday` travel on the DTO so the browser never recomputes
 * "today" against its own clock — a laptop in another timezone, or one with the
 * wrong date, would otherwise disagree with the list it is labelling.
 */
async function getDirectSaleStats(): Promise<DirectSaleStatsDto> {
  const today = todayIST();
  const yesterday = addDays(today, -1);
  const month = monthBounds(today);

  const [todaySales, yesterdaySales, monthSales] = await Promise.all([
    directSaleRepository.summariseBetween(today, today),
    directSaleRepository.summariseBetween(yesterday, yesterday),
    directSaleRepository.summariseBetween(month.from, today),
  ]);

  return {
    today,
    yesterday,
    todayCount: todaySales.count,
    todayTotal: todaySales.total,
    yesterdayCount: yesterdaySales.count,
    yesterdayTotal: yesterdaySales.total,
    monthCount: monthSales.count,
    monthTotal: monthSales.total,
    averageToday: todaySales.average,
    monthFrom: month.from,
  };
}

/** Same-day entries can be corrected; older ones can only be voided. §6 */
function canEdit(sale: DirectSale, today: string): boolean {
  return !sale.isVoided && sale.saleDate === today;
}

function customerKeyFor(sale: DirectSale): DirectSaleCustomerKey {
  return { phone: sale.phone, customerName: sale.customerName };
}

/**
 * The list page: search + filter + sort + page, the day bands and the KPIs in
 * one response, so the screen is one round trip rather than three.
 *
 * The raw query is parsed by the SHARED parser against the module's table
 * config, which is what makes `?sort=` an allowlist lookup rather than a SQL
 * fragment. See ARCHITECTURE §6.2
 */
export async function listDirectSales(
  query: DirectSaleListQuery,
): Promise<DirectSaleListDto> {
  const raw: Record<string, string | undefined> = { ...query };
  const listQuery = parseListQuery(raw, directSaleTableConfig);

  const range = (pickFilter(listQuery.filters, DIRECT_SALE_FILTERS.range) ??
    DEFAULT_DIRECT_SALE_RANGE) as DirectSaleRange;
  const { fromDate, toDate } = resolveRange(
    range,
    pickFilter(listQuery.filters, DIRECT_SALE_FILTERS.from),
    pickFilter(listQuery.filters, DIRECT_SALE_FILTERS.to),
  );

  const [[rows, total], stats] = await Promise.all([
    directSaleRepository.searchPaginated({
      search: listQuery.q || undefined,
      productId: pickFilter(listQuery.filters, DIRECT_SALE_FILTERS.productId),
      includeVoided:
        pickFilter(listQuery.filters, DIRECT_SALE_FILTERS.voided) === "1",
      fromDate,
      toDate,
      minAmount: toAmount(
        pickFilter(listQuery.filters, DIRECT_SALE_FILTERS.minAmount),
      ),
      maxAmount: toAmount(
        pickFilter(listQuery.filters, DIRECT_SALE_FILTERS.maxAmount),
      ),
      sort: listQuery.sort.key,
      dir: listQuery.sort.dir === "asc" ? "ASC" : "DESC",
      skip: (listQuery.page - 1) * listQuery.pageSize,
      take: listQuery.pageSize,
    }),
    getDirectSaleStats(),
  ]);

  /**
   * A per-day tally is meaningless once the rows are reordered ACROSS days, so
   * sorting by amount or customer drops the bands entirely rather than showing
   * a total the rows beneath it don't add up to. §3.6
   */
  const grouped = DIRECT_SALE_GROUPED_SORTS.includes(
    listQuery.sort.key as DirectSaleSortKey,
  );

  const phones = unique(
    rows.filter((sale) => sale.phone).map((sale) => sale.phone as string),
  );
  const names = unique(
    rows.filter((sale) => !sale.phone).map((sale) => sale.customerName),
  );

  const [dayGroups, phoneVisits, nameVisits] = await Promise.all([
    grouped
      ? directSaleRepository.summariseDays(unique(rows.map((r) => r.saleDate)))
      : Promise.resolve([]),
    directSaleRepository.countVisitsByPhone(phones),
    directSaleRepository.countVisitsByName(names),
  ]);

  const byPhone = new Map(phoneVisits.map((v) => [v.value, v.count]));
  const byName = new Map(nameVisits.map((v) => [v.value, v.count]));

  const items: DirectSaleListItemDto[] = rows.map((sale) =>
    toDirectSaleListItemDto(sale, {
      visitCount: sale.phone
        ? (byPhone.get(sale.phone) ?? 0)
        : (byName.get(sale.customerName) ?? 0),
      canEdit: canEdit(sale, stats.today),
    }),
  );

  return {
    result: {
      rows: items,
      total,
      page: listQuery.page,
      pageSize: listQuery.pageSize,
      pageCount: Math.max(1, Math.ceil(total / listQuery.pageSize)),
    },
    stats,
    dayGroups: dayGroups satisfies DirectSaleDayGroupDto[],
  };
}

export async function getDirectSale(id: string): Promise<DirectSaleDetailDto> {
  const sale = await directSaleRepository.findByIdWithProduct(id);
  if (!sale) throw new NotFoundError("Direct sale");

  const key = customerKeyFor(sale);

  const [siblings, siblingTotals, dayTotal, dayTotalAfterVoid, recordedByName] =
    await Promise.all([
      directSaleRepository.findCustomerSales(key, { excludeId: sale.id }),
      directSaleRepository.summariseCustomerSales(key, sale.id),
      directSaleRepository.sumForDate(sale.saleDate),
      directSaleRepository.sumForDateExcluding(sale.saleDate, sale.id),
      resolveActorName(sale.createdById),
    ]);

  /**
   * `voided_at` and `voided_by_id` are not columns on `direct_sales`, and a
   * void is the last write a sale can take — so the update stamp IS the void
   * stamp. Derived in one place rather than shown as "unknown", which the
   * banner ("voided on … by …") cannot render.
   * TODO(wave-5): dedicated columns if a void ever stops being terminal.
   */
  const voidedByName = sale.isVoided
    ? await resolveActorName(sale.updatedById)
    : null;

  return {
    ...toDirectSaleListItemDto(sale, {
      // Counts, not money: the earlier visits plus this one, unless this one
      // was voided — in which case it was not a visit.
      visitCount: siblingTotals.count + (sale.isVoided ? 0 : 1),
      canEdit: canEdit(sale, todayIST()),
    }),
    recordedByName,
    voidedByName,
    voidedAt: sale.isVoided ? sale.updatedAt.toISOString() : null,
    // Says WHY the card below is empty. `null` means there was nothing to
    // match on, which is a different fact from "matched, found nobody". §5.3
    matchedOn: sale.phone ? "phone" : sale.customerName ? "name" : null,
    siblings: siblings.map(toDirectSaleSiblingDto),
    siblingTotal: siblingTotals.total,
    siblingCount: siblingTotals.count,
    // A division for display, not an accumulation — see the DTO's note.
    perLitre:
      sale.litres && sale.litres > 0 ? sale.amount / sale.litres : null,
    dayTotal: dayTotal.total,
    dayTotalAfterVoid,
  };
}

async function resolveActorName(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const user = await userRepository.findById(userId);
  return user?.name ?? null;
}

/* ═══════════════════════════════════════════════════════════════════════
   Writes
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Record a walk-in.
 *
 * The API call is on the critical path of a five-second interaction, so it does
 * exactly two statements: the insert, and a re-read for the generated code.
 * There is no uniqueness check to make — two customers really can pay ₹20 for
 * the same thing in the same minute, and refusing the second would be a bug.
 */
export async function createDirectSale(
  userId: string,
  input: CreateDirectSaleInput,
): Promise<DirectSaleDto> {
  return withTx(async (em) => {
    const created = await directSaleRepository.create(
      {
        saleDate: input.saleDate,
        /**
         * The INSTANT, stamped by the server. A backdated entry keeps the
         * business date it was filed under and the moment it was actually
         * recorded — inventing a plausible time for it would be fabricating
         * evidence in a register whose whole job is to be auditable.
         */
        soldAt: new Date(),
        customerName: input.customerName,
        phone: input.phone,
        address: input.address,
        amount: input.amount,
        litres: input.litres,
        productId: input.productId,
        // A CHECK constraint makes anything else unrepresentable; this is the
        // same fact stated where the row is built.
        mode: "CASH",
        isVoided: false,
        note: input.note,
        createdById: userId,
        updatedById: userId,
      },
      em,
    );

    /**
     * Re-read inside the transaction: `sale_no` is an identity column and
     * `code` is a STORED generated column, both `insert: false`, so the entity
     * returned by the insert has no `DWS-000329` to hand back — and the
     * optimistic row on screen is waiting for exactly that.
     */
    const saved = await directSaleRepository.findByIdWithProduct(created.id, em);
    if (!saved) throw new NotFoundError("Direct sale");

    logger.info(
      { saleId: saved.id, code: saved.code, saleDate: saved.saleDate, userId },
      "direct sale recorded",
    );
    return toDirectSaleDto(saved);
  }, userId);
}

/**
 * Correct a same-day mistake.
 *
 * TRANSACTIONAL and row-locked: the window check and the write are one unit, so
 * an edit submitted a second before midnight cannot commit a second after a
 * void landed on the same row.
 */
export async function updateDirectSale(
  userId: string,
  id: string,
  input: UpdateDirectSaleInput,
): Promise<DirectSaleDto> {
  return withTx(async (em) => {
    const sale = await directSaleRepository.findByIdForUpdate(id, em);
    if (!sale) throw new NotFoundError("Direct sale");

    // Voided elsewhere while the form was open. The form shows this verbatim:
    // "Admin voided DWS-000329 at 6:58 pm. Your changes can't be saved." §6.4
    if (sale.isVoided) {
      throw new ConflictError(
        `${sale.code} is voided and cannot be edited`,
        "directSales.errors.voidedNotEditable",
        {
          saleId: sale.id,
          code: sale.code,
          voidedAt: sale.updatedAt.toISOString(),
        },
      );
    }

    const today = todayIST();

    /**
     * FAIL CLOSED. The client hides `Edit` on an older sale, but the rule lives
     * here — a stale tab, a script or a bookmarked URL reaches the same refusal.
     * §6.5 "window expired"
     */
    if (sale.saleDate !== today) {
      throw new ConflictError(
        `${sale.code} is dated ${sale.saleDate} and can only be voided`,
        "directSales.errors.editWindowClosed",
        { saleId: sale.id, code: sale.code, saleDate: sale.saleDate },
      );
    }

    // A sale cannot be MOVED to another day either, or yesterday's tallied
    // total would change after the fact by the back door. §6.4
    if (input.saleDate !== undefined && input.saleDate !== today) {
      throw new ConflictError(
        `${sale.code} cannot be moved to ${input.saleDate}`,
        "directSales.errors.saleDateNotToday",
        { saleId: sale.id, code: sale.code, saleDate: sale.saleDate },
      );
    }

    // PATCH is partial: `undefined` means "leave alone", which is a different
    // instruction from `null` meaning "clear this field".
    if (input.customerName !== undefined) sale.customerName = input.customerName;
    if (input.amount !== undefined) sale.amount = input.amount;
    if (input.phone !== undefined) sale.phone = input.phone;
    if (input.address !== undefined) sale.address = input.address;
    if (input.productId !== undefined) sale.productId = input.productId;
    if (input.litres !== undefined) sale.litres = input.litres;
    if (input.note !== undefined) sale.note = input.note;
    sale.updatedById = userId;

    const saved = await directSaleRepository.save(sale, em);
    const withProduct = await directSaleRepository.findByIdWithProduct(
      saved.id,
      em,
    );

    logger.info({ saleId: saved.id, code: saved.code, userId }, "direct sale updated");
    return toDirectSaleDto(withProduct ?? saved);
  }, userId);
}

/**
 * Void — never delete.
 *
 * The row stays in the register, struck through and out of every total, so the
 * receipt numbering has no gaps and a day's cash can be reconciled after the
 * fact. There is deliberately no `unvoid`: a sale that has been cancelled on
 * the record is recorded again, not quietly restored.
 */
export async function voidDirectSale(
  userId: string,
  id: string,
  input: VoidDirectSaleInput,
): Promise<DirectSaleDto> {
  return withTx(async (em) => {
    const sale = await directSaleRepository.findByIdForUpdate(id, em);
    if (!sale) throw new NotFoundError("Direct sale");

    /**
     * NOT idempotent, unlike a deactivation: the second caller's reason would
     * silently replace the first one, and the reason is the entire point of the
     * dialog. The dialog reads this back as "Admin voided it at 6:58 pm." §7.4
     */
    if (sale.isVoided) {
      throw new ConflictError(
        `${sale.code} is already voided`,
        "directSales.errors.alreadyVoided",
        {
          saleId: sale.id,
          code: sale.code,
          voidedAt: sale.updatedAt.toISOString(),
          reason: sale.voidReason,
        },
      );
    }

    sale.isVoided = true;
    sale.voidReason = input.reason;
    sale.updatedById = userId;

    const saved = await directSaleRepository.save(sale, em);
    logger.info(
      { saleId: saved.id, code: saved.code, amount: saved.amount, userId },
      "direct sale voided",
    );
    return toDirectSaleDto(saved);
  }, userId);
}
