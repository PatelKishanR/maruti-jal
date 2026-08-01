"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertCircle, AlertTriangle, Plus, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import {
  DateInput,
  EntityCombobox,
  FormActions,
  FormField,
  MoneyInput,
  QuantityInput,
} from "@/components/form";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Money, Quantity } from "@/components/common/money";
import { StatusBadge } from "@/components/common/status-badge";
import { api, ApiError } from "@/lib/api/client";
import { todayIST } from "@/lib/dates";
import { formatINR, formatQuantity } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CoinTypeListItemDto } from "@/lib/dto/coin-type.dto";
import type {
  CoinIssueDetailDto,
  CoinIssueStaffSummaryDto,
} from "@/lib/dto/coin-issue.dto";
import {
  COIN_PAYMENT_MODES,
  createCoinIssueSchema,
  type CoinPaymentMode,
} from "@/lib/validation/coin-issue";
import { ColourDot, formatPerCoinValue } from "../types/coin-figures";

/**
 * Issue coins. Spec: design MODULES/04-coins §7
 *
 * The form's job is to SHOW THE ARITHMETIC as it happens. The owner is about to
 * hand over physical value; he should never wonder what he is going to be owed,
 * and he must never be able to issue coins that do not exist.
 *
 * Two things are deliberate and easy to get wrong:
 *
 *  · **The stock check here is a courtesy, not the guard.** It reads a figure
 *    fetched when the page loaded. The real check happens server-side under the
 *    coin type's row lock, and a 409 from it is rendered in the banner below.
 *    §7.6
 *
 *  · **`Issue coins` is never disabled for insufficient stock.** The owner is
 *    told why on submit, not blocked silently — a disabled button that will not
 *    say why is how people conclude the software is broken. §7.5
 *
 * Create-only. An issue's lines snapshot the rate they went out at and have
 * already moved stock through the ledger, so there is no edit path.
 */

interface LineDraft {
  /** Client-only key, so removing row 2 does not re-key rows 3 and 4. */
  key: string;
  coinTypeId: string | null;
  packets: number | null;
}

function emptyLine(): LineDraft {
  return { key: crypto.randomUUID(), coinTypeId: null, packets: null };
}

