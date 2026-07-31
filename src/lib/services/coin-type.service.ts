import "server-only";
// The transaction manager is the ONLY ORM type a service may name — everything
// else stays behind the repositories. See .claude/ARCHITECTURE.md §14 risk 21
import type { EntityManager } from "typeorm";
import { withTx } from "@/lib/db/data-source";
import { coinTypeRepository } from "@/lib/repositories/coin-type.repository";
import { coinLedgerEntryRepository } from "@/lib/repositories/coin-ledger-entry.repository";
import { coinAdjustmentRepository } from "@/lib/repositories/coin-adjustment.repository";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { todayIST } from "@/lib/dates";
import { parseListQuery } from "@/lib/table/parse";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/table/types";
import type { ListResult } from "@/lib/table/types";
import {
  coinTypeTableConfig,
  isCoinTypeSortKey,
} from "@/lib/table/configs/coin-type";
import type { CoinType } from "@/lib/db/entities";
import {
  packetBreakdown,
  toCoinTypeDetailDto,
  toCoinTypeDto,
  toCoinTypeListItemDto,
  toLedgerEntryDto,
  type CoinTypeDetailDto,
  type CoinTypeDto,
  type CoinTypeListResponseDto,
  type CoinTypeOptionDto,
  type DeactivateBlocker,
  type LedgerEntryDto,
} from "@/lib/dto/coin-type.dto";
import type {
  CoinLedgerQuery,
  CoinTypeListQuery,
  CreateCoinTypeInput,
  UpdateCoinTypeInput,
} from "@/lib/validation/coin-type";

/**
 * Coin type business rules.
 *
 * This layer never touches the database — every read and write goes through a
 * repository — and it owns every transaction boundary. Entities never leave;
 * DTOs do. See .claude/ARCHITECTURE.md §4
 *
 * ── The one rule that governs this file ─────────────────────────────────────
 *
 * `coin_types.balance_coins` is a CACHE maintained by a trigger on every
 * `coin_ledger_entries` insert, and `per_coin_price` is a GENERATED column.
 * Neither is ever written here. Stock changes only by appending to the ledger,
 * which is why "opening stock" is an OPENING row rather than a column.
 * See .claude/DATA-MODEL.md §5.9, §8.2, §8.3
 */

/**
 * The note stamped on the adjustment that carries a coin type's opening stock.
 *
 * `coin_adjustments.note` is NOT NULL with a non-empty constraint — a stock
 * adjustment with no explanation is how theft hides — and the create form
 * deliberately does not ask for one, because "this is the opening balance" is
 * the only true answer. See MODULES/04-coins.md §7.2
 */
const OPENING_STOCK_NOTE = "Opening stock recorded when the coin type was created";

/* ── Errors ─────────────────────────────────────────────────────────────── */

/**
 * The database enforces uniqueness of `lower(name)` among non-deleted rows via
 * a functional partial index, which no TypeORM decorator can express. We check
 * first for a clean field error, and translate the index violation too: the
 * check and the insert are not serialisable against each other, so a genuine
 * race still has to surface as a field error rather than a 500.
 */
function nameTakenError(name: string): ConflictError {
  return new ConflictError(
    `Coin type "${name}" already exists`,
    "coins.types.errors.nameTaken",
    { name },
  );
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { code?: string; driverError?: { code?: string } };
  return e.code === "23505" || e.driverError?.code === "23505";
}

/**
 * Itemised reasons a coin type may not be deactivated.
 *
 * Returned rather than thrown so the detail page can grey the menu item and
 * explain why BEFORE the owner clicks, and the same list is thrown as `meta`
 * when he clicks anyway. See design MODULES/04-coins §3.4
 */
function deactivateBlockers(
  coinType: CoinType,
  coinsOutWithStaff: number,
): DeactivateBlocker[] {
  const blockers: DeactivateBlocker[] = [];

  if (coinType.balanceCoins !== 0) {
    blockers.push({
      key: "coins.types.deactivate.blockedBalance",
      coins: coinType.balanceCoins,
    });
  }

  if (coinsOutWithStaff > 0) {
    blockers.push({
      key: "coins.types.deactivate.blockedOutWithStaff",
      coins: coinsOutWithStaff,
    });
  }

  return blockers;
}

/**
 * Coins issued to staff and not yet returned or redeemed.
 *
 * TODO(wave-3): aggregate `coin_issues` / `coin_issue_items` less returns.
 * Zero until coin issues ship — there is no table to aggregate yet, and
 * inventing a figure would be worse than showing none.
 */
