"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  DataTable,
  useTableParams,
  type DataTableColumn,
  type QuickChip,
} from "@/components/data-table";
import { EmptyState } from "@/components/common/empty-state";
import { Money, Quantity } from "@/components/common/money";
import { TABLE_PARAMS, type ListResult } from "@/lib/table/types";
import {
  DEFAULT_STAFF_STATUS,
  STAFF_FILTERS,
  STAFF_STATUSES,
  type StaffStatusFilter,
} from "@/lib/table/configs/staff";
import { staffPaths } from "@/lib/api/routes.staff";
import type { StaffListItemDto } from "@/lib/dto/staff.dto";
import { StaffActions } from "./staff-actions";
import { StaffStatusBadges } from "./staff-badges";

/**
 * Staff list table. Spec: design/MODULES/01-staff.md §3
 *
 * Everything module-specific lives here — columns, chips, filters, the two
 * empty states. The shared DataTable contains zero staff logic, which is the
 * test this module exists to pass.
 */
export function StaffTable({
  result,
  totalStaff,
}: {
  result: ListResult<StaffListItemDto>;
  /** Drives the empty-state fork. See the note on `emptyState` below. */
  totalStaff: number;
}) {
  const t = useTranslations("staff");
  const { get, setParams, clearAll } = useTableParams();

  const status = (get(STAFF_FILTERS.status) ??
    DEFAULT_STAFF_STATUS) as StaffStatusFilter;
  const hasBalance = get(STAFF_FILTERS.hasBalance) === "1";
  const hasJars = get(STAFF_FILTERS.hasJars) === "1";
  const query = get(TABLE_PARAMS.q) ?? "";

  const columns: DataTableColumn<StaffListItemDto>[] = [
    {
      id: "code",
      header: t("columns.code"),
      width: "112px",
      cell: (row) => (
        <span className="font-mono text-[13px] font-medium text-primary">
          {row.code}
        </span>
      ),
    },
    {
      id: "name",
      header: t("columns.name"),
      sortKey: "name",
      cell: (row) => (
        <span
          className="block max-w-50 truncate font-medium text-foreground"
          title={row.name}
        >
          {row.name}
        </span>
      ),
    },
    {
      id: "phone",
      header: t("columns.phone"),
      width: "150px",
      cell: (row) => (
        <span className="block">
          <span className="block font-mono text-[13px] text-foreground">
            {row.phone}
          </span>
          {row.altPhone && (
            <span className="block font-mono text-caption text-muted-foreground">
              {row.altPhone}
            </span>
          )}
        </span>
      ),
    },
    {
      id: "address",
      header: t("columns.address"),
      hideOnMobile: true,
      cell: (row) =>
        row.address ? (
          <span
            className="block max-w-45 truncate text-muted-foreground"
            title={row.address}
          >
            {row.address}
          </span>
        ) : (
          // Never blank, never `null`, never `N/A`. §5.3
          <span className="text-muted-foreground/60">—</span>
        ),
    },
    {
      id: "cash",
      header: t("columns.cash"),
      align: "right",
      width: "132px",
      // TODO(wave-3): gains `sortKey: "cash"` the day the cached outstanding
      // column exists. A sort key with no SQL column behind it throws.
      cell: (row) => <Money value={row.cashOutstanding} emphasis />,
    },
    {
      id: "jars",
      header: t("columns.jars"),
      align: "right",
      width: "92px",
      cell: (row) => (
        <Quantity value={row.jarsOut} zeroAs="dash" emphasis />
      ),
    },
    {
      id: "coins",
      header: t("columns.coins"),
      align: "right",
      width: "120px",
      hideOnMobile: true,
      cell: (row) => <Money value={row.coinDues} />,
    },
    {
      id: "status",
      header: t("columns.status"),
      width: "200px",
      cell: (row) => <StaffStatusBadges staff={row} />,
    },
    {
      id: "actions",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      align: "center",
      width: "56px",
      cell: (row) => <StaffActions staff={row} />,
    },
  ];

  /** One-tap presets. Each writes the URL, so the view stays shareable. §3.6 */
  const quickChips: QuickChip[] = [
    {
      id: "all",
      label: t("chips.all"),
      params: {
        [STAFF_FILTERS.status]: "all",
        [STAFF_FILTERS.hasBalance]: undefined,
        [STAFF_FILTERS.hasJars]: undefined,
      },
    },
    {
      id: "active",
      label: t("chips.active"),
      params: { [STAFF_FILTERS.status]: "active" },
    },
    {
      id: "moneyPending",
      label: t("chips.moneyPending"),
      params: { [STAFF_FILTERS.hasBalance]: "1" },
    },
    {
      id: "jarsOut",
      label: t("chips.jarsOut"),
      params: { [STAFF_FILTERS.hasJars]: "1" },
    },
    {
      id: "inactive",
      label: t("chips.inactive"),
      params: { [STAFF_FILTERS.status]: "inactive" },
    },
  ];

  /** Named verbatim in the no-results copy, so the owner sees what to loosen. */
  const activeFilterLabels = [
    query ? `“${query}”` : null,
    get(STAFF_FILTERS.status)
      ? t("filters.statusValue", { value: t(`filters.status.${status}`) })
      : null,
    hasBalance ? t("filters.hasBalance") : null,
    hasJars ? t("filters.hasJars") : null,
  ].filter((label): label is string => label !== null);

  const noResults = (
    <EmptyState
      variant="no-results"
      title={t("list.noResults.title")}
      description={describeNoResults(t, query, activeFilterLabels)}
      onClearFilters={clearAll}
    />
  );

  return (
    <DataTable
      columns={columns}
      result={result}
      rowKey={(row) => row.id}
      rowHref={(row) => staffPaths.detail(row.id)}
      searchPlaceholder={t("list.searchPlaceholder")}
      quickChips={quickChips}
      filters={
        <StaffFilters
          status={status}
          hasBalance={hasBalance}
          hasJars={hasJars}
          setParams={setParams}
        />
      }
      /**
       * The fork the shared table cannot make for us: with no URL filters the
       * list still defaults to Active, so "zero rows" can mean either "no
       * staff exist" or "no ACTIVE staff exist". Only the total tells them
       * apart — and telling the owner they have no staff while sitting on
       * fourteen of them is the classic version of this bug.
       */
      emptyState={
        totalStaff === 0 ? (
          <EmptyState
            icon={Users}
            title={t("list.empty.title")}
            description={t("list.empty.body")}
            action={
              <Button asChild>
                <Link href={staffPaths.new}>
                  <Plus aria-hidden />
                  {t("list.empty.cta")}
                </Link>
              </Button>
            }
          />
        ) : (
          noResults
        )
      }
      noResultsState={noResults}
      /** §3.7 — below md every row becomes a tappable card. */
      mobileCard={(row) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-start justify-between gap-3">
            <span className="font-mono text-[13px] font-medium text-primary">
              {row.code}
            </span>
            <StaffStatusBadges staff={row} className="justify-end" />
          </div>

          <p className="text-sm">
            <span className="font-medium text-foreground">{row.name}</span>
            <span className="text-muted-foreground"> · {row.phone}</span>
          </p>

          {row.address && (
            <p className="truncate text-caption text-muted-foreground">
              {row.address}
            </p>
          )}

          <div className="mt-1 flex items-end justify-between gap-4">
            <span className="flex gap-4">
              <MobileFigure label={t("columns.cash")}>
                <Money value={row.cashOutstanding} emphasis />
              </MobileFigure>
              <MobileFigure label={t("columns.jars")}>
                <Quantity value={row.jarsOut} zeroAs="dash" emphasis />
              </MobileFigure>
              <MobileFigure label={t("columns.coins")}>
                <Money value={row.coinDues} />
              </MobileFigure>
            </span>
            <StaffActions staff={row} />
          </div>
        </div>
      )}
      rowClassName={(row) => cn(!row.isActive && "opacity-70")}
    />
  );
}

