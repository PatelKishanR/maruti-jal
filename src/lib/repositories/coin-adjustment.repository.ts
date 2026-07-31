import "server-only";
import type { EntityManager, EntityTarget } from "typeorm";
import { BaseRepository } from "./base.repository";
import { CoinAdjustment } from "@/lib/db/entities";
import type {
  AdjustmentReason,
  PaymentDirection,
} from "@/lib/db/entities/enums";

/**
 * Public sort key → hard-coded SQL column. User input is a lookup key only,
 * never interpolated. See .claude/ARCHITECTURE.md §6.2
 */
const SORTABLE = {
  adjustmentDate: "ca.adjustmentDate",
  coins: "ca.coins",
  reason: "ca.reason",
  createdAt: "ca.createdAt",
} as const;

export type CoinAdjustmentSortKey = keyof typeof SORTABLE;

export interface CoinAdjustmentSearchParams {
  /** Free text over the mandatory note. */
  search?: string;
  coinTypeId?: string;
  direction?: PaymentDirection;
  reason?: AdjustmentReason[];
  /** Inclusive, 'YYYY-MM-DD'. */
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: CoinAdjustmentSortKey;
  sortDir?: "ASC" | "DESC";
}

/**
 * Every query that touches `coin_adjustments` lives here and nowhere else.
 *
 * The table has no `deleted_at` column, so the inherited `softDeleteById` and
 * `restoreById` are inapplicable — a wrong adjustment is corrected by recording
 * an opposing one, which is also what the ledger will show.
 * See .claude/DATA-MODEL.md §5.13
 */
class CoinAdjustmentRepository extends BaseRepository<CoinAdjustment> {
  protected readonly target: EntityTarget<CoinAdjustment> = CoinAdjustment;
  protected readonly alias = "ca";

  /** Adjustment history for one coin type, newest first. */
  async findByCoinType(
    coinTypeId: string,
    em?: EntityManager,
  ): Promise<CoinAdjustment[]> {
    const qb = await this.qb(em);
    return qb
      .where("ca.coinTypeId = :coinTypeId", { coinTypeId })
      .orderBy("ca.adjustmentDate", "DESC")
      .addOrderBy("ca.createdAt", "DESC")
      .getMany();
  }

  async searchPaginated(
    params: CoinAdjustmentSearchParams = {},
    em?: EntityManager,
  ): Promise<{ rows: CoinAdjustment[]; total: number }> {
    const {
      search,
      coinTypeId,
      direction,
      reason,
      dateFrom,
      dateTo,
      page = 1,
      pageSize = 25,
      sortBy = "adjustmentDate",
      sortDir = "DESC",
    } = params;

    const qb = await this.qb(em);
    // Joined for display and filtering only — coin type CRUD stays in
    // CoinTypeRepository.
    qb.leftJoinAndSelect("ca.coinType", "ct");

    if (search?.trim()) {
      qb.andWhere("ca.note ILIKE :search", { search: `%${search.trim()}%` });
    }
    if (coinTypeId) qb.andWhere("ca.coinTypeId = :coinTypeId", { coinTypeId });
    if (direction) qb.andWhere("ca.direction = :direction", { direction });
    if (reason?.length) qb.andWhere("ca.reason IN (:...reason)", { reason });
    if (dateFrom) qb.andWhere("ca.adjustmentDate >= :dateFrom", { dateFrom });
    if (dateTo) qb.andWhere("ca.adjustmentDate <= :dateTo", { dateTo });

    const [rows, total] = await qb
      .orderBy(SORTABLE[sortBy] ?? SORTABLE.adjustmentDate, sortDir)
      // Stable tiebreaker — same-day adjustments must not shuffle between pages.
      .addOrderBy("ca.id", "ASC")
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { rows, total };
  }
}

export const coinAdjustmentRepository = new CoinAdjustmentRepository();