function coinsOutWithStaff(_coinTypeId: string): number {
  return 0;
}

/* ── Reads ──────────────────────────────────────────────────────────────── */

/** The list page, plus its KPI strip, in one payload. */
export async function listCoinTypes(
  rawQuery: CoinTypeListQuery,
): Promise<CoinTypeListResponseDto> {
  // Everything hostile is neutralised here: the sort key is only ever a lookup
  // into the TableConfig allowlist. See .claude/ARCHITECTURE.md §6.2
  const query = parseListQuery(
    {
      page: rawQuery.page,
      pageSize: rawQuery.pageSize,
      q: rawQuery.q,
      sort: rawQuery.sort,
      dir: rawQuery.dir,
      status: rawQuery.status,
    },
    coinTypeTableConfig,
  );
  const status = query.filters.status;

  const [{ rows, total }, totals] = await Promise.all([
    coinTypeRepository.searchPaginated({
      search: query.q || undefined,
      isActive:
        status === "active" ? true : status === "inactive" ? false : undefined,
      page: query.page,
      pageSize: query.pageSize,
      sortBy: isCoinTypeSortKey(query.sort.key) ? query.sort.key : "name",
      sortDir: query.sort.dir === "asc" ? "ASC" : "DESC",
    }),
    coinTypeRepository.summary(),
  ]);

  return {
    rows: rows.map(toCoinTypeListItemDto),
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
    summary: {
      total: totals.total,
      active: totals.active,
      inactive: totals.total - totals.active,
      coinsInStock: totals.coinsInStock,
      valueInStock: totals.valueInStock,
      packetsInStock: totals.packetsInStock,
      looseCoinsInStock: totals.looseCoinsInStock,
      // TODO(wave-3): both come from `coin_issues`.
      coinsOutWithStaff: 0,
      valueOutWithStaff: 0,
    },
  };
}

export async function getCoinType(id: string): Promise<CoinTypeDetailDto> {
  const coinType = await coinTypeRepository.findById(id);
  if (!coinType) throw new NotFoundError("Coin type", { id });

  const totals = await coinLedgerEntryRepository.sumMovements(id);
  const out = coinsOutWithStaff(id);

  return toCoinTypeDetailDto(
    coinType,
    totals,
    out,
    deactivateBlockers(coinType, out),
  );
}

/**
 * The picker feeding coin issues and coin payments.
 *
 * Active types only — you cannot issue a token you have retired — and the hint
 * carries the two figures that tell two similarly-named tokens apart: what a
 * coin is worth and how many are in a packet. It is deliberately wordless, so
 * one endpoint serves both languages.
 */
export async function listCoinTypeOptions(
  search?: string,
): Promise<CoinTypeOptionDto[]> {
  const { rows } = await coinTypeRepository.searchPaginated({
    search: search?.trim() || undefined,
    isActive: true,
    page: 1,
    pageSize: 100,
    sortBy: "name",
    sortDir: "ASC",
  });

  return rows.map((row) => ({
    id: row.id,
    label: row.name,
    hint: `₹${sixDecimalRate(row.perCoinPrice)} × ${row.coinsPerPacket}`,
  }));
}

/**
 * `10.00` / `11.111111` — trailing zeros trimmed back to a minimum of two.
 *
 * Six decimals, not two: a picker that shows ₹11.11 for a ₹11.111111 coin is
 * quietly wrong, and this is the figure someone will check a total against.
 * Plain digits with no grouping — a per-coin rate never reaches a lakh, and the
 * hint has to read identically in both languages.
 */
function sixDecimalRate(value: number): string {
  const [whole, fraction = "000000"] = value.toFixed(6).split(".");
  return `${whole}.${fraction.replace(/0+$/, "").padEnd(2, "0")}`;
}

/**
 * The register itself. Ordered by `entry_seq` inside the repository, never by
 * date — the sequence is the order the running balances were computed in, so
 * `balance_after_coins` only reads correctly down the page that way.
 * There is deliberately no sort parameter. See design §5.6
 */
