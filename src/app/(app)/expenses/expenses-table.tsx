"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import {
  Download,
  Eye,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Receipt,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  DataTable,
  useTableParams,
  type DataTableColumn,
  type QuickChip,
} from "@/components/data-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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
import { Money } from "@/components/common/money";
import { DateInput } from "@/components/form";
import { api } from "@/lib/api/client";
import { formatDate, formatDateRelative, todayIST } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/config";
import type { ListResult } from "@/lib/table/types";
import { expensePaymentModeSchema } from "@/lib/validation/expense";
import {
  expensePaths,
  expenseRoutes,
  type ExpenseCategoryChipDto,
  type ExpenseListItemDto,
  type ExpenseTotalsDto,
} from "@/lib/dto/expense.dto";
import { categoryDotColour } from "./expense-category-colour";
import { monthAsDate, previousMonth, recentMonths } from "./expense-months";
import type { ExpenseSelectOption } from "./expense-form-model";

/**
 * The cash-out register. Spec: design/MODULES/07-expenses.md §3
 *
 * Talks to the API only — no service, no repository, no database import.
 * See .claude/ARCHITECTURE.md §4
 *
 * Every `sortKey` below is a key of `expenseTableConfig.sortable`. It travels as
 * a URL parameter and is used by the server ONLY as a lookup key into that
 * allowlist, never as a SQL fragment. See .claude/ARCHITECTURE.md §6.2
 *
 * `CATEGORY` is drawn as sortable in the design but is NOT offered here:
 * sorting by category name needs a join to `expense_categories`, and a
 * repository queries its own table only. Sorting by `category_id` would order
 * by a random uuid, which is worse than not offering it — so the chip band
 * above the table does that job instead.
 */
const ANY = "__any__";

/**
 * The payment modes, taken from the SCHEMA rather than from the entity enum.
 *
 * `entities/enums.ts` has no imports at all and would be safe to read here, but
 * `check-layering.mjs` bans every value import of `lib/db/**` from the frontend
 * — correctly, since the exception is impossible to police one file at a time.
 * Reading `.options` off the zod enum that already validates this field is
 * better than a second hand-written list: the dropdown and the validator cannot
 * disagree about what a payment mode is.
 */
const PAYMENT_MODES = expensePaymentModeSchema.options;

