import "server-only";
import { withTx } from "@/lib/db/data-source";
import { staffRepository } from "@/lib/repositories/staff.repository";
import { auditLogRepository } from "@/lib/repositories/audit-log.repository";
import { userRepository } from "@/lib/repositories/user.repository";
import { staffOutstandingRepository } from "@/lib/repositories/insights/staff-outstanding.repository";
import { staffJarBalanceRepository } from "@/lib/repositories/insights/staff-jar-balance.repository";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { parseListQuery } from "@/lib/table";
import {
  DEFAULT_STAFF_STATUS,
  STAFF_FILTERS,
  staffTableConfig,
  type StaffStatusFilter,
} from "@/lib/table/configs/staff";
import {
  toStaffActivityEntryDto,
  toStaffDto,
  toStaffListItemDto,
  type StaffBlockerDto,
  type StaffDetailDto,
  type StaffDto,
  type StaffListDto,
  type StaffListItemDto,
  type StaffOptionDto,
  type StaffOutstanding,
  type StaffStatsDto,
} from "@/lib/dto/staff.dto";
import {
  toStaffJarBalanceDto,
  toStaffJarBalanceTotalsDto,
  toStaffOutstandingDto,
  toStaffOutstandingTotalsDto,
  type StaffJarBalanceDto,
  type StaffOutstandingDto,
} from "@/lib/dto/insights.dto";
import type { Staff } from "@/lib/db/entities";
import type { EntityManager } from "typeorm";
import type {
  CreateStaffInput,
  StaffListQuery,
  UpdateStaffInput,
} from "@/lib/validation/staff";

/**
 * Staff business rules.
 *
 * This layer never touches the database — every read and write goes through a
 * repository — and it never returns an entity. It owns the transaction
 * boundaries. See .claude/ARCHITECTURE.md §4
 */

/* ═══════════════════════════════════════════════════════════════════════
   Outstanding figures

   Cash dues, coin dues and jars out are cross-module aggregates: they span
   `delivery_orders`, `order_items`, `coin_issues` and their return events.
   Under "one repository per entity" (ARCHITECTURE §4.1 rule 4) that number has
   nowhere to live — which is exactly why `v_staff_outstanding` and
   `v_staff_jar_balance` exist. A view is a single relation, so it gets its own
   repository and the rule holds unbroken, while every rupee of arithmetic stays
   inside PostgreSQL.

   So this file reads TWO view repositories and zips them together. What it must
   NOT become: a join added to `staffRepository`, which queries the `staff`
   table and nothing else.

   NOBODY DISAPPEARS. Both views drive from `staff` through a lateral over an
   unfiltered aggregate, so a staff member with nothing outstanding still has a
   row of zeros. The `?? ZERO` fallbacks below therefore only fire for a person
   created inside the current transaction, before the view can see him.
   ═══════════════════════════════════════════════════════════════════════ */

const NOTHING_OUTSTANDING: StaffOutstanding = {
  cashOutstanding: 0,
  jarsOut: 0,
  coinDues: 0,
  moneyOutstanding: 0,
};

/**
 * One person's position, from the two views.
 *
 * `moneyOutstanding` is `total_dues` STRAIGHT OFF THE VIEW — it is not
 * `cashOutstanding + coinDues` recomputed here. Adding two rupee figures in
 * TypeScript is a code-review failure in this codebase, and the badge that
 * renders this number would be the first place a float artefact showed up.
 * See DATA-MODEL D-4.
 */
function combineOutstanding(
  dues: StaffOutstandingDto | null,
  jars: StaffJarBalanceDto | null,
): StaffOutstanding {
  return {
    cashOutstanding: dues?.orderDues ?? 0,
    coinDues: dues?.coinDues ?? 0,
    moneyOutstanding: dues?.totalDues ?? 0,
    jarsOut: jars?.jarsOut ?? 0,
  };
}

