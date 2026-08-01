import "server-only";
// The transaction manager is the ONLY ORM type a service may name.
import type { EntityManager } from "typeorm";
import { withTx } from "@/lib/db/data-source";
import { coinAdjustmentRepository } from "@/lib/repositories/coin-adjustment.repository";
import { coinLedgerEntryRepository } from "@/lib/repositories/coin-ledger-entry.repository";
import { coinTypeRepository } from "@/lib/repositories/coin-type.repository";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { todayIST } from "@/lib/dates";
import { parseListQuery } from "@/lib/table/parse";
import {
  coinAdjustmentTableConfig,
  isCoinAdjustmentSortKey,
  COIN_ADJUSTMENT_FILTERS,
} from "@/lib/table/configs/coin-adjustment";
import type {
  AdjustmentReason,
  PaymentDirection,
} from "@/lib/db/entities/enums";
import {
  toCoinAdjustmentDto,
  type CoinAdjustmentDto,
  type CoinAdjustmentListResponseDto,
} from "@/lib/dto/coin-adjustment.dto";
import type {
  CoinAdjustmentListQuery,
  CreateCoinAdjustmentInput,
} from "@/lib/validation/coin-adjustment";

/**
 * Stock adjustment business rules.
 *
 * An adjustment is the ONE way coin stock changes without an issue, a return or
 * an order payment behind it — new coins printed, coins lost, a month-end count
 * that did not match. It is therefore the one place where a person's word is
 * the only evidence, which is why:
 *
 *  · the note is mandatory, in the schema (`chk_coin_adjustments_note_present`),
 *    in the Zod schema and in the form's copy — three layers, on purpose;
 *  · there is no edit path and no delete path. `coin_adjustments` has no
 *    `deleted_at` column at all, so "quietly make that shrinkage disappear" is
 *    impossible rather than merely discouraged;
 *  · every adjustment writes a ledger row in the same transaction, so the
 *    correction and the movement it caused can never come apart.
 *
 * See .claude/DATA-MODEL.md §5.13 and MODULES/04-coins.md §7.2
 */

/* ═══════════════════════════════════════════════════════════════════════
   Reads
   ═══════════════════════════════════════════════════════════════════════ */

