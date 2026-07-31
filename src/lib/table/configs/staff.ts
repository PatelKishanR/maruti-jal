import { z } from "zod";
import type { TableConfig } from "@/lib/table/types";

/**
 * The Staff table contract. Spec: ARCHITECTURE §6.1
 *
 * Imported by the service (to parse the URL) and by the client table (to build
 * chips and filter controls), so it must stay free of anything server-only —
 * zod and types only.
 */

/** URL parameter names for this module's filters, in one place. */
export const STAFF_FILTERS = {
  status: "status",
  hasBalance: "hasBalance",
  hasJars: "hasJars",
} as const;

export const STAFF_STATUSES = ["active", "inactive", "all"] as const;
export type StaffStatusFilter = (typeof STAFF_STATUSES)[number];

/** Inactive staff are out of the way by default — §3.3 filter popover. */
export const DEFAULT_STAFF_STATUS: StaffStatusFilter = "active";

/**
 * Public sort key → hard-coded qualified SQL column.
 *
 * THE INJECTION DEFENCE IS THIS MAP. User input is only ever a lookup key
 * into it — `?sort=id;DROP TABLE staff` misses and falls back to the default.
 * Nothing user-supplied is ever interpolated, so there is no escaping to get
 * wrong. See ARCHITECTURE §6.2
 *
 * THE SINGLE SOURCE OF TRUTH: `StaffRepository` imports this map rather than
 * keeping a second copy. Two hand-synced allowlists drift, and the failure is a
 * sort that silently does nothing — or a runtime throw — on a column nobody
 * tested. See MODULE-RECIPE §1
 *
 * TODO(wave-3): `cash` and `jars` join this map once delivery orders and coin
 * issues maintain the cached outstanding columns. Until those columns exist
 * there is nothing to sort on, and a key advertised here with no column behind
 * it would leave the header claiming one order while the rows came back in
 * another.
 */
export const STAFF_SORT_COLUMNS = {
  name: "s.name",
  /** The identity number, not the text code — so STF-9 sorts before STF-10. */
  code: "s.staffNo",
  phone: "s.phone",
  joinedOn: "s.joinedOn",
  createdAt: "s.createdAt",
} as const;

export type StaffSortKey = keyof typeof STAFF_SORT_COLUMNS;

export const staffTableConfig: TableConfig = {
  sortable: STAFF_SORT_COLUMNS,

  /** ICU-collated name ascending: Gujarati and Latin names interleave naturally. */
  defaultSort: { key: "name", dir: "asc" },

  /**
   * One generated column carrying name + phone + alt phone + address, with a
   * single trigram index — instead of four OR-branches. `code` is searched
   * alongside it by the repository. See DATA-MODEL §5.2
   */
  searchable: ["s.searchBlob", "s.code"],

  /**
   * Unknown filter keys are dropped; declared ones are schema-validated, and a
   * malformed value is ignored rather than 500-ing a bookmarked URL.
   */
  filters: {
    [STAFF_FILTERS.status]: z.enum(STAFF_STATUSES),
    [STAFF_FILTERS.hasBalance]: z.literal("1"),
    [STAFF_FILTERS.hasJars]: z.literal("1"),
  },

  defaultPageSize: 25,
  maxPageSize: 100,
};
