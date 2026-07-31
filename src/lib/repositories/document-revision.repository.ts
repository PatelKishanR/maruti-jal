import "server-only";
import type { EntityManager, EntityTarget } from "typeorm";
import { BaseRepository } from "./base.repository";
import { DocumentRevision } from "@/lib/db/entities";
import type { DocumentType } from "@/lib/db/entities/enums";

/**
 * Every query that touches the `document_revisions` table lives here.
 *
 * APPEND-ONLY. The inherited mutators are overridden to throw: a revision that
 * can be edited is not a revision. Writes go through create(), once per edit
 * SESSION, at the end of the transaction that made the change.
 * See .claude/DATA-MODEL.md §5.20, §9
 */
class DocumentRevisionRepository extends BaseRepository<DocumentRevision> {
  protected readonly target: EntityTarget<DocumentRevision> = DocumentRevision;
  protected readonly alias = "dr";

  /** The most recent revision — the "before" side of the next diff. */
  async findLatest(
    documentType: DocumentType,
    documentId: string,
    em?: EntityManager,
  ): Promise<DocumentRevision | null> {
    const qb = await this.qb(em);
    return qb
      .where("dr.documentType = :documentType", { documentType })
      .andWhere("dr.documentId = :documentId", { documentId })
      .orderBy("dr.revisionNo", "DESC")
      .getOne();
  }

  /**
   * The next revision number for a document — 1 if it has none yet.
   *
   * MAX + 1 is a read-modify-write, so two concurrent edit sessions can both
   * compute the same number. That is fine and deliberate: the unique index on
   * (document_type, document_id, revision_no) makes the loser fail loudly
   * rather than silently overwrite. Serialising it with a lock instead would
   * mean holding one for the whole edit transaction, which is a far worse
   * trade for a history table. Call this inside the same transaction as the
   * insert and let the constraint arbitrate.
   */
  async nextRevisionNo(
    documentType: DocumentType,
    documentId: string,
    em?: EntityManager,
  ): Promise<number> {
    const qb = await this.qb(em);
    const row = await qb
      .select("coalesce(max(dr.revisionNo), 0)", "maxRevision")
      .where("dr.documentType = :documentType", { documentType })
      .andWhere("dr.documentId = :documentId", { documentId })
      .getRawOne<{ maxRevision: string | number }>();
    return Number(row?.maxRevision ?? 0) + 1;
  }

  /* ── Append-only guards ─────────────────────────────────────────────── */

  override async updateById(): Promise<never> {
    throw new Error(
      "document_revisions is append-only: history is written once, never edited.",
    );
  }

  override async softDeleteById(): Promise<never> {
    throw new Error("document_revisions is append-only: it has no deleted_at.");
  }

  override async restoreById(): Promise<never> {
    throw new Error("document_revisions is append-only: nothing is deleted.");
  }
}

export const documentRevisionRepository = new DocumentRevisionRepository();