/** A whole page of staff in two round trips, not two per row. */
async function outstandingByStaffId(
  staffIds: string[],
): Promise<Map<string, StaffOutstanding>> {
  if (staffIds.length === 0) return new Map();

  const [dues, jars] = await Promise.all([
    staffOutstandingRepository.findByStaffIds(staffIds),
    staffJarBalanceRepository.findByStaffIds(staffIds),
  ]);

  const duesById = new Map(
    dues.map((row) => {
      const dto = toStaffOutstandingDto(row);
      return [dto.staffId, dto] as const;
    }),
  );
  const jarsById = new Map(
    jars.map((row) => {
      const dto = toStaffJarBalanceDto(row);
      return [dto.staffId, dto] as const;
    }),
  );

  return new Map(
    staffIds.map((id) => [
      id,
      combineOutstanding(duesById.get(id) ?? null, jarsById.get(id) ?? null),
    ]),
  );
}

function outstandingFrom(
  map: ReadonlyMap<string, StaffOutstanding>,
  staff: Staff,
): StaffOutstanding {
  return map.get(staff.id) ?? { ...NOTHING_OUTSTANDING };
}

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

/**
 * The four KPI cards above the list.
 *
 * `cashOutstanding` is the roster-wide sum of ORDER dues, matching the "Cash"
 * column in the table below it — a card labelled "Cash outstanding" that
 * silently folded in coin dues would not reconcile against the column the owner
 * can see. `staffWithBalance` counts everyone with ANY money owing, which is
 * what the card's link (`?hasBalance=1`) filters to.
 *
 * Every one of these is a SQL aggregate over a view. Nothing is summed here.
 */
async function getStaffStats(): Promise<StaffStatsDto> {
  const [totalStaff, activeStaff, duesRow, jarsRow] = await Promise.all([
    staffRepository.count(),
    staffRepository.countActive(),
    staffOutstandingRepository.totals(),
    staffJarBalanceRepository.totals(),
  ]);

  // Converted once — `numeric` reaches us as a string and must not stay one.
  const dues = toStaffOutstandingTotalsDto(duesRow);
  const jars = toStaffJarBalanceTotalsDto(jarsRow);

  return {
    totalStaff,
    activeStaff,
    inactiveStaff: Math.max(0, totalStaff - activeStaff),
    cashOutstanding: dues.orderDues,
    jarsOut: jars.jarsOut,
    staffWithBalance: dues.staffWithBalance,
    staffWithJars: jars.staffWithJars,
  };
}

/**
 * The list page: search + filter + sort + page, plus the KPI strip.
 *
 * The raw query is parsed by the SHARED parser against the module's table
 * config, which is what makes the sort key an allowlist lookup rather than a
 * SQL fragment. See ARCHITECTURE §6.2
 */
export async function listStaff(query: StaffListQuery): Promise<StaffListDto> {
  const raw: Record<string, string | undefined> = { ...query };
  const listQuery = parseListQuery(raw, staffTableConfig);

  const status = (pickFilter(listQuery.filters, STAFF_FILTERS.status) ??
    DEFAULT_STAFF_STATUS) as StaffStatusFilter;
  const wantsBalance =
    pickFilter(listQuery.filters, STAFF_FILTERS.hasBalance) === "1";
  const wantsJars = pickFilter(listQuery.filters, STAFF_FILTERS.hasJars) === "1";

  const stats = await getStaffStats();

  /**
   * `?hasBalance=1` and `?hasJars=1`.
   *
   * The predicates live on the views, so the ids are resolved there and passed
   * to `staffRepository` as a set — search, sort and pagination still run once,
   * against `staff`, in a single round trip. Asking `staffRepository` to join
   * the views would break "a repository queries its own table only".
   *
   * BOTH FILTERS TOGETHER MEANS BOTH, NOT EITHER. The two chips are separate
   * questions and the filter popover lets the owner tick both; an owner who
   * ticks both is asking "who owes me money AND is holding my jars", so the
   * sets are intersected. `undefined` when neither is ticked leaves the query
   * unrestricted — an empty array would mean nobody.
   */
  let ids: string[] | undefined;
  if (wantsBalance || wantsJars) {
    const [withDues, withJars] = await Promise.all([
      wantsBalance ? staffOutstandingRepository.findStaffIdsWithDues() : null,
      wantsJars ? staffJarBalanceRepository.findStaffIdsWithJarsOut() : null,
    ]);

    if (withDues && withJars) {
      const jarSet = new Set(withJars);
      ids = withDues.filter((id) => jarSet.has(id));
    } else {
      ids = withDues ?? withJars ?? [];
    }
  }

  const [rows, total] = await staffRepository.searchPaginated({
    search: listQuery.q || undefined,
    isActive: status === "all" ? undefined : status === "active",
    ids,
    sort: listQuery.sort.key,
    dir: listQuery.sort.dir === "asc" ? "ASC" : "DESC",
    skip: (listQuery.page - 1) * listQuery.pageSize,
    take: listQuery.pageSize,
  });

  // Two view queries for the whole page, not two per row.
  const outstanding = await outstandingByStaffId(rows.map((s) => s.id));

  const items: StaffListItemDto[] = rows.map((staff) =>
    toStaffListItemDto(staff, outstandingFrom(outstanding, staff)),
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
  };
}

