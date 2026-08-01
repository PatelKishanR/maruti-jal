"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertCircle,
  Ban,
  ChevronDown,
  Droplet,
  Loader2,
  Plus,
  Repeat,
  Sunrise,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DataTableColumnHeader,
  DataTablePagination,
  DataTableToolbar,
  useTableParams,
} from "@/components/data-table";
import { EmptyState } from "@/components/common/empty-state";
import { Litres, Money } from "@/components/common/money";
import { DateInput, EntityCombobox } from "@/components/form";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api/client";
import { apiRoutes } from "@/lib/api/routes";
import { directSalePaths, directSaleRoutes } from "@/lib/api/routes.direct-sale";
import { formatDate, formatTime } from "@/lib/dates";
import { formatINR, formatRupeesPlain, parseRupees } from "@/lib/money";
import { TABLE_PARAMS, type ListResult } from "@/lib/table/types";
import {
  DEFAULT_DIRECT_SALE_RANGE,
  DIRECT_SALE_FILTERS,
  DIRECT_SALE_GROUPED_SORTS,
  DIRECT_SALE_RANGES,
  directSaleTableConfig,
  type DirectSaleRange,
  type DirectSaleSortKey,
} from "@/lib/table/configs/direct-sale";
import { createDirectSaleSchema } from "@/lib/validation/direct-sale";
import type { Locale } from "@/i18n/config";
import type {
  DirectSaleDayGroupDto,
  DirectSaleDto,
  DirectSaleListItemDto,
  DirectSaleStatsDto,
} from "@/lib/dto/direct-sale.dto";
import { DirectSaleActions } from "./direct-sale-actions";

/**
 * Walk-in list + the inline entry row. Spec: design/MODULES/06-direct-sales.md
 * §3 and §4
 *
 * This is not the shared `DataTable`: the screen needs three things that table
 * deliberately does not have — a live create row pinned under the header,
 * day-group bands carrying a running cash tally, and optimistic rows that exist
 * before the server has seen them. It reuses the shared toolbar, pagination,
 * sort header and table primitives, so the metrics still come from one place.
 *
 * **The whole design is subordinate to entry speed**: name, Enter, amount,
 * Enter. Two keystrokes of navigation, no Tab, no mouse, and the row is on
 * screen before the request leaves the browser.
 */

/** A sale typed into the entry row that the server has not confirmed yet. */
interface PendingSale {
  tempId: string;
  row: DirectSaleListItemDto;
  /** Exactly what was typed, so a failure never costs a retype. */
  draft: Draft;
  status: "saving" | "saved" | "failed";
}

interface Draft {
  customerName: string;
  amount: string;
  phone: string;
  address: string;
  productId: string | null;
  productTitle: string | null;
  litres: string;
  saleDate: string;
  note: string;
}

const emptyDraft = (saleDate: string): Draft => ({
  customerName: "",
  amount: "",
  phone: "",
  address: "",
  productId: null,
  productTitle: null,
  litres: "",
  saleDate,
  note: "",
});

function isBlankDraft(draft: Draft): boolean {
  return (
    draft.customerName.trim() === "" &&
    draft.amount.trim() === "" &&
    draft.phone.trim() === "" &&
    draft.address.trim() === "" &&
    draft.litres.trim() === "" &&
    draft.note.trim() === "" &&
    draft.productId === null
  );
}

/** Which fields the details band holds — used to reopen it after a failure. */
function hasDetails(draft: Draft): boolean {
  return (
    draft.phone.trim() !== "" ||
    draft.address.trim() !== "" ||
    draft.litres.trim() !== "" ||
    draft.note.trim() !== "" ||
    draft.productId !== null
  );
}

const COLUMN_COUNT = 8;

