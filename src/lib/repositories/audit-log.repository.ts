import "server-only";
import type { EntityManager, EntityTarget } from "typeorm";
import { BaseRepository } from "./base.repository";
import { AuditLog } from "@/lib/db/entities";

/**
 * Every query that touches the `audit_logs` table lives here.
 *
 * READ-MOSTLY. Rows are written by a generic database trigger, not by this
 * repository — which is the whole point: the audit is correct even when the
 * write came from a script or the Neon console. The inherited mutators are
 * overridden to throw, matching the BEFORE UPDATE OR DELETE trigger and the
 * revoked grants on the table. See .claude/DATA-MODEL.md §5.21, §9
 */
class AuditLogRepository extends BaseRepository<AuditLog> {
  protected readonly target: EntityTarget<AuditLog> = AuditLog;
  protected readonly alias = "al";

  /**
   * The change history of one row, newest first — the "history" tab.
   *
   * `table_name` is a caller-supplied string, so it is passed as a BOUND
   * PARAMETER and never interpolated, exactly like any other user input.
   * Served by idx_audit_record (table_name, record_id, created_at DESC).
   */
  async findForRecord(
    tableName: string,
    recordId: string,
    em?: EntityManager,
  ): Promise<AuditLog[]> {
    const qb = await this.qb(em);
    return qb
      .where("al.tableName = :tableName", { tableName })
      .andWhere("al.recordId = :recordId", { recordId })
      .orderBy("al.createdAt", "DESC")
      // Several rows can share a timestamp inside one transaction; the id
      // sequence is the only stable ordering.
      .addOrderBy("al.id", "DESC")
      .getMany();
  }

  /* ── Append-only guards ─────────────────────────────────────────────── */

  override async updateById(): Promise<never> {
    throw new Error("audit_logs is append-only: an editable audit trail is not one.");
  }

  override async softDeleteById(): Promise<never> {
    throw new Error("audit_logs is append-only: it has no deleted_at.");
  }

  override async restoreById(): Promise<never> {
    throw new Error("audit_logs is append-only: nothing is ever deleted.");
  }
}

export const auditLogRepository = new AuditLogRepository();