export async function listCoinAdjustments(
  rawQuery: CoinAdjustmentListQuery,
): Promise<CoinAdjustmentListResponseDto> {
  // The injection defence: the sort key is only ever a lookup into the
  // TableConfig allowlist. See .claude/ARCHITECTURE.md §6.2
  const query = parseListQuery(
    {
      page: rawQuery.page,
      pageSize: rawQuery.pageSize,
      q: rawQuery.q,
      sort: rawQuery.sort,
      dir: rawQuery.dir,
      [COIN_ADJUSTMENT_FILTERS.direction]: rawQuery.direction,
      [COIN_ADJUSTMENT_FILTERS.reason]: rawQuery.reason,
      [COIN_ADJUSTMENT_FILTERS.coinTypeId]: rawQuery.coinTypeId,
      [COIN_ADJUSTMENT_FILTERS.from]: rawQuery.from,
      [COIN_ADJUSTMENT_FILTERS.to]: rawQuery.to,
    },
    coinAdjustmentTableConfig,
  );

  const reason = query.filters[COIN_ADJUSTMENT_FILTERS.reason] as
    | AdjustmentReason
    | undefined;

  const { rows, total } = await coinAdjustmentRepository.searchPaginated({
    search: query.q || undefined,
    coinTypeId: query.filters[COIN_ADJUSTMENT_FILTERS.coinTypeId] as
      | string
      | undefined,
    direction: query.filters[COIN_ADJUSTMENT_FILTERS.direction] as
      | PaymentDirection
      | undefined,
    reason: reason ? [reason] : undefined,
    dateFrom: query.filters[COIN_ADJUSTMENT_FILTERS.from] as string | undefined,
    dateTo: query.filters[COIN_ADJUSTMENT_FILTERS.to] as string | undefined,
    page: query.page,
    pageSize: query.pageSize,
    sortBy: isCoinAdjustmentSortKey(query.sort.key)
      ? query.sort.key
      : "adjustmentDate",
    sortDir: query.sort.dir === "asc" ? "ASC" : "DESC",
  });

  return {
    rows: rows.map(toCoinAdjustmentDto),
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   Writes
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Change stock by hand, with a reason on the record.
 *
 * TRANSACTIONAL across two tables — the adjustment and the ledger row it
 * causes. The ledger's foreign keys are ON DELETE RESTRICT and exactly one must
 * be populated, so the adjustment has to exist before the entry that points at
 * it; both live or neither does.
 *
 * The coin type is ROW-LOCKED first. For an `OUT` adjustment that is the same
 * negative-stock defence every issue uses: the balance is read under the lock,
 * and the ledger trigger recomputes it under the same lock before refusing.
 */
export async function createCoinAdjustment(
  input: CreateCoinAdjustmentInput,
  userId: string,
): Promise<CoinAdjustmentDto> {
  if (input.adjustmentDate > todayIST()) {
    throw new ConflictError(
      "Adjustment date is in the future",
      "coins.adjustments.errors.dateFuture",
      { date: input.adjustmentDate, today: todayIST() },
    );
  }

  try {
    return await withTx(async (em) => {
      const coinType = await coinTypeRepository.findByIdForUpdate(
        input.coinTypeId,
        em,
      );
      if (!coinType || coinType.deletedAt) {
        throw new NotFoundError("Coin type", { id: input.coinTypeId });
      }
      if (!coinType.isActive) {
        throw new ConflictError(
          `Coin type "${coinType.name}" is inactive`,
          "coins.adjustments.errors.coinTypeInactive",
          { coinTypeId: coinType.id, coinTypeName: coinType.name },
        );
      }

      // Read under the lock, so it is the same figure the trigger will use.
      // The trigger refuses anyway; this exists so the refusal is a sentence
      // the owner can act on. Design §12.4
      if (input.direction === "OUT" && input.coins > coinType.balanceCoins) {
        throw new ConflictError(
          `Only ${coinType.balanceCoins} ${coinType.name} are in stock`,
          "coins.adjustments.errors.insufficientStock",
          {
            coinTypeId: coinType.id,
            coinTypeName: coinType.name,
            availableCoins: coinType.balanceCoins,
            requestedCoins: input.coins,
          },
        );
      }

      const adjustment = await coinAdjustmentRepository.create(
        {
          coinTypeId: coinType.id,
          adjustmentDate: input.adjustmentDate,
          direction: input.direction,
          // Always positive. The sign lives in `direction`, never in the number.
          coins: input.coins,
          reason: input.reason,
          note: input.note,
          approvedById: userId,
          createdById: userId,
          updatedById: userId,
        },
        em,
      );

      await writeAdjustmentLedgerEntry(em, {
        coinTypeId: coinType.id,
        unitValue: coinType.perCoinPrice,
        entryDate: input.adjustmentDate,
        direction: input.direction,
        coins: input.coins,
        note: input.note,
        coinAdjustmentId: adjustment.id,
        userId,
      });

      logger.info(
        {
          coinAdjustmentId: adjustment.id,
          coinTypeId: coinType.id,
          direction: input.direction,
          coins: input.coins,
          reason: input.reason,
          userId,
        },
        "coin adjustment recorded",
      );

      // Re-read: the ledger insert fired the trigger that maintains
      // `balance_coins`, and the DTO's value column reads the coin type.
      const stored = await coinAdjustmentRepository.findById(adjustment.id, em);
      if (!stored) throw new NotFoundError("Coin adjustment", { id: adjustment.id });

      // `findById` does not join the coin type, and the DTO needs its name,
      // colour and rate. The entity relation is populated by hand rather than
      // with a second query.
      stored.coinType = coinType;
      return toCoinAdjustmentDto(stored);
    }, userId);
  } catch (error) {
    const mapped = asStockConflict(error);
    if (mapped) throw mapped;
    throw error;
  }
}

/**
 * The ledger row an adjustment causes.
 *
 * `entry_seq` and `balance_after_coins` go in as ZERO: the BEFORE INSERT
 * trigger assigns both under the coin type's row lock, and a value computed
 * here would be a guess made outside it.
 *
 * Exactly one source foreign key, matching `source_type` — `chk_ledger_arc` and
 * `chk_ledger_source_matches` both enforce it.
 */
async function writeAdjustmentLedgerEntry(
  em: EntityManager,
  entry: {
    coinTypeId: string;
    unitValue: number;
    entryDate: string;
    direction: PaymentDirection;
    coins: number;
    note: string;
    coinAdjustmentId: string;
    userId: string;
  },
): Promise<void> {
  // `chk_ledger_sign` checks the sign of coins_delta against movement_type:
  // ADJUSTMENT_OUT must be negative, ADJUSTMENT_IN positive.
  const outbound = entry.direction === "OUT";
  const coinsDelta = outbound ? -entry.coins : entry.coins;
  const value = Math.round(entry.coins * entry.unitValue * 100) / 100;

  await coinLedgerEntryRepository.create(
    {
      coinTypeId: entry.coinTypeId,
      entrySeq: 0,
      balanceAfterCoins: 0,
      entryDate: entry.entryDate,
      occurredAt: new Date(),
      movementType: outbound ? "ADJUSTMENT_OUT" : "ADJUSTMENT_IN",
      coinsDelta,
      unitValue: entry.unitValue,
      valueDelta: outbound ? -value : value,
      sourceType: "COIN_ADJUSTMENT",
      coinAdjustmentId: entry.coinAdjustmentId,
      // No staff member is involved in a stock correction.
      staffId: null,
      note: entry.note,
      createdById: entry.userId,
    },
    em,
  );
}

/**
 * The trigger's RAISE, turned into a clean 409.
 *
 * `fn_coin_ledger_assign_seq` raises with `ERRCODE = 'check_violation'` when the
 * running balance would go below zero, and `chk_ledger_balance_non_negative` is
 * the backstop behind it. Either one reaching the browser raw would be
 * unreadable and would leak the schema.
 */
const NEGATIVE_STOCK_MESSAGE =
  /Coin stock for "(.+?)" would go negative: balance (-?\d+), movement (-?\d+)/;

function asStockConflict(error: unknown): ConflictError | null {
  const e = error as {
    code?: string;
    message?: string;
    driverError?: { code?: string; message?: string };
  };
  const code = e?.code ?? e?.driverError?.code;
  if (code !== "23514") return null;

  const message = e?.driverError?.message ?? e?.message ?? "";
  const matched = NEGATIVE_STOCK_MESSAGE.exec(message);
  if (!matched) {
    if (!message.includes("chk_ledger_balance_non_negative")) return null;
    // No coin-type name or figures survived the parse, and the normal key
    // carries placeholders — throwing it with empty meta renders a
    // MISSING_FORMAT_VALUE error rather than a sentence.
    return new ConflictError(
      "Coin stock would go negative",
      "coins.adjustments.errors.insufficientStockUnknown",
    );
  }

  const [, coinTypeName, balance, movement] = matched;
  return new ConflictError(
    `Only ${balance} ${coinTypeName} are in stock`,
    "coins.adjustments.errors.insufficientStock",
    {
      coinTypeName,
      availableCoins: Number(balance),
      requestedCoins: Math.abs(Number(movement)),
    },
  );
}