export function DirectSalesTable({
  result,
  stats,
  dayGroups,
}: {
  result: ListResult<DirectSaleListItemDto>;
  stats: DirectSaleStatsDto;
  dayGroups: DirectSaleDayGroupDto[];
}) {
  const t = useTranslations("directSales");
  const tRoot = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { get, setParams, clearAll, isPending } = useTableParams();
  const [, startTransition] = useTransition();

  const sortKey = get(TABLE_PARAMS.sort) ?? directSaleTableConfig.defaultSort.key;
  /**
   * A per-day tally is meaningless once rows are reordered ACROSS days, so
   * sorting by amount or customer drops the bands and shows the date on each
   * row instead. §3.6
   */
  const grouped = DIRECT_SALE_GROUPED_SORTS.includes(sortKey as DirectSaleSortKey);

  const range = (get(DIRECT_SALE_FILTERS.range) ??
    DEFAULT_DIRECT_SALE_RANGE) as DirectSaleRange;
  const query = get(TABLE_PARAMS.q) ?? "";

  /* ── the entry row ────────────────────────────────────────────────── */

  const [draft, setDraftState] = useState<Draft>(() => emptyDraft(stats.today));
  const draftRef = useRef(draft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState(false);
  const [entryFocused, setEntryFocused] = useState(false);
  const [pending, setPending] = useState<PendingSale[]>([]);
  const [flashId, setFlashId] = useState<string | null>(null);
  const announced = useRef(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  /** Every mutation goes through here, so `draftRef` is never a frame behind. */
  const updateDraft = useCallback((patch: Partial<Draft>) => {
    setDraftState((current) => {
      const next = { ...current, ...patch };
      draftRef.current = next;
      return next;
    });
  }, []);

  const resolve = useCallback(
    (key: string) => (tRoot.has(key) ? tRoot(key) : key),
    [tRoot],
  );

  /** A field in error re-validates on every keystroke. §4.6 */
  const clearError = useCallback((field: string) => {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }, []);

  /**
   * Focus lands in the name field on mount and after every successful save.
   * The one field that is always the next thing to type. §4.6
   */
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  /** `N` from anywhere outside a field returns to the entry row. §3.6 */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "n" && event.key !== "N") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.tagName === "SELECT" ||
          active.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      nameRef.current?.focus();
      nameRef.current?.scrollIntoView({ block: "center" });
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  /** Once the server's copy of a saved row lands, drop the optimistic one. */
  useEffect(() => {
    setPending((previous) => {
      const next = previous.filter(
        (entry) =>
          !(
            entry.status === "saved" &&
            result.rows.some((row) => row.id === entry.row.id)
          ),
      );
      return next.length === previous.length ? previous : next;
    });
  }, [result.rows]);

  function flash(id: string) {
    setFlashId(id);
    // One paint at the flash colour, then the class comes off and the 600ms
    // colour transition runs. §3.5 — the row itself never animates.
    window.setTimeout(
      () => setFlashId((current) => (current === id ? null : current)),
      80,
    );
  }

  function focusFirstInvalid(fieldErrors: Record<string, string>) {
    if (fieldErrors.customerName) return nameRef.current?.select();
    if (fieldErrors.amount) return amountRef.current?.select();
    if (fieldErrors.phone || fieldErrors.litres || fieldErrors.address) {
      setExpanded(true);
      window.setTimeout(() => phoneRef.current?.focus(), 0);
    }
  }

  async function save(tempId: string, input: unknown, restore: Draft) {
    try {
      const saved = await api.post<DirectSaleDto>(directSaleRoutes.create, input);

      setPending((previous) =>
        previous.map((entry) =>
          entry.tempId === tempId
            ? {
                ...entry,
                status: "saved",
                row: {
                  ...saved,
                  visitCount: entry.row.visitCount,
                  canEdit: saved.saleDate === stats.today,
                },
              }
            : entry,
        ),
      );
      flash(saved.id);

      // Only on the first sale of a session: a toast per walk-in would be
      // three toasts deep by the time the third customer is served. §3.5
      if (!announced.current) {
        announced.current = true;
        toast.success(
          t("toasts.recorded", {
            amount: formatINR(saved.amount),
            name: saved.customerName,
          }),
        );
      }

      // Re-reads the page, which recomputes the day band and the KPI cards
      // from SQL rather than nudging them in the browser.
      startTransition(() => router.refresh());
    } catch (error) {
      const detail =
        error instanceof ApiError ? resolve(error.messageKey) : undefined;

      /**
       * Nothing typed is ever lost, in either direction: if the entry row is
       * still empty the values go straight back into it and the optimistic row
       * is withdrawn; if the next customer is already being typed, the failed
       * row keeps them instead and offers Retry / Discard. §4.5
       */
      if (isBlankDraft(draftRef.current)) {
        setPending((previous) => previous.filter((e) => e.tempId !== tempId));
        updateDraft(restore);
        if (hasDetails(restore)) setExpanded(true);
        nameRef.current?.focus();
      } else {
        setPending((previous) =>
          previous.map((e) =>
            e.tempId === tempId ? { ...e, status: "failed" } : e,
          ),
        );
      }

      toast.error(t("entry.saveFailed"), { description: detail });
    }
  }

  /**
   * `replaceTempId` marks a RETRY of a failed row: the same values go back to
   * the server, and the entry row is left completely alone — the owner is
   * probably mid-name for the next customer, and clearing it to re-send an old
   * sale would be the module's worst possible bug.
   */
  function submit(source: Draft = draftRef.current, replaceTempId?: string) {
    const isRetry = replaceTempId !== undefined;
    const parsed = createDirectSaleSchema.safeParse({
      customerName: source.customerName,
      amount: source.amount,
      saleDate: source.saleDate,
      phone: source.phone,
      address: source.address,
      productId: source.productId,
      litres: source.litres,
      note: source.note,
    });

    if (!parsed.success) {
      // Validation runs on SUBMIT only — never while typing, never on blur.
      // Blurring the name field to reach the amount field is the normal path
      // and must not throw an error at the owner. §4.6
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const mapped: Record<string, string> = {};
      for (const [field, keys] of Object.entries(fieldErrors)) {
        if (keys?.[0]) mapped[field] = resolve(keys[0]);
      }
      // A retry re-sends values that already passed once; flagging the entry
      // row for them would point at the wrong fields.
      if (!isRetry) {
        setErrors(mapped);
        focusFirstInvalid(mapped);
      }
      return;
    }

    const input = parsed.data;
    const tempId = `pending-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    const optimistic: DirectSaleListItemDto = {
      id: tempId,
      code: "",
      saleDate: input.saleDate,
      soldAt: now,
      customerName: input.customerName,
      phone: input.phone,
      address: input.address,
      amount: input.amount,
      litres: input.litres,
      productId: input.productId,
      productTitle: source.productTitle,
      mode: "CASH",
      isVoided: false,
      voidReason: null,
      note: input.note,
      createdAt: now,
      updatedAt: now,
      visitCount: 1,
      canEdit: input.saleDate === stats.today,
    };

    setPending((previous) => [
      { tempId, row: optimistic, draft: source, status: "saving" },
      ...(replaceTempId
        ? previous.filter((e) => e.tempId !== replaceTempId)
        : previous),
    ]);

    /**
     * The row is inserted and the entry row is cleared and refocused in the
     * SAME frame, so the next customer can be typed while the first is still
     * in flight. `Add sale` never disables and never spins — blocking it would
     * defeat the entire design. §4.5
     */
    if (!isRetry) {
      const backdated = source.saleDate !== stats.today;
      updateDraft(emptyDraft(source.saleDate));
      setErrors({});
      // The band collapses on save unless the date was changed, because the
      // next customer probably needs two fields, not eight. §4.5
      if (!backdated) setExpanded(false);
      nameRef.current?.focus();
    }

    void save(tempId, input, source);
  }

  /** Escape clears the row. No confirm — nothing is saved yet. §4.6 */
  function clearEntry() {
    updateDraft(emptyDraft(stats.today));
    setErrors({});
    setExpanded(false);
    nameRef.current?.focus();
  }

  function onEntryKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
      return;
    }
    if ((event.key === "d" || event.key === "D") && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      toggleDetails();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      clearEntry();
    }
  }

  function toggleDetails() {
    setExpanded((open) => {
      const next = !open;
      window.setTimeout(
        () => (next ? phoneRef.current : amountRef.current)?.focus(),
        0,
      );
      return next;
    });
  }

  /* ── rows ─────────────────────────────────────────────────────────── */

  const pendingRows = useMemo(
    () =>
      pending.filter(
        (entry) => !result.rows.some((row) => row.id === entry.row.id),
      ),
    [pending, result.rows],
  );

  const groups = useMemo(
    () =>
      buildGroups(
        result.rows,
        pendingRows.map((entry) => entry.row),
        grouped,
      ),
    [result.rows, pendingRows, grouped],
  );

  /**
   * A row the server has not confirmed yet: a spinner instead of a code, no
   * navigation, no `⋯`. A row that HAS been confirmed but whose refresh has
   * not landed is a real sale and behaves like one.
   */
  const provisional = useCallback(
    (id: string) => {
      const entry = pending.find((e) => e.row.id === id);
      return entry && entry.status !== "saved" ? entry : undefined;
    },
    [pending],
  );

  const bandFor = useCallback(
    (date: string) =>
      dayGroups.find((group) => group.date === date) ?? {
        date,
        count: 0,
        voidedCount: 0,
        total: 0,
      },
    [dayGroups],
  );

  /**
   * Which of the three empty states is the true one.
   *
   * `all` and `today` are not "filters" for this purpose: they are the two
   * views that mean "everything" and "the default", and telling the owner
   * their filters are too tight when they asked for everything is the classic
   * version of this bug. §3.5
   */
  const filtersActive =
    query.length > 0 ||
    (range !== "today" && range !== "all") ||
    [
      DIRECT_SALE_FILTERS.from,
      DIRECT_SALE_FILTERS.to,
      DIRECT_SALE_FILTERS.minAmount,
      DIRECT_SALE_FILTERS.maxAmount,
      DIRECT_SALE_FILTERS.voided,
      DIRECT_SALE_FILTERS.productId,
    ].some((key) => !!get(key));

  const isEmpty = groups.length === 0;

  /* ── render ───────────────────────────────────────────────────────── */

  const columnHeaders = (
    <TableRow>
      <TableHead style={{ width: "116px" }}>
        <DataTableColumnHeader sortKey="code">
          {t("columns.code")}
        </DataTableColumnHeader>
      </TableHead>
      <TableHead style={{ width: grouped ? "96px" : "124px" }}>
        {/* The date lives in the group band, so the cell shows only the time —
            but the sort behind it is still the business date, with `sale_no`
            ordering the sales within a day. §3.3 */}
        <DataTableColumnHeader sortKey="saleDate">
          {grouped ? t("columns.time") : t("columns.date")}
        </DataTableColumnHeader>
      </TableHead>
      <TableHead>
        <DataTableColumnHeader sortKey="customerName">
          {t("columns.customer")}
        </DataTableColumnHeader>
      </TableHead>
      <TableHead style={{ width: "140px" }} className="hidden lg:table-cell">
        {t("columns.phone")}
      </TableHead>
      <TableHead style={{ width: "100px" }}>
        <DataTableColumnHeader align="right">
          {t("columns.litres")}
        </DataTableColumnHeader>
      </TableHead>
      <TableHead style={{ width: "140px" }}>
        <DataTableColumnHeader sortKey="amount" align="right">
          {t("columns.amount")}
        </DataTableColumnHeader>
      </TableHead>
      <TableHead style={{ width: "96px" }}>
        <span className="sr-only">{t("columns.status")}</span>
      </TableHead>
      <TableHead style={{ width: "56px" }}>
        <span className="sr-only">{t("columns.actions")}</span>
      </TableHead>
    </TableRow>
  );

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <DataTableToolbar
        searchPlaceholder={t("list.searchPlaceholder")}
        filters={<Filters get={get} setParams={setParams} />}
      />

      {/* The primary navigation of this screen — the owner lives on Today. §3.3 */}
      <div className="flex min-h-11 flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        {DIRECT_SALE_RANGES.map((option) => (
          <button
            key={option}
            type="button"
            disabled={isPending}
            aria-pressed={range === option}
            onClick={() =>
              setParams({
                [DIRECT_SALE_FILTERS.range]:
                  option === DEFAULT_DIRECT_SALE_RANGE ? undefined : option,
                // A preset and a hand-typed range are two answers to the same
                // question; picking a chip clears the other one.
                [DIRECT_SALE_FILTERS.from]: undefined,
                [DIRECT_SALE_FILTERS.to]: undefined,
              })
            }
            className={cn(
              "h-7 rounded-full px-2.5 text-[13px] transition-colors duration-100",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              range === option
                ? "border border-primary bg-[var(--badge-primary-bg)] text-[var(--badge-primary-fg)]"
                : "border border-transparent bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`chips.${option}`)}
          </button>
        ))}
      </div>

      <div className="relative">
        {isPending && (
          <div
            className="absolute inset-x-0 top-0 z-30 h-0.5 overflow-hidden bg-primary/20"
            aria-hidden
          >
            <div className="h-full w-1/3 animate-[indeterminate_1.2s_ease-in-out_infinite] bg-primary" />
          </div>
        )}

        <Table containerClassName="max-h-[calc(100dvh-18rem)]">
          <TableHeader className="z-20">{columnHeaders}</TableHeader>

          <TableBody>
            {/* ── the entry row ──────────────────────────────────────────
                56px, one step darker than the rows below so it reads as a
                control strip rather than data, sticky under the column
                header, and live before any data has loaded. §4.3 */}
            <TableRow
              onKeyDown={onEntryKeyDown}
              onFocusCapture={() => setEntryFocused(true)}
              onBlurCapture={() => setEntryFocused(false)}
              className="h-14 hover:bg-muted"
            >
              <TableCell
                className={cn(
                  "sticky top-11 z-10 border-l-primary bg-muted",
                  entryFocused ? "border-l-4" : "border-l-[3px]",
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded-full bg-[var(--badge-primary-bg)]">
                    <Plus
                      className="size-3 text-[var(--badge-primary-fg)]"
                      aria-hidden
                    />
                  </span>
                  <span className="text-caption font-semibold uppercase tracking-[0.04em] text-[var(--badge-primary-fg)]">
                    {draft.saleDate === stats.today
                      ? t("entry.new")
                      : formatDate(draft.saleDate, locale)}
                  </span>
                </span>
              </TableCell>

              {/* The server stamps the time; a live clock here would be noise. */}
              <TableCell className="sticky top-11 z-10 bg-muted" />

              <TableCell className="sticky top-11 z-10 bg-muted">
                <span className="relative block">
                  <Input
                    ref={nameRef}
                    inputSize="lg"
                    value={draft.customerName}
                    invalid={!!errors.customerName}
                    aria-label={t("entry.namePlaceholder")}
                    placeholder={t("entry.namePlaceholder")}
                    onChange={(e) => {
                      updateDraft({ customerName: e.target.value });
                      // Once a field is in error it re-validates on every
                      // keystroke, so the error clears the instant it is
                      // fixed. §4.6
                      clearError("customerName");
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" || e.metaKey || e.ctrlKey) return;
                      // Enter ADVANCES, it does not submit: a sale with no
                      // amount can only fail, and bouncing an error back costs
                      // more time than moving one field. §4.6
                      e.preventDefault();
                      amountRef.current?.focus();
                    }}
                  />
                  <FieldPopover message={errors.customerName} />
                </span>
              </TableCell>

              <TableCell className="sticky top-11 z-10 hidden bg-muted lg:table-cell" />
              <TableCell className="sticky top-11 z-10 bg-muted" />

              <TableCell className="sticky top-11 z-10 bg-muted">
                <span className="relative block">
                  <Input
                    ref={amountRef}
                    inputSize="lg"
                    figure
                    prefix="₹"
                    inputMode="decimal"
                    value={draft.amount}
                    invalid={!!errors.amount}
                    aria-label={t("entry.amountPlaceholder")}
                    placeholder={t("entry.amountPlaceholder")}
                    className="text-base font-semibold"
                    onChange={(e) => {
                      updateDraft({ amount: e.target.value });
                      clearError("amount");
                    }}
                    onBlur={() => {
                      // `120` becomes `120.00` on blur, `1250` becomes
                      // `1,250.00`. The ₹ prefix is decoration, so
                      // select-all-and-retype never fights it. §4.6
                      const value = parseRupees(draft.amount);
                      if (!Number.isNaN(value)) {
                        updateDraft({ amount: formatRupeesPlain(value) });
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" || e.metaKey || e.ctrlKey) return;
                      e.preventDefault();
                      submit();
                    }}
                  />
                  <FieldPopover message={errors.amount} align="right" />
                </span>
              </TableCell>

              <TableCell className="sticky top-11 z-10 bg-muted">
                {!expanded && (
                  <Button type="button" onClick={() => submit()}>
                    {t("entry.submit")}
                  </Button>
                )}
              </TableCell>

              <TableCell className="sticky top-11 z-10 bg-muted">
                <button
                  type="button"
                  onClick={toggleDetails}
                  aria-expanded={expanded}
                  aria-label={t("entry.addDetails")}
                  title={t("entry.detailsTooltip")}
                  className="flex size-10 items-center justify-center rounded-sm text-muted-foreground transition-colors duration-100 hover:bg-border hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <ChevronDown
                    className={cn(
                      "size-4 transition-transform duration-200",
                      expanded && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>
              </TableCell>
            </TableRow>

            {/* Backdating notice — 32px, directly under the row. §4.3 */}
            {draft.saleDate !== stats.today && (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={COLUMN_COUNT}
                  className="h-8 border-t border-warning bg-[var(--badge-warning-bg)] py-0"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-caption text-[var(--badge-warning-fg)]">
                      <AlertCircle className="size-4" aria-hidden />
                      {t("entry.backdated", {
                        date: formatDate(draft.saleDate, locale),
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateDraft({ saleDate: stats.today })}
                      className="flex items-center gap-1 text-caption text-[var(--badge-warning-fg)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {t("entry.backToToday")}
                      <X className="size-3" aria-hidden />
                    </button>
                  </span>
                </TableCell>
              </TableRow>
            )}

            {/* The details band. Visual order, DOM order and tab order stay
                identical, which is why `Add sale` MOVES in here. §4.3 */}
            {expanded && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={COLUMN_COUNT} className="bg-muted p-3">
                  <div
                    onKeyDown={onEntryKeyDown}
                    className="rounded-lg border border-border bg-card p-4"
                  >
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <Field label={t("entry.phone")} error={errors.phone}>
                        <Input
                          ref={phoneRef}
                          figure
                          inputMode="numeric"
                          value={draft.phone}
                          invalid={!!errors.phone}
                          placeholder={t("entry.phonePlaceholder")}
                          onChange={(e) => updateDraft({ phone: e.target.value })}
                          onKeyDown={onBandEnter(submit)}
                        />
                      </Field>

                      <Field
                        label={t("entry.address")}
                        error={errors.address}
                        className="lg:col-span-2"
                      >
                        {/* A single-line input, not a textarea — a counter
                            clerk is not writing a paragraph. §4.3 */}
                        <Input
                          value={draft.address}
                          invalid={!!errors.address}
                          placeholder={t("entry.addressPlaceholder")}
                          onChange={(e) =>
                            updateDraft({ address: e.target.value })
                          }
                          onKeyDown={onBandEnter(submit)}
                        />
                      </Field>

                      <Field label={t("entry.litres")} error={errors.litres}>
                        <Input
                          figure
                          inputMode="decimal"
                          value={draft.litres}
                          invalid={!!errors.litres}
                          placeholder={t("entry.litresPlaceholder")}
                          onChange={(e) => updateDraft({ litres: e.target.value })}
                          onKeyDown={onBandEnter(submit)}
                        />
                      </Field>

                      <Field label={t("entry.product")}>
                        <EntityCombobox
                          value={draft.productId}
                          onValueChange={(id, option) =>
                            updateDraft({
                              productId: id,
                              productTitle: option?.label ?? null,
                            })
                          }
                          endpoint={apiRoutes.products.options}
                          placeholder={t("entry.optional")}
                          searchPlaceholder={t("entry.productSearch")}
                          emptyMessage={t("entry.productEmpty")}
                        />
                      </Field>

                      <Field label={t("entry.saleDate")} error={errors.saleDate}>
                        <DateInput
                          value={draft.saleDate}
                          max={stats.today}
                          onValueChange={(value) =>
                            updateDraft({ saleDate: value })
                          }
                        />
                      </Field>

                      <Field label={t("entry.note")} error={errors.note}>
                        <Input
                          value={draft.note}
                          invalid={!!errors.note}
                          placeholder={t("entry.optional")}
                          onChange={(e) => updateDraft({ note: e.target.value })}
                          onKeyDown={onBandEnter(submit)}
                        />
                      </Field>

                      <div className="flex items-end justify-end">
                        <Button type="button" onClick={() => submit()}>
                          {t("entry.submit")}
                        </Button>
                      </div>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {/* ── the sales ─────────────────────────────────────────── */}
            {groups.map((group, groupIndex) => (
              <Fragmentless key={`${group.date}-${groupIndex}`}>
                {grouped && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={COLUMN_COUNT}
                      className="sticky top-25 z-[9] h-10 border-t border-border bg-muted py-0"
                    >
                      <span className="flex items-center justify-between gap-4">
                        <span className="text-caption font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                          {bandLabel(group.date, stats, t, locale)}
                          {group.continued ? ` ${t("band.continued")}` : ""}
                        </span>
                        <span className="flex items-center gap-6">
                          <span className="text-caption text-muted-foreground">
                            {t("band.sales", { count: bandFor(group.date).count })}
                            {bandFor(group.date).voidedCount > 0 && (
                              <span className="text-muted-foreground/70">
                                {" · "}
                                {t("band.voided", {
                                  count: bandFor(group.date).voidedCount,
                                })}
                              </span>
                            )}
                          </span>
                          <Money
                            value={bandFor(group.date).total}
                            emphasis
                            className="text-sm"
                          />
                        </span>
                      </span>
                    </TableCell>
                  </TableRow>
                )}

                {group.rows.map((row) => {
                  const entry = provisional(row.id);
                  return (
                    <TableRow
                      key={row.id}
                      cancelled={row.isVoided}
                      attention={entry?.status === "failed"}
                      clickable={!entry}
                      onClick={
                        entry
                          ? undefined
                          : () => router.push(directSalePaths.detail(row.id))
                      }
                      className={cn(
                        "transition-colors duration-[600ms] ease-out motion-reduce:duration-[150ms]",
                        flashId === row.id && "bg-[var(--badge-primary-bg)]",
                      )}
                    >
                      <TableCell>
                        {entry ? (
                          entry.status === "saving" ? (
                            <Loader2
                              className="size-3.5 animate-spin text-muted-foreground"
                              aria-label={t("entry.saving")}
                            />
                          ) : (
                            <span className="text-caption text-destructive">
                              {t("entry.saveFailedShort")}
                            </span>
                          )
                        ) : (
                          <span className="font-mono text-[13px] font-medium text-primary">
                            {row.code}
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                        {grouped
                          ? formatTime(row.soldAt, locale)
                          : formatDate(row.saleDate, locale)}
                      </TableCell>

                      <TableCell>
                        <span className="flex items-center gap-1.5">
                          <span
                            className="block max-w-50 truncate font-medium text-foreground"
                            title={row.customerName}
                          >
                            {row.customerName}
                          </span>
                          {/* 2+ prior sales earns the marker, and the tooltip
                              says which visit this is. §3.3 */}
                          {row.visitCount > 1 && (
                            <span
                              className="flex items-center"
                              title={t("badges.repeat", {
                                count: row.visitCount,
                              })}
                            >
                              <Repeat
                                className="size-3 shrink-0 text-muted-foreground"
                                aria-hidden
                              />
                              <span className="sr-only">
                                {t("badges.repeat", { count: row.visitCount })}
                              </span>
                            </span>
                          )}
                        </span>
                      </TableCell>

                      <TableCell className="hidden lg:table-cell">
                        {row.phone ? (
                          <span className="font-mono text-[13px]">
                            {row.phone}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </TableCell>

                      <TableCell align="right">
                        <Litres value={row.litres} />
                      </TableCell>

                      <TableCell align="right">
                        <Money
                          value={row.amount}
                          emphasis
                          className={cn(
                            row.isVoided && "line-through text-muted-foreground",
                          )}
                        />
                      </TableCell>

                      <TableCell align="center">
                        {row.isVoided && (
                          <Badge icon={<Ban aria-hidden />}>
                            {t("badges.voided")}
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell align="center">
                        {entry?.status === "failed" ? (
                          <span
                            className="flex items-center justify-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => submit(entry.draft, entry.tempId)}
                              className="text-caption text-primary underline-offset-4 hover:underline"
                            >
                              {t("entry.retry")}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setPending((previous) =>
                                  previous.filter(
                                    (e) => e.tempId !== entry.tempId,
                                  ),
                                )
                              }
                              className="text-caption text-destructive underline-offset-4 hover:underline"
                            >
                              {t("entry.discard")}
                            </button>
                          </span>
                        ) : entry ? null : (
                          <DirectSaleActions sale={row} />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </Fragmentless>
            ))}
          </TableBody>
        </Table>

        {isEmpty && (
          <div className="px-6 py-12">
            {filtersActive ? (
              <EmptyState
                variant="no-results"
                title={t("list.noResults.title")}
                description={describeNoResults(t, query, range, locale, get)}
                onClearFilters={clearAll}
              />
            ) : range === "today" &&
              (stats.yesterdayCount > 0 || stats.monthCount > 0) ? (
              /* Not yet — as distinct from never, and from you-filtered-too-far.
                 The line quotes yesterday, so the screen still says something. */
              <EmptyState
                icon={Sunrise}
                title={t("list.emptyToday.title")}
                description={t("list.emptyToday.body", {
                  amount: formatINR(stats.yesterdayTotal),
                  count: stats.yesterdayCount,
                })}
                action={
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setParams({ [DIRECT_SALE_FILTERS.range]: "yesterday" })
                    }
                  >
                    {t("list.emptyToday.cta")}
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={Droplet}
                title={t("list.empty.title")}
                description={t("list.empty.body")}
                action={
                  /* There is nowhere to navigate to — the form is already on
                     screen, so the button focuses it. §3.5 */
                  <Button
                    variant="secondary"
                    onClick={() => nameRef.current?.focus()}
                  >
                    {t("list.empty.cta")}
                  </Button>
                }
              />
            )}
          </div>
        )}
      </div>

      {!isEmpty && <DataTablePagination result={result} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Pieces
   ═══════════════════════════════════════════════════════════════════════ */

/** `<>…</>` with a key, without importing Fragment at every call site. */
function Fragmentless({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/**
 * A validation message that does not change the row's height.
 *
 * An inline block would push every row down under the cursor mid-entry, so the
 * message floats over the rows below instead. §4.4
 */
function FieldPopover({
  message,
  align = "left",
}: {
  message?: string;
  align?: "left" | "right";
}) {
  if (!message) return null;

  return (
    <span
      role="alert"
      className={cn(
        "absolute top-full z-30 mt-1 flex w-max max-w-64 items-center gap-1.5",
        "rounded-md border border-destructive bg-[var(--badge-danger-bg)] px-2 py-1",
        "text-caption text-[var(--badge-danger-fg)] shadow-lg",
        align === "right" ? "right-0" : "left-0",
      )}
    >
      <AlertCircle className="size-3.5 shrink-0" aria-hidden />
      {message}
    </span>
  );
}

/** A labelled field in the details band, where a height change is harmless. */
function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      {children}
      {error && <p className="mt-1 text-caption text-destructive">{error}</p>}
    </div>
  );
}

/** Enter submits from any single-line band field, exactly as from Amount. §4.6 */
function onBandEnter(submit: () => void) {
  return (event: React.KeyboardEvent) => {
    if (event.key !== "Enter" || event.metaKey || event.ctrlKey) return;
    event.preventDefault();
    submit();
  };
}

/** Date range, amount range and the voided toggle. §3.3 filter popover */
function Filters({
  get,
  setParams,
}: {
  get: (key: string) => string | undefined;
  setParams: (patch: Record<string, string | undefined>) => void;
}) {
  const t = useTranslations("directSales");

  return (
    <>
      <div>
        <Label>{t("filters.from")}</Label>
        <DateInput
          value={get(DIRECT_SALE_FILTERS.from) ?? ""}
          onValueChange={(value) =>
            setParams({
              [DIRECT_SALE_FILTERS.from]: value || undefined,
              // A hand-picked range replaces the chip, rather than fighting it.
              [DIRECT_SALE_FILTERS.range]: undefined,
            })
          }
          className="w-45"
        />
      </div>

      <div>
        <Label>{t("filters.to")}</Label>
        <DateInput
          value={get(DIRECT_SALE_FILTERS.to) ?? ""}
          onValueChange={(value) =>
            setParams({
              [DIRECT_SALE_FILTERS.to]: value || undefined,
              [DIRECT_SALE_FILTERS.range]: undefined,
            })
          }
          className="w-45"
        />
      </div>

      <div>
        <Label htmlFor="filter-min-amount">{t("filters.min")}</Label>
        <Input
          id="filter-min-amount"
          figure
          inputMode="decimal"
          defaultValue={get(DIRECT_SALE_FILTERS.minAmount) ?? ""}
          onBlur={(e) =>
            setParams({
              [DIRECT_SALE_FILTERS.minAmount]: e.target.value || undefined,
            })
          }
          className="w-35"
        />
      </div>

      <div>
        <Label htmlFor="filter-max-amount">{t("filters.max")}</Label>
        <Input
          id="filter-max-amount"
          figure
          inputMode="decimal"
          defaultValue={get(DIRECT_SALE_FILTERS.maxAmount) ?? ""}
          onBlur={(e) =>
            setParams({
              [DIRECT_SALE_FILTERS.maxAmount]: e.target.value || undefined,
            })
          }
          className="w-35"
        />
      </div>

      <div className="flex min-h-11 items-center gap-2">
        <Switch
          id="filter-voided"
          checked={get(DIRECT_SALE_FILTERS.voided) === "1"}
          onCheckedChange={(next) =>
            setParams({ [DIRECT_SALE_FILTERS.voided]: next ? "1" : undefined })
          }
        />
        <Label htmlFor="filter-voided" className="mb-0 cursor-pointer">
          {t("filters.showVoided")}
        </Label>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Pure helpers
   ═══════════════════════════════════════════════════════════════════════ */

interface DayGroup {
  date: string;
  rows: DirectSaleListItemDto[];
  /** A day split across two pages gets a band on each, the second `(continued)`. */
  continued: boolean;
}

/**
 * Group the page's rows by business date, with unconfirmed rows sitting at the
 * head of the day they belong to.
 *
 * Server order is preserved: the rows are already sorted by SQL, and
 * re-sorting them here would let the browser disagree with the ORDER BY.
 */
function buildGroups(
  rows: DirectSaleListItemDto[],
  pendingRows: DirectSaleListItemDto[],
  grouped: boolean,
): DayGroup[] {
  if (!grouped) {
    const all = [...pendingRows, ...rows];
    return all.length === 0 ? [] : [{ date: "", rows: all, continued: false }];
  }

  const groups: DayGroup[] = [];
  for (const row of rows) {
    const last = groups.at(-1);
    if (last && last.date === row.saleDate) last.rows.push(row);
    else {
      groups.push({
        date: row.saleDate,
        rows: [row],
        // The same date opening a second band means the day was already
        // above — this page is continuing it.
        continued: groups.some((g) => g.date === row.saleDate),
      });
    }
  }

  for (const row of [...pendingRows].reverse()) {
    const group = groups.find((g) => g.date === row.saleDate);
    if (group) group.rows.unshift(row);
    else groups.unshift({ date: row.saleDate, rows: [row], continued: false });
  }

  return groups;
}

/** `TODAY · 14 Aug 2026` · `YESTERDAY · 13 Aug 2026` · `12 Aug 2026`. §3.3 */
function bandLabel(
  date: string,
  stats: DirectSaleStatsDto,
  t: ReturnType<typeof useTranslations>,
  locale: Locale,
): string {
  const absolute = formatDate(date, locale);
  // Compared against the SERVER's idea of today, so a laptop with the wrong
  // clock cannot label yesterday's band "Today".
  if (date === stats.today) return `${t("band.today")} · ${absolute}`;
  if (date === stats.yesterday) return `${t("band.yesterday")} · ${absolute}`;
  return absolute;
}

/** Names the live query and date range verbatim, so it is clear what to loosen. */
function describeNoResults(
  t: ReturnType<typeof useTranslations>,
  query: string,
  range: DirectSaleRange,
  locale: Locale,
  get: (key: string) => string | undefined,
): string {
  const from = get(DIRECT_SALE_FILTERS.from);
  const to = get(DIRECT_SALE_FILTERS.to);
  const window =
    from || to
      ? [from && formatDate(from, locale), to && formatDate(to, locale)]
          .filter(Boolean)
          .join(" – ")
      : t(`chips.${range}`);

  if (query) return t("list.noResults.bodyQuery", { query, window });
  return t("list.noResults.bodyFilters", { window });
}