export function ExpensesTable({
  result,
  totals,
  categories,
  staffOptions,
  month,
  totalRecorded,
}: {
  result: ListResult<ExpenseListItemDto>;
  totals: ExpenseTotalsDto;
  categories: ExpenseCategoryChipDto[];
  /** Fetched server-side so a bookmarked `?staff=` filter shows a NAME. */
  staffOptions: ExpenseSelectOption[];
  /** `YYYY-MM`, resolved by the server — never guessed in the browser. */
  month: string;
  /**
   * Every expense ever recorded. `DataTable` only sees URL params, so without
   * this a freshly-opened list would show "no expenses yet" when it means
   * "none THIS month". See .claude/MODULE-RECIPE.md §7
   */
  totalRecorded: number;
}) {
  const t = useTranslations("expenses");
  const locale = useLocale() as Locale;
  const format = useFormatter();
  const { get, setParams, clearAll } = useTableParams();

  const monthLabel = (value: string) =>
    format.dateTime(monthAsDate(value), {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });

  const activeCategory = get("category");

  const columns: DataTableColumn<ExpenseListItemDto>[] = [
    {
      id: "code",
      header: t("columns.code"),
      sortKey: "code",
      width: "130px",
      cell: (e) => (
        <span className="font-mono text-[13px] font-medium text-primary">
          {e.code}
        </span>
      ),
    },
    {
      id: "expenseDate",
      header: t("columns.date"),
      sortKey: "expenseDate",
      width: "110px",
      // `Today` / `Yesterday` for the two days most rows come from — read
      // faster than a date that has to be compared with today's.
      cell: (e) => (
        <span className="text-sm text-foreground">
          {formatDateRelative(e.expenseDate, locale, {
            today: t("dates.today"),
            yesterday: t("dates.yesterday"),
          })}
        </span>
      ),
    },
    {
      id: "category",
      header: t("columns.category"),
      // Flexible with a 170px minimum, not a fixed 170px: `પ્લાન્ટ
      // મેઇન્ટેનન્સ` overflows the fixed width the design first drew. §checklist
      width: "min-content",
      cell: (e) => (
        <span className="flex min-w-42 items-center gap-2">
          <CategoryDot categoryId={e.categoryId} />
          <span className="truncate text-sm text-foreground">
            {e.categoryName}
          </span>
        </span>
      ),
    },
    {
      id: "paidTo",
      header: t("columns.paidTo"),
      cell: (e) =>
        e.paidTo ? (
          // Any script, at line-height 1.6 — `રમેશ પટેલ` loses its matras when
          // squeezed. §checklist
          <span className="block min-w-45 truncate text-sm leading-relaxed text-foreground">
            {e.paidTo}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      id: "amount",
      header: t("columns.amount"),
      sortKey: "amount",
      align: "right",
      width: "130px",
      cell: (e) => <Money value={e.amount} zeroAs="value" />,
    },
    {
      id: "paymentMode",
      header: t("columns.mode"),
      width: "110px",
      hideOnMobile: true,
      cell: (e) => (
        <span className="text-sm text-muted-foreground">
          {t(`paymentModes.${e.paymentMode}`)}
        </span>
      ),
    },
    {
      id: "attachment",
      header: t("columns.attachment"),
      align: "center",
      width: "60px",
      cell: (e) => <ReceiptCell expense={e} />,
    },
    {
      id: "actions",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      align: "center",
      width: "56px",
      cell: (e) => <ExpenseActions expense={e} />,
    },
  ];

  /**
   * The category band. `All` clears the parameter rather than setting a value,
   * because an absent category already MEANS all — otherwise the chip would
   * look off on a freshly-opened list showing exactly what it describes.
   *
   * Every category gets a chip and the row wraps. The design puts a `+6 more`
   * popover after the fifth; `DataTableToolbar` renders `quickChips` flat and
   * is shared by nine modules, so that is reported rather than patched here.
   */
  const quickChips: QuickChip[] = [
    { id: "all", label: t("chips.all"), params: { category: undefined } },
    ...categories.map((category) => ({
      id: category.id,
      label: category.name,
      params: { category: category.id },
    })),
  ];

  const activeCategoryName = categories.find((c) => c.id === activeCategory)?.name;

  return (
    <>
      <DataTable
        columns={columns}
        result={result}
        rowKey={(e) => e.id}
        rowHref={(e) => expensePaths.detail(e.id)}
        searchPlaceholder={t("searchPlaceholder")}
        quickChips={quickChips}
        toolbarActions={
          <MonthSelect
            month={month}
            label={monthLabel}
            onChange={(next) => setParams({ month: next, from: undefined, to: undefined })}
          />
        }
        filters={
          <ExpenseFilters categories={categories} staffOptions={staffOptions} />
        }
        emptyState={
          totalRecorded === 0 ? (
            <EmptyState
              icon={Receipt}
              title={t("empty.noData.title")}
              description={t("empty.noData.body")}
              action={
                <Button asChild>
                  <Link href={expensePaths.new}>{t("empty.noData.action")}</Link>
                </Button>
              }
            />
          ) : (
            /* Plenty exists — just not in this month. Different sentence,
               different CTA, and a shortcut to the month before. §3.4 */
            <EmptyState
              icon={Receipt}
              title={t("empty.noMonth.title", { month: monthLabel(month) })}
              description={t("empty.noMonth.body")}
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button variant="secondary" asChild>
                    <Link href={expensePaths.month(previousMonth(month))}>
                      {t("empty.noMonth.viewPrevious", {
                        month: monthLabel(previousMonth(month)),
                      })}
                    </Link>
                  </Button>
                  <Button asChild>
                    <Link href={expensePaths.new}>{t("empty.noData.action")}</Link>
                  </Button>
                </div>
              }
            />
          )
        }
        noResultsState={
          <EmptyState
            variant="no-results"
            title={t("empty.noResults.title")}
            description={t("empty.noResults.body")}
            onClearFilters={clearAll}
          />
        }
        mobileCard={(e) => (
          <ExpenseCard expense={e} modeLabel={t(`paymentModes.${e.paymentMode}`)} />
        )}
      />

      {/*
        The foot row. It sits BELOW the table card rather than above the pager,
        because `DataTable` has no footer slot and is shared by nine modules —
        reported as a kernel gap rather than patched here.

        It states what it is totalling. A filtered list showing an unfiltered
        sum is the fastest way to teach an owner to distrust every figure on
        the page. §3.3
      */}
      {result.rows.length > 0 && (
        <div className="mt-3 flex h-12 items-center justify-between gap-4 rounded-lg border border-border bg-muted px-4">
          <span className="truncate text-sm font-semibold text-foreground">
            {activeCategoryName
              ? t("total.filtered", {
                  category: activeCategoryName,
                  month: monthLabel(month),
                })
              : totals.filtered
                ? t("total.filteredGeneric", { month: monthLabel(month) })
                : t("total.month", { month: monthLabel(month) })}
          </span>
          <Money value={totals.total} emphasis zeroAs="value" className="text-base" />
        </div>
      )}
    </>
  );
}

