import { PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";

/**
 * Base for CHILD LINE ITEMS of an aggregate — order_items, coin_issue_items,
 * party_order_items.
 *
 * Deliberately NOT `BaseEntity`. Line items are not independently owned rows:
 *
 *  - **No soft delete.** They cascade with their parent, and removing a line
 *    is recorded as a `document_revisions` diff on the aggregate, not as a
 *    tombstone row. A `deleted_at` here would also break the plain unique
 *    `(parent_id, line_no)` constraint, which would have to become partial for
 *    no benefit.
 *  - **No actor columns.** The parent header carries created_by / updated_by;
 *    duplicating them per line adds three columns and answers nothing the
 *    revision log doesn't already answer.
 *  - **Timestamps kept.** Cheap, and genuinely useful when reconciling "when
 *    did this line change".
 *
 * See .claude/DATA-MODEL.md §4 and §9
 */
export abstract class LineItemBase {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
