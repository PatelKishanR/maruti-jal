import "server-only";
import { withTx } from "@/lib/db/data-source";
import { staffRepository } from "@/lib/repositories/staff.repository";
import { auditLogRepository } from "@/lib/repositories/audit-log.repository";
import { userRepository } from "@/lib/repositories/user.repository";
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
import type { Staff } from "@/lib/db/entities";
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
   Outstanding figures — TODO(wave-3)

   Cash outstanding, jars out and coin dues aggregate `delivery_orders`,
   `order_items`, `coin_issues` and their return events. Those modules are not
   built, their tables are empty, and `staff` carries no cached rollup columns
   yet (see db/migrations/…-Schema.ts — there is no cash_outstanding column).

   So this returns zeros, deliberately and in ONE place:

     · it is the single seam wave 3 replaces — a repository call per module,
       assembled here, or a read of the cached columns once they exist;
     · every consumer (badges, KPI cards, the deactivation guard) is already
       written against the final shape;
     · zero is also the TRUTHFUL answer today. Nobody can owe money against
       orders that cannot yet exist, so the "has outstanding balance" filter
       correctly returns nobody rather than lying.

   What it must NOT become: a join added to staffRepository. A repository
   queries its own table only (ARCHITECTURE §4.1 rule 4); the aggregate belongs
   to the orders and coins repositories, called from here.
   ═══════════════════════════════════════════════════════════════════════ */

const NOTHING_OUTSTANDING: StaffOutstanding = {
  cashOutstanding: 0,
  jarsOut: 0,
  coinDues: 0,
  moneyOutstanding: 0,
};

function outstandingFor(_staff: Staff): StaffOutstanding {
  return { ...NOTHING_OUTSTANDING };
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

async function getStaffStats(): Promise<StaffStatsDto> {
  const [totalStaff, activeStaff] = await Promise.all([
    staffRepository.count(),
    staffRepository.countActive(),
  ]);

  return {
    totalStaff,
    activeStaff,
    inactiveStaff: Math.max(0, totalStaff - activeStaff),
    // TODO(wave-3): sums over the cached outstanding columns.
    cashOutstanding: 0,
    jarsOut: 0,
    staffWithBalance: 0,
    staffWithJars: 0,
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

  // TODO(wave-3): becomes a predicate on the cached columns, inside the
  // repository. Today every figure is zero, so "who owes me something?" has
  // exactly one honest answer: nobody. Returning rows here would be a lie.
  if (wantsBalance || wantsJars) {
    return {
      result: {
        rows: [],
        total: 0,
        page: listQuery.page,
        pageSize: listQuery.pageSize,
        pageCount: 1,
      },
      stats,
    };
  }

  const [rows, total] = await staffRepository.searchPaginated({
    search: listQuery.q || undefined,
    isActive: status === "all" ? undefined : status === "active",
    sort: listQuery.sort.key,
    dir: listQuery.sort.dir === "asc" ? "ASC" : "DESC",
    skip: (listQuery.page - 1) * listQuery.pageSize,
    take: listQuery.pageSize,
  });

  const items: StaffListItemDto[] = rows.map((staff) =>
    toStaffListItemDto(staff, outstandingFor(staff)),
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

  const [createdByName, updatedByName] = await Promise.all([
    resolveActorName(staff.createdById),
    resolveActorName(staff.updatedById),
  ]);

  return {
    ...toStaffListItemDto(staff, outstandingFor(staff)),
    // TODO(wave-3): every figure below comes from orders, coin issues and
    // payments. Zero until those modules exist.
    jarsTotal: 0,
    lifetimeRevenue: 0,
    openOrderCount: 0,
    openIssueCount: 0,
    jarsOutOrderCount: 0,
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
function deactivationBlockers(staff: Staff): StaffBlockerDto[] {
  const outstanding = outstandingFor(staff);
  const blockers: StaffBlockerDto[] = [];

  // TODO(wave-3): counts ("3 orders", "2 issues") arrive with the aggregate.
  if (outstanding.cashOutstanding > 0) {
    blockers.push({
      kind: "cash",
      amount: outstanding.cashOutstanding,
      count: 0,
    });
  }
  if (outstanding.jarsOut > 0) {
    blockers.push({ kind: "jars", amount: outstanding.jarsOut, count: 0 });
  }
  if (outstanding.coinDues > 0) {
    blockers.push({ kind: "coins", amount: outstanding.coinDues, count: 0 });
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
function assertDeactivatable(staff: Staff): void {
  const blockers = deactivationBlockers(staff);
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
    if (staff.isActive && input.isActive === false) assertDeactivatable(staff);

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

    assertDeactivatable(staff);

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
