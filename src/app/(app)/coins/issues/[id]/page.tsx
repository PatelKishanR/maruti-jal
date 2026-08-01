import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronLeft, RotateCcw } from "lucide-react";
import { api, ApiError } from "@/lib/api/client";
import { formatDate } from "@/lib/dates";
import { formatINR, formatQuantity } from "@/lib/money";
import type { Locale } from "@/i18n/config";
import type { CoinIssueDetailDto } from "@/lib/dto/coin-issue.dto";
import { PageHeader } from "@/components/common/page-header";
import { DetailSummary } from "@/components/common/detail-summary";
import { EmptyState, ErrorState } from "@/components/common/empty-state";
import { Money } from "@/components/common/money";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  CoinIssueStatusBadge,
  RoundingStubBadge,
} from "../coin-issue-badges";
import { CoinIssueActions } from "../coin-issue-actions";
import { CoinIssueDetailTabs } from "./coin-issue-detail-tabs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One handover, fully explained. Spec: design MODULES/04-coins §8
 *
 * The page is arranged around ONE figure — `Pending` — because that is the only
 * one that says whether this relationship is closed. Everything above it
 * explains how it was reached; everything below it is the evidence.
 *
 * This is also where a refund is actually paid, which is why the blue banner
 * exists and is not dismissible: an overpaid staff member who is never refunded
 * is money quietly disappearing from the books.
 */
export default async function CoinIssueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("coins.issues.detail");
  const locale = (await getLocale()) as Locale;

  let issue: CoinIssueDetailDto;
  try {
    issue = await api.get<CoinIssueDetailDto>(`/api/coin-issues/${id}`);
  } catch (error) {
    // The module's own not-found, not the framework's: it keeps the back link
    // and says which record. Anything that is not a 404 is a real failure and
    // gets the error block instead.
    if (error instanceof ApiError && error.status === 404) {
      return (
        <>
          <BackLink label={t("back")} />
          <EmptyState
            icon="coin"
            title={t("notFound.title")}
            description={t("notFound.body")}
            action={
              <Button asChild>
                <Link href="/coins/issues">{t("notFound.cta")}</Link>
              </Button>
            }
          />
        </>
      );
    }

    return (
      <>
        <BackLink label={t("back")} />
        <ErrorState title={t("error.title")} description={t("error.body")} />
      </>
    );
  }

  const cancelled = issue.registerStatus === "cancelled";

  return (
    <>
      <BackLink label={t("back")} />

      <PageHeader
        title={issue.code}
        subtitle={t("meta", {
          staff: issue.staffName,
          phone: issue.staffPhone ?? "",
          date: formatDate(issue.issueDate, locale),
        })}
        actions={
          // Read-only roles never reach this component's writes: every action
          // behind it posts to an OWNER/ADMIN route, which refuses a MANAGER.
          cancelled ? undefined : <CoinIssueActions issue={issue} variant="detail" />
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <CoinIssueStatusBadge issue={issue} />
        {issue.roundingStub && <RoundingStubBadge />}
      </div>

      {/* Five figures, left to right, in the order the money moved. `Pending`
          is last because it is the conclusion. §8.3 */}
      <DetailSummary
        className="mb-6"
        items={[
          {
            label: t("summary.issued"),
            value: (
              <span className="flex flex-col items-start">
                <Money value={issue.totalAmount} zeroAs="value" />
                <span className="text-caption text-muted-foreground">
                  {t("coinsCount", {
                    coins: formatQuantity(issue.totalCoinsIssued),
                  })}
                </span>
              </span>
            ),
          },
          {
            label: t("summary.returned"),
            value: (
              <span className="flex flex-col items-start">
                <Money value={issue.returnedValue} />
                <span className="text-caption text-muted-foreground">
                  {t("coinsCount", {
                    coins: formatQuantity(issue.totalCoinsReturned),
                  })}
                </span>
              </span>
            ),
          },
          {
            label: t("summary.netPayable"),
            value: <Money value={issue.netPayable} zeroAs="value" />,
          },
          {
            label: t("summary.collected"),
            value: <Money value={issue.paidAmount} />,
          },
          {
            label: t("summary.pending"),
            emphasis: true,
            value: (
              <span className="flex flex-col items-start">
                <Money
                  value={issue.outstandingAmount}
                  emphasis
                  // BLUE in parentheses when the company owes it back. §8.3
                  variant={issue.refundDue ? "refund" : "default"}
                />
                <span
                  className={
                    issue.refundDue
                      ? "text-caption text-primary"
                      : "text-caption text-muted-foreground"
                  }
                >
                  {issue.refundDue
                    ? t("summary.refundDue")
                    : issue.outstandingAmount > 0
                      ? t("summary.stillToCollect")
                      : t("summary.settled")}
                </span>
              </span>
            ),
          },
        ]}
      />

      {/* NOT dismissible: it disappears only when the refund is recorded. §8.3 */}
      {issue.refundDue && !cancelled && (
        <Alert
          variant="info"
          className="mb-6"
          icon={<RotateCcw aria-hidden />}
        >
          <AlertTitle>
            {t("refundBanner.title", {
              staff: issue.staffName,
              amount: formatINR(issue.refundAmount),
            })}
          </AlertTitle>
          <AlertDescription>
            {t("refundBanner.body", {
              paid: formatINR(issue.paidAmount),
              payable: formatINR(issue.netPayable),
            })}
          </AlertDescription>
        </Alert>
      )}

      {issue.roundingStub && !cancelled && (
        <Alert variant="info" className="mb-6">
          <AlertDescription>
            {t("roundingBanner", {
              amount: formatINR(Math.abs(issue.outstandingAmount)),
            })}
          </AlertDescription>
        </Alert>
      )}

      {cancelled && (
        <Alert variant="warning" className="mb-6">
          <AlertDescription>
            {t("cancelledBanner", {
              coins: formatQuantity(issue.coinsOutstanding),
              collected: formatINR(issue.paidAmount),
            })}
          </AlertDescription>
        </Alert>
      )}

      {issue.notes && (
        <p className="mb-6 whitespace-pre-line text-sm text-muted-foreground">
          {issue.notes}
        </p>
      )}

      <CoinIssueDetailTabs issue={issue} />
    </>
  );
}

function BackLink({ label }: { label: string }) {
  return (
    <Link
      href="/coins/issues"
      className="mb-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
    >
      <ChevronLeft className="size-4" aria-hidden />
      {label}
    </Link>
  );
}
