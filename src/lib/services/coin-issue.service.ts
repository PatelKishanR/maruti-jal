import "server-only";
// The transaction manager is the ONLY ORM type a service may name — everything
// else stays behind the repositories. See .claude/ARCHITECTURE.md §14 risk 21
import type { EntityManager } from "typeorm";
import { withTx } from "@/lib/db/data-source";
import { coinIssueRepository } from "@/lib/repositories/coin-issue.repository";
import { coinIssueItemRepository } from "@/lib/repositories/coin-issue-item.repository";
import { coinIssueReturnEventRepository } from "@/lib/repositories/coin-issue-return-event.repository";
import { coinLedgerEntryRepository } from "@/lib/repositories/coin-ledger-entry.repository";
import { coinTypeRepository } from "@/lib/repositories/coin-type.repository";
import { paymentRepository } from "@/lib/repositories/payment.repository";
import { staffRepository } from "@/lib/repositories/staff.repository";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { todayIST } from "@/lib/dates";
import { parseListQuery } from "@/lib/table/parse";
import {
  coinIssueTableConfig,
  isCoinIssueSortKey,
  COIN_ISSUE_FILTERS,
  type CoinIssueStatusFilter,
} from "@/lib/table/configs/coin-issue";
import type { CoinIssue, CoinIssueItem, CoinType } from "@/lib/db/entities";
import type {
  CoinIssueStatus,
  LedgerMovementType,
  LedgerSourceType,
  PaymentStatus,
} from "@/lib/db/entities/enums";
import type { CoinBalanceDriftDto } from "@/lib/dto/coin-drift.dto";
import {
  toCoinIssueDetailDto,
  toCoinIssueLineDto,
  toCoinIssueListItemDto,
  toCoinPaymentDto,
  toCoinReturnEventDto,
  type CoinIssueDetailDto,
  type CoinIssueLineDto,
  type CoinIssueListResponseDto,
  type CoinIssueOptionDto,
  type CoinIssueStaffSummaryDto,
} from "@/lib/dto/coin-issue.dto";
import {
  ROUNDING_STUB_LIMIT,
  type CancelCoinIssueInput,
  type CoinIssueListQuery,
  type CoinIssueOptionsQuery,
  type CreateCoinIssueInput,
  type RecordCoinPaymentInput,
  type RecordCoinReturnInput,
  type SettleCoinIssueDifferenceInput,
} from "@/lib/validation/coin-issue";

/**
 * Coin issue business rules.
 *
 * This layer never touches the database — every read and write goes through a
 * repository — and it owns every transaction boundary. Entities never leave;
 * DTOs do. See .claude/ARCHITECTURE.md §4
 *
 * ── The three rules that govern this file ────────────────────────────────
 *
 * 1. **The DATABASE owns the ledger.** `fn_coin_ledger_assign_seq` assigns
 *    `entry_seq` and `balance_after_coins` under the coin type's row lock and
 *    REFUSES to let stock go negative. Every insert below therefore passes
 *    PLACEHOLDER values for both and lets the trigger overwrite them.
 *    Computing them here would be a second source of truth, and under two
 *    concurrent issues it would be the wrong one.
 *
 * 2. **Every ledger row carries exactly ONE source foreign key** matching its
 *    `source_type`. `chk_ledger_arc` and `chk_ledger_source_matches` enforce
 *    it, so `writeLedgerEntry` takes the pair together and nothing else can.
 *
 * 3. **Coin types are locked in ASCENDING ID ORDER.** A three-type issue takes
 *    three row locks, and two transactions taking them in different orders
 *    deadlock intermittently — a failure that will not reproduce on demand.
 *    `findByIdsForUpdate` orders the SELECT; the ledger inserts that follow are
 *    ordered to match. See .claude/ARCHITECTURE.md §4.3
 *
 * Nothing here sums money. Every rollup on `coin_issues` is trigger-maintained
 * or generated, and the KPI strip is aggregated in SQL by the repository.
 */

/* ═══════════════════════════════════════════════════════════════════════
   Errors
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * The one error this module exists to produce cleanly.
 *
 * The database refuses the write either way — the trigger raises under the row
 * lock, and `chk_ledger_balance_non_negative` is the backstop. What matters is
 * that the owner reads a sentence he can act on rather than a Postgres
 * exception, and that the sentence names the figure to change:
 *
 *   Only 240 Blue Tokens are in stock. Reduce the quantity or add stock first.
 *
 * The meta carries the packet breakdown too, because the form's inline message
 * is "(5 packets + 15)" and the owner counts in packets.
 *
 * `InsufficientStockError` from lib/errors is deliberately NOT used: its meta
 * is `{ item, available, requested }`, which cannot render either the packet
 * breakdown or the per-line "reduce to N packets" instruction. Reported as a
 * kernel gap rather than silently degrading the copy.
 */
