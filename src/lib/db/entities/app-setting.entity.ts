import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

/**
 * What `jsonb` can actually hold, so `value` is typed rather than `any`.
 *
 * The array and object arms are INTERFACES, not inline type literals. TypeORM's
 * QueryDeepPartialEntity maps every property of an entity structurally, and a
 * self-referential type alias makes it recurse until the compiler gives up with
 * "type instantiation is excessively deep". An interface is a deferred
 * reference, which breaks that chain while describing the same shape.
 */
export type JsonValue = string | number | boolean | null | JsonArray | JsonObject;
export interface JsonArray extends Array<JsonValue> {}
export interface JsonObject {
  [key: string]: JsonValue;
}

/**
 * Runtime configuration the owner can change without a deployment.
 *
 * Seeded with `orders.charge_basis` (decision D5 — flipping to "ISSUED" must be
 * a config change, not a migration), `business.profile` and
 * `coins.allow_negative_balance`. See .claude/DATA-MODEL.md §5.22
 *
 * `value` is jsonb rather than text so a setting can grow from a scalar to an
 * object — `business.profile` already is one — without a column change.
 *
 * Deliberately does NOT extend BaseEntity: §5.22 makes `key` the primary key,
 * and a settings row is addressed by its key everywhere in the codebase. The
 * audit block is therefore repeated here minus the uuid `id`. See §4
 *
 * Every @Column declares its type EXPLICITLY — esbuild, which runs our
 * migration CLI, emits no decorator metadata. See .claude/ARCHITECTURE.md §1.1
 */
@Entity('app_settings')
export class AppSetting {
  /** Dotted namespace, e.g. `orders.charge_basis`. */
  @PrimaryColumn({ type: 'text' })
  key!: string;

  @Column({ type: 'jsonb' })
  value!: JsonValue;

  /** Shown beside the field in the settings screen so keys stay self-explaining. */
  @Column({ type: 'text', nullable: true })
  description!: string | null;

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