/** 8px dot, raw hex — see `expense-category-colour.ts` for why it is derived. */
function CategoryDot({ categoryId }: { categoryId: string }) {
  return (
    <span
      aria-hidden
      className="size-2 shrink-0 rounded-full"
      style={{ backgroundColor: categoryDotColour(categoryId) }}
    />
  );
}

/**
 * Present → a `Paperclip` in a 44px target. Absent → an em dash.
 *
 * **Never blank.** An empty cell reads as "not loaded", which is a different
 * and much more alarming statement than "no receipt". §3.3
 *
 * The link opens the file itself; the row underneath must not navigate with it,
 * hence `stopPropagation`.
 */
function ReceiptCell({ expense }: { expense: ExpenseListItemDto }) {
  const t = useTranslations("expenses");

  if (!expense.hasReceipt || !expense.receiptUrl) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  return (
    <a
      href={expense.receiptUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      title={t("viewReceipt")}
      aria-label={t("viewReceiptFor", { code: expense.code })}
      className="inline-flex size-11 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <Paperclip className="size-4" aria-hidden />
    </a>
  );
}

/** Below `md` each row becomes a card, amount largest. §3.7 */
function ExpenseCard({
  expense,
  modeLabel,
}: {
  expense: ExpenseListItemDto;
  modeLabel: string;
}) {
  const locale = useLocale() as Locale;
  const t = useTranslations("expenses");

  return (
    <div className="space-y-1">
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-[13px] font-medium text-primary">
          {expense.code}
        </span>
        <span className="flex items-center gap-2">
          <CategoryDot categoryId={expense.categoryId} />
          <span className="text-sm text-foreground">{expense.categoryName}</span>
          {expense.hasReceipt && (
            <Paperclip className="size-4 text-muted-foreground" aria-hidden />
          )}
        </span>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">
        {expense.paidTo ?? "—"} ·{" "}
        {formatDateRelative(expense.expenseDate, locale, {
          today: t("dates.today"),
          yesterday: t("dates.yesterday"),
        })}
      </p>

      <div className="flex items-baseline justify-between gap-3 pt-1">
        <span className="text-sm text-muted-foreground">{modeLabel}</span>
        <Money value={expense.amount} emphasis zeroAs="value" className="text-base" />
      </div>
    </div>
  );
}

/**
 * The `⋯` menu. Used by the row AND by the detail header, so the two can never
 * offer different actions. Always visible, not hover-only — hover-only actions
 * are undiscoverable and impossible on touch. DESIGN-STANDARDS §5.2
 */
export function ExpenseActions({
  expense,
  align = "end",
}: {
  expense: Pick<
    ExpenseListItemDto,
    "id" | "code" | "amount" | "paidTo" | "expenseDate" | "receiptUrl" | "hasReceipt"
  >;
  align?: "start" | "end";
}) {
  const t = useTranslations("expenses");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [, startTransition] = useTransition();

  async function restore() {
    try {
      await api.post(expenseRoutes.restore(expense.id));
      startTransition(() => router.refresh());
      toast.success(t("toast.restored", { code: expense.code }));
    } catch {
      toast.error(t("toast.actionFailed"));
    }
  }

  async function remove() {
    try {
      await api.del(expenseRoutes.byId(expense.id));
      startTransition(() => router.refresh());
      toast.success(
        t("toast.deleted", {
          code: expense.code,
          amount: formatINR(expense.amount),
        }),
        {
          // 8s for Undo — long enough to notice the row leave the month.
          duration: 8000,
          action: { label: t("toast.undo"), onClick: () => void restore() },
        },
      );
    } catch {
      toast.error(t("toast.actionFailed"));
    }
  }

  return (
    // The row itself navigates; this cell must not.
    <span onClick={(event) => event.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("rowActions.menu", { code: expense.code })}
          >
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align={align}>
          <DropdownMenuItem asChild>
            <Link href={expensePaths.detail(expense.id)}>
              <Eye aria-hidden />
              {t("rowActions.view")}
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link href={expensePaths.edit(expense.id)}>
              <Pencil aria-hidden />
              {t("rowActions.edit")}
            </Link>
          </DropdownMenuItem>

          {expense.hasReceipt && expense.receiptUrl && (
            <DropdownMenuItem asChild>
              <a
                href={expense.receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                download
              >
                <Download aria-hidden />
                {t("rowActions.downloadReceipt")}
              </a>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem destructive onSelect={() => setConfirming(true)}>
            <Trash2 aria-hidden />
            {t("rowActions.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("delete.title", { code: expense.code })}
        // Names the amount, the payee and the date, and says the record
        // survives — so a mis-clicked row is still catchable here. §3.4
        description={t("delete.body", {
          amount: formatINR(expense.amount),
          paidTo: expense.paidTo ?? t("noPayee"),
          date: formatDate(expense.expenseDate, locale),
        })}
        confirmLabel={t("delete.confirm")}
        onConfirm={remove}
      />
    </span>
  );
}

/** `Restore` on a deleted expense's detail page. §5.4 */
export function ExpenseRestoreButton({
  expenseId,
  code,
}: {
  expenseId: string;
  code: string;
}) {
  const t = useTranslations("expenses");
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function restore() {
    setBusy(true);
    try {
      await api.post(expenseRoutes.restore(expenseId));
      router.refresh();
      toast.success(t("toast.restored", { code }));
    } catch {
      toast.error(t("toast.actionFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="secondary" loading={busy} onClick={() => void restore()}>
      <RotateCcw aria-hidden />
      {t("detail.restore")}
    </Button>
  );
}

/**
 * The month is the frame the whole page hangs off, so it sits in the toolbar
 * beside the search box rather than inside the filter popover — and it is
 * written to the URL, so back works and the view is shareable. §3.6
 */
function MonthSelect({
  month,
  label,
  onChange,
}: {
  month: string;
  label: (month: string) => string;
  onChange: (month: string) => void;
}) {
  const t = useTranslations("expenses");
  // The window is anchored on the CURRENT month, and the selected one is
  // folded in if a bookmark reaches further back than 24 months.
  const options = recentMonths(todayIST().slice(0, 7), 24, month);

  return (
    <Select value={month} onValueChange={onChange}>
      <SelectTrigger className="w-37" aria-label={t("filters.month")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((value) => (
          <SelectItem key={value} value={value}>
            {label(value)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** The filter popover. Spec §3.4 */
function ExpenseFilters({
  categories,
  staffOptions,
}: {
  categories: ExpenseCategoryChipDto[];
  staffOptions: ExpenseSelectOption[];
}) {
  const t = useTranslations("expenses.filters");
  // The mode labels are the SAME strings the table column renders. One set of
  // keys, so `Bank transfer` can never be worded differently in the filter.
  const tMode = useTranslations("expenses.paymentModes");
  const { get, setParams } = useTableParams();

  return (
    <>
      <SelectFilter
        label={t("category")}
        anyLabel={t("anyCategory")}
        value={get("category")}
        options={categories.map((c) => ({ id: c.id, label: c.name }))}
        onChange={(value) => setParams({ category: value })}
      />

      <SelectFilter
        label={t("mode")}
        anyLabel={t("anyMode")}
        value={get("mode")}
        options={PAYMENT_MODES.map((mode) => ({
          id: mode,
          label: tMode(mode),
        }))}
        onChange={(value) => setParams({ mode: value })}
      />

      <SelectFilter
        label={t("staff")}
        anyLabel={t("anyStaff")}
        value={get("staff")}
        options={staffOptions.map((s) => ({ id: s.id, label: s.label }))}
        onChange={(value) => setParams({ staff: value })}
      />

      <SelectFilter
        label={t("receipt")}
        anyLabel={t("receiptAny")}
        value={get("receipt")}
        options={[
          { id: "with", label: t("receiptWith") },
          { id: "without", label: t("receiptWithout") },
        ]}
        onChange={(value) => setParams({ receipt: value })}
      />

      {/* An explicit range overrides the month for the ROWS. The KPI strip
          keeps describing the whole month, or it would be comparing a
          fortnight against a month and calling the difference a trend. */}
      <div className="flex flex-col gap-1">
        <span className="text-caption font-medium text-muted-foreground">
          {t("dateRange")}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <DateInput
            value={get("from") ?? ""}
            max={todayIST()}
            onValueChange={(value) => setParams({ from: value })}
            className="w-40"
          />
          <span aria-hidden className="text-sm text-muted-foreground">
            –
          </span>
          <DateInput
            value={get("to") ?? ""}
            max={todayIST()}
            onValueChange={(value) => setParams({ to: value })}
            className="w-40"
          />
        </div>
      </div>

      <AmountRange
        label={t("amountRange")}
        minLabel={t("amountMin")}
        maxLabel={t("amountMax")}
        min={get("minAmount")}
        max={get("maxAmount")}
        onChange={(patch) => setParams(patch)}
      />
    </>
  );
}

function SelectFilter({
  label,
  anyLabel,
  value,
  options,
  onChange,
}: {
  label: string;
  anyLabel: string;
  value: string | undefined;
  options: { id: string; label: string }[];
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
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

/**
 * Committed on BLUR, not per keystroke: refiltering the whole page while
 * someone is halfway through typing `4850` would fire on `4`, `48` and `485`.
 */
function AmountRange({
  label,
  minLabel,
  maxLabel,
  min,
  max,
  onChange,
}: {
  label: string;
  minLabel: string;
  maxLabel: string;
  min: string | undefined;
  max: string | undefined;
  onChange: (patch: { minAmount?: string; maxAmount?: string }) => void;
}) {
  const [values, setValues] = useState({ min: min ?? "", max: max ?? "" });

  return (
    <div className="flex flex-col gap-1">
      <span className="text-caption font-medium text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <Input
          figure
          inputMode="decimal"
          className="w-28"
          aria-label={minLabel}
          placeholder={minLabel}
          value={values.min}
          onChange={(e) => setValues((v) => ({ ...v, min: e.target.value }))}
          onBlur={() => onChange({ minAmount: values.min.trim() || undefined })}
        />
        <span aria-hidden className="text-sm text-muted-foreground">
          –
        </span>
        <Input
          figure
          inputMode="decimal"
          className="w-28"
          aria-label={maxLabel}
          placeholder={maxLabel}
          value={values.max}
          onChange={(e) => setValues((v) => ({ ...v, max: e.target.value }))}
          onBlur={() => onChange({ maxAmount: values.max.trim() || undefined })}
        />
      </div>
    </div>
  );
}

/**
 * The list failed to load.
 *
 * A client component because `Try again` re-runs the server render, and a
 * server component cannot hand a callback across the boundary.
 */
export function ExpensesLoadError({ className }: { className?: string }) {
  const t = useTranslations("expenses.error");
  const router = useRouter();

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card shadow-sm",
        className,
      )}
    >
      <ErrorState
        title={t("listTitle")}
        description={t("listBody")}
        onRetry={() => router.refresh()}
      />
    </div>
  );
}