export async function getStaff(id: string): Promise<StaffDetailDto> {
  const staff = await staffRepository.findById(id);
  if (!staff) throw new NotFoundError("Staff");

  /**
   * Two repositories, one service — the composition rule in practice. The
   * audit rows come from `audit_logs`, written by a database trigger, so the
   * history is right even when a change came from a script or the console.
   */
  const activity = await auditLogRepository.findForRecord("staff", staff.id);

  const [createdByName, updatedByName, duesRow, jarsRow] = await Promise.all([
    resolveActorName(staff.createdById),
    resolveActorName(staff.updatedById),
    staffOutstandingRepository.findByStaffId(staff.id),
    staffJarBalanceRepository.findByStaffId(staff.id),
  ]);

  const dues = duesRow ? toStaffOutstandingDto(duesRow) : null;
  const jars = jarsRow ? toStaffJarBalanceDto(jarsRow) : null;

  return {
    ...toStaffListItemDto(staff, combineOutstanding(dues, jars)),

    /** Jars ever issued — the "of 402" in "18 of 402". */
    jarsTotal: jars?.jarsIssued ?? 0,

    /**
     * The context lines under each summary figure, and the counts the blocked
     * dialog reads back. Three DIFFERENT counts, on purpose:
     *   openOrderCount    — orders with money still owing (outstanding > 0)
     *   openIssueCount    — coin issues not settled (outstanding <> 0, so a
     *                       refund the company owes counts as open too)
     *   jarsOutOrderCount — orders with jars still pending, which is a
     *                       different set: an order can be paid in full and
     *                       still have jars on the van.
     */
    openOrderCount: dues?.openOrderCount ?? 0,
    openIssueCount: dues?.openIssueCount ?? 0,
    jarsOutOrderCount: jars?.openOrderCount ?? 0,

    /**
     * NOT WIRED — and not from these views.
     *
     * `lifetimeRevenue` and the three tab counts are LIFETIME figures per staff
     * member. `v_staff_outstanding` and `v_staff_jar_balance` carry only what is
     * still OPEN, and `v_daily_sales` has no staff dimension at all, so no view
     * in the migration can answer them. They need `countByStaff` methods on the
     * delivery-order, coin-issue and payment repositories — a different change
     * from this one, in modules that own those tables.
     */
    lifetimeRevenue: 0,
    deliveryOrderCount: 0,
    coinIssueCount: 0,
    paymentCount: 0,

    createdByName,
    updatedByName,
    activity: activity.map(toStaffActivityEntryDto),
  };
}

async function resolveActorName(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const user = await userRepository.findById(userId);
  return user?.name ?? null;
}

/** Pickers and dropdowns: the active roster, searchable, capped. */
export async function listStaffOptions(q?: string): Promise<StaffOptionDto[]> {
  const [rows] = await staffRepository.searchPaginated({
    search: q?.trim() || undefined,
    isActive: true,
    sort: "name",
    dir: "ASC",
    skip: 0,
    // A picker that returns 400 rows is a picker nobody scrolls. Typing
    // narrows it; the list page is for browsing.
    take: 50,
  });

  return rows.map((staff) => ({
    id: staff.id,
    label: staff.name,
    // Two people genuinely can share a name; the phone is what tells them apart.
    hint: `${staff.code} · ${staff.phone}`,
  }));
}

