"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { FormActions, FormField, MoneyInput, QuantityInput } from "@/components/form";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { api, ApiError } from "@/lib/api/client";
import { formatINR, formatQuantity } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  COIN_TYPE_COLOURS,
  createCoinTypeSchema,
  updateCoinTypeSchema,
} from "@/lib/validation/coin-type";
import type { CoinTypeDetailDto, CoinTypeDto } from "@/lib/dto/coin-type.dto";
import { formatPerCoinValue, StockPackets } from "./coin-figures";

/**
 * Coin type form. Spec: design MODULES/04-coins §4
 *
 * The point of this screen is the DERIVED PER-COIN VALUE. It recomputes on
 * every keystroke, with no animation, so the owner never does the division
 * himself and never wonders whether the figure is stale. Everything else is a
 * normal form around it.
 *
 * The value shown here is a PREVIEW. `per_coin_price` is a generated column in
 * PostgreSQL and is never posted — a value computed in JavaScript and a value
 * computed in SQL are two sources of truth, and one of them will eventually be
 * wrong. See .claude/DATA-MODEL.md §8.2
 */
export function CoinTypeForm({
  coinType,
}: {
  /** Present = edit. Absent = create. */
  coinType?: CoinTypeDetailDto;
}) {
  const t = useTranslations("coins.types");
  const tRoot = useTranslations();
  const router = useRouter();
  const isEdit = !!coinType;

  const [name, setName] = useState(coinType?.name ?? "");
  const [coinsPerPacket, setCoinsPerPacket] = useState<number | null>(
    coinType?.coinsPerPacket ?? null,
  );
  const [packetAmount, setPacketAmount] = useState<number | null>(
    coinType?.packetAmount ?? null,
  );
  const [openingStock, setOpeningStock] = useState<number | null>(null);
  const [colourHex, setColourHex] = useState<string>(
    coinType?.colourHex ?? COIN_TYPE_COLOURS[0],
  );
  const [isActive, setIsActive] = useState(coinType?.isActive ?? true);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [submitting, startSubmit] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const dirty =
    name !== (coinType?.name ?? "") ||
    coinsPerPacket !== (coinType?.coinsPerPacket ?? null) ||
    packetAmount !== (coinType?.packetAmount ?? null) ||
    (openingStock ?? 0) !== 0 ||
    colourHex !== (coinType?.colourHex ?? COIN_TYPE_COLOURS[0]) ||
    isActive !== (coinType?.isActive ?? true);

  /** Server errors arrive as catalogue KEYS, so client and server render the
   *  same message through the same component. See .claude/I18N.md §5.4 */
  const resolve = (key: string) => (tRoot.has(key) ? tRoot(key) : key);

  /* ── The derived value ──────────────────────────────────────────────── */

  const perCoin =
    coinsPerPacket && coinsPerPacket > 0 && packetAmount !== null
      ? Math.round((packetAmount / coinsPerPacket) * 1_000_000) / 1_000_000
      : null;

  /**
   * The five-paise gap, stated before it can surprise anyone.
   *
   * Row-level amounts round to two decimals, so 45 coins returned one at a
   * time credit ₹499.95 against a ₹500 packet. Showing it on the form is
   * cheaper than explaining it later. MODULES/04-coins.md §8.2
   */
  const rounding =
    perCoin !== null && coinsPerPacket && packetAmount !== null
      ? (() => {
          const perCoinTwoDp = Math.round(perCoin * 100) / 100;
          const credited =
            Math.round(perCoinTwoDp * coinsPerPacket * 100) / 100;
          const shortfall = Math.round((packetAmount - credited) * 100) / 100;
          return shortfall !== 0 ? { credited, shortfall } : null;
        })()
      : null;

  /* ── Validation ─────────────────────────────────────────────────────── */

  function payload() {
    return isEdit
      ? { name, coinsPerPacket, packetAmount, colourHex, isActive }
      : {
          name,
          coinsPerPacket,
          packetAmount,
          openingStock: openingStock ?? 0,
          colourHex,
        };
  }

  function collectErrors(): Record<string, string> {
    const schema = isEdit ? updateCoinTypeSchema : createCoinTypeSchema;
    const parsed = schema.safeParse(payload());
    if (parsed.success) return {};

    const flat = parsed.error.flatten().fieldErrors;
    const mapped: Record<string, string> = {};
    for (const [field, messages] of Object.entries(flat)) {
      if (messages?.[0]) mapped[field] = resolve(messages[0]);
    }
    return mapped;
  }

  /**
   * Validate on BLUR, never while typing — interrupting someone mid-entry is
   * hostile. Once a field is wrong it re-validates live, so the error clears
   * the moment it is fixed. DESIGN-STANDARDS §6.4
   */
  function validateField(field: string) {
    const all = collectErrors();
    setErrors((previous) => ({ ...previous, [field]: all[field] ?? "" }));
  }

  function reValidate(field: string) {
    if (!errors[field]) return;
    validateField(field);
  }

  /* ── Submit ─────────────────────────────────────────────────────────── */

  function submit(event?: React.FormEvent) {
    event?.preventDefault();
    setFormError(null);

    const found = collectErrors();
    if (Object.keys(found).length > 0) {
      setErrors(found);
      // Focus the first thing that is wrong, rather than making the owner hunt.
      const first = formRef.current?.querySelector<HTMLElement>(
        "[aria-invalid='true']",
      );
      first?.scrollIntoView({ block: "center", behavior: "smooth" });
      first?.focus();
      return;
    }
    setErrors({});

    startSubmit(async () => {
      try {
        if (isEdit) {
          const saved = await api.patch<CoinTypeDto>(
            `/api/coin-types/${coinType.id}`,
            payload(),
          );
          toast.success(t("form.updatedToast", { name: saved.name }));
          router.push(`/coins/types/${saved.id}`);
        } else {
          const created = await api.post<CoinTypeDto>(
            "/api/coin-types",
            payload(),
          );
          toast.success(
            created.balanceCoins > 0
              ? t("form.createdToast", {
                  name: created.name,
                  coins: formatQuantity(created.balanceCoins),
                })
              : t("form.createdToastNoStock", { name: created.name }),
          );
          router.push(`/coins/types/${created.id}`);
        }
        router.refresh();
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.fieldErrors) {
            const mapped: Record<string, string> = {};
            for (const [field, keys] of Object.entries(error.fieldErrors)) {
              if (keys?.[0]) mapped[field] = resolve(keys[0]);
            }
            setErrors(mapped);
            return;
          }
          // A duplicate name belongs on the name field, not in a banner — the
          // database index is what finally decides it, and the owner should be
          // told where to type, not that something went wrong.
          if (error.messageKey.endsWith("nameTaken")) {
            setErrors({ name: t("errors.nameTaken") });
            return;
          }
          setFormError(resolve(error.messageKey));
          return;
        }
        setFormError(tRoot("common.somethingWentWrong"));
      }
    });
  }

  function cancel() {
    if (dirty) {
      setDiscarding(true);
      return;
    }
    router.back();
  }

  return (
    <>
      <form
        ref={formRef}
        noValidate
        onSubmit={submit}
        onKeyDown={(event) => {
          // ⌘/Ctrl + Enter submits from anywhere on the form. §4.6
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            submit();
          }
          if (event.key === "Escape" && dirty) {
            event.preventDefault();
            setDiscarding(true);
          }
        }}
      >
        <Card className={cn("max-w-[720px] p-6", submitting && "opacity-60")}>
          {isEdit && coinType.ledgerEntryCount > 0 && (
            // A warning, not an error: the edit is allowed, but the owner needs
            // to know what it does and does not touch. DESIGN-STANDARDS §6.4
            <Alert
              variant="warning"
              icon={<AlertTriangle aria-hidden />}
              className="mb-6"
            >
              {t("form.ledgerWarning", {
                name: coinType.name,
                count: formatQuantity(coinType.ledgerEntryCount),
                rate: formatPerCoinValue(coinType.perCoinPrice),
              })}
            </Alert>
          )}

          <FormField
            label={t("form.nameLabel")}
            required
            error={errors.name || null}
            hint={t("form.nameHint")}
          >
            {({ id, invalid }) => (
              <Input
                id={id}
                autoFocus
                value={name}
                invalid={invalid}
                disabled={submitting}
                maxLength={120}
                placeholder={t("form.namePlaceholder")}
                onChange={(e) => {
                  setName(e.target.value);
                  reValidate("name");
                }}
                onBlur={() => validateField("name")}
              />
            )}
          </FormField>

          <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
            <FormField
              label={t("form.coinsPerPacketLabel")}
              required
              error={errors.coinsPerPacket || null}
              hint={t("form.coinsPerPacketHint")}
              className="mb-4 sm:w-[160px]"
            >
              {({ id, invalid }) => (
                <QuantityInput
                  id={id}
                  min={1}
                  value={coinsPerPacket}
                  invalid={invalid}
                  disabled={submitting}
                  placeholder="100"
                  onValueChange={(v) => {
                    setCoinsPerPacket(v);
                    reValidate("coinsPerPacket");
                  }}
                  onBlur={() => validateField("coinsPerPacket")}
                />
              )}
            </FormField>

            <FormField
              label={t("form.packetAmountLabel")}
              required
              error={errors.packetAmount || null}
              hint={t("form.packetAmountHint")}
              className="mb-4 sm:w-[220px]"
            >
              {({ id, invalid }) => (
                <MoneyInput
                  id={id}
                  value={packetAmount}
                  invalid={invalid}
                  disabled={submitting}
                  placeholder="1,000.00"
                  onValueChange={(v) => {
                    setPacketAmount(v);
                    reValidate("packetAmount");
                  }}
                  onBlur={() => validateField("packetAmount")}
                />
              )}
            </FormField>
          </div>

          {/* The hero of the page. Recomputes on every keystroke, with NO
              animation — an animated number reads as slower, and this one is
              being compared against a calculator. §4.3 */}
          <section
            aria-live="polite"
            className="mb-4 rounded-md bg-muted p-4 dark:border dark:border-border"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-caption font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                {t("form.derivedLabel")}
              </h2>
              <Badge>{t("form.derivedBadge")}</Badge>
            </div>

            <p
              className={cn(
                "mt-2 font-mono text-h2 font-bold tabular-nums",
                perCoin === null ? "text-muted-foreground/60" : "text-foreground",
              )}
            >
              {perCoin === null ? "₹—.——" : formatPerCoinValue(perCoin)}
            </p>

            <p className="mt-1 text-caption leading-relaxed text-muted-foreground">
              {perCoin === null
                ? t("form.derivedEmpty")
                : rounding
                  ? t("form.derivedFormulaUneven", {
                      amount: formatINR(packetAmount ?? 0),
                      coins: formatQuantity(coinsPerPacket ?? 0),
                      credited: formatINR(rounding.credited),
                      shortfall: formatINR(rounding.shortfall),
                    })
                  : t("form.derivedFormula", {
                      amount: formatINR(packetAmount ?? 0),
                      coins: formatQuantity(coinsPerPacket ?? 0),
                    })}
            </p>
          </section>

          {/* Opening stock writes an OPENING ledger row, never a column — the
              ledger stays the single source of truth. MODULES/04-coins.md §4.1 */}
          <FormField
            label={t("form.openingStockLabel")}
            error={errors.openingStock || null}
            hint={
              isEdit ? t("form.openingStockLocked") : t("form.openingStockHint")
            }
          >
            {({ id, invalid }) => (
              <div className="flex items-center gap-3">
                <QuantityInput
                  id={id}
                  min={0}
                  value={isEdit ? null : openingStock}
                  invalid={invalid}
                  disabled={isEdit || submitting}
                  placeholder="0"
                  onValueChange={(v) => {
                    setOpeningStock(v);
                    reValidate("openingStock");
                  }}
                  onBlur={() => validateField("openingStock")}
                />
                {!isEdit && !!openingStock && !!coinsPerPacket && (
                  <span className="text-sm text-muted-foreground">
                    ={" "}
                    <StockPackets
                      coins={openingStock}
                      coinsPerPacket={coinsPerPacket}
                    />
                  </span>
                )}
              </div>
            )}
          </FormField>

          <fieldset className="mb-4">
            <legend className="mb-1.5 text-sm font-medium text-foreground">
              {t("form.colourLabel")}
            </legend>
            <div role="radiogroup" className="flex flex-wrap gap-2">
              {COIN_TYPE_COLOURS.map((colour, index) => {
                const selected = colourHex === colour;
                return (
                  <button
                    key={colour}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={t("form.colourOption", { index: index + 1 })}
                    disabled={submitting}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setColourHex(colour)}
                    onKeyDown={(event) => {
                      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
                        return;
                      }
                      event.preventDefault();
                      const step = event.key === "ArrowRight" ? 1 : -1;
                      const next =
                        (index + step + COIN_TYPE_COLOURS.length) %
                        COIN_TYPE_COLOURS.length;
                      setColourHex(COIN_TYPE_COLOURS[next]);
                    }}
                    className={cn(
                      "size-8 rounded-full transition-shadow duration-100",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                      selected &&
                        "ring-2 ring-primary ring-offset-2 ring-offset-card",
                    )}
                    style={{ backgroundColor: colour }}
                  />
                );
              })}
            </div>
          </fieldset>

          {isEdit && (
            <div className="mb-4 flex items-center gap-3">
              <Switch
                id="coin-type-active"
                checked={isActive}
                disabled={submitting}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="coin-type-active">{t("form.activeLabel")}</Label>
            </div>
          )}

          {formError && (
            <Alert
              variant="danger"
              icon={<AlertTriangle aria-hidden />}
              className="mb-4"
            >
              <p className="font-medium">{t("form.formError")}</p>
              <p className="mt-0.5">{formError}</p>
            </Alert>
          )}

          <FormActions
            onCancel={cancel}
            dirty={dirty}
            submitting={submitting}
            submitLabel={isEdit ? t("form.submitEdit") : t("form.submit")}
            submittingLabel={t("form.submitting")}
          />
        </Card>
      </form>

      <ConfirmDialog
        open={discarding}
        onOpenChange={setDiscarding}
        title={t("form.discardTitle")}
        description={t("form.discardBody")}
        confirmLabel={t("form.discardConfirm")}
        onConfirm={() => router.back()}
      />
    </>
  );
}
