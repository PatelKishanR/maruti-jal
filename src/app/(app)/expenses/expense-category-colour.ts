/**
 * The colour dot beside a category name.
 *
 * A PLAIN module: the client table and the server detail page both render the
 * dot, and a server component may not call an export of a `"use client"` file.
 * See .claude/MODULE-RECIPE.md §7
 *
 * **The colour is DERIVED, not stored.** `expense_categories` has no colour
 * column — design §6.3 draws an owner-chosen swatch, but the entity has only
 * `name`, `sort_order` and `is_active`. Hashing the id gives a colour that is
 * stable for the life of the category and different from its neighbours, which
 * is what the dot is actually for: telling `Fuel` from `Rent` at a glance
 * before either word is read (§1.7 principle 3).
 *
 * The trade-off is honest and worth naming: the owner cannot CHOOSE the colour,
 * and a deleted-then-recreated category gets a different one. Adding
 * `expense_categories.colour` is the real fix and is reported as a gap.
 *
 * The eight values are the swatch palette from design §6.3, verbatim. Raw hex
 * rather than a token: §3.8 says category dots keep their own colours in dark
 * mode, because their whole job is being distinguishable from each other.
 */
export const CATEGORY_DOT_COLOURS = [
  "#2563EB",
  "#F97316",
  "#22C55E",
  "#EF4444",
  "#8B5CF6",
  "#14B8A6",
  "#F59E0B",
  "#64748B",
] as const;

/**
 * FNV-1a over the id. Not cryptographic and does not need to be — it only has
 * to be deterministic, cheap, and well spread across eight buckets so two
 * categories the owner reads together rarely collide.
 */
export function categoryDotColour(categoryId: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < categoryId.length; i += 1) {
    hash ^= categoryId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return CATEGORY_DOT_COLOURS[hash % CATEGORY_DOT_COLOURS.length];
}