export function CoinIssueForm({
  coinTypes,
}: {
  /** Active types only, fetched by the server page. */
  coinTypes: CoinTypeListItemDto[];
}) {
  const t = useTranslations("coins.issues.form");
  const tRoot = useTranslations();
  const router = useRouter();

  const [staffId, setStaffId] = useState<string | null>(null);
  const [staffName, setStaffName] = useState("");
  const [staffSummary, setStaffSummary] =
    useState<CoinIssueStaffSummaryDto | null>(null);
  const [issueDate, setIssueDate] = useState(todayIST());
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [paidNow, setPaidNow] = useState<number | null>(null);
  const [mode, setMode] = useState<CoinPaymentMode>("CASH");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [submitting, startSubmit] = useTransition();

  /**
   * Minted ONCE per form open. A retry after a timeout carries the same value,
   * and the unique index rejects the duplicate rather than the staff member
   * being charged twice. See .claude/DATA-MODEL.md §10.11
   */
  const [clientRequestId] = useState(() => crypto.randomUUID());

  const byId = new Map(coinTypes.map((coinType) => [coinType.id, coinType]));

  /* ── The context line under the staff picker. §7.3 ────────────────────── */

  useEffect(() => {
    if (!staffId) {
      setStaffSummary(null);
      return;
    }
    let cancelled = false;
    void api
      .get<CoinIssueStaffSummaryDto>(
        `/api/coin-issues/staff-summary?staffId=${encodeURIComponent(staffId)}`,
      )
      .then((summary) => {
        if (!cancelled) setStaffSummary(summary);
      })
      .catch(() => {
        // A missing context line is a smaller failure than a blocked form.
        if (!cancelled) setStaffSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, [staffId]);

  /* ── The arithmetic, recomputed on every keystroke, never animated ─────── */

  const computed = lines.map((line) => {
    const coinType = line.coinTypeId ? byId.get(line.coinTypeId) : undefined;
    const packets = line.packets ?? 0;
    const coins = coinType ? packets * coinType.coinsPerPacket : 0;
    const amount = coinType
      ? Math.round(packets * coinType.packetAmount * 100) / 100
      : 0;

    return {
      line,
      coinType,
      coins,
      amount,
      inStock: coinType?.balanceCoins ?? 0,
      shortOfStock: !!coinType && coins > coinType.balanceCoins,
    };
  });

  const totalCoins = computed.reduce((total, row) => total + row.coins, 0);
  // A DISPLAY total over already-rounded line amounts, matching the shape the
  // database computes from `line_amount`. Nothing here is persisted; the server
  // recomputes every figure from its own generated columns.
  const totalAmount =
    Math.round(computed.reduce((total, row) => total + row.amount, 0) * 100) /
    100;

  const paid = paidNow ?? 0;
  const balance = Math.round((totalAmount - paid) * 100) / 100;
  const anyShort = computed.some((row) => row.shortOfStock);
  /** A rate with more than 2 decimals means the packet does not divide. §8.2 */
  const unevenRate = computed.find(
    (row) =>
      row.coinType &&
      Math.abs(row.coinType.perCoinPrice * 100 - Math.round(row.coinType.perCoinPrice * 100)) >
        1e-9,
  )?.coinType;

  const dirty =
    !!staffId ||
    notes.length > 0 ||
    paid > 0 ||
    lines.some((line) => line.coinTypeId || line.packets);

  /* ── Validation ───────────────────────────────────────────────────────── */

  function payload() {
    return {
      staffId: staffId ?? "",
      issueDate,
      notes: notes.trim() || null,
      items: lines
        .filter((line) => line.coinTypeId)
        .map((line) => ({
          coinTypeId: line.coinTypeId as string,
          packets: line.packets,
        })),
      payment:
        paid > 0
          ? { amount: paid, mode, referenceNo: null, note: null }
          : null,
      clientRequestId,
    };
  }

  function collectErrors(): Record<string, string> {
    const parsed = createCoinIssueSchema.safeParse(payload());
    if (parsed.success) return {};

    const mapped: Record<string, string> = {};
    for (const [field, messages] of Object.entries(
      parsed.error.flatten().fieldErrors,
    )) {
      if (messages?.[0]) {
        mapped[field] = tRoot.has(messages[0]) ? tRoot(messages[0]) : messages[0];
      }
    }
    return mapped;
  }

  function submit() {
    const found = collectErrors();
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    startSubmit(async () => {
      try {
        const created = await api.post<CoinIssueDetailDto>(
          "/api/coin-issues",
          payload(),
        );

        toast.success(
          t("createdToast", {
            code: created.code,
            coins: formatQuantity(created.totalCoinsIssued),
            staff: created.staffName,
            amount: formatINR(Math.abs(created.outstandingAmount)),
          }),
        );
        router.push(`/coins/issues/${created.id}`);
      } catch (error) {
        if (error instanceof ApiError) {
          // The stock refusal arrives with everything the sentence needs — the
          // coin type, what is there, and what was asked for. §7.4
          setFormError(
            tRoot.has(error.messageKey)
              ? tRoot(error.messageKey, {
                  ...(error.meta as Record<string, string | number>),
                })
              : error.messageKey,
          );
          return;
        }
        setFormError(tRoot("common.somethingWentWrong"));
      }
    });
  }

  /* ── Render ───────────────────────────────────────────────────────────── */

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-6"
    >
      <Card className="p-6">
        <h2 className="mb-4 border-b border-border pb-2 text-h4 font-semibold">
          {t("sections.details")}
        </h2>

        <div className="flex flex-wrap gap-4">
          <FormField
            label={t("staff")}
            required
            error={errors.staffId}
            className="min-w-72 flex-1"
            hint={staffContextLine(staffSummary, staffName, t)}
          >
            {({ id, invalid }) => (
              <EntityCombobox
                id={id}
                value={staffId}
                onValueChange={(value, option) => {
                  setStaffId(value);
                  setStaffName(option?.label ?? "");
                }}
                endpoint="/api/staff/options"
                placeholder={t("staffPlaceholder")}
                searchPlaceholder={t("staffPlaceholder")}
                emptyMessage={t("staffEmpty")}
                invalid={invalid}
              />
            )}
          </FormField>

          <FormField label={t("issueDate")} required error={errors.issueDate}>
            {({ id, invalid }) => (
              <DateInput
                id={id}
                value={issueDate}
                onValueChange={setIssueDate}
                max={todayIST()}
                invalid={invalid}
              />
            )}
          </FormField>
        </div>

        <FormField label={t("note")} error={errors.notes}>
          {({ id }) => (
            <Input
              id={id}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("notePlaceholder")}
            />
          )}
        </FormField>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 border-b border-border pb-2 text-h4 font-semibold">
          {t("sections.coins")}
        </h2>

        {errors.items && (
          <p className="mb-2 text-sm text-destructive" role="alert">
            {errors.items}
          </p>
        )}

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-180 text-sm">
            <thead>
              <tr className="border-b border-border text-caption uppercase tracking-[0.04em] text-muted-foreground">
                <th className="px-3 py-2 text-left font-semibold">
                  {t("columns.coinType")}
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  {t("columns.packets")}
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  {t("columns.coins")}
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  {t("columns.perCoin")}
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  {t("columns.amount")}
                </th>
                <th className="px-3 py-2 text-right font-semibold">
                  {t("columns.inStock")}
                </th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {computed.map((row, index) => (
                <tr
                  key={row.line.key}
                  className={cn(
                    "border-b border-border last:border-b-0",
                    row.shortOfStock && "border-l-2 border-l-destructive",
                  )}
                >
                  <td className="px-3 py-2">
                    <Select
                      value={row.line.coinTypeId ?? ""}
                      onValueChange={(value) =>
                        setLines((prev) =>
                          prev.map((line, i) =>
                            i === index ? { ...line, coinTypeId: value } : line,
                          ),
                        )
                      }
                    >
                      <SelectTrigger className="w-full min-w-48">
                        <SelectValue placeholder={t("coinTypePlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {coinTypes.map((coinType) => {
                          const takenElsewhere = lines.some(
                            (line, i) =>
                              i !== index && line.coinTypeId === coinType.id,
                          );
                          return (
                            <SelectItem
                              key={coinType.id}
                              value={coinType.id}
                              // `uq_cii_issue_type` makes a repeated coin type
                              // a database error, so it is disabled rather than
                              // silently merged — two "Blue Token" lines mean
                              // the owner lost track of what he typed.
                              disabled={takenElsewhere}
                            >
                              <span className="flex items-center gap-2">
                                <ColourDot colour={coinType.colourHex} />
                                {coinType.name}
                                {takenElsewhere && (
                                  <span className="text-muted-foreground">
                                    {t("alreadyAdded")}
                                  </span>
                                )}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </td>

                  <td className="px-3 py-2">
                    <QuantityInput
                      value={row.line.packets}
                      onValueChange={(value) =>
                        setLines((prev) =>
                          prev.map((line, i) =>
                            i === index ? { ...line, packets: value } : line,
                          ),
                        )
                      }
                      min={1}
                      className="ml-auto w-28"
                    />
                  </td>

                  {/* Computed cells: no border, muted, updated per keystroke. */}
                  <td className="bg-muted px-3 py-2 text-right">
                    <Quantity value={row.coins} zeroAs="dash" />
                  </td>
                  <td className="bg-muted px-3 py-2 text-right">
                    {row.coinType ? (
                      <span className="font-mono text-muted-foreground">
                        {formatPerCoinValue(row.coinType.perCoinPrice)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="bg-muted px-3 py-2 text-right">
                    <Money value={row.amount} emphasis />
                  </td>
                  <td className="bg-muted px-3 py-2 text-right">
                    <Quantity
                      value={row.inStock}
                      className={cn(
                        row.shortOfStock && "font-semibold text-destructive",
                      )}
                    />
                    {row.shortOfStock && row.coinType && (
                      <p className="mt-0.5 flex items-center justify-end gap-1 text-caption text-destructive">
                        <AlertCircle className="size-3.5" aria-hidden />
                        {t("stockInline", {
                          available: formatQuantity(row.inStock),
                          name: row.coinType.name,
                          packets: formatQuantity(
                            Math.floor(row.inStock / row.coinType.coinsPerPacket),
                          ),
                          coins: formatQuantity(
                            row.inStock % row.coinType.coinsPerPacket,
                          ),
                        })}
                      </p>
                    )}
                  </td>

                  <td className="px-3 py-2 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      // An issue needs at least one coin type, so the last row
                      // cannot be removed. §7.6
                      disabled={lines.length === 1}
                      aria-label={t("removeLine")}
                      onClick={() =>
                        setLines((prev) => prev.filter((_, i) => i !== index))
                      }
                    >
                      <X aria-hidden />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Button
          type="button"
          variant="ghost"
          onClick={() => setLines((prev) => [...prev, emptyLine()])}
          className="mt-3 w-full border border-dashed border-input"
        >
          <Plus aria-hidden />
          {t("addLine")}
        </Button>

        {/* The breakdown block. Mono throughout so the × and = columns line up
            down the panel — that alignment is the point of it. §7.3 */}
        <div className="mt-4 rounded-md bg-muted p-4 font-mono text-sm">
          {computed.every((row) => !row.coinType) ? (
            <p className="text-center text-muted-foreground">
              {t("breakdownEmpty")}
            </p>
          ) : (
            <>
              {computed
                .filter((row) => row.coinType)
                .map((row) => (
                  <p key={row.line.key} className="text-muted-foreground">
                    <span className="text-foreground">
                      {row.coinType?.name}
                    </span>{" "}
                    {t("breakdownLine", {
                      packets: formatQuantity(row.line.packets ?? 0),
                      perPacket: formatQuantity(
                        row.coinType?.coinsPerPacket ?? 0,
                      ),
                      coins: formatQuantity(row.coins),
                      rate: formatPerCoinValue(row.coinType?.perCoinPrice ?? 0),
                      amount: formatINR(row.amount),
                    })}
                  </p>
                ))}

              <div className="mt-2 flex items-baseline justify-between border-t border-border pt-2 text-base font-semibold">
                <span>{t("breakdownTotal")}</span>
                <span className="flex gap-6">
                  <Quantity value={totalCoins} emphasis />
                  <Money value={totalAmount} emphasis zeroAs="value" />
                </span>
              </div>
            </>
          )}
        </div>

        {unevenRate && (
          <p className="mt-2 text-caption text-muted-foreground">
            {t("unevenRate", {
              name: unevenRate.name,
              rate: formatPerCoinValue(unevenRate.perCoinPrice),
            })}
          </p>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 border-b border-border pb-2 text-h4 font-semibold">
          {t("sections.payment")}
        </h2>

        <div className="flex flex-wrap items-start gap-4">
          <FormField label={t("paidNow")} error={errors.payment}>
            {({ id, invalid }) => (
              <MoneyInput
                id={id}
                value={paidNow}
                onValueChange={setPaidNow}
                invalid={invalid}
              />
            )}
          </FormField>

          <FormField label={t("mode")}>
            {({ id }) => (
              <Select
                value={mode}
                onValueChange={(value) => setMode(value as CoinPaymentMode)}
              >
                <SelectTrigger id={id} className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COIN_PAYMENT_MODES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {tRoot(`coins.issues.modes.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <div className="flex gap-2 pt-7">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={totalAmount === 0}
              onClick={() => setPaidNow(totalAmount)}
            >
              {t("payFull", { amount: formatINR(totalAmount) })}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setPaidNow(null)}
            >
              {t("payNothing")}
            </Button>
          </div>
        </div>

        {/* The live settlement line — the sentence the owner reads last before
            handing the packets over. §7.4 */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            {t("settlementLine", {
              total: formatINR(totalAmount),
              paid: paid > 0 ? formatINR(paid) : "—",
              balance: formatINR(Math.abs(balance)),
            })}
          </span>
          {totalAmount > 0 && (
            <StatusBadge
              status={
                balance === 0
                  ? "paid"
                  : balance < 0
                    ? "refundDue"
                    : paid > 0
                      ? "partiallyPaid"
                      : "unpaid"
              }
              amount={balance}
            />
          )}
        </div>

        {balance < 0 && (
          <Alert variant="warning" className="mt-3">
            <AlertDescription>
              {t("overpayWarning", {
                paid: formatINR(paid),
                total: formatINR(totalAmount),
                extra: formatINR(Math.abs(balance)),
                staff: staffName,
              })}
            </AlertDescription>
          </Alert>
        )}
      </Card>

      {/* The form-level banner appears ONLY on a submit attempt, never while
          typing. §7.5 */}
      {formError && (
        <Alert variant="danger" icon={<AlertTriangle aria-hidden />}>
          <AlertTitle>{t("formErrorTitle")}</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      {anyShort && !formError && (
        <p className="text-caption text-muted-foreground">
          {t("stockHint")}
        </p>
      )}

      <FormActions
        onCancel={() => (dirty ? setDiscarding(true) : router.back())}
        submitLabel={t("submit")}
        submittingLabel={t("submitting")}
        submitting={submitting}
        // Pressing it is how the owner learns what is required, so a create
        // form's primary is never disabled until dirty. DESIGN-STANDARDS §6.5
        alwaysEnabled
      />

      {discarding && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setDiscarding(false)}
          variant="destructive"
          title={t("discardTitle")}
          description={t("discardBody", {
            lines: formatQuantity(
              computed.filter((row) => row.coinType).length,
            ),
            amount: formatINR(paid),
          })}
          confirmLabel={t("discardConfirm")}
          onConfirm={() => router.push("/coins/issues")}
        />
      )}
    </form>
  );
}

/**
 * "Ramesh currently owes ₹4,500.00 on 1 open issue" — or, when the figure is
 * negative, "You owe Ramesh Patel ₹500.00". Design §7.3, §7.6
 *
 * A plain helper rather than a component so the reserved hint slot on
 * `FormField` keeps its height whether or not there is anything to say.
 */
function staffContextLine(
  summary: CoinIssueStaffSummaryDto | null,
  staffName: string,
  t: (key: string, values?: Record<string, string>) => string,
): string | undefined {
  if (!summary) return undefined;

  if (summary.outstandingAmount < 0) {
    return t("staffOwedByUs", {
      staff: staffName,
      amount: formatINR(Math.abs(summary.outstandingAmount)),
    });
  }
  if (summary.outstandingAmount > 0) {
    return t("staffOwes", {
      staff: staffName,
      amount: formatINR(summary.outstandingAmount),
      issues: formatQuantity(summary.openIssues),
    });
  }
  return t("staffClear", { staff: staffName });
}
