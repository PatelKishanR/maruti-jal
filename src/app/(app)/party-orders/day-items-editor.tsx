"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Info, Plus, X } from "lucide-react";
import {
  EntityCombobox,
  MoneyInput,
  QuantityInput,
  type ComboboxOption,
} from "@/components/form";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/common/money";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  blankItem,
  isRateOverridden,
  previewLineTotal,
  rateDifference,
  type ItemDraft,
} from "./schedule-model";

/**
 * The line-item table shared by the Edit-day modal (§8.3) and the repeat
 * generator (§5.4).
 *
 * Identical in both by design: the generator's "items for each generated day"
 * IS a day's item list, and two implementations of it would drift within a
 * week — one of them gaining the delivered column, or the override strip.
 *
 * Every figure here is a PREVIEW. `line_total` is a generated column and
 * `day_total` is a trigger; both are re-read from the database after a save.
 */

/** A product whose LIST price is known, so an override can be spotted. */
export interface PartyProductRef {
  id: string;
  title: string;
  basePrice: number;
}

export function DayItemsEditor({
  items,
  products,
  disabled = false,
  /** The generator plans days that have not happened, so it hides actuals. */
  showDelivered = true,
  onChange,
}: {
  items: ItemDraft[];
  products: PartyProductRef[];
  disabled?: boolean;
  showDelivered?: boolean;
  onChange: (items: ItemDraft[]) => void;
}) {
  const t = useTranslations("partyOrders");

  const basePrices = useMemo(
    () => new Map(products.map((product) => [product.id, product.basePrice])),
    [products],
  );

  function patch(key: string, changes: Partial<ItemDraft>) {
    onChange(
      items.map((item) => (item.key === key ? { ...item, ...changes } : item)),
    );
  }

  return (
    <div>
      <div className="overflow-hidden rounded-md border border-border">
        <div className="hidden bg-muted px-3 py-2 text-caption font-semibold uppercase tracking-[0.04em] text-muted-foreground md:flex md:items-center md:gap-3">
          <span className="flex-1">{t("dayModal.colProduct")}</span>
          <span className="w-24 text-right">{t("dayModal.colPlanned")}</span>
          {showDelivered && (
            <span className="w-24 text-right">{t("dayModal.colDelivered")}</span>
          )}
          <span className="w-20 text-right">{t("dayModal.colBase")}</span>
          <span className="w-32 text-right">{t("dayModal.colUnitPrice")}</span>
          <span className="w-28 text-right">{t("dayModal.colTotal")}</span>
          <span className="w-8" />
        </div>

        <ul className="divide-y divide-border">
          {items.map((item) => (
            <ItemRow
              key={item.key}
              item={item}
              disabled={disabled}
              canRemove={items.length > 1}
              showDelivered={showDelivered}
              basePrices={basePrices}
              onChange={(changes) => patch(item.key, changes)}
              onRemove={() =>
                onChange(items.filter((other) => other.key !== item.key))
              }
            />
          ))}
        </ul>
      </div>

      <Button
        type="button"
        variant="ghost"
        className="mt-2 w-full border border-dashed border-input"
        disabled={disabled}
        onClick={() => onChange([...items, blankItem()])}
      >
        <Plus aria-hidden />
        {t("dayModal.addItem")}
      </Button>
    </div>
  );
}

function ItemRow({
  item,
  disabled,
  canRemove,
  showDelivered,
  basePrices,
  onChange,
  onRemove,
}: {
  item: ItemDraft;
  disabled: boolean;
  canRemove: boolean;
  showDelivered: boolean;
  basePrices: Map<string, number>;
  onChange: (changes: Partial<ItemDraft>) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("partyOrders");
  const overridden = isRateOverridden(item);
  const difference = rateDifference(item);

  function chooseProduct(id: string | null, option: ComboboxOption | null) {
    /**
     * The base price comes from the catalogue read the PAGE did, not from the
     * picker — `/api/products/options` returns a display hint, not a figure. A
     * product outside that read leaves the base unknown, which renders as `—`
     * and simply never flags an override, exactly as §8.5 asks.
     */
    const basePrice = id ? (basePrices.get(id) ?? null) : null;

    onChange({
      productId: id ?? "",
      productTitle: option?.label ?? "",
      productBasePrice: basePrice,
      // The negotiated rate starts at the list price. Events are negotiated
      // down from it, so pre-filling saves the common case a keystroke.
      unitPrice: item.unitPrice ?? basePrice,
    });
  }

  return (
    <li className={cn("px-3 py-2", overridden && "border-l-2 border-warning")}>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
        <div className="min-w-0 flex-1">
          <EntityCombobox
            value={item.productId || null}
            endpoint="/api/products/options"
            placeholder={t("dayModal.productPlaceholder")}
            searchPlaceholder={t("dayModal.productSearch")}
            emptyMessage={t("dayModal.productEmpty")}
            disabled={disabled}
            onValueChange={chooseProduct}
          />
        </div>

        <label className="flex items-center justify-between gap-2 md:w-24 md:justify-end">
          <span className="text-caption text-muted-foreground md:hidden">
            {t("dayModal.colPlanned")}
          </span>
          <QuantityInput
            value={item.quantity}
            min={1}
            disabled={disabled}
            className="w-24"
            onValueChange={(value) => onChange({ quantity: value })}
          />
        </label>

        {showDelivered && (
          <label className="flex items-center justify-between gap-2 md:w-24 md:justify-end">
            <span className="text-caption text-muted-foreground md:hidden">
              {t("dayModal.colDelivered")}
            </span>
            <QuantityInput
              value={item.deliveredQuantity}
              min={0}
              placeholder="—"
              disabled={disabled}
              className="w-24"
              onValueChange={(value) => onChange({ deliveredQuantity: value })}
            />
          </label>
        )}

        <span className="w-20 text-right font-mono text-sm tabular-nums text-muted-foreground">
          {item.productBasePrice === null
            ? "—"
            : formatINR(item.productBasePrice)}
        </span>

        <MoneyInput
          value={item.unitPrice}
          disabled={disabled}
          className="w-32"
          onValueChange={(value) => onChange({ unitPrice: value })}
        />

        <span className="w-28 text-right">
          <Money value={previewLineTotal(item)} emphasis zeroAs="value" />
          {item.deliveredQuantity !== null && (
            <Info
              className="ml-1 inline size-3 text-muted-foreground"
              aria-label={t("dayModal.billedOnDelivered", {
                delivered: item.deliveredQuantity,
                planned: item.quantity ?? 0,
              })}
            />
          )}
        </span>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("dayModal.removeItem")}
          disabled={disabled || !canRemove}
          onClick={onRemove}
        >
          <X aria-hidden />
        </Button>
      </div>

      {/* The override strip: what was negotiated, per unit AND per line. §5.4 */}
      {overridden && (
        <p className="mt-1 text-caption text-[var(--badge-warning-fg)]">
          {t("dayModal.rateOverridden", {
            difference: `${difference > 0 ? "+" : "−"}${formatINR(Math.abs(difference))}`,
            line: `${difference > 0 ? "+" : "−"}${formatINR(
              Math.abs((Math.round(difference * 100) * (item.quantity ?? 0)) / 100),
            )}`,
          })}
        </p>
      )}
    </li>
  );
}