export async function getLedger(
  coinTypeId: string,
  query: CoinLedgerQuery,
): Promise<ListResult<LedgerEntryDto>> {
  const exists = await coinTypeRepository.findById(coinTypeId);
  if (!exists) throw new NotFoundError("Coin type", { id: coinTypeId });

  const page = clampPage(query.page);
  const pageSize = clampPageSize(query.pageSize);

  const { rows, total } = await coinLedgerEntryRepository.findByCoinTypePaginated(
    coinTypeId,
    {
      movementType: query.movement?.length ? query.movement : undefined,
      dateFrom: query.from,
      dateTo: query.to,
      page,
      pageSize,
    },
  );

  return {
    rows: rows.map(toLedgerEntryDto),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

function clampPage(raw: string | undefined): number {
  const value = Number(raw);
  return Number.isFinite(value) && value >= 1 ? Math.trunc(value) : 1;
}

function clampPageSize(raw: string | undefined): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(value)));
}

/* ── Writes ─────────────────────────────────────────────────────────────── */

/**
 * Create a coin type, and its opening stock if there is any.
 *
 * TRANSACTIONAL because it writes three tables — the coin type, the adjustment
 * that explains the opening stock, and the ledger row that actually creates the
 * coins. A partial write here would leave stock that the ledger cannot account
 * for, which is the one thing this module exists to make impossible.
 * See .claude/ARCHITECTURE.md §4.4
 */
export async function createCoinType(
  input: CreateCoinTypeInput,
  userId: string,
): Promise<CoinTypeDto> {
  return withTx(async (em) => {
    if (await coinTypeRepository.isNameTaken(input.name, undefined, em)) {
      throw nameTakenError(input.name);
    }

    let created: CoinType;
    try {
      created = await coinTypeRepository.create(
        {
          name: input.name,
          coinsPerPacket: input.coinsPerPacket,
          packetAmount: input.packetAmount,
          colourHex: input.colourHex,
          isActive: true,
          createdById: userId,
          updatedById: userId,
        },
        em,
      );
    } catch (error) {
      if (isUniqueViolation(error)) throw nameTakenError(input.name);
      throw error;
    }

    // `per_coin_price` is GENERATED, so its value only exists once the row is
    // in the table. Re-read rather than assume what PostgreSQL computed.
    const stored = await coinTypeRepository.findById(created.id, em);
    if (!stored) throw new NotFoundError("Coin type", { id: created.id });

    if (input.openingStock > 0) {
      await writeOpeningStock(stored, input.openingStock, userId, em);
    }

    // Re-read once more: the ledger insert fired the trigger that maintains
    // `balance_coins`, and the DTO must carry the post-trigger figure.
    const final = await coinTypeRepository.findById(created.id, em);
    if (!final) throw new NotFoundError("Coin type", { id: created.id });

    logger.info(
      { coinTypeId: final.id, openingStock: input.openingStock, userId },
      "coin type created",
    );

    return toCoinTypeDto(final);
  }, userId);
}

/**
 * The OPENING ledger row.
 *
 * Written under the coin type's row lock, which is the same lock every issue
 * and return takes: `nextEntrySeq` and `latestBalance` must be read and the
 * insert committed atomically, or two writers claim the same sequence slot and
 * the unique index rejects one of them at random.
 * See .claude/DATA-MODEL.md §10.2
 */
async function writeOpeningStock(
  coinType: CoinType,
  coins: number,
  userId: string,
  em: EntityManager,
): Promise<void> {
  const entryDate = todayIST();

  // The ledger's four foreign keys are ON DELETE RESTRICT and exactly one must
  // be populated; an OPENING movement is sourced from an adjustment, so the
  // adjustment has to exist first.
  const adjustment = await coinAdjustmentRepository.create(
    {
      coinTypeId: coinType.id,
      adjustmentDate: entryDate,
      direction: "IN",
      coins,
      reason: "OPENING_STOCK",
      note: OPENING_STOCK_NOTE,
      approvedById: userId,
      createdById: userId,
      updatedById: userId,
    },
    em,
  );

  await coinTypeRepository.findByIdForUpdate(coinType.id, em);

  const entrySeq = await coinLedgerEntryRepository.nextEntrySeq(coinType.id, em);
  const previousBalance = await coinLedgerEntryRepository.latestBalance(
    coinType.id,
    em,
  );

  await coinLedgerEntryRepository.create(
    {
      coinTypeId: coinType.id,
      entrySeq,
      entryDate,
      occurredAt: new Date(),
      movementType: "OPENING",
      coinsDelta: coins,
      balanceAfterCoins: previousBalance + coins,
      unitValue: coinType.perCoinPrice,
      // Row-level amounts are rounded and stored at two decimals even though
      // the rate is held at six — the deliberate five-paise gap of §8.2.
      valueDelta: Math.round(coins * coinType.perCoinPrice * 100) / 100,
      sourceType: "COIN_ADJUSTMENT",
      coinAdjustmentId: adjustment.id,
      staffId: null,
      note: OPENING_STOCK_NOTE,
      createdById: userId,
    },
    em,
  );
}

