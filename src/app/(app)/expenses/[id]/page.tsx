import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import {
  AlertTriangle,
  ChevronLeft,
  Download,
  FileText,
  Info,
  Paperclip,
  Pencil,
  SearchX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DetailSummary } from "@/components/common/detail-summary";
import { Money } from "@/components/common/money";
import { Timeline, type TimelineEntry } from "@/components/common/timeline";
import { api, ApiError } from "@/lib/api/client";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/config";
import { expensePaths, type ExpenseDetailDto } from "@/lib/dto/expense.dto";
import { categoryDotColour } from "../expense-category-colour";
import { ExpenseActions, ExpenseRestoreButton } from "../expenses-table";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Extensions the browser will render inline. Everything else gets an icon. */
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

/**
 * Expense detail. Spec: design/MODULES/07-expenses.md §5
 *
 * One expense, fully readable, with the bill big enough to check against the
 * amount. The receipt card is NEVER omitted — an absent receipt gets its own
 * empty state, so "no bill was kept" is stated rather than left to be inferred
 * from a missing panel. §5.5
 */
export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("expenses");
  const locale = (await getLocale()) as Locale;
  const format = await getFormatter();

  let expense: ExpenseDetailDto;
  try {
    expense = await api.get<ExpenseDetailDto>(`/api/expenses/${id}`);
  } catch (error) {
    const missing = error instanceof ApiError && error.status === 404;
    return (
      <>
        <BackLink label={t("backToList")} />
        <div
          role={missing ? undefined : "alert"}
          className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center"
        >
          {missing ? (
            <SearchX className="size-12 text-muted-foreground/60" aria-hidden />
          ) : (
            <AlertTriangle className="size-12 text-destructive" aria-hidden />
          )}
          <h1 className="mt-4 text-h4 font-semibold text-foreground">
            {missing ? t("detail.notFoundTitle") : t("detail.errorTitle")}
          </h1>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            {missing ? t("detail.notFoundBody") : t("detail.errorBody")}
          </p>
          <Button asChild className="mt-4">
            <Link href={expensePaths.list}>{t("detail.backToExpenses")}</Link>
          </Button>
        </div>
      </>
    );
  }

  const deleted = expense.deletedAt !== null;

  return (
    <>
      <BackLink label={t("backToList")} />

      {/* ---- Deleted banner --------------------------------------------
          Non-dismissible, and it names the consequence the owner cares about:
          this expense has stopped counting towards the month's profit. §5.4 */}
      {deleted && (
        <div className="mb-6 flex flex-wrap items-start gap-3 rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground">
          <Info className="mt-px size-5 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1">
            {t("detail.deletedBanner", {
              date: format.dateTime(new Date(expense.deletedAt!), {
                dateStyle: "medium",
              }),
            })}
          </p>
          <ExpenseRestoreButton expenseId={expense.id} code={expense.code} />
        </div>
      )}

      {/* ---- Header ----------------------------------------------------- */}
      <div
        className={cn(
          "mb-6 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between",
          // §5.5: the whole page dims behind the banner, which does not.
          deleted && "opacity-70",
        )}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            {/* Mono: this is a code, not a name. */}
            <h1 className="font-mono text-h2 font-semibold leading-[1.3] text-foreground">
              {expense.code}
            </h1>
            <Badge
              icon={
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor: categoryDotColour(expense.categoryId),
                  }}
                />
              }
            >
              {expense.categoryName}
              {!expense.categoryIsActive && (
                <span className="text-muted-foreground">
                  {t("form.categoryInactiveSuffix")}
                </span>
              )}
            </Badge>
          </div>

          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {expense.paidTo ?? t("noPayee")}
            {" · "}
            {formatDate(expense.expenseDate, locale)}
            {" · "}
            {t("detail.recordedOn", {
              date: format.dateTime(new Date(expense.createdAt), {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            })}
          </p>
        </div>

        {!deleted && (
          <div className="flex shrink-0 items-center gap-2">
            {expense.receiptUrl && (
              <Button variant="ghost" asChild>
                <a
                  href={expense.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                >
                  <Download aria-hidden />
                  {t("detail.downloadReceipt")}
                </a>
              </Button>
            )}
            <Button variant="secondary" asChild>
              <Link href={expensePaths.edit(expense.id)}>
                <Pencil aria-hidden />
                {t("rowActions.edit")}
              </Link>
            </Button>
            <ExpenseActions expense={expense} />
          </div>
        )}
      </div>

      <div className={cn(deleted && "opacity-70")}>
        {/* ---- Summary band -------------------------------------------
            Amount carries the emphasis; the other three are context. A card
            that emphasises everything emphasises nothing. §9 */}
        <DetailSummary
          className="mb-8"
          items={[
            {
              label: t("detail.summary.amount"),
              emphasis: true,
              value: <Money value={expense.amount} emphasis zeroAs="value" />,
            },
            {
              label: t("detail.summary.category"),
              // A word, not a figure — Inter, not mono.
              value: (
                <span className="font-sans">{expense.categoryName}</span>
              ),
            },
            {
              label: t("detail.summary.paymentMode"),
              value: (
                <span className="font-sans">
                  {t(`paymentModes.${expense.paymentMode}`)}
                </span>
              ),
            },
            {
              label: t("detail.summary.staff"),
              value: expense.staffId ? (
                <Link
                  href={`/staff/${expense.staffId}`}
                  className="font-sans text-primary underline-offset-4 hover:underline"
                >
                  {expense.staffName ?? expense.staffId}
                </Link>
              ) : (
                <span className="font-sans text-muted-foreground">—</span>
              ),
            },
          ]}
        />

        <div className="grid gap-6 lg:grid-cols-5">
          {/* ---- Note + Activity (60%) ------------------------------- */}
          <div className="flex flex-col gap-6 lg:col-span-3">
            <Card className="p-6">
              <h2 className="mb-3 text-h4 font-semibold text-foreground">
                {t("detail.note")}
              </h2>
              {expense.note ? (
                // Never truncated on a detail page, and line breaks survive.
                <p className="whitespace-pre-line text-base leading-relaxed text-foreground">
                  {expense.note}
                </p>
              ) : (
                <p className="text-base text-muted-foreground">
                  —
                  <span className="ml-2 text-caption">
                    {t("detail.noNote")}
                  </span>
                </p>
              )}
            </Card>

            <Card className="p-6">
              <h2 className="mb-4 text-h4 font-semibold text-foreground">
                {t("detail.activity")}
              </h2>

              <Timeline
                entries={expense.activity.map<TimelineEntry>((entry) => ({
                  id: entry.id,
                  tone: entry.action === "deleted" ? "danger" : "primary",
                  title: t(`activity.${entry.action}`),
                  meta: format.dateTime(new Date(entry.at), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }),
                }))}
              />

              {/* Says out loud that field-level history is not recorded yet,
                  rather than letting a two-entry rail imply nothing ever
                  changed. */}
              {!expense.activityComplete && (
                <p className="mt-4 border-t border-border pt-3 text-caption text-muted-foreground">
                  {t("detail.activityPending")}
                </p>
              )}
            </Card>
          </div>

          {/* ---- Receipt (40%) --------------------------------------- */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              <h2 className="mb-4 text-h4 font-semibold text-foreground">
                {t("detail.receipt")}
              </h2>

              {expense.receiptUrl ? (
                <ReceiptPanel
                  url={expense.receiptUrl}
                  labels={{
                    view: t("detail.viewFullSize"),
                    download: t("detail.download"),
                  }}
                />
              ) : (
                /* The card is never omitted — the absence has to be explicit,
                   or a missing panel reads as a page that failed to load. §5.5 */
                <div className="flex min-h-50 flex-col items-center justify-center px-4 py-8 text-center">
                  <Paperclip
                    className="size-10 text-muted-foreground/60"
                    aria-hidden
                  />
                  <p className="mt-3 text-h4 font-semibold text-foreground">
                    {t("detail.noReceiptTitle")}
                  </p>
                  <p className="mt-1 max-w-prose text-sm text-muted-foreground">
                    {t("detail.noReceiptBody")}
                  </p>
                  {!deleted && (
                    <Button variant="secondary" className="mt-4" asChild>
                      <Link href={expensePaths.edit(expense.id)}>
                        {t("detail.addReceipt")}
                      </Link>
                    </Button>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

function BackLink({ label }: { label: string }) {
  return (
    <Link
      href={expensePaths.list}
      className="mb-2 inline-flex h-11 items-center gap-1 text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <ChevronLeft className="size-4" aria-hidden />
      {label}
    </Link>
  );
}

/**
 * The bill itself.
 *
 * §5.8: the photograph is NEVER dimmed, tinted or inverted, in either theme —
 * the owner is reading a printed bill and needs it true. Only the letterbox
 * around it changes with the theme.
 */
function ReceiptPanel({
  url,
  labels,
}: {
  url: string;
  labels: { view: string; download: string };
}) {
  const path = url.split("?")[0];
  const name = decodeURIComponent(path.split("/").pop() ?? url);
  const isImage = IMAGE_EXTENSIONS.some((extension) =>
    path.toLowerCase().endsWith(extension),
  );

  return (
    <div>
      <div className="flex max-h-80 items-center justify-center overflow-hidden rounded-md border border-border bg-muted p-2">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- the host is
          // whatever storage provider is eventually chosen, so it cannot be in
          // `images.remotePatterns` and next/image would refuse it.
          <img
            src={url}
            alt={name}
            className="max-h-76 w-auto object-contain"
          />
        ) : (
          <span className="flex min-h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
            <FileText className="size-10" aria-hidden />
            <span className="text-caption">{name}</span>
          </span>
        )}
      </div>

      <p className="mt-2 truncate text-caption text-muted-foreground">{name}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            {labels.view}
          </a>
        </Button>
        <Button variant="ghost" size="sm" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer" download>
            <Download aria-hidden />
            {labels.download}
          </a>
        </Button>
      </div>
    </div>
  );
}
