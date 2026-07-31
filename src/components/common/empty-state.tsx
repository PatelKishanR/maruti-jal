"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Inbox, SearchX, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Empty and error states. Spec: DESIGN-STANDARDS §5.6, §11 · INVENTORY §11
 *
 * Two empty flavours, and keeping them distinct is the whole point:
 *
 *  - `no-data` — "No orders yet". Nothing exists. The owner is at the start of
 *    something, so the card explains what will appear here and offers the
 *    **primary** action that creates the first one.
 *  - `no-results` — "No orders match your filters". Plenty exists, the filters
 *    are just too tight. It names the active filters and offers a **secondary**
 *    `Clear filters`.
 *
 * Showing the first when the second is true is the classic bug: the owner is
 * told they have no orders while sitting on 312 of them.
 */

export interface EmptyStateProps {
  variant?: "no-data" | "no-results";
  /**
   * The module icon (`ClipboardList`, `Coins`, …) — §17. Ignored for
   * `no-results`, which always uses `SearchX` so the two never look alike.
   */
  icon?: LucideIcon;
  /** Already translated, e.g. "No orders yet". */
  title?: string;
  /** Already translated. For `no-data`, say what happens next. */
  description?: string;
  /**
   * Active filters in plain words — `Staff: Ramesh`, `Last 30 days`. Shown for
   * `no-results` so the owner can see what to loosen.
   */
  filters?: string[];
  /** Primary CTA for `no-data`, e.g. `<Button>+ New order</Button>`. */
  action?: React.ReactNode;
  onClearFilters?: () => void;
  className?: string;
}

export function EmptyState({
  variant = "no-data",
  icon,
  title,
  description,
  filters,
  action,
  onClearFilters,
  className,
}: EmptyStateProps) {
  const t = useTranslations("common");
  const noResults = variant === "no-results";
  const Icon = noResults ? SearchX : (icon ?? Inbox);

  return (
    <div
      className={cn(
        // 320px minimum, per §5.6 — never a squashed strip between toolbars.
        "flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center",
        className,
      )}
    >
      <Icon className="size-12 text-muted-foreground/60" aria-hidden />

      <h3 className="mt-4 text-h4 font-semibold text-foreground">
        {title ?? (noResults ? t("empty.noResultsTitle") : t("empty.noDataTitle"))}
      </h3>

      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        {description ??
          (noResults ? t("empty.noResultsBody") : t("empty.noDataBody"))}
      </p>

      {noResults && filters && filters.length > 0 ? (
        <div className="mt-3 flex flex-col items-center gap-1">
          <p className="text-caption font-medium text-muted-foreground">
            {t("empty.activeFilters")}
          </p>
          <ul className="flex flex-wrap justify-center gap-1">
            {filters.map((filter) => (
              <li
                key={filter}
                className="rounded-full bg-muted px-2.5 py-0.5 text-caption text-muted-foreground"
              >
                {filter}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {noResults ? (
        onClearFilters ? (
          <Button variant="secondary" className="mt-4" onClick={onClearFilters}>
            {t("clearFilters")}
          </Button>
        ) : null
      ) : (
        action && <div className="mt-4">{action}</div>
      )}
    </div>
  );
}

export interface ErrorStateProps {
  /** Already translated, e.g. "Couldn't load orders". */
  title?: string;
  /**
   * Plain language, no stack traces — "The server didn't respond. Your data is
   * safe." §5.6
   */
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel,
  className,
}: ErrorStateProps) {
  const t = useTranslations("common");

  return (
    <div
      role="alert"
      className={cn(
        "flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center",
        className,
      )}
    >
      <AlertTriangle className="size-12 text-destructive" aria-hidden />

      <h3 className="mt-4 text-h4 font-semibold text-foreground">
        {title ?? t("errorState.title")}
      </h3>

      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        {description ?? t("somethingWentWrong")}
      </p>

      {onRetry ? (
        <Button variant="primary" className="mt-4" onClick={onRetry}>
          {retryLabel ?? t("tryAgain")}
        </Button>
      ) : null}
    </div>
  );
}