/* ═══════════════════════════════════════════════════════════════════════
   Writes
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * A phone number already on file.
 *
 * The message the owner sees names the person holding it, so a duplicate is a
 * navigable fact rather than a refusal. The meta travels to the form, which
 * renders the name, the code and a `View` link.
 */
function phoneConflict(existing: Staff): ConflictError {
  return new ConflictError(
    `Phone ${existing.phone} already belongs to ${existing.code}`,
    "staff.errors.phoneTaken",
    {
      phone: existing.phone,
      staffId: existing.id,
      staffName: existing.name,
      staffCode: existing.code,
      staffIsActive: existing.isActive,
    },
  );
}

/**
 * What is still open against this person.
 *
 * Returned as an itemised list rather than a boolean, because the dialog has
 * to say WHICH balance is blocking — "cannot deactivate" with no reason is how
 * an owner ends up editing rows in the database console.
 */
async function deactivationBlockers(
  staff: Staff,
  em: EntityManager,
): Promise<StaffBlockerDto[]> {
  /**
   * Read INSIDE the caller's transaction, which already holds the row lock on
   * this staff member. On a separate connection the guard would be checking a
   * snapshot taken before the lock, and a payment committing in that gap could
   * let a deactivation through against a balance that was still open when the
   * decision was made.
   */
  const [duesRow, jarsRow] = await Promise.all([
    staffOutstandingRepository.findByStaffId(staff.id, em),
    staffJarBalanceRepository.findByStaffId(staff.id, em),
  ]);

  const dues = duesRow ? toStaffOutstandingDto(duesRow) : null;
  const jars = jarsRow ? toStaffJarBalanceDto(jarsRow) : null;
  const blockers: StaffBlockerDto[] = [];

  // Each blocker carries the COUNT behind the figure, so the dialog reads
  // "₹35,570.00 across 18 orders" rather than an unexplained number.
  if (dues && dues.orderDues > 0) {
    blockers.push({
      kind: "cash",
      amount: dues.orderDues,
      count: dues.openOrderCount,
    });
  }
  if (jars && jars.jarsOut > 0) {
    blockers.push({
      kind: "jars",
      amount: jars.jarsOut,
      count: jars.openOrderCount,
    });
  }
  if (dues && dues.coinDues > 0) {
    blockers.push({
      kind: "coins",
      amount: dues.coinDues,
      count: dues.openIssueCount,
    });
  }

  return blockers;
}

/**
 * FAIL CLOSED.
 *
 * The client already knows the figures and shows the blocking dialog itself,
 * but the rule lives here — a deactivation that reaches the API by any other
 * route (a stale tab, a script, a future mobile app) is refused the same way.
 * See MODULES/01-staff.md §6
 */
async function assertDeactivatable(
  staff: Staff,
  em: EntityManager,
): Promise<void> {
  const blockers = await deactivationBlockers(staff, em);
  if (blockers.length === 0) return;

  throw new ConflictError(
    `Staff ${staff.code} has outstanding balances`,
    "staff.errors.deactivateBlocked",
    { staffId: staff.id, staffName: staff.name, blockers },
  );
}

/**
 * Create.
 *
 * TRANSACTIONAL: the uniqueness check and the insert must be atomic, or two
 * concurrent creates both pass the check and the partial unique index rejects
 * the second one with a database error the owner cannot read.
 */
export async function createStaff(
  userId: string,
  input: CreateStaffInput,
): Promise<StaffDto> {
  return withTx(async (em) => {
    const existing = await staffRepository.findByPhone(input.phone, em);
    if (existing) throw phoneConflict(existing);

    const created = await staffRepository.create(
      {
        name: input.name,
        phone: input.phone,
        altPhone: input.altPhone,
        address: input.address,
        note: input.note,
        joinedOn: input.joinedOn,
        isActive: true,
        createdById: userId,
        updatedById: userId,
      },
      em,
    );

    /**
     * Re-read inside the same transaction: `staff_no` is an identity column
     * and `code` is a STORED generated column, both marked `insert: false`, so
     * the in-memory entity returned by the insert has no code to show.
     */
    const saved = await staffRepository.findById(created.id, em);
    if (!saved) throw new NotFoundError("Staff");

    logger.info({ staffId: saved.id, code: saved.code, userId }, "staff created");
    return toStaffDto(saved);
  }, userId);
}