function insufficientStockError(
  coinType: Pick<CoinType, "id" | "name" | "balanceCoins" | "coinsPerPacket">,
  requestedCoins: number,
): ConflictError {
  const available = coinType.balanceCoins;

  return new ConflictError(
    `Only ${available} ${coinType.name} are in stock (requested ${requestedCoins})`,
    "coins.issues.errors.insufficientStock",
    {
      coinTypeId: coinType.id,
      coinTypeName: coinType.name,
      availableCoins: available,
      availablePackets: Math.floor(available / coinType.coinsPerPacket),
      availableLooseCoins: available % coinType.coinsPerPacket,
      requestedCoins,
      /** The largest whole packet count that would fit. */
      maxPackets: Math.floor(available / coinType.coinsPerPacket),
    },
  );
}

/**
 * `Coin stock for "Blue Token" would go negative: balance 240, movement -270 …`
 *
 * The trigger raises with `ERRCODE = 'check_violation'`; the table constraint
 * raises 23514 too. Both are caught here and re-thrown as the same clean 409 —
 * a raw driver error reaching the browser would be both unreadable and a leak.
 *
 * This is the LAST line of defence, not the first: `createCoinIssue` checks the
 * balance it just locked and throws the same error before touching the ledger.
 * The trigger still wins the race that the check cannot see, which is the whole
 * reason the check is not trusted alone. See .claude/DATA-MODEL.md §10.2
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
    // The trigger fired but its text did not parse, so we have no coin-type
    // name or figures. Throwing the placeholder-bearing key with empty meta
    // renders a MISSING_FORMAT_VALUE error instead of a sentence — this
    // fallback key carries no placeholders precisely because this path has
    // nothing to fill them with.
    return new ConflictError(
      "Coin stock would go negative",
      "coins.issues.errors.stockChangedUnknown",
    );
  }

  const [, coinTypeName, balance, movement] = matched;
  return new ConflictError(
    `Coin stock for "${coinTypeName}" would go negative`,
    "coins.issues.errors.stockChanged",
    {
      coinTypeName,
      availableCoins: Number(balance),
      requestedCoins: Math.abs(Number(movement)),
    },
  );
}

/** Wrap any ledger-writing transaction so the trigger's RAISE lands as a 409. */
async function withStockErrorMapping<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const mapped = asStockConflict(error);
    if (mapped) throw mapped;
    throw error;
  }
}

