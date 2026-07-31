import { useTranslations } from "next-intl";
import { StatusBadge } from "@/components/common/status-badge";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { StaffOutstanding } from "@/lib/dto/staff.dto";

/**
 * The settlement badge rule. Spec: design/MODULES/01-staff.md §3.3
 *
 * Precedence, and the order matters:
 *
 *   1. `Inactive` wins outright. An inactive member cannot have dues by
 *      business rule, so showing both would state a contradiction.
 *   2. Jars first, then money — jars are physical assets sitting in someone's
 *      auto-rickshaw, and they are the thing that walks away.
 *   3. Nothing outstanding → `Active`.
 *
 * Never more than two badges, so the column stays scannable at arm's length.
 *
 * No "use client": it renders in the server detail page and inside the client
 * table alike, and it holds no state.
 */
export function StaffStatusBadges({
  staff,
  className,
}: {
  staff: StaffOutstanding & { isActive: boolean };
  className?: string;
}) {
  const t = useTranslations("staff");
  const shell = cn("inline-flex flex-wrap items-center gap-1", className);

  if (!staff.isActive) {
    return (
      <span className={shell}>
        <StatusBadge status="inactive" />
      </span>
    );
  }

  const hasJars = staff.jarsOut > 0;
  const hasMoney = staff.moneyOutstanding > 0;

  if (!hasJars && !hasMoney) {
    return (
      <span className={shell}>
        <StatusBadge status="active" />
      </span>
    );
  }

  return (
    <span className={shell}>
      {hasJars && (
        <StatusBadge status="notReturned" count={staff.jarsOut} unit="jars" />
      )}
      {hasMoney && (
        // The badge shows the combined figure; the tooltip splits it, because
        // "₹960 due" and "which ₹960?" are two different questions.
        <span
          title={t("badges.moneyTooltip", {
            cash: formatINR(staff.cashOutstanding),
            coins: formatINR(staff.coinDues),
          })}
        >
          <StatusBadge status="partiallyPaid" amount={staff.moneyOutstanding} />
        </span>
      )}
    </span>
  );
}
