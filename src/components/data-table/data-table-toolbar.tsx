"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { TABLE_PARAMS } from "@/lib/table/types";
import { useTableParams } from "./use-table-params";

export interface QuickChip {
  /** Stable id, used as the React key. */
  id: string;
  label: string;
  /** Params this chip applies. `undefined` clears a param. */
  params: Record<string, string | undefined>;
}

/**
 * Table toolbar. Spec: DESIGN-STANDARDS §5.4
 *
 * The search placeholder must NAME what is searched — "Search order no, staff
 * name, phone…" — never a bare "Search". A user who can't tell what the box
 * covers will assume it doesn't cover what they want.
 */
export function DataTableToolbar({
  searchPlaceholder,
  filters,
  quickChips,
  children,
}: {
  searchPlaceholder: string;
  /** Module-specific filter controls, rendered inside the filter popover. */
  filters?: React.ReactNode;
  quickChips?: QuickChip[];
  /** Extra actions on the right, e.g. Export CSV. */
  children?: React.ReactNode;
}) {
  const t = useTranslations("common");
  const { get, setParams, clearAll, activeCount, isPending } = useTableParams();

  const urlQ = get(TABLE_PARAMS.q) ?? "";
  const [value, setValue] = useState(urlQ);
  const [showFilters, setShowFilters] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Keep in step when the URL changes from elsewhere (back button, a chip).
  useEffect(() => setValue(urlQ), [urlQ]);

  function onSearchChange(next: string) {
    setValue(next);
    clearTimeout(debounce.current);
    // 300ms: long enough not to fire per keystroke, short enough to feel live.
    debounce.current = setTimeout(
      () => setParams({ [TABLE_PARAMS.q]: next || undefined }),
      300,
    );
  }

  const chipActive = (chip: QuickChip) =>
    Object.entries(chip.params).every(([k, v]) =>
      v === undefined ? !get(k) : get(k) === v,
    );

  const anythingActive = activeCount > 0 || urlQ.length > 0;

  return (
    <div className="border-b border-border">
      <div className="flex h-14 items-center gap-2 px-4">
        <div className="relative w-full max-w-100">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={value}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="pl-9 pr-9"
          />
          {value && (
            <button
              type="button"
              onClick={() => {
                setValue("");
                setParams({ [TABLE_PARAMS.q]: undefined });
              }}
              aria-label={t("clearFilters")}
              className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          )}
        </div>

        {filters && (
          <Button
            variant="outline"
            onClick={() => setShowFilters((s) => !s)}
            aria-expanded={showFilters}
          >
            <SlidersHorizontal aria-hidden />
            {t("filters")}
            {activeCount > 0 && (
              <span className="ml-0.5 rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                {activeCount}
              </span>
            )}
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">{children}</div>
      </div>

      {showFilters && filters && (
        <div className="flex flex-wrap items-end gap-3 border-t border-border px-4 py-3">
          {filters}
        </div>
      )}

      {(quickChips?.length || anythingActive) && (
        <div className="flex min-h-11 flex-wrap items-center gap-2 border-t border-border px-4 py-2">
          {quickChips?.map((chip) => {
            const active = chipActive(chip);
            return (
              <button
                key={chip.id}
                type="button"
                disabled={isPending}
                onClick={() => setParams(active ? invert(chip.params) : chip.params)}
                aria-pressed={active}
                className={cn(
                  "h-7 rounded-full px-2.5 text-[13px] transition-colors duration-100",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  active
                    ? "border border-primary bg-[var(--badge-primary-bg)] text-[var(--badge-primary-fg)]"
                    : "border border-transparent bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {chip.label}
              </button>
            );
          })}

          {anythingActive && (
            <button
              type="button"
              onClick={clearAll}
              className="ml-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {t("clearFilters")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Turning a chip off clears exactly the params it set. */
function invert(params: Record<string, string | undefined>) {
  return Object.fromEntries(Object.keys(params).map((k) => [k, undefined]));
}