/**
 * Edit a coin type.
 *
 * TRANSACTIONAL and row-locked: the uniqueness check and the write must be
 * atomic, or two concurrent renames both pass the check and both commit.
 *
 * Changing the packet amount changes `per_coin_price` for FUTURE movements
 * only — every issue line snapshots the rate it was issued at, so past records
 * cannot be rewritten from here. See MODULES/04-coins.md §8
 */
export async function updateCoinType(
  id: string,
  input: UpdateCoinTypeInput,
  userId: string,
): Promise<CoinTypeDto> {
  return withTx(async (em) => {
    const coinType = await coinTypeRepository.findByIdForUpdate(id, em);
    if (!coinType) throw new NotFoundError("Coin type", { id });

    if (coinType.name.toLowerCase() !== input.name.toLowerCase()) {
      if (await coinTypeRepository.isNameTaken(input.name, id, em)) {
        throw nameTakenError(input.name);
      }
    }

    // Turning the toggle off is a deactivation, so it obeys the same guards as
    // the explicit action — otherwise the form becomes a way around them.
    if (coinType.isActive && !input.isActive) {
      assertDeactivatable(coinType);
    }

    coinType.name = input.name;
    coinType.coinsPerPacket = input.coinsPerPacket;
    coinType.packetAmount = input.packetAmount;
    coinType.colourHex = input.colourHex;
    coinType.isActive = input.isActive;
    coinType.updatedById = userId;

    try {
      await coinTypeRepository.save(coinType, em);
    } catch (error) {
      if (isUniqueViolation(error)) throw nameTakenError(input.name);
      throw error;
    }

    // `per_coin_price` is regenerated by PostgreSQL when either input changes.
    const stored = await coinTypeRepository.findById(id, em);
    if (!stored) throw new NotFoundError("Coin type", { id });

    logger.info({ coinTypeId: id, userId }, "coin type updated");
    return toCoinTypeDto(stored);
  }, userId);
}

function assertDeactivatable(coinType: CoinType): void {
  const blockers = deactivateBlockers(
    coinType,
    coinsOutWithStaff(coinType.id),
  );
  if (blockers.length === 0) return;

  const { packets, looseCoins } = packetBreakdown(
    coinType.balanceCoins,
    coinType.coinsPerPacket,
  );

  throw new ConflictError(
    `Cannot deactivate "${coinType.name}"`,
    "coins.types.errors.cannotDeactivate",
    {
      name: coinType.name,
      reasons: blockers,
      balanceCoins: coinType.balanceCoins,
      balancePackets: packets,
      balanceLooseCoins: looseCoins,
    },
  );
}

/**
 * Deactivate — never delete.
 *
 * A coin type with any ledger movement is physically undeletable (the ledger's
 * foreign keys are RESTRICT), and one with stock still in the store room or
 * coins still out with staff must not be retired either: the float would leave
 * the books while the coins stayed in the world. The blocked reasons are
 * itemised so the owner is told what to do, not just that he cannot.
 * See MODULES/04-coins.md §8
 */
export async function deactivateCoinType(
  id: string,
  userId: string,
): Promise<CoinTypeDto> {
  return withTx(async (em) => {
    const coinType = await coinTypeRepository.findByIdForUpdate(id, em);
    if (!coinType) throw new NotFoundError("Coin type", { id });

    // Idempotent: deactivating something already inactive is not an error, and
    // a double-click must not produce one.
    if (!coinType.isActive) return toCoinTypeDto(coinType);

    assertDeactivatable(coinType);

    coinType.isActive = false;
    coinType.updatedById = userId;
    await coinTypeRepository.save(coinType, em);

    logger.info({ coinTypeId: id, userId }, "coin type deactivated");
    return toCoinTypeDto(coinType);
  }, userId);
}

export async function reactivateCoinType(
  id: string,
  userId: string,
): Promise<CoinTypeDto> {
  return withTx(async (em) => {
    const coinType = await coinTypeRepository.findByIdForUpdate(id, em);
    if (!coinType) throw new NotFoundError("Coin type", { id });

    if (coinType.isActive) return toCoinTypeDto(coinType);

    coinType.isActive = true;
    coinType.updatedById = userId;
    await coinTypeRepository.save(coinType, em);

    logger.info({ coinTypeId: id, userId }, "coin type reactivated");
    return toCoinTypeDto(coinType);
  }, userId);
}
