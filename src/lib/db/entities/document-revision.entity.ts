import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';
import { bigintToNumber } from '../transformers';
import { DOCUMENT_TYPES, type DocumentType } from './enums';

/**
 * "Show me the order as it stood on 14 March."
 *
 * One of four history mechanisms, each answering a different question: the
 * live rows say what a document looks like NOW, `audit_logs` says WHAT CHANGED,
 * the event tables (returns, payments, coin ledger) say what PHYSICALLY
 * HAPPENED, and this table replays a document AS IT STOOD.
 * See .claude/DATA-MODEL.md §9
 *
 * ONE ROW PER EDIT SESSION, NOT PER COLUMN. The edit action wraps the whole
 * aggregate mutation — header, lines, schedule — in one transaction and writes
 * exactly one revision at the end. Per-column rows would turn "what did this
 * order look like before Ramesh touched it?" into a reassembly problem, and
 * would lose the fact that eleven field changes were one human decision.
 * See .claude/DATA-MODEL.md §5.20
 *
 * APPEND-ONLY: does not extend BaseEntity, and carries no `updated_at` or
 * `deleted_at`. Rewritable history is not history.
 */
@Index(
  'uq_document_revisions_doc_rev',
  ['documentType', 'documentId', 'revisionNo'],
  { unique: true },
)
@Entity('document_revisions')
export class DocumentRevision {
  /**
   * `bigint` identity, NOT a uuid.
   *
   * This is a high-volume append-only log, never referenced from a URL and
   * never joined by a human. A monotonic 8-byte key clusters new rows at the
   * end of the index instead of scattering random uuids across the whole
   * B-tree, which is the difference between an append and a page split.
   *
   * BY DEFAULT rather than ALWAYS, matching the register numbers elsewhere in
   * the schema: the application never supplies a value, but a restore must be
   * able to.
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

  @Column({
    type: 'enum',
    enum: DOCUMENT_TYPES,
    enumName: 'document_type',
    name: 'document_type',
  })
  documentType!: DocumentType;

  /**
   * No foreign key, by design: this table outlives the documents it records,
   * and a revision must survive even a direct `DELETE` in the console.
   * `document_type` is the discriminator that says which table to look in.
   */
  @Column({ type: 'uuid', name: 'document_id' })
  documentId!: string;

  /** 1, 2, 3… per document. Unique with (document_type, document_id). */
  @Column({ type: 'integer', name: 'revision_no' })
  revisionNo!: number;

  /** The FULL aggregate — header plus children — as it stood after this edit. */
  @Column({ type: 'jsonb' })
  snapshot!: Record<string, unknown>;

  /** `{ field: [before, after] }`. NULL on revision 1, which has nothing to diff against. */
  @Column({ type: 'jsonb', nullable: true })
  diff!: Record<string, [unknown, unknown]> | null;

  @Column({ type: 'text', name: 'change_reason', nullable: true })
  changeReason!: string | null;

  /** No FK to `users`: an account may be removed; its history may not vanish with it. */
  @Column({ type: 'uuid', name: 'actor_id', nullable: true })
  actorId!: string | null;

  /**
   * SNAPSHOTTED, not joined.
   *
   * A revision list that renders "(deleted user)" for edits made by someone
   * who has since left is useless in exactly the audit conversation it exists
   * for. Copying 20 bytes at write time is what makes the history survive its
   * author. See .claude/DATA-MODEL.md §5.20
   */
  @Column({ type: 'text', name: 'actor_name', nullable: true })
  actorName!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