function assertNotFuture(date: string, messageKey: string): void {
  const today = todayIST();
  if (date > today) {
    throw new ConflictError(`Date ${date} is in the future`, messageKey, {
      date,
      today,
    });
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   Ledger
   ═══════════════════════════════════════════════════════════════════════ */

/** Row-level amounts are rounded and stored at two decimals. §8.2 */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

interface LedgerSource {
  sourceType: LedgerSourceType;
  coinIssueItemId?: string;
  coinIssueReturnEventId?: string;
  paymentId?: string;
  coinAdjustmentId?: string;
}

/**
 * Append one row to the spine.
 *
 * `entrySeq` and `balanceAfterCoins` go in as ZERO on purpose. The BEFORE
 * INSERT trigger takes the coin type's row lock, reads the ledger's own latest
 * balance, and overwrites both. Anything this function computed would be a
 * guess made outside the lock. See db/migrations/…-Rollups.ts §D
 */
async function writeLedgerEntry(
  em: EntityManager,
  entry: LedgerSource & {
    coinTypeId: string;
    entryDate: string;
    movementType: LedgerMovementType;
    /** SIGNED and never zero. Negative means coins left company stock. */
    coinsDelta: number;
    unitValue: number;
    /** Signed to match `coinsDelta`. */
    valueDelta: number;
    staffId: string | null;
    note: string | null;
    userId: string;
  },
): Promise<void> {
  const { userId, ...row } = entry;

  await coinLedgerEntryRepository.create(
    {
      ...row,
      occurredAt: new Date(),
      // Placeholders. `fn_coin_ledger_assign_seq` replaces both under the coin
      // type's row lock; writing anything meaningful here would be a lie the
      // moment two people issue at once.
      entrySeq: 0,
      balanceAfterCoins: 0,
      createdById: userId,
    },
    em,
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Reads
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * The register's status vocabulary → the columns that answer it.
 *
 * `payment_status` is trigger-maintained from `outstanding_amount`, so each of
 * these is an indexed equality rather than an expression over three columns.
 * The four money states all exclude cancelled issues: a cancelled handover is
 * not "pending", whatever its last payment status happened to be.
 */
const REGISTER_FILTER: Record<
  CoinIssueStatusFilter,
  { status?: CoinIssueStatus[]; paymentStatus?: PaymentStatus[] }
> = {
  pending: { status: ["OPEN", "SETTLED"], paymentStatus: ["UNPAID"] },
  partial: { status: ["OPEN", "SETTLED"], paymentStatus: ["PARTIAL"] },
  settled: { status: ["OPEN", "SETTLED"], paymentStatus: ["PAID"] },
  // OVERPAID and REFUND_DUE are the same instruction to the owner: give money
  // back. Splitting them into two chips would be a distinction he cannot act on.
  refund_due: {
    status: ["OPEN", "SETTLED"],
    paymentStatus: ["REFUND_DUE", "OVERPAID"],
  },
  cancelled: { status: ["CANCELLED"] },
};

function searchParamsFrom(rawQuery: CoinIssueListQuery) {
  // Everything hostile is neutralised here: the sort key is only ever a lookup
  // into the TableConfig allowlist. See .claude/ARCHITECTURE.md §6.2
  const query = parseListQuery(
    {
      page: rawQuery.page,
      pageSize: rawQuery.pageSize,
      q: rawQuery.q,
      sort: rawQuery.sort,
      dir: rawQuery.dir,
      [COIN_ISSUE_FILTERS.status]: rawQuery.status,
      [COIN_ISSUE_FILTERS.staffId]: rawQuery.staffId,
      [COIN_ISSUE_FILTERS.coinTypeId]: rawQuery.coinTypeId,
      [COIN_ISSUE_FILTERS.from]: rawQuery.from,
      [COIN_ISSUE_FILTERS.to]: rawQuery.to,
    },
    coinIssueTableConfig,
  );

  const statusFilter = query.filters[COIN_ISSUE_FILTERS.status] as
    | CoinIssueStatusFilter
    | undefined;

  return {
    query,
    params: {
      search: query.q || undefined,
      staffId: query.filters[COIN_ISSUE_FILTERS.staffId] as string | undefined,
      coinTypeId: query.filters[COIN_ISSUE_FILTERS.coinTypeId] as
        | string
        | undefined,
      dateFrom: query.filters[COIN_ISSUE_FILTERS.from] as string | undefined,
      dateTo: query.filters[COIN_ISSUE_FILTERS.to] as string | undefined,
      ...(statusFilter ? REGISTER_FILTER[statusFilter] : {}),
    },
  };
}

/**
 * The register, its KPI strip and the drift banner in ONE payload.
 *
 * Three round trips would land a beat apart and read as the page still
 * loading; worse, the strip would briefly disagree with the table under it.
 */
export async function listCoinIssues(
  rawQuery: CoinIssueListQuery,
): Promise<CoinIssueListResponseDto> {
  const { query, params } = searchParamsFrom(rawQuery);

  const [{ rows, total }, totals, drift] = await Promise.all([
    coinIssueRepository.searchPaginated({
      ...params,
      page: query.page,
      pageSize: query.pageSize,
      sortBy: isCoinIssueSortKey(query.sort.key) ? query.sort.key : "issueDate",
      sortDir: query.sort.dir === "asc" ? "ASC" : "DESC",
    }),
    coinIssueRepository.summary(params),
    listCoinBalanceDrift(),
  ]);

  const lines = await linesByIssue(rows.map((issue) => issue.id));

  return {
    rows: rows.map((issue) =>
      toCoinIssueListItemDto(issue, lines.get(issue.id) ?? []),
    ),
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
    summary: {
      openIssues: totals.openIssues,
      totalIssues: totals.totalIssues,
      coinsOutWithStaff: totals.coinsOutWithStaff,
      staffWithCoins: totals.staffWithCoins,
      pendingAmount: totals.pendingAmount,
      refundsDueAmount: totals.refundsDueAmount,
      staffWithRefunds: totals.staffWithRefunds,
    },
    drift,
  };
}

/**
 * §13. Expected to return an empty array forever.
 *
 * A single row means the cached balance and the ledger disagree, which is a
 * Sev-1 — hence a banner that cannot be dismissed. Read on every register load
 * because the owner must know BEFORE he acts on any figure on the screen.
 */
export async function listCoinBalanceDrift(): Promise<CoinBalanceDriftDto[]> {
  const rows = await coinTypeRepository.findBalanceDrift();

  return rows.map((row) => ({
    coinTypeId: row.coinTypeId,
    coinTypeName: row.coinTypeName,
    storedCoins: row.balanceCoins,
    ledgerCoins: row.ledgerSum,
    latestBalanceAfter: row.latestBalanceAfter,
    entryCount: row.entryCount,
    // Always positive — the direction is not the point, the disagreement is.
    differenceCoins: Math.abs(row.balanceCoins - row.ledgerSum),
  }));
}

/** The per-coin-type breakdown for a whole page, keyed by issue. */
async function linesByIssue(
  issueIds: string[],
  em?: EntityManager,
): Promise<Map<string, CoinIssueLineDto[]>> {
  const out = new Map<string, CoinIssueLineDto[]>();
  if (issueIds.length === 0) return out;

  const items = await coinIssueItemRepository.findByIssueIds(issueIds, em);
  const returned = await coinIssueReturnEventRepository.sumByItemIds(
    items.map((item) => item.id),
    em,
  );

  for (const item of items) {
    const line = toCoinIssueLineDto(item, returned.get(item.id));
    const existing = out.get(item.coinIssueId);
    if (existing) existing.push(line);
    else out.set(item.coinIssueId, [line]);
  }

  return out;
}

async function loadDetail(
  id: string,
  em?: EntityManager,
): Promise<CoinIssueDetailDto> {
  const issue = await coinIssueRepository.findByIdWithItems(id, em);
  if (!issue) throw new NotFoundError("Coin issue", { id });

  const items = issue.items ?? [];
  const itemIds = items.map((item) => item.id);

  const [returned, events, payments] = await Promise.all([
    coinIssueReturnEventRepository.sumByItemIds(itemIds, em),
    coinIssueReturnEventRepository.findByItemIds(itemIds, em),
    paymentRepository.findByCoinIssueId(id, em),
  ]);

  const nameByItemId = new Map(
    items.map((item) => [item.id, item.coinTypeNameSnapshot]),
  );

  return toCoinIssueDetailDto(
    issue,
    items.map((item) => toCoinIssueLineDto(item, returned.get(item.id))),
    events.map((event) =>
      toCoinReturnEventDto(event, nameByItemId.get(event.coinIssueItemId) ?? ""),
    ),
    payments.map(toCoinPaymentDto),
  );
}

export function getCoinIssue(id: string): Promise<CoinIssueDetailDto> {
  return loadDetail(id);
}

/**
 * The context line under the staff picker on the create form. Design §7.3
 *
 * `outstandingAmount` is SIGNED, so the form can say either "Ramesh currently
 * owes ₹4,500.00 on 1 open issue" or, in blue, "You owe Ramesh Patel ₹500.00".
 */
export async function getCoinIssueStaffSummary(
  staffId: string,
): Promise<CoinIssueStaffSummaryDto> {
  const staff = await staffRepository.findById(staffId);
  if (!staff) throw new NotFoundError("Staff", { id: staffId });

  const totals = await coinIssueRepository.summary({
    staffId,
    status: ["OPEN", "SETTLED"],
  });

  return {
    staffId,
    openIssues: totals.openIssues,
    outstandingAmount: totals.netOutstanding,
    coinsOutstanding: totals.coinsOutWithStaff,
  };
}

/**
 * The picker later modules select an issue from — open handovers only.
 *
 * Wordless hint (`CIS-000012 · ₹4,500.00`) so one endpoint serves both
 * languages. See .claude/MODULE-RECIPE.md §5
 */
export async function listCoinIssueOptions(
  query: CoinIssueOptionsQuery,
): Promise<CoinIssueOptionDto[]> {
  const { rows } = await coinIssueRepository.searchPaginated({
    search: query.q?.trim() || undefined,
    staffId: query.staffId,
    status: ["OPEN"],
    outstandingOnly: true,
    page: 1,
    pageSize: 50,
    sortBy: "issueDate",
    sortDir: "DESC",
  });

  return rows.map((issue) => ({
    id: issue.id,
    label: issue.code,
    hint: `${issue.staff?.name ?? ""} · ${issue.issueDate}`,
  }));
}

/* ═══════════════════════════════════════════════════════════════════════
   Writes
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Hand packets to a staff member.
 *
 * TRANSACTIONAL across four tables — the header, one line per coin type, one
 * ledger row per line, and optionally the payment taken at handover. A partial
 * write would leave coins missing from stock that nobody owes, which is the one
 * thing this module exists to make impossible.
 *
 * The sequence is deliberate:
 *   1. resolve the staff member
 *   2. LOCK every coin type, ASCENDING BY ID — the deadlock defence
 *   3. check stock against the balances just locked — the readable refusal
 *   4. write header, then lines and their ledger rows in the same lock order
 *   5. write the payment, if one was taken
 *
 * Step 3 is a courtesy, not the guard. Step 4's trigger recomputes the balance
 * under the lock and refuses anyway; `withStockErrorMapping` turns that refusal
 * into the same 409 the courtesy check produces.
 */
export async function createCoinIssue(
  input: CreateCoinIssueInput,
  userId: string,
): Promise<CoinIssueDetailDto> {
  assertNotFuture(input.issueDate, "coins.issues.errors.issueDateFuture");

  return withStockErrorMapping(() =>
    withTx(async (em) => {
      // A retry after a timeout carries the same id. Return what the first
      // attempt produced rather than charging the staff member twice.
      //
      // LIMIT, stated plainly: the key is stored on the PAYMENT row, because
      // `coin_issues` has no `client_request_id` column. An issue created with
      // no payment at handover is therefore not protected against a double
      // submit. Reported as a schema gap rather than papered over with a
      // best-effort duplicate check that would refuse two genuine issues to the
      // same staff member on the same morning.
      if (input.clientRequestId) {
        const previous = await paymentRepository.findByClientRequestId(
          input.clientRequestId,
          em,
        );
        if (previous?.coinIssueId) return loadDetail(previous.coinIssueId, em);
      }

      const staff = await staffRepository.findById(input.staffId, em);
      if (!staff || staff.deletedAt) {
        throw new NotFoundError("Staff", { id: input.staffId });
      }
      if (!staff.isActive) {
        throw new ConflictError(
          `Staff "${staff.name}" is inactive`,
          "coins.issues.errors.staffInactive",
          { staffId: staff.id, staffName: staff.name },
        );
      }

      // ── 2. The lock, in ascending id order ───────────────────────────────
      // `uq_cii_issue_type` makes a repeated coin type a database error, and
      // the create schema already refines against it, so one line per type.
      const coinTypeIds = [...new Set(input.items.map((i) => i.coinTypeId))];
      const coinTypes = await coinTypeRepository.findByIdsForUpdate(
        coinTypeIds,
        em,
      );
      const byId = new Map(coinTypes.map((coinType) => [coinType.id, coinType]));

      for (const id of coinTypeIds) {
        const coinType = byId.get(id);
        if (!coinType || coinType.deletedAt) {
          throw new NotFoundError("Coin type", { id });
        }
        if (!coinType.isActive) {
          throw new ConflictError(
            `Coin type "${coinType.name}" is inactive`,
            "coins.issues.errors.coinTypeInactive",
            { coinTypeId: coinType.id, coinTypeName: coinType.name },
          );
        }
      }

      // Same order as the locks above, so the trigger's own FOR UPDATE on
      // coin_types re-takes them in an order it already holds.
      const lines = [...input.items].sort((a, b) =>
        a.coinTypeId < b.coinTypeId ? -1 : a.coinTypeId > b.coinTypeId ? 1 : 0,
      );

      // ── 3. The readable refusal ──────────────────────────────────────────
      for (const line of lines) {
        const coinType = byId.get(line.coinTypeId) as CoinType;
        const requested = line.packets * coinType.coinsPerPacket;
        if (requested > coinType.balanceCoins) {
          throw insufficientStockError(coinType, requested);
        }
      }

      // ── 4. Header, lines, ledger ─────────────────────────────────────────
      const issue = await coinIssueRepository.create(
        {
          staffId: staff.id,
          issueDate: input.issueDate,
          status: "OPEN",
          notes: input.notes,
          createdById: userId,
          updatedById: userId,
        },
        em,
      );

      for (const line of lines) {
        const coinType = byId.get(line.coinTypeId) as CoinType;

        /**
         * The two figures the ledger row needs, computed from the SAME inputs
         * PostgreSQL generates them from.
         *
         * They are NOT read back off the saved entity: TypeORM only adds
         * `isGenerated` columns to the INSERT's RETURNING clause, and a STORED
         * generated column declared with `asExpression` is not one of them —
         * `item.coinsIssued` comes back `undefined`, and `-undefined` is NaN.
         *
         * Both expressions are exact rather than approximated: packets and
         * coins-per-packet are integers, and a packet amount already carries
         * exactly two decimals, so the products need no rounding at all.
         */
        const coinsIssued = line.packets * coinType.coinsPerPacket;
        const lineAmount = round2(line.packets * coinType.packetAmount);

        const item = await coinIssueItemRepository.create(
          {
            coinIssueId: issue.id,
            coinTypeId: coinType.id,
            packets: line.packets,
            // The four snapshots. Repricing this coin type next month must not
            // rewrite what the staff member owed today. DATA-MODEL §6
            coinsPerPacketSnapshot: coinType.coinsPerPacket,
            packetAmountSnapshot: coinType.packetAmount,
            perCoinPriceSnapshot: coinType.perCoinPrice,
            coinTypeNameSnapshot: coinType.name,
          },
          em,
        );

        await writeLedgerEntry(em, {
          coinTypeId: coinType.id,
          entryDate: input.issueDate,
          movementType: "ISSUE",
          // NEGATIVE: `chk_ledger_sign` requires it for an ISSUE, and it is
          // what makes the trigger's balance check refuse an overdraw.
          coinsDelta: -coinsIssued,
          unitValue: coinType.perCoinPrice,
          // The line amount, so the ledger and the issue state the same rupees.
          valueDelta: -lineAmount,
          sourceType: "COIN_ISSUE_ITEM",
          coinIssueItemId: item.id,
          staffId: staff.id,
          note: input.notes,
          userId,
        });
      }

      // ── 5. The payment taken at handover, if any ─────────────────────────
      if (input.payment) {
        await paymentRepository.create(
          {
            contextType: "COIN_ISSUE",
            coinIssueId: issue.id,
            direction: "IN",
            mode: input.payment.mode,
            amount: input.payment.amount,
            paidOn: input.issueDate,
            referenceNo: input.payment.referenceNo,
            note: input.payment.note,
            clientRequestId: input.clientRequestId,
            createdById: userId,
          },
          em,
        );
      }

      logger.info(
        {
          coinIssueId: issue.id,
          staffId: staff.id,
          lines: lines.length,
          paidAtIssue: input.payment?.amount ?? 0,
          userId,
        },
        "coin issue created",
      );

      // Read back INSIDE the transaction: the item and payment triggers have
      // already recomputed the header's rollups by now.
      return loadDetail(issue.id, em);
    }, userId),
  );
}

/**
 * The staff member brings unsold coins back.
 *
 * Lock order is child → parent: the LINES first, in ascending id order, then
 * the issue header. The ledger trigger then takes the coin type, which is a
 * third level down and always last. Never the reverse.
 * See .claude/ARCHITECTURE.md §4.3
 *
 * The over-return guard is a table constraint
 * (`chk_cii_returned_within_issued`), so 60 coins against a 50-coin line is
 * refused by the database whatever the UI does. It is checked here first only
 * so the refusal names the line and the figure.
 */
export async function recordCoinReturn(
  issueId: string,
  input: RecordCoinReturnInput,
  userId: string,
): Promise<CoinIssueDetailDto> {
  assertNotFuture(input.returnDate, "coins.issues.errors.returnDateFuture");

  return withStockErrorMapping(() =>
    withTx(async (em) => {
      const items = await coinIssueItemRepository.findByIssueIdForUpdate(
        issueId,
        em,
      );
      const issue = await coinIssueRepository.findByIdForUpdate(issueId, em);
      assertLive(issue, issueId);

      if (input.returnDate < issue.issueDate) {
        throw new ConflictError(
          "Return date precedes the issue date",
          "coins.issues.errors.returnBeforeIssue",
          { returnDate: input.returnDate, issueDate: issue.issueDate },
        );
      }

      const byId = new Map(items.map((item) => [item.id, item]));
      const lines = input.lines.filter((line) => line.coins > 0);

      for (const line of lines) {
        const item = byId.get(line.coinIssueItemId);
        if (!item) {
          throw new NotFoundError("Coin issue line", {
            id: line.coinIssueItemId,
            coinIssueId: issueId,
          });
        }
        if (line.coins > item.coinsOutstanding) {
          throw new ConflictError(
            `Only ${item.coinsOutstanding} ${item.coinTypeNameSnapshot} are still out`,
            "coins.issues.errors.overReturn",
            {
              coinIssueItemId: item.id,
              coinTypeName: item.coinTypeNameSnapshot,
              remainingCoins: item.coinsOutstanding,
              requestedCoins: line.coins,
            },
          );
        }
      }

      // Ascending coin type id, matching the lock order every other write in
      // this module uses.
      const ordered = [...lines].sort((a, b) => {
        const left = byId.get(a.coinIssueItemId) as CoinIssueItem;
        const right = byId.get(b.coinIssueItemId) as CoinIssueItem;
        return left.coinTypeId < right.coinTypeId
          ? -1
          : left.coinTypeId > right.coinTypeId
            ? 1
            : 0;
      });

      for (const line of ordered) {
        const item = byId.get(line.coinIssueItemId) as CoinIssueItem;

        // Rounded ONCE, at write time. The trigger sums these stored values, so
        // the header can never disagree with the sum of its events — at the
        // known cost that 45 coins at ₹11.111111 credit ₹499.95. §8.2
        const valueCredited = round2(line.coins * item.perCoinPriceSnapshot);

        const event = await coinIssueReturnEventRepository.create(
          {
            coinIssueItemId: item.id,
            returnDate: input.returnDate,
            coinsReturned: line.coins,
            unitValueSnapshot: item.perCoinPriceSnapshot,
            valueCredited,
            note: input.note,
            createdById: userId,
          },
          em,
        );

        await writeLedgerEntry(em, {
          coinTypeId: item.coinTypeId,
          entryDate: input.returnDate,
          movementType: "ISSUE_RETURN",
          coinsDelta: line.coins,
          unitValue: item.perCoinPriceSnapshot,
          valueDelta: valueCredited,
          sourceType: "COIN_ISSUE_RETURN_EVENT",
          coinIssueReturnEventId: event.id,
          staffId: issue.staffId,
          note: input.note,
          userId,
        });
      }

      logger.info(
        { coinIssueId: issueId, lines: ordered.length, userId },
        "coin return recorded",
      );

      return loadDetail(issueId, em);
    }, userId),
  );
}

/**
 * Money moving in either direction against one issue.
 *
 * The DIRECTION is fixed by the caller and never toggled inside the modal:
 * mixing an inbound instalment up with an outbound refund is the single most
 * costly mistake available on this screen. Design §10.1
 *
 * An inbound OVERPAYMENT is deliberately allowed — it simply flips the issue
 * into refund due, which is a truthful state the register already renders. An
 * outbound refund larger than what is owed is not: that is money leaving the
 * business against nothing.
 */
export async function recordCoinPayment(
  issueId: string,
  input: RecordCoinPaymentInput,
  userId: string,
): Promise<CoinIssueDetailDto> {
  assertNotFuture(input.paidOn, "coins.issues.errors.paymentDateFuture");

  return withTx(async (em) => {
    if (input.clientRequestId) {
      const previous = await paymentRepository.findByClientRequestId(
        input.clientRequestId,
        em,
      );
      // The retry already landed. Returning the current state is the whole
      // point of the key — a conflict here would read as "it failed".
      if (previous) return loadDetail(issueId, em);
    }

    const issue = await coinIssueRepository.findByIdForUpdate(issueId, em);
    assertLive(issue, issueId);

    if (input.direction === "OUT") {
      const refundable =
        issue.outstandingAmount < 0 ? -issue.outstandingAmount : 0;

      if (refundable === 0) {
        throw new ConflictError(
          "Nothing to refund on this issue",
          "coins.issues.errors.nothingToRefund",
          { coinIssueId: issueId, outstandingAmount: issue.outstandingAmount },
        );
      }
      if (input.amount > refundable) {
        throw new ConflictError(
          `Refund exceeds the ${refundable} owed`,
          "coins.issues.errors.refundExceeds",
          { maxAmount: refundable, requestedAmount: input.amount },
        );
      }
    }

    await paymentRepository.create(
      {
        contextType: "COIN_ISSUE",
        coinIssueId: issueId,
        direction: input.direction,
        mode: input.mode,
        amount: input.amount,
        paidOn: input.paidOn,
        referenceNo: input.referenceNo,
        note: input.note,
        clientRequestId: input.clientRequestId,
        createdById: userId,
      },
      em,
    );

    logger.info(
      {
        coinIssueId: issueId,
        direction: input.direction,
        amount: input.amount,
        userId,
      },
      "coin issue payment recorded",
    );

    return loadDetail(issueId, em);
  }, userId);
}

/**
 * The rounding write-off. MODULES/04-coins.md §8.2
 *
 * Takes no amount: the residual is whatever the ledger says it is, and letting
 * a human type it would turn the write-off into a way to move real money. The
 * ₹1 ceiling is the other half of that control — anything larger is a genuine
 * debt and must be collected or refunded, not written off.
 *
 * Recorded as a `WRITE_OFF` payment rather than by editing a rollup: outstanding
 * reaches zero because a movement says so, which is the difference between an
 * accounting system and a spreadsheet.
 */
export async function settleCoinIssueDifference(
  issueId: string,
  input: SettleCoinIssueDifferenceInput,
  userId: string,
): Promise<CoinIssueDetailDto> {
  return withTx(async (em) => {
    const issue = await coinIssueRepository.findByIdForUpdate(issueId, em);
    assertLive(issue, issueId);

    const residual = issue.outstandingAmount;

    if (residual === 0) {
      throw new ConflictError(
        "Nothing outstanding on this issue",
        "coins.issues.errors.nothingToSettle",
        { coinIssueId: issueId },
      );
    }
    if (Math.abs(residual) >= ROUNDING_STUB_LIMIT) {
      throw new ConflictError(
        `${residual} is too large to write off`,
        "coins.issues.errors.tooLargeToWriteOff",
        { outstandingAmount: residual, limit: ROUNDING_STUB_LIMIT },
      );
    }

    await paymentRepository.create(
      {
        contextType: "COIN_ISSUE",
        coinIssueId: issueId,
        // He owes five paise → write it off as a receipt. We owe him five
        // paise → as a refund. Either way the sign lives in the direction.
        direction: residual > 0 ? "IN" : "OUT",
        mode: "WRITE_OFF",
        amount: Math.abs(residual),
        paidOn: todayIST(),
        referenceNo: null,
        note: input.note,
        clientRequestId: null,
        createdById: userId,
      },
      em,
    );

    logger.info(
      { coinIssueId: issueId, writtenOff: residual, userId },
      "coin issue difference settled",
    );

    return loadDetail(issueId, em);
  }, userId);
}

/**
 * Cancel a handover. The coins go back into stock; the money does not move.
 *
 * One `ISSUE_CANCELLED` ledger row per line that still has coins out — the only
 * movement type whose source is a coin issue item and whose sign is positive.
 *
 * What is deliberately NOT done: the payments are left exactly as they are.
 * "The ₹4,000.00 he already paid is not touched — record a refund separately"
 * (design §6.4). Rewriting history to make a cancelled issue balance would
 * destroy the record of money that genuinely changed hands.
 */
export async function cancelCoinIssue(
  issueId: string,
  input: CancelCoinIssueInput,
  userId: string,
): Promise<CoinIssueDetailDto> {
  return withStockErrorMapping(() =>
    withTx(async (em) => {
      const items = await coinIssueItemRepository.findByIssueIdForUpdate(
        issueId,
        em,
      );
      const issue = await coinIssueRepository.findByIdForUpdate(issueId, em);
      if (!issue || issue.deletedAt) {
        throw new NotFoundError("Coin issue", { id: issueId });
      }

      // Idempotent: a double-click must not write a second set of ledger rows
      // and put the coins back twice.
      if (issue.status === "CANCELLED") return loadDetail(issueId, em);

      const returning = items
        .filter((item) => item.coinsOutstanding > 0)
        .sort((a, b) =>
          a.coinTypeId < b.coinTypeId ? -1 : a.coinTypeId > b.coinTypeId ? 1 : 0,
        );

      for (const item of returning) {
        await writeLedgerEntry(em, {
          coinTypeId: item.coinTypeId,
          entryDate: todayIST(),
          movementType: "ISSUE_CANCELLED",
          coinsDelta: item.coinsOutstanding,
          unitValue: item.perCoinPriceSnapshot,
          valueDelta: round2(
            item.coinsOutstanding * item.perCoinPriceSnapshot,
          ),
          sourceType: "COIN_ISSUE_ITEM",
          coinIssueItemId: item.id,
          staffId: issue.staffId,
          note: input.reason,
          userId,
        });
      }

      issue.status = "CANCELLED";
      issue.notes = input.reason
        ? [issue.notes, input.reason].filter(Boolean).join("\n")
        : issue.notes;
      issue.updatedById = userId;
      await coinIssueRepository.save(issue, em);

      logger.info(
        {
          coinIssueId: issueId,
          coinsReturnedToStock: returning.reduce(
            (total, item) => total + item.coinsOutstanding,
            0,
          ),
          userId,
        },
        "coin issue cancelled",
      );

      return loadDetail(issueId, em);
    }, userId),
  );
}

/**
 * Exists, is not soft-deleted, and is not cancelled.
 *
 * A cancelled issue accepts no further movement of any kind — its coins are
 * already back in stock, and a return against it would create them twice.
 */
function assertLive(
  issue: CoinIssue | null,
  id: string,
): asserts issue is CoinIssue {
  if (!issue || issue.deletedAt) throw new NotFoundError("Coin issue", { id });
  if (issue.status === "CANCELLED") {
    throw new ConflictError(
      `Coin issue ${issue.code} is cancelled`,
      "coins.issues.errors.cancelledNoChanges",
      { coinIssueId: id, code: issue.code },
    );
  }
}
