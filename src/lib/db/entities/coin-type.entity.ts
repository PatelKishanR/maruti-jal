import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';
import { money, rate6 } from '../transformers';

/**
 * A coin denomination — "Blue Token", 100 coins per packet, ₹1,000 per packet,
 * therefore ₹10 a coin.
 *
 * This table is the DEFINITION side of a coin. `coin_ledger_entries` is the
 * accounting side, and it alone decides how many coins exist.
 * See .claude/DATA-MODEL.md §5.9
 *
 * Every @Column below declares its type EXPLICITLY. Bare `@Column()` relies on
 * emitted decorator metadata, which esbuild — the toolchain running our
 * migration CLI — has never implemented. See .claude/ARCHITECTURE.md §1.1
 */
@Entity('coin_types')
export class CoinType extends BaseEntity {
  /**
   * Unique among non-deleted rows, case-insensitively.
   *
   * The case-insensitive half is a functional partial index on `lower(name)`,
   * which no TypeORM decorator can express — it is declared in the migration.
   * `text` rather than `citext` because the column is only ever compared for
   * uniqueness, never joined on. See .claude/DATA-MODEL.md §5.9
   */
  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'integer', name: 'coins_per_packet' })
  coinsPerPacket!: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    name: 'packet_amount',
    transformer: money,
  })
  packetAmount!: number;

  /**
   * Derived, never editable: packet amount ÷ coins per packet.
   *
   * Six decimal places because packets rarely divide cleanly — ₹500 across 45
   * coins is ₹11.111111. Row-level amounts are still rounded and stored at two,
   * which is the deliberate source of the five-paise gap documented in
   * MODULES/04-coins.md §8.2.
   *
   * GENERATED in PostgreSQL, not computed in TypeScript: monetary arithmetic
   * never happens in JavaScript, and a generated column cannot drift from its
   * inputs. Division by zero is impossible because `coins_per_packet > 0` is a
   * table constraint. See .claude/DATA-MODEL.md §8.2
   */
  @Column({
    type: 'numeric',
    precision: 14,
    scale: 6,
    name: 'per_coin_price',
    transformer: rate6,
    generatedType: 'STORED',
    asExpression: 'round(packet_amount / coins_per_packet::numeric, 6)',
    insert: false,
    update: false,
  })
  perCoinPrice!: number;

  /**
   * A CACHE of the ledger balance, maintained by the trigger that fires on
   * every `coin_ledger_entries` insert. Nothing else may write it — not a
   * service, not an import script, not the owner running UPDATE in the Neon
   * console at 11pm. `v_coin_balance_drift` exists to prove it.
   *
   * There is deliberately NO `opening_stock` column. Opening stock is an
   * OPENING row in the ledger, so the ledger remains the single source of
   * truth for every coin that has ever existed.
   * See .claude/DATA-MODEL.md §5.9 and §8.3
   */
  @Column({ type: 'integer', name: 'balance_coins', default: 0 })
  balanceCoins!: number;

  /** Badge colour in the UI, e.g. '#2563EB'. */
  @Column({ type: 'varchar', length: 7, name: 'colour_hex', nullable: true })
  colourHex!: string | null;

  /**
   * A coin type with any ledger movement can never be deleted — the RESTRICT
   * foreign keys on the ledger see to that — only deactivated.
   * See MODULES/04-coins.md §8
   */
  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;
}
