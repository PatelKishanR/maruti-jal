import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import { bigintToNumber } from '../transformers';
import { AUDIT_ACTIONS, type AuditAction } from './enums';

/**
 * "What changed, when, and by whom?" — for every business table.
 *
 * Written by a GENERIC DATABASE TRIGGER, not by application code. That is the
 * whole point: the row is correct no matter who writes — a service, a future
 * import script, or the owner running an `UPDATE` in the Neon console at 11pm.
 * Application-level auditing only records the writes the application happens
 * to know about, which is precisely the wrong set on the day it matters.
 *
 * Separate from the log files because this is a money application and logs get
 * rotated away. Audit rows are written inside the same transaction as the
 * change they record. See .claude/DATA-MODEL.md §5.21 · ARCHITECTURE.md §10.2
 *
 * APPEND-ONLY: does not extend BaseEntity.
 */
@Entity('audit_logs')
export class AuditLog {
  /**
   * `bigint` identity, NOT a uuid — the highest-volume table in the schema,
   * written once and read by range. See DocumentRevision for the full reasoning.
   */
  @PrimaryColumn({
    type: 'bigint',
    name: 'id',
    generated: 'identity',
    generatedIdentity: 'BY DEFAULT',
    insert: false,
    update: false,
    transformer: bigintToNumber,
  })
  id!: number;

  @Column({ type: 'text', name: 'table_name' })
  tableName!: string;

  /** Every business table in this schema has a uuid primary key. See DATA-MODEL D-1 */
  @Column({ type: 'uuid', name: 'record_id' })
  recordId!: string;

  @Column({ type: 'enum', enum: AUDIT_ACTIONS, enumName: 'audit_action' })
  action!: AuditAction;

  /** NULL on INSERT — there was no previous row. */
  @Column({ type: 'jsonb', nullable: true })
  before!: Record<string, unknown> | null;

  /** NULL on a hard DELETE, which should only ever come from a migration. */
  @Column({ type: 'jsonb', nullable: true })
  after!: Record<string, unknown> | null;

  /**
   * A real `text[]`, GIN indexed, not a comma-joined string.
   *
   * "Every time anyone touched a price" is then `WHERE changed_fields @> '{unit_price}'`
   * — an index scan. Against a joined string it is a `LIKE '%unit_price%'` that
   * also matches `unit_price_note`.
   */
  @Column({ type: 'text', array: true, name: 'changed_fields' })
  changedFields!: string[];

  /* ═══════════════════════════════════════════════════════════════════════
     THE ACTOR

     Read by the trigger from a per-request session variable. That indirection
     is what lets a DATABASE-level trigger record *who* without every single
     statement in the codebase remembering to pass it.

     Snapshotted as text with no FK, for the same reason as document_revisions:
     history must survive the deletion of the account that made it.
     ═══════════════════════════════════════════════════════════════════════ */

  @Column({ type: 'uuid', name: 'actor_id', nullable: true })
  actorId!: string | null;

  @Column({ type: 'text', name: 'actor_name', nullable: true })
  actorName!: string | null;

  /** `text`, not the `user_role` enum: it is a historical fact, not a code branch. */
  @Column({ type: 'text', name: 'actor_role', nullable: true })
  actorRole!: string | null;

  /** Correlates a row with the `x-request-id` on the response and in the logs. */
  @Column({ type: 'text', name: 'request_id', nullable: true })
  requestId!: string | null;

  /**
   * `inet`, so subnet questions are an index scan rather than string surgery.
   *
   * The caller must pass a SINGLE normalised address — the leftmost hop of
   * `X-Forwarded-For`, not the raw header, which is a comma-separated chain
   * that `inet` will reject outright.
   */
  @Column({ type: 'inet', nullable: true })
  ip!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}

/*
 * `idx_audit_record (table_name, record_id, created_at DESC)` and the GIN index
 * on `changed_fields` are created in the concurrent-index migration — both
 * carry shape (a DESC sort key, a GIN operator class) that TypeORM's @Index
 * decorator cannot express. See .claude/DATA-MODEL.md §11
 *
 * If multi-year retention is ever wanted, partition this table by month FROM
 * DAY ONE. Cheap now, painful to retrofit.
 */
