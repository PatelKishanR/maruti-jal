import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Column,
} from 'typeorm';

/**
 * Shared column block for every business table.
 *
 * NOTE: append-only tables (payments, *_return_events, coin_ledger_entries,
 * audit_logs) must NOT extend this — they carry only id, created_at and
 * created_by_id. A DB trigger refuses UPDATE and DELETE on them.
 * See .claude/DATA-MODEL.md §4
 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt!: Date | null;

  @Column({ type: 'uuid', name: 'created_by_id', nullable: true })
  createdById!: string | null;

  @Column({ type: 'uuid', name: 'updated_by_id', nullable: true })
  updatedById!: string | null;

  @Column({ type: 'uuid', name: 'deleted_by_id', nullable: true })
  deletedById!: string | null;
}