function MobileFigure({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <span className="flex flex-col">
      <span className="text-caption text-muted-foreground">{label}</span>
      {children}
    </span>
  );
}

/** `Nothing matches "vaghel" with Status: Inactive and Has jars out.` */
function describeNoResults(
  t: ReturnType<typeof useTranslations>,
  query: string,
  labels: string[],
): string {
  const withoutQuery = labels.filter((label) => label !== `“${query}”`);

  if (query && withoutQuery.length > 0) {
    return t("list.noResults.bodyQueryAndFilters", {
      query,
      filters: withoutQuery.join(", "),
    });
  }
  if (query) return t("list.noResults.bodyQuery", { query });
  if (withoutQuery.length > 0) {
    return t("list.noResults.bodyFilters", { filters: withoutQuery.join(", ") });
  }
  return t("list.noResults.bodyGeneric");
}

/**
 * Filter controls, rendered by the shared toolbar. Status is a 3-segment
 * control rather than a dropdown: three options, all worth seeing at once.
 */
function StaffFilters({
  status,
  hasBalance,
  hasJars,
  setParams,
}: {
  status: StaffStatusFilter;
  hasBalance: boolean;
  hasJars: boolean;
  setParams: (patch: Record<string, string | undefined>) => void;
}) {
  const t = useTranslations("staff");

  return (
    <>
      <div>
        <span className="mb-1.5 block text-caption font-medium text-muted-foreground">
          {t("filters.statusLabel")}
        </span>
        <div className="inline-flex overflow-hidden rounded-md border border-border">
          {STAFF_STATUSES.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() =>
                setParams({
                  [STAFF_FILTERS.status]:
                    option === DEFAULT_STAFF_STATUS ? undefined : option,
                })
              }
              aria-pressed={status === option}
              className={cn(
                "h-9 px-3 text-sm transition-colors duration-100",
                "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                status === option
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {t(`filters.status.${option}`)}
            </button>
          ))}
        </div>
      </div>

      <FilterToggle
        id="filter-has-balance"
        label={t("filters.hasBalance")}
        checked={hasBalance}
        onCheckedChange={(next) =>
          setParams({ [STAFF_FILTERS.hasBalance]: next ? "1" : undefined })
        }
      />

      <FilterToggle
        id="filter-has-jars"
        label={t("filters.hasJars")}
        checked={hasJars}
        onCheckedChange={(next) =>
          setParams({ [STAFF_FILTERS.hasJars]: next ? "1" : undefined })
        }
      />
    </>
  );
}

function FilterToggle({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-11 items-center gap-2">
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      <Label htmlFor={id} className="mb-0 cursor-pointer">
        {label}
      </Label>
    </div>
  );
}
