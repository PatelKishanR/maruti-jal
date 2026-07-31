"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Ban,
  CheckCircle2,
  Copy,
  Eye,
  MoreHorizontal,
  Package,
  PackageX,
  Pencil,
  RotateCcw,
} from "lucide-react";
import {
  DataTable,
  useTableParams,
  type DataTableColumn,
  type QuickChip,
} from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/common/empty-state";
import { Litres, Money } from "@/components/common/money";
import { StatusBadge } from "@/components/common/status-badge";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { ListResult } from "@/lib/table/types";
import type { LookupDto, ProductListItemDto } from "@/lib/dto/product.dto";

/**
 * The catalogue table. Spec: design/MODULES/02-products.md §3
 *
 * Talks to the API only — no service, no repository, no database import.
 * See .claude/ARCHITECTURE.md §4
 *
 * Every `sortKey` below is a key of `productTableConfig.sortable`. It travels
 * as a URL parameter and is used by the server ONLY as a lookup key into that
 * allowlist, never as a SQL fragment.
 */
export function ProductsTable({
  result,
  tags,
  filterTypes,
}: {
  result: ListResult<ProductListItemDto>;
  tags: LookupDto[];
  filterTypes: LookupDto[];
}) {
  const t = useTranslations("products");
  const { get, clearAll } = useTableParams();

  const query = get("q") ?? "";

  const columns: DataTableColumn<ProductListItemDto>[] = [
    {
      id: "code",
      header: t("columns.code"),
      width: "112px",
      cell: (p) => (
        <span className="font-mono text-[13px] font-medium text-primary">
          {p.code}
        </span>
      ),
    },
    {
      id: "title",
      header: t("columns.title"),
      sortKey: "title",
      cell: (p) => (
        <div className="min-w-0">
          {/* Inactive drops to muted but stays fully legible — a deactivated
              product is history, not a mistake, so no opacity dimming. */}
          <p
            className={cn(
              "truncate text-sm font-medium",
              p.isActive ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {p.title}
          </p>
          {p.description ? (
            <p className="truncate text-caption text-muted-foreground">
              {p.description}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      id: "litres",
      header: t("columns.litres"),
      sortKey: "litres",
      align: "right",
      width: "104px",
      // Sorts numerically, so 0.5L sits below 5L rather than beside it.
      cell: (p) => <Litres value={p.litres} />,
    },
    {
      id: "tag",
      header: t("columns.tag"),
      width: "120px",
      // The lookup's label AS STORED — rename it to ઠંડું and this cell follows
      // with no code change.
      cell: (p) => <Badge>{p.tagLabel}</Badge>,
    },
    {
      id: "filterType",
      header: t("columns.filterType"),
      width: "160px",
      hideOnMobile: true,
      cell: (p) => (
        <span className="text-sm text-muted-foreground">
          {p.filterTypeLabel}
        </span>
      ),
    },
    {
      id: "basePrice",
      header: t("columns.basePrice"),
      sortKey: "basePrice",
      align: "right",
      width: "140px",
      cell: (p) => <BasePrice value={p.basePrice} />,
    },
    {
      id: "returnable",
      header: t("columns.returnable"),
      align: "center",
      width: "96px",
      cell: (p) => <ReturnableMark isReturnable={p.isReturnable} />,
    },
    {
      id: "status",
      header: t("columns.status"),
      width: "120px",
      cell: (p) => <StatusBadge status={p.isActive ? "active" : "inactive"} />,
    },
    {
      id: "actions",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      align: "center",
      width: "56px",
      cell: (p) => <RowActions product={p} />,
    },
  ];

  /**
   * One-tap presets. `Active` clears the parameter rather than setting
   * `status=active`, because an absent status already MEANS active — otherwise
   * the chip would look off on a freshly-opened list that is showing exactly
   * what the chip describes.
   */
  const quickChips: QuickChip[] = [
    { id: "all", label: t("chips.all"), params: { status: "all" } },
    { id: "active", label: t("chips.active"), params: { status: undefined } },
    { id: "cold", label: t("chips.cold"), params: { tag: "COLD" } },
    {
      id: "returnable",
      label: t("chips.returnable"),
      params: { returnable: "yes" },
    },
    {
      id: "nonReturnable",
      label: t("chips.nonReturnable"),
      params: { returnable: "no" },
    },
    {
      id: "inactive",
      label: t("chips.inactive"),
      params: { status: "inactive" },
    },
  ];

  return (
    <DataTable
      columns={columns}
      result={result}
      rowKey={(p) => p.id}
      rowHref={(p) => `/products/${p.id}`}
      searchPlaceholder={t("searchPlaceholder")}
      quickChips={quickChips}
      filters={<ProductFilters tags={tags} filterTypes={filterTypes} />}
      emptyState={
        <EmptyState
          icon={Package}
          title={t("empty.noData.title")}
          description={t("empty.noData.body")}
          action={
            <Button asChild>
              <Link href="/products/new">{t("empty.noData.action")}</Link>
            </Button>
          }
        />
      }
      noResultsState={
        <EmptyState
          variant="no-results"
          title={t("empty.noResults.title")}
          // Quotes the query back verbatim: search is SCRIPT-LITERAL, so a
          // product stored as ૨૦ લિટર જાર is genuinely not found by typing 20L.
          description={
            query
              ? t("empty.noResults.bodyWithQuery", { query })
              : t("empty.noResults.body")
          }
          onClearFilters={clearAll}
        />
      }
      mobileCard={(p) => <ProductCard product={p} />}
    />
  );
}

/** `₹0.00` is a LEGAL price and reads as `Free` — the em dash is for MISSING. */
function BasePrice({ value }: { value: number }) {
  const t = useTranslations("products");

  if (value === 0) {
    return <span className="text-caption text-muted-foreground">{t("free")}</span>;
  }
  return <Money value={value} emphasis zeroAs="value" />;
}

/** Icon AND word, never colour alone. */
function ReturnableMark({ isReturnable }: { isReturnable: boolean }) {
  const t = useTranslations("products");

  return isReturnable ? (
    <span className="inline-flex items-center gap-1 text-caption text-success">
      <RotateCcw className="size-4 shrink-0" aria-hidden />
      {t("returnableYes")}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-caption text-muted-foreground">
      <PackageX className="size-4 shrink-0" aria-hidden />
      {t("returnableNo")}
    </span>
  );
}

/** Below `md` each row becomes a card. Spec §3.7 */
function ProductCard({ product }: { product: ProductListItemDto }) {
  return (
    <div className="space-y-1">
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-[13px] font-medium text-primary">
          {product.code}
        </span>
        <StatusBadge status={product.isActive ? "active" : "inactive"} />
      </div>

      <p className="text-base font-medium text-foreground">{product.title}</p>

      <p className="text-caption text-muted-foreground">
        {product.tagLabel} · {product.filterTypeLabel}
      </p>

      <div className="flex items-center justify-between gap-3 pt-1">
        <ReturnableMark isReturnable={product.isReturnable} />
        <span className="flex items-center gap-2">
          <Litres value={product.litres} />
          <BasePrice value={product.basePrice} />
        </span>
      </div>
    </div>
  );
}

/**
 * Row menu. Always visible, not hover-only — hover-only actions are
 * undiscoverable and impossible on touch. DESIGN-STANDARDS §5.2
 *
 * Deactivate is NEVER disabled here, unlike Staff: a deactivated product breaks
 * nothing, because every past order reads from its own snapshot.
 */
function RowActions({ product }: { product: ProductListItemDto }) {
  const t = useTranslations("products");
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [, startTransition] = useTransition();

  async function reactivate() {
    try {
      await api.post(`/api/products/${product.id}/reactivate`);
      startTransition(() => router.refresh());
      toast.success(t("toast.reactivated", { title: product.title }));
    } catch {
      toast.error(t("toast.actionFailed"));
    }
  }

  async function deactivate() {
    try {
      await api.del(`/api/products/${product.id}`);
      startTransition(() => router.refresh());
      toast.success(t("toast.deactivated", { title: product.title }), {
        // 8s for Undo — long enough to notice the row leave the Active view.
        duration: 8000,
        action: { label: t("toast.undo"), onClick: () => void reactivate() },
      });
    } catch {
      toast.error(t("toast.actionFailed"));
    }
  }

  return (
    // The row itself navigates; this cell must not.
    <span onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("rowActions.menu", { title: product.title })}
          >
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/products/${product.id}`}>
              <Eye aria-hidden />
              {t("rowActions.view")}
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link href={`/products/${product.id}/edit`}>
              <Pencil aria-hidden />
              {t("rowActions.edit")}
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link href={`/products/new?duplicate=${product.id}`}>
              <Copy aria-hidden />
              {t("rowActions.duplicate")}
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {product.isActive ? (
            <DropdownMenuItem destructive onSelect={() => setConfirming(true)}>
              <Ban aria-hidden />
              {t("rowActions.deactivate")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => void reactivate()}>
              <CheckCircle2 aria-hidden />
              {t("rowActions.reactivate")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("deactivate.title", { title: product.title })}
        description={t("deactivate.body")}
        confirmLabel={t("deactivate.confirm")}
        onConfirm={deactivate}
      />
    </span>
  );
}

/**
 * Filter controls, rendered by the shared toolbar.
 *
 * The tag and filter-type lists are driven by the LOOKUP TABLES, so a tag the
 * owner adds tomorrow appears here with no code change.
 */
function ProductFilters({
  tags,
  filterTypes,
}: {
  tags: LookupDto[];
  filterTypes: LookupDto[];
}) {
  const t = useTranslations("products.filters");
  const { get, setParams } = useTableParams();

  return (
    <>
      <LookupFilter
        label={t("tag")}
        anyLabel={t("anyTag")}
        value={get("tag")}
        options={tags}
        onChange={(value) => setParams({ tag: value })}
      />

      <LookupFilter
        label={t("filterType")}
        anyLabel={t("anyFilterType")}
        value={get("filterType")}
        options={filterTypes}
        onChange={(value) => setParams({ filterType: value })}
      />

      <Segmented
        label={t("status")}
        value={get("status") ?? "active"}
        options={[
          { value: "active", label: t("statusActive") },
          { value: "inactive", label: t("statusInactive") },
          { value: "all", label: t("statusAll") },
        ]}
        // `active` is the default, so it is expressed as an absent parameter —
        // that keeps a shared URL short and the chip row honest.
        onChange={(value) =>
          setParams({ status: value === "active" ? undefined : value })
        }
      />

      <Segmented
        label={t("returnable")}
        value={get("returnable") ?? "any"}
        options={[
          { value: "any", label: t("returnableAny") },
          { value: "yes", label: t("returnableYes") },
          { value: "no", label: t("returnableNo") },
        ]}
        onChange={(value) =>
          setParams({ returnable: value === "any" ? undefined : value })
        }
      />
    </>
  );
}

const ANY = "__any__";

function LookupFilter({
  label,
  anyLabel,
  value,
  options,
  onChange,
}: {
  label: string;
  anyLabel: string;
  value: string | undefined;
  options: LookupDto[];
  onChange: (value: string | undefined) => void;
}) {
  return (
    <label className="flex min-w-45 flex-col gap-1">
      <span className="text-caption font-medium text-muted-foreground">
        {label}
      </span>
      <Select
        value={value ?? ANY}
        onValueChange={(next) => onChange(next === ANY ? undefined : next)}
      >
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{anyLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.code} value={option.code}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-caption font-medium text-muted-foreground">
        {label}
      </span>
      <div
        role="group"
        aria-label={label}
        className="inline-flex h-10 items-center rounded-sm border border-input p-0.5"
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-full rounded-[3px] px-3 text-sm transition-colors duration-100",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              option.value === value
                ? "bg-[var(--badge-primary-bg)] font-medium text-[var(--badge-primary-fg)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The list failed to load.
 *
 * A client component because `Try again` re-runs the server render, and a
 * Server Component cannot hand a callback across the boundary.
 */
export function ProductsLoadError() {
  const t = useTranslations("products.error");
  const router = useRouter();

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <ErrorState
        title={t("listTitle")}
        description={t("listBody")}
        onRetry={() => router.refresh()}
      />
    </div>
  );
}
