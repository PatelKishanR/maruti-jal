"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertTriangle,
  Ban,
  Banknote,
  CalendarPlus,
  Copy,
  MapPin,
  MoreHorizontal,
  Pencil,
  RotateCcw,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { DetailSummary } from "@/components/common/detail-summary";
import { EmptyState } from "@/components/common/empty-state";
import { Money, Quantity } from "@/components/common/money";
import { Timeline, type TimelineEntry } from "@/components/common/timeline";
import { FormField } from "@/components/form";
import { useFormErrors } from "@/components/form/use-form-errors";
import { api } from "@/lib/api/client";
import { partyOrderPaths, partyOrderRoutes } from "@/lib/api/routes.party-order";
import { formatDate, formatDateTime, todayIST } from "@/lib/dates";
import { formatINR, formatQuantity } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/config";
import type { DayDeliveryStatus } from "@/lib/db/entities/enums";
import type {
  PartyOrderDayDto,
  PartyOrderDetailDto,
} from "@/lib/dto/party-order.dto";
import { ScheduleTimeline } from "../day-card";
import type { PartyProductRef } from "../day-items-editor";
import { DuplicateDayDialog } from "../duplicate-day-dialog";
import { EditDayModal } from "../edit-day-modal";
import { PaymentModal } from "../payment-modal";
import {
  blankDay,
  draftFromDto,
  nextScheduleDate,
  takenDates,
  toDayPayload,
  viewFromDto,
  type DayDraft,
} from "../schedule-model";

/**
 * The booking, live. Spec: design/MODULES/05-party-orders.md §7
 *
 * Talks to the API only. Every mutation here returns the WHOLE booking, and
 * this component replaces its state with it rather than patching a figure in
 * place: `total_amount`, `paid_amount`, `payment_status` and each `day_total`
 * are trigger-maintained, so the server's answer is the only correct one after
 * a write. See .claude/ARCHITECTURE.md §9.1
 */
