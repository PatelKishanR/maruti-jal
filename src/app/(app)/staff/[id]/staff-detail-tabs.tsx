"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ClipboardList, Coins, Banknote, Phone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/common/empty-state";
import { Timeline, type TimelineEntry } from "@/components/common/timeline";
import { StatusBadge } from "@/components/common/status-badge";
import { formatDate, formatDateTime } from "@/lib/dates";
import type { Locale } from "@/i18n/config";
import type { StaffDetailDto } from "@/lib/dto/staff.dto";

const TABS = ["overview", "orders", "coins", "payments", "activity"] as const;
type TabKey = (typeof TABS)[number];

/**
 * Detail tabs. Spec: design/MODULES/01-staff.md §4.3
 *
 * The active tab lives in the URL (`?tab=orders`), so refresh, back and a
 * pasted link all land on the same view — and the blocked-deactivation dialog
 * can link straight to the tab that explains a figure.
 *
 * Four of the five tabs are empty by construction today: orders, coin issues
 * and payments are separate modules. They render the real empty state rather
 * than being hidden, because a missing tab reads as "this person has no
 * orders" — which is a different claim.
 */
export function StaffDetailTabs({ staff }: { staff: StaffDetailDto }) {
  const t = useTranslations("staff");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const raw = searchParams.get("tab");
  const active: TabKey = (TABS as readonly string[]).includes(raw ?? "")
    ? (raw as TabKey)
    : "overview";

  const onTabChange = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "overview") params.delete("tab");
      else params.set("tab", next);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return (
    <Tabs value={active} onValueChange={onTabChange} className="mt-8">
      <TabsList>
        <TabsTrigger value="overview">{t("tabs.overview")}</TabsTrigger>
        <TabsTrigger value="orders" count={staff.deliveryOrderCount}>
          {t("tabs.orders")}
        </TabsTrigger>
        <TabsTrigger value="coins" count={staff.coinIssueCount}>
          {t("tabs.coins")}
        </TabsTrigger>
        <TabsTrigger value="payments" count={staff.paymentCount}>
          {t("tabs.payments")}
        </TabsTrigger>
        <TabsTrigger value="activity">{t("tabs.activity")}</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <Card className="p-6 lg:col-span-3">
            <h2 className="mb-4 text-h4 font-semibold text-foreground">
              {t("detail.contact")}
            </h2>
            <dl className="flex flex-col gap-3">
              <Row label={t("form.phone.label")}>
                <span className="inline-flex items-center gap-2">
                  <span className="font-mono text-[15px]">{staff.phone}</span>
                  <a
                    href={`tel:${staff.phone}`}
                    aria-label={t("detail.call", { phone: staff.phone })}
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    <Phone className="size-4" aria-hidden />
                  </a>
                </span>
              </Row>
              <Row label={t("form.altPhone.label")}>
                {staff.altPhone ? (
                  <span className="font-mono text-[15px]">{staff.altPhone}</span>
                ) : (
                  <Dash />
                )}
              </Row>
              <Row label={t("form.address.label")}>
                {/* Wraps to as many lines as it needs — a detail page never
                    truncates the thing the owner opened it to read. */}
                {staff.address ?? <Dash />}
              </Row>
              <Row label={t("form.joinedOn.label")}>
                {staff.joinedOn ? formatDate(staff.joinedOn, locale) : <Dash />}
              </Row>
              <Row label={t("detail.status")}>
                <StatusBadge status={staff.isActive ? "active" : "inactive"} />
              </Row>
            </dl>
          </Card>

          <div className="flex flex-col gap-6 lg:col-span-2">
            <Card className="p-6">
              <h2 className="mb-4 text-h4 font-semibold text-foreground">
                {t("detail.note")}
              </h2>
              {staff.note ? (
                // Line height 1.6 minimum and preserved breaks, so Gujarati
                // matras are never clipped.
                <p className="whitespace-pre-line text-base leading-relaxed text-foreground">
                  {staff.note}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("detail.noteEmpty")}
                </p>
              )}
            </Card>

            <Card className="p-6">
              <h2 className="mb-4 text-h4 font-semibold text-foreground">
                {t("detail.record")}
              </h2>
              <p className="text-caption text-muted-foreground">
                {t("detail.createdAt", {
                  date: formatDateTime(staff.createdAt, locale),
                  actor: staff.createdByName ?? t("detail.unknownActor"),
                })}
              </p>
              <p className="mt-1 text-caption text-muted-foreground">
                {t("detail.updatedAt", {
                  date: formatDateTime(staff.updatedAt, locale),
                  actor: staff.updatedByName ?? t("detail.unknownActor"),
                })}
              </p>
            </Card>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="orders">
        <EmptyState
          icon={ClipboardList}
          title={t("detail.orders.emptyTitle")}
          description={t("detail.orders.emptyBody", { name: staff.name })}
        />
      </TabsContent>

      <TabsContent value="coins">
        {/* No CTA on this tab or the next: those records are created from
            their own modules, never from here. §4.5 */}
        <EmptyState
          icon={Coins}
          title={t("detail.coins.emptyTitle")}
          description={t("detail.coins.emptyBody", { name: staff.name })}
        />
      </TabsContent>

      <TabsContent value="payments">
        <EmptyState
          icon={Banknote}
          title={t("detail.payments.emptyTitle")}
          description={t("detail.payments.emptyBody", { name: staff.name })}
        />
      </TabsContent>

      <TabsContent value="activity">
        <Card className="p-6">
          <Timeline
            entries={toTimeline(staff, t, locale)}
            emptyLabel={t("detail.activity.empty")}
          />
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
      <dt className="w-35 shrink-0 text-sm font-medium text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 text-base leading-relaxed text-foreground">
        {children}
      </dd>
    </div>
  );
}

function Dash() {
  return <span className="text-muted-foreground/60">—</span>;
}

/** Audit columns are snake_case; the owner reads field names, not columns. */
const FIELD_LABELS: Record<string, string> = {
  name: "name",
  phone: "phone",
  alt_phone: "altPhone",
  address: "address",
  note: "note",
  joined_on: "joinedOn",
  is_active: "isActive",
};

function toTimeline(
  staff: StaffDetailDto,
  t: ReturnType<typeof useTranslations>,
  locale: Locale,
): TimelineEntry[] {
  return staff.activity.map((entry) => {
    const fields = entry.changedFields
      .map((field) => FIELD_LABELS[field])
      .filter((key): key is string => !!key)
      .map((key) => t(`detail.activity.fields.${key}`));

    return {
      id: entry.id,
      title:
        entry.action === "INSERT"
          ? t("detail.activity.created")
          : fields.length > 0
            ? t("detail.activity.changed", { fields: fields.join(", ") })
            : t("detail.activity.updated"),
      meta: t("detail.activity.meta", {
        date: formatDateTime(entry.at, locale),
        actor: entry.actorName ?? t("detail.unknownActor"),
      }),
    };
  });
}