/**
 * Update.
 *
 * TRANSACTIONAL and row-locked: the read, the uniqueness check, the
 * deactivation guard and the write are one unit. Without the lock, two edits
 * can both read "active with nothing outstanding" and one silently wins.
 */
export async function updateStaff(
  userId: string,
  id: string,
  input: UpdateStaffInput,
): Promise<StaffDto> {
  return withTx(async (em) => {
    const staff = await staffRepository.findByIdForUpdate(id, em);
    if (!staff) throw new NotFoundError("Staff");

    if (input.phone !== undefined && input.phone !== staff.phone) {
      const existing = await staffRepository.findByPhone(input.phone, em);
      // Excludes this record, so re-saving an unchanged number never errors.
      if (existing && existing.id !== staff.id) throw phoneConflict(existing);
    }

    // Checked BEFORE anything is written, so an impossible state is never
    // shown as accepted. §6.6
    if (staff.isActive && input.isActive === false) {
      await assertDeactivatable(staff, em);
    }

    // PATCH is partial: apply only what was sent. `undefined` means "leave
    // alone", which is distinct from `null` meaning "clear this field" — so
    // the nullable columns are checked against undefined, not falsiness.
    if (input.name !== undefined) staff.name = input.name;
    if (input.phone !== undefined) staff.phone = input.phone;
    if (input.altPhone !== undefined) staff.altPhone = input.altPhone;
    if (input.address !== undefined) staff.address = input.address;
    if (input.note !== undefined) staff.note = input.note;
    if (input.joinedOn !== undefined) staff.joinedOn = input.joinedOn;
    if (input.isActive !== undefined) staff.isActive = input.isActive;
    staff.updatedById = userId;

    const saved = await staffRepository.save(staff, em);
    logger.info({ staffId: saved.id, userId }, "staff updated");
    return toStaffDto(saved);
  }, userId);
}

/**
 * Deactivate — never delete.
 *
 * Historical orders keep pointing at the record and still render. Hard
 * deletion is impossible at the database level anyway: every reference is a
 * RESTRICT constraint. See MODULES/01-staff.md §6
 */
export async function deactivateStaff(
  userId: string,
  id: string,
): Promise<StaffDto> {
  return withTx(async (em) => {
    const staff = await staffRepository.findByIdForUpdate(id, em);
    if (!staff) throw new NotFoundError("Staff");

    // Idempotent: deactivating an inactive person is a no-op, not an error.
    // The owner's intent is already satisfied.
    if (!staff.isActive) return toStaffDto(staff);

    await assertDeactivatable(staff, em);

    staff.isActive = false;
    staff.updatedById = userId;

    const saved = await staffRepository.save(staff, em);
    logger.info({ staffId: saved.id, userId }, "staff deactivated");
    return toStaffDto(saved);
  }, userId);
}

export async function reactivateStaff(
  userId: string,
  id: string,
): Promise<StaffDto> {
  return withTx(async (em) => {
    const staff = await staffRepository.findByIdForUpdate(id, em);
    if (!staff) throw new NotFoundError("Staff");

    if (staff.isActive) return toStaffDto(staff);

    /**
     * The phone frees up when someone leaves, so it may have been given to
     * somebody else in the meantime. Reactivating must not create two live
     * rows with the same number — the partial unique index would refuse the
     * write anyway, and this turns that into a readable message.
     */
    const holder = await staffRepository.findByPhone(staff.phone, em);
    if (holder && holder.id !== staff.id) throw phoneConflict(holder);

    staff.isActive = true;
    staff.updatedById = userId;

    const saved = await staffRepository.save(staff, em);
    logger.info({ staffId: saved.id, userId }, "staff reactivated");
    return toStaffDto(saved);
  }, userId);
}