export function PartyOrderDetail({
  order: initial,
  products,
  initialTab,
  highlightDay,
}: {
  order: PartyOrderDetailDto;
  products: PartyProductRef[];
  initialTab?: string;
  /** `?day=` from a calendar pill — that card is ringed. §10.6 */
  highlightDay?: string;
}) {
  const t = useTranslations("partyOrders");
  /** Server messages arrive as fully-qualified catalogue keys. */
  const tRoot = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [order, setOrder] = useState(initial);
  const [tab, setTab] = useState(initialTab ?? "schedule");
  const [editingDay, setEditingDay] = useState<{
    mode: "add" | "edit";
    day: DayDraft;
    status: DayDeliveryStatus;
  } | null>(null);
  const [duplicating, setDuplicating] = useState<DayDraft | null>(null);
  const [paying, setPaying] = useState(false);
  const [editingBooking, setEditingBooking] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [skipping, setSkipping] = useState<PartyOrderDayDto | null>(null);
  const [removing, setRemoving] = useState<PartyOrderDayDto | null>(null);
  const [dayError, setDayError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  const cancelled = order.status === "CANCELLED";
  const refundDue = order.outstandingAmount < 0;
  const dates = takenDates(order.days);

  function apply(next: PartyOrderDetailDto) {
    setOrder(next);
    // The server-rendered header above this component holds the same figures.
    router.refresh();
  }

  function changeTab(next: string) {
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function findDay(key: string): PartyOrderDayDto | undefined {
    return order.days.find((day) => day.id === key);
  }

  /** Every day write goes through here, so the failure path is written once. */
  function mutate(
    run: () => Promise<PartyOrderDetailDto>,
    success: (next: PartyOrderDetailDto) => string,
    onDone?: () => void,
  ) {
    setDayError(null);
    startBusy(async () => {
      try {
        const next = await run();
        apply(next);
        toast.success(success(next));
        onDone?.();
      } catch (error) {
        // The API returns catalogue KEYS, not sentences — a Gujarati UI must
        // not receive English server errors. See .claude/I18N.md §5.4
        const key =
          error && typeof error === "object" && "messageKey" in error
            ? String((error as { messageKey: unknown }).messageKey)
            : "common.somethingWentWrong";
        setDayError(tRoot.has(key) ? tRoot(key) : t("toast.actionFailed"));
        toast.error(t("toast.actionFailed"));
      }
    });
  }

  function saveDay(draft: DayDraft, status: DayDeliveryStatus) {
    const payload = toDayPayload(draft);
    const existing = editingDay?.mode === "edit";

    mutate(
      () =>
        existing
          ? api.patch<PartyOrderDetailDto>(
              partyOrderRoutes.day(order.id, draft.key),
              { ...payload, deliveryStatus: status },
            )
          : api.post<PartyOrderDetailDto>(partyOrderRoutes.days(order.id), {
              days: [payload],
            }),
      (next) =>
        t(existing ? "toast.dayUpdated" : "toast.dayAdded", {
          date: formatDate(draft.serviceDate, locale),
          total: formatINR(next.totalAmount),
        }),
      () => setEditingDay(null),
    );
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap justify-end gap-3">
        {!cancelled && (
          <>
            <Button
              onClick={() =>
                setEditingDay({
                  mode: "add",
                  day: blankDay(nextScheduleDate(order.days, todayIST())),
                  status: "SCHEDULED",
                })
              }
            >
              <CalendarPlus aria-hidden />
              {t("actions.addDay")}
            </Button>

            <Button variant="secondary" onClick={() => setPaying(true)}>
              <Banknote aria-hidden />
              {t("actions.recordPayment")}
            </Button>

            <Button variant="secondary" onClick={() => setEditingBooking(true)}>
              <Pencil aria-hidden />
              {t("actions.editBooking")}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t("actions.more")}>
                  <MoreHorizontal aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem destructive onSelect={() => setCancelling(true)}>
                  <Ban aria-hidden />
                  {t("actions.cancelBooking")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      {cancelled && (
        <Alert variant="warning" icon={<Ban aria-hidden />} className="mt-4">
          {t("banners.cancelled", { code: order.code })}
        </Alert>
      )}

      {/* Not dismissible: it explains a negative figure the owner has to act on. */}
      {refundDue && !cancelled && (
        <Alert variant="info" icon={<RotateCcw aria-hidden />} className="mt-4">
          {t("banners.refundDue", {
            amount: formatINR(Math.abs(order.outstandingAmount)),
            party: order.partyName,
            paid: formatINR(order.paidAmount),
            total: formatINR(order.totalAmount),
          })}
        </Alert>
      )}

      {dayError && (
        <Alert
          variant="danger"
          icon={<AlertTriangle aria-hidden />}
          className="mt-4"
        >
          {dayError}
        </Alert>
      )}

      <DetailSummary
        className="mt-6"
        items={[
          {
            label: t("summary.payable"),
            value: (
              <Figure
                context={t("summary.payableContext", {
                  days: order.progress.totalDays,
                  units: formatQuantity(order.totalUnits),
                })}
              >
                <Money value={order.totalAmount} className="text-left" />
              </Figure>
            ),
          },
          {
            label: t("summary.received"),
            value: (
              <Figure
                context={t("summary.receivedContext", {
                  advance: formatINR(order.advanceAmount),
                  payments: order.payments.length,
                })}
              >
                <Money value={order.paidAmount} className="text-left" />
              </Figure>
            ),
          },
          {
            label: t("summary.outstanding"),
            emphasis: true,
            value: (
              <Figure
                context={
                  order.progress.nextServiceDate
                    ? t("summary.dueFrom", {
                        date: formatDate(order.progress.nextServiceDate, locale),
                      })
                    : undefined
                }
              >
                <Money
                  value={order.outstandingAmount}
                  emphasis
                  zeroAs="value"
                  variant={refundDue ? "refund" : "default"}
                  className="text-left"
                />
              </Figure>
            ),
          },
          {
            label: t("summary.progress"),
            value: (
              <Figure
                context={
                  order.progress.nextServiceDate
                    ? t("summary.next", {
                        date: formatDate(order.progress.nextServiceDate, locale),
                      })
                    : t("summary.noneScheduled")
                }
              >
                <span className="block text-left">
                  {t("summary.progressValue", {
                    delivered: order.progress.deliveredDays,
                    total: order.progress.totalDays,
                  })}
                </span>
              </Figure>
            ),
          },
        ]}
      />

      <AddressCard
        address={order.deliveryAddress}
        notes={order.notes}
        className="mt-6"
      />

      <Tabs value={tab} onValueChange={changeTab} className="mt-8">
        <TabsList>
          <TabsTrigger value="schedule" count={order.days.length}>
            {t("tabs.schedule")}
          </TabsTrigger>
          <TabsTrigger value="payments" count={order.payments.length}>
            {t("tabs.payments")}
          </TabsTrigger>
          <TabsTrigger value="activity">{t("tabs.activity")}</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule">
          {order.days.length === 0 ? (
            <EmptyState
              icon="party"
              title={t("scheduleTab.empty.title")}
              description={t("scheduleTab.empty.body")}
              action={
                cancelled ? undefined : (
                  <Button
                    onClick={() =>
                      setEditingDay({
                        mode: "add",
                        day: blankDay(todayIST()),
                        status: "SCHEDULED",
                      })
                    }
                  >
                    <CalendarPlus aria-hidden />
                    {t("scheduleTab.empty.action")}
                  </Button>
                )
              }
            />
          ) : (
            <ScheduleTimeline
              days={order.days.map(viewFromDto)}
              highlightDate={highlightDay}
              onAddDay={
                cancelled
                  ? undefined
                  : (date) =>
                      setEditingDay({
                        mode: "add",
                        day: blankDay(date),
                        status: "SCHEDULED",
                      })
              }
              actions={
                cancelled
                  ? undefined
                  : {
                      onEdit: (view) => {
                        const day = findDay(view.key);
                        if (day) {
                          setEditingDay({
                            mode: "edit",
                            day: draftFromDto(day),
                            status: day.deliveryStatus,
                          });
                        }
                      },
                      onDuplicate: (view) => {
                        const day = findDay(view.key);
                        if (day) setDuplicating(draftFromDto(day));
                      },
                      onRemove: (view) => {
                        const day = findDay(view.key);
                        if (day) setRemoving(day);
                      },
                      onMarkSkipped: (view) => {
                        const day = findDay(view.key);
                        if (day) setSkipping(day);
                      },
                      onRestore: (view) => {
                        const day = findDay(view.key);
                        if (!day) return;
                        mutate(
                          () =>
                            api.patch<PartyOrderDetailDto>(
                              partyOrderRoutes.day(order.id, day.id),
                              { deliveryStatus: "SCHEDULED" },
                            ),
                          () =>
                            t("toast.dayRestored", {
                              date: formatDate(day.serviceDate, locale),
                            }),
                        );
                      },
                      onMarkDelivered: (view) => {
                        const day = findDay(view.key);
                        if (!day) return;
                        /**
                         * Opens the day modal with the actuals pre-filled to the
                         * plan — "leave the quantities as they are if the
                         * delivery matched", and change the one that didn't.
                         * §7.4
                         */
                        const draft = draftFromDto(day);
                        setEditingDay({
                          mode: "edit",
                          status: "DELIVERED",
                          day: {
                            ...draft,
                            items: draft.items.map((item) => ({
                              ...item,
                              deliveredQuantity:
                                item.deliveredQuantity ?? item.quantity,
                            })),
                          },
                        });
                      },
                    }
              }
            />
          )}
        </TabsContent>

        <TabsContent value="payments">
          <PaymentsTab
            order={order}
            onRecord={() => setPaying(true)}
            disabled={cancelled}
          />
        </TabsContent>

        <TabsContent value="activity">
          <ActivityTab order={order} />
        </TabsContent>
      </Tabs>

      {/* ---- Modals ------------------------------------------------- */}

      <EditDayModal
        open={editingDay !== null}
        onOpenChange={(open) => !open && setEditingDay(null)}
        mode={editingDay?.mode ?? "add"}
        subtitle={`${order.code} · ${order.partyName}`}
        day={editingDay?.day ?? blankDay(todayIST())}
        status={editingDay?.status ?? "SCHEDULED"}
        // A saved day may change status; a brand-new one always starts
        // Scheduled, and the control says so. §8.3
        allowStatus={editingDay?.mode === "edit"}
        takenDates={dates.filter(
          (date) => date !== (editingDay?.day.serviceDate ?? ""),
        )}
        products={products}
        bookingTotal={order.totalAmount}
        submitting={busy}
        error={dayError}
        onSubmit={saveDay}
      />

      <DuplicateDayDialog
        open={duplicating !== null}
        onOpenChange={(open) => !open && setDuplicating(null)}
        source={duplicating}
        takenDates={dates}
        submitting={busy}
        onDuplicate={(day) =>
          mutate(
            () =>
              api.post<PartyOrderDetailDto>(partyOrderRoutes.days(order.id), {
                days: [toDayPayload(day)],
              }),
            (next) =>
              t("toast.dayAdded", {
                date: formatDate(day.serviceDate, locale),
                total: formatINR(next.totalAmount),
              }),
            () => setDuplicating(null),
          )
        }
      />

      <PaymentModal
        open={paying}
        onOpenChange={setPaying}
        order={order}
        onRecorded={apply}
      />

      <EditBookingDialog
        open={editingBooking}
        onOpenChange={setEditingBooking}
        order={order}
        onSaved={() => {
          setEditingBooking(false);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={skipping !== null}
        onOpenChange={(open) => !open && setSkipping(null)}
        title={t("skipDay.title", {
          date: skipping ? formatDate(skipping.serviceDate, locale) : "",
        })}
        description={t("skipDay.body", {
          from: formatINR(order.totalAmount),
          to: formatINR(order.totalAmount - (skipping?.dayTotal ?? 0)),
        })}
        confirmLabel={t("skipDay.confirm")}
        variant="primary"
        onConfirm={() => {
          if (!skipping) return;
          const day = skipping;
          setSkipping(null);
          mutate(
            () =>
              api.patch<PartyOrderDetailDto>(
                partyOrderRoutes.day(order.id, day.id),
                { deliveryStatus: "SKIPPED" },
              ),
            (next) =>
              t("toast.daySkipped", {
                date: formatDate(day.serviceDate, locale),
                total: formatINR(next.totalAmount),
              }),
          );
        }}
      />

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t("removeDay.title", {
          date: removing ? formatDate(removing.serviceDate, locale) : "",
        })}
        description={
          removing?.deliveryStatus === "DELIVERED"
            ? t("removeDay.deliveredBody")
            : t("removeDay.body", {
                items: removing?.items.length ?? 0,
                amount: formatINR(removing?.dayTotal ?? 0),
                from: formatINR(order.totalAmount),
                to: formatINR(order.totalAmount - (removing?.dayTotal ?? 0)),
              })
        }
        confirmLabel={
          removing?.deliveryStatus === "DELIVERED"
            ? t("removeDay.cancelDay")
            : t("removeDay.confirm")
        }
        onConfirm={() => {
          if (!removing) return;
          const day = removing;
          setRemoving(null);

          // A DELIVERED day is CANCELLED, never deleted — billing history is
          // preserved, and the server refuses the delete anyway. §7
          mutate(
            () =>
              day.deliveryStatus === "DELIVERED"
                ? api.patch<PartyOrderDetailDto>(
                    partyOrderRoutes.day(order.id, day.id),
                    { deliveryStatus: "CANCELLED" },
                  )
                : api.del<PartyOrderDetailDto>(
                    partyOrderRoutes.day(order.id, day.id),
                  ),
            (next) =>
              t("toast.dayRemoved", {
                date: formatDate(day.serviceDate, locale),
                total: formatINR(next.totalAmount),
              }),
          );
        }}
      />

      <ConfirmDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={t("cancelBooking.title", { code: order.code })}
        description={t("cancelBooking.body", {
          party: order.partyName,
          days: order.progress.scheduledDays,
          received: formatINR(order.paidAmount),
          from: order.firstServiceDate
            ? formatDate(order.firstServiceDate, locale)
            : "—",
        })}
        confirmLabel={t("cancelBooking.confirm")}
        onConfirm={async () => {
          try {
            await api.del(partyOrderRoutes.cancel(order.id));
            toast.success(t("toast.cancelled", { code: order.code }));
            router.refresh();
          } catch {
            toast.error(t("toast.actionFailed"));
          }
        }}
      />
    </>
  );
}

function Figure({
  context,
  children,
}: {
  context?: string;
  children: React.ReactNode;
}) {
  return (
    <span className="block">
      {children}
      {context && (
        <span className="mt-1 block font-sans text-caption font-normal text-muted-foreground">
          {context}
        </span>
      )}
    </span>
  );
}

/** The address the driver reads on the day, one tap from the clipboard. §7.3 */
function AddressCard({
  address,
  notes,
  className,
}: {
  address: string;
  notes: string | null;
  className?: string;
}) {
  const t = useTranslations("partyOrders");

  return (
    <section
      className={cn(
        "flex items-start gap-3 rounded-lg border border-border bg-card p-4",
        className,
      )}
    >
      <MapPin className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />

      <div className="min-w-0 flex-1">
        <h2 className="sr-only">{t("address.heading")}</h2>
        <p className="whitespace-pre-line text-base text-foreground">{address}</p>
        {notes && (
          <p className="mt-1 text-sm text-muted-foreground">
            &ldquo;{notes}&rdquo;
          </p>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          void navigator.clipboard
            .writeText([address, notes].filter(Boolean).join("\n"))
            .then(() => toast.success(t("address.copied")));
        }}
      >
        <Copy aria-hidden />
        {t("address.copy")}
      </Button>
    </section>
  );
}

/**
 * The payment history. Newest first — the component does not sort.
 *
 * An ADVANCE is visually distinct wherever it sits in the list: a Primary
 * badge, a blue rail dot regardless of position, and a sub-line saying it was
 * taken before any delivery. It is a subset of what has been received, never a
 * separate bucket. §7.3
 */
function PaymentsTab({
  order,
  onRecord,
  disabled,
}: {
  order: PartyOrderDetailDto;
  onRecord: () => void;
  disabled: boolean;
}) {
  const t = useTranslations("partyOrders");
  const locale = useLocale() as Locale;

  const entries: TimelineEntry[] = order.payments.map((payment) => ({
    id: payment.id,
    tone: payment.isAdvance ? "primary" : payment.direction === "OUT" ? "warning" : "success",
    title: (
      <span className="flex flex-wrap items-center gap-2">
        <Money
          value={payment.direction === "OUT" ? -payment.amount : payment.amount}
          emphasis
          variant={payment.direction === "OUT" ? "refund" : "default"}
        />
        <span className="text-muted-foreground">
          · {t(`payment.modes.${payment.mode}`)}
        </span>
        {payment.referenceNo && (
          <span className="text-muted-foreground">
            · {t("payments.reference", { reference: payment.referenceNo })}
          </span>
        )}
        {payment.isAdvance && (
          <Badge variant="primary" icon={<Banknote aria-hidden />}>
            {t("payment.advanceBadge")}
          </Badge>
        )}
        {payment.isReversed && <Badge>{t("payments.reversed")}</Badge>}
      </span>
    ),
    meta: `${payment.code} · ${formatDateTime(payment.createdAt, locale)}`,
    note: payment.isAdvance
      ? t("payments.advanceNote")
      : (payment.note ?? undefined),
  }));

  if (order.payments.length === 0) {
    return (
      <EmptyState
        icon="payment"
        title={t("payments.empty.title")}
        description={t("payments.empty.body", {
          amount: formatINR(order.totalAmount),
          days: order.progress.totalDays,
        })}
        action={
          disabled ? undefined : (
            <Button onClick={onRecord}>
              <Banknote aria-hidden />
              {t("actions.recordPayment")}
            </Button>
          )
        }
      />
    );
  }

  return (
    <div>
      <Timeline entries={entries} />

      {/* Both figures come from the database — nothing here adds up rupees. */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted px-4 py-3">
        <p className="text-sm text-muted-foreground">
          {order.outstandingAmount === 0
            ? t("payments.settled", { amount: formatINR(order.paidAmount) })
            : t("payments.running", {
                paid: formatINR(order.paidAmount),
                total: formatINR(order.totalAmount),
                outstanding: formatINR(Math.abs(order.outstandingAmount)),
              })}
        </p>
        {!disabled && (
          <Button onClick={onRecord}>
            <Banknote aria-hidden />
            {t("actions.recordPayment")}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * What happened, when.
 *
 * Derived from the booking itself — its creation, its payments and the days
 * already marked delivered. A fuller trail lives in `audit_logs` and
 * `document_revisions`; surfacing those is its own read model.
 * TODO(wave-N): read the revision log once it has an API.
 */
function ActivityTab({ order }: { order: PartyOrderDetailDto }) {
  const t = useTranslations("partyOrders");
  const locale = useLocale() as Locale;

  const entries: TimelineEntry[] = [
    ...order.payments.map((payment) => ({
      id: `payment-${payment.id}`,
      tone: "success" as const,
      title: t(payment.isAdvance ? "activity.advance" : "activity.payment", {
        amount: formatINR(payment.amount),
        mode: t(`payment.modes.${payment.mode}`),
      }),
      meta: formatDateTime(payment.createdAt, locale),
    })),
    ...order.days
      .filter((day) => day.deliveredAt)
      .map((day) => ({
        id: `day-${day.id}`,
        tone: "success" as const,
        title: t("activity.delivered", {
          date: formatDate(day.serviceDate, locale),
          units: formatQuantity(day.totalUnits),
        }),
        meta: formatDateTime(day.deliveredAt as string, locale),
      })),
    {
      id: "created",
      tone: "primary" as const,
      title: t("activity.created", {
        days: order.progress.totalDays,
        amount: formatINR(order.totalAmount),
      }),
      meta: formatDateTime(order.createdAt, locale),
    },
  ].sort((a, b) => (a.id === "created" ? 1 : b.id === "created" ? -1 : 0));

  return <Timeline entries={entries} emptyLabel={t("activity.empty")} />;
}

/**
 * Party details, out of the wizard. Spec §11 — the schedule is edited in place
 * on the timeline, so this dialog is the flat half of that screen.
 *
 * `version` travels back with the save: two admins on one booking must not have
 * the second save silently discard the first one's work. §11.4
 */
function EditBookingDialog({
  open,
  onOpenChange,
  order,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: PartyOrderDetailDto;
  onSaved: () => void;
}) {
  const t = useTranslations("partyOrders.details");
  const tRoot = useTranslations("partyOrders");
  const [values, setValues] = useState({
    partyName: order.partyName,
    phone: order.phone,
    altPhone: order.altPhone ?? "",
    deliveryAddress: order.deliveryAddress,
    notes: order.notes ?? "",
  });
  const [submitting, startSubmit] = useTransition();
  const { fieldErrors, formError, handle } = useFormErrors();

  function save() {
    startSubmit(async () => {
      try {
        await api.patch(partyOrderRoutes.detail(order.id), {
          ...values,
          version: order.version,
        });
        toast.success(tRoot("toast.updated", { code: order.code }));
        onSaved();
      } catch (error) {
        handle(error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={submitting ? undefined : onOpenChange}>
      <DialogContent className="max-w-140">
        <DialogTitle>{tRoot("editBooking.title")}</DialogTitle>
        <DialogDescription>
          {order.code} · {order.partyName}
        </DialogDescription>

        <div className="mt-4 space-y-1">
          {formError && (
            <Alert variant="danger" icon={<AlertTriangle aria-hidden />}>
              {formError}
            </Alert>
          )}

          <FormField
            label={t("nameLabel")}
            required
            htmlFor="edit-party-name"
            error={fieldErrors.partyName}
          >
            <Input
              id="edit-party-name"
              value={values.partyName}
              disabled={submitting}
              onChange={(event) =>
                setValues((v) => ({ ...v, partyName: event.target.value }))
              }
            />
          </FormField>

          <div className="flex flex-wrap gap-6">
            <FormField
              label={t("phoneLabel")}
              required
              htmlFor="edit-party-phone"
              error={fieldErrors.phone}
            >
              <Input
                id="edit-party-phone"
                type="tel"
                className="w-50"
                value={values.phone}
                disabled={submitting}
                onChange={(event) =>
                  setValues((v) => ({ ...v, phone: event.target.value }))
                }
              />
            </FormField>

            <FormField
              label={t("altPhoneLabel")}
              htmlFor="edit-party-alt"
              error={fieldErrors.altPhone}
            >
              <Input
                id="edit-party-alt"
                type="tel"
                className="w-50"
                value={values.altPhone}
                disabled={submitting}
                onChange={(event) =>
                  setValues((v) => ({ ...v, altPhone: event.target.value }))
                }
              />
            </FormField>
          </div>

          <FormField
            label={t("addressLabel")}
            required
            htmlFor="edit-party-address"
            error={fieldErrors.deliveryAddress}
          >
            <Textarea
              id="edit-party-address"
              rows={3}
              value={values.deliveryAddress}
              disabled={submitting}
              onChange={(event) =>
                setValues((v) => ({
                  ...v,
                  deliveryAddress: event.target.value,
                }))
              }
            />
          </FormField>

          <FormField
            label={t("notesLabel")}
            htmlFor="edit-party-notes"
            error={fieldErrors.notes}
          >
            <Textarea
              id="edit-party-notes"
              rows={3}
              value={values.notes}
              disabled={submitting}
              onChange={(event) =>
                setValues((v) => ({ ...v, notes: event.target.value }))
              }
            />
          </FormField>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {tRoot("actions.cancel")}
          </Button>
          <Button
            onClick={save}
            loading={submitting}
            loadingText={tRoot("editBooking.saving")}
          >
            {tRoot("editBooking.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
