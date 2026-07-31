"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  Info,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { FormActions, FormField, MoneyInput, QuantityInput } from "@/components/form";
import { useFormErrors } from "@/components/form/use-form-errors";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { api } from "@/lib/api/client";
import { formatINR } from "@/lib/money";
import {
  createProductSchema,
  productBasePriceSchema,
  productFilterTypeCodeSchema,
  productLitresSchema,
  productSortOrderSchema,
  productTagCodeSchema,
  productTitleSchema,
  updateProductSchema,
} from "@/lib/validation/product";
import type {
  LookupDto,
  ProductDto,
  ProductListResponseDto,
} from "@/lib/dto/product.dto";

/**
 * Add / Edit product. Spec: design/MODULES/02-products.md §5 and §6
 *
 * One component for both, because the edit form IS the add form plus a snapshot
 * banner, a live price-delta chip and a Status section. Two copies would drift
 * within a month, and the fields are the contract.
 *
 * Talks to the API only. See .claude/ARCHITECTURE.md §4
 *
 * The sentence this form exists to make believable: **changing a product never
 * changes past orders.** Every order line carries its own copy of the title,
 * litres, tag, filter type, price and returnable flag. The banner says so out
 * loud, so the owner raises a price without fear.
 */

export interface ProductFormInitial {
  title: string;
  litres: number | null;
  basePrice: number | null;
  tagCode: string;
  filterTypeCode: string;
  description: string;
  isReturnable: boolean;
  sortOrder: number | null;
  isActive: boolean;
}

interface FormValues {
  title: string;
  /** Text while editing — `.5` normalises to `0.500` on blur, not per keystroke. */
  litres: string;
  basePrice: number | null;
  tagCode: string;
  filterTypeCode: string;
  description: string;
  isReturnable: boolean;
  sortOrder: number | null;
  isActive: boolean;
}

const FIELD_IDS = {
  title: "product-title",
  litres: "product-litres",
  basePrice: "product-base-price",
  tagCode: "product-tag",
  filterTypeCode: "product-filter-type",
  description: "product-description",
  sortOrder: "product-sort-order",
} as const;

type FieldName = keyof typeof FIELD_IDS;

/**
 * Blur-time validation reuses the exact schemas the server enforces, so the two
 * can never disagree about what a valid product is.
 *
 * `sortOrder` is `.optional()` here because it is genuinely optional — leaving
 * it blank means "use the default", and blurring an empty optional field must
 * not paint it red.
 */
const FIELD_SCHEMAS = {
  title: productTitleSchema,
  litres: productLitresSchema,
  basePrice: productBasePriceSchema,
  tagCode: productTagCodeSchema,
  filterTypeCode: productFilterTypeCodeSchema,
  sortOrder: productSortOrderSchema.optional(),
} as const;

export function ProductForm({
  mode,
  productId,
  initial,
  tags,
  filterTypes,
}: {
  mode: "create" | "edit";
  /** Required in `edit` mode. */
  productId?: string;
  initial: ProductFormInitial;
  tags: LookupDto[];
  filterTypes: LookupDto[];
}) {
  const t = useTranslations("products");
  const tRoot = useTranslations();
  const router = useRouter();

  const [values, setValues] = useState<FormValues>(() => ({
    ...initial,
    litres: initial.litres === null ? "" : initial.litres.toFixed(3),
  }));
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [duplicate, setDuplicate] = useState<{ id: string; code: string } | null>(
    null,
  );
  const [discarding, setDiscarding] = useState(false);
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  const [submitting, startSubmit] = useTransition();

  const { fieldErrors, formError, setFieldErrors, setFormError, handle } =
    useFormErrors();

  /** Server field errors arrive as catalogue KEYS; so do ours. One path. */
  const resolve = (key: string) => (tRoot.has(key) ? tRoot(key) : key);

  const litresValue = values.litres.trim() === "" ? null : Number(values.litres);

  const dirty = useMemo(
    () =>
      values.title !== initial.title ||
      litresValue !== initial.litres ||
      values.basePrice !== initial.basePrice ||
      values.tagCode !== initial.tagCode ||
      values.filterTypeCode !== initial.filterTypeCode ||
      values.description !== initial.description ||
      values.isReturnable !== initial.isReturnable ||
      values.sortOrder !== initial.sortOrder ||
      values.isActive !== initial.isActive,
    [values, litresValue, initial],
  );

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setFormError(null);
    // Once a field is in error it re-validates live, so the message clears the
    // moment it is fixed. Before that, never interrupt someone mid-entry.
    if (fieldErrors[key as string]) {
      const message = validateOne(key as FieldName, value);
      setFieldErrors((prev) => {
        const next = { ...prev };
        if (message) next[key as string] = message;
        else delete next[key as string];
        return next;
      });
    }
  }

  function validateOne(name: FieldName, raw: unknown): string | null {
    const schema = FIELD_SCHEMAS[name as keyof typeof FIELD_SCHEMAS];
    if (!schema) return null;
    // A null from QuantityInput means "left blank"; the schemas read that as
    // undefined rather than as zero.
    const parsed = schema.safeParse(raw ?? undefined);
    return parsed.success ? null : resolve(parsed.error.issues[0].message);
  }

  function blur(name: FieldName, raw: unknown) {
    setTouched((prev) => ({ ...prev, [name]: true }));
    const message = validateOne(name, raw);
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (message) next[name] = message;
      else delete next[name];
      return next;
    });
  }

  /**
   * A duplicate title is a WARNING, never a block.
   *
   * A plant may legitimately stock two similar 20 L jars, so the owner is told
   * and left to decide. The check excludes this record, so re-saving an
   * unchanged title never warns.
   */
  async function checkDuplicate(title: string) {
    const needle = title.trim();
    if (needle === "") {
      setDuplicate(null);
      return;
    }

    try {
      const found = await api.get<ProductListResponseDto>(
        `/api/products?status=all&pageSize=10&q=${encodeURIComponent(needle)}`,
      );
      const match = found.result.rows.find(
        (row) =>
          row.id !== productId &&
          row.title.toLowerCase() === needle.toLowerCase(),
      );
      setDuplicate(match ? { id: match.id, code: match.code } : null);
    } catch {
      // A failed warning check must never block a save.
      setDuplicate(null);
    }
  }

  function payload() {
    return {
      title: values.title,
      // Litres and base price are sent RAW: the schema turns a blank into
      // "enter a value" rather than into zero, and a cleared required field
      // must still error rather than be quietly skipped.
      litres: values.litres,
      tagCode: values.tagCode,
      filterTypeCode: values.filterTypeCode,
      description: values.description,
      basePrice: values.basePrice,
      isReturnable: values.isReturnable,
      // Sort order genuinely is optional: blank means "use the default".
      sortOrder: values.sortOrder ?? undefined,
      ...(mode === "edit" ? { isActive: values.isActive } : {}),
    };
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();

    // On submit, validate everything at once, then focus the first error.
    const schema = mode === "create" ? createProductSchema : updateProductSchema;
    const parsed = schema.safeParse(payload());

    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      const mapped: Record<string, string> = {};
      for (const [field, messages] of Object.entries(flat)) {
        if (messages?.[0]) mapped[field] = resolve(messages[0]);
      }
      setFieldErrors(mapped);
      focusFirstError(mapped);
      return;
    }

    // Turning Active off is confirmed on SAVE, not on toggle — so the owner can
    // flip it, keep editing, and only be asked once.
    if (mode === "edit" && initial.isActive && !values.isActive) {
      setConfirmingDeactivate(true);
      return;
    }

    void save(parsed.data);
  }

  async function save(body: unknown) {
    setFormError(null);

    startSubmit(async () => {
      try {
        const saved =
          mode === "create"
            ? await api.post<ProductDto>("/api/products", body)
            : await api.patch<ProductDto>(`/api/products/${productId}`, body);

        toast.success(
          mode === "create"
            ? t("toast.created", { title: saved.title })
            : priceChanged
              ? t("toast.updatedWithPrice", {
                  title: saved.title,
                  price: formatINR(saved.basePrice),
                })
              : t("toast.updated", { title: saved.title }),
        );

        // Never leave the owner on a form wondering whether it worked.
        router.push(`/products/${saved.id}`);
        router.refresh();
      } catch (error) {
        handle(error);
      }
    });
  }

  function focusFirstError(errors: Record<string, string>) {
    const first = (Object.keys(FIELD_IDS) as FieldName[]).find(
      (name) => errors[name],
    );
    if (!first) return;
    const element = document.getElementById(FIELD_IDS[first]);
    element?.scrollIntoView({ block: "center", behavior: "smooth" });
    element?.focus();
  }

  function cancel() {
    if (dirty) {
      setDiscarding(true);
      return;
    }
    leave();
  }

  function leave() {
    router.push(mode === "edit" && productId ? `/products/${productId}` : "/products");
  }

  const priceChanged =
    mode === "edit" &&
    initial.basePrice !== null &&
    values.basePrice !== null &&
    values.basePrice !== initial.basePrice;

  const error = (name: FieldName) =>
    touched[name] || fieldErrors[name] ? fieldErrors[name] : undefined;

  return (
    <>
      <Card className="max-w-180 p-6">
        <form onSubmit={submit} noValidate>
          {mode === "edit" && (
            /* Not dismissible. It is the reason the owner is willing to
               press Save on a price rise at all. */
            <Alert
              variant="info"
              icon={<Info aria-hidden />}
              className="mb-6"
              role="note"
            >
              {t("form.snapshotBanner")}
            </Alert>
          )}

          {formError && (
            <Alert
              variant="danger"
              icon={<AlertTriangle aria-hidden />}
              className="mb-4"
            >
              <p className="font-medium">{t("form.couldNotSave")}</p>
              <p className="mt-0.5">{formError}</p>
            </Alert>
          )}

          {/* ---- Title — the primary field, 48px ---------------------- */}
          <FormField
            label={t("form.titleLabel")}
            required
            htmlFor={FIELD_IDS.title}
            error={error("title")}
            hint={t("form.titleHint")}
          >
            <Input
              id={FIELD_IDS.title}
              inputSize="lg"
              value={values.title}
              placeholder={t("form.titlePlaceholder")}
              invalid={!!error("title")}
              disabled={submitting}
              // Autofocus on create only: auto-selecting an existing title on
              // the edit form invites accidental overwrites.
              autoFocus={mode === "create"}
              onChange={(e) => set("title", e.target.value)}
              onBlur={(e) => {
                blur("title", e.target.value);
                void checkDuplicate(e.target.value);
              }}
            />
          </FormField>

          {duplicate && !error("title") && (
            <p className="-mt-3 mb-4 flex items-start gap-1 text-caption text-[var(--badge-warning-fg)]">
              <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
              <span>
                {t("form.duplicateTitle", {
                  title: values.title.trim(),
                  code: duplicate.code,
                })}{" "}
                <Link
                  href={`/products/${duplicate.id}`}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {t("form.duplicateView")}
                </Link>
              </span>
            </p>
          )}

          {/* ---- Litres and Base price -------------------------------
              Sized to their content, not to 50% each. A full-width box for
              a two-digit number is an error magnet. */}
          <div className="flex flex-wrap items-start gap-6">
            <FormField
              label={t("form.litresLabel")}
              required
              htmlFor={FIELD_IDS.litres}
              error={error("litres")}
              hint={t("form.litresHint")}
              className="mb-4"
            >
              <Input
                id={FIELD_IDS.litres}
                className="w-30"
                figure
                inputMode="decimal"
                autoComplete="off"
                value={values.litres}
                placeholder="0.000"
                invalid={!!error("litres")}
                disabled={submitting}
                onChange={(e) => set("litres", e.target.value)}
                onBlur={(e) => {
                  // `20` becomes `20.000`, `.5` becomes `0.500`. Reformatting
                  // on blur rather than per keystroke keeps the caret still.
                  const raw = e.target.value.trim();
                  const parsed = Number(raw);
                  const normalised =
                    raw !== "" && Number.isFinite(parsed)
                      ? parsed.toFixed(3)
                      : raw;
                  setValues((v) => ({ ...v, litres: normalised }));
                  blur("litres", normalised);
                }}
              />
            </FormField>

            <div className="mb-4">
              <Label htmlFor={FIELD_IDS.basePrice} required>
                {t("form.basePriceLabel")}
              </Label>

              {/* The delta chip's space is permanently reserved, so nothing
                  shifts the moment the price changes. §6.5 */}
              <div className="flex flex-wrap items-center gap-3">
                <MoneyInput
                  id={FIELD_IDS.basePrice}
                  value={values.basePrice}
                  invalid={!!error("basePrice")}
                  disabled={submitting}
                  onValueChange={(value) => set("basePrice", value)}
                  onBlur={() => blur("basePrice", values.basePrice)}
                />
                <div className="min-w-50">
                  {priceChanged && <PriceDelta from={initial.basePrice!} to={values.basePrice!} />}
                </div>
              </div>

              <div className="min-h-5">
                {error("basePrice") ? (
                  <p className="mt-1 flex items-start gap-1 text-xs leading-4 text-destructive" role="alert">
                    <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                    <span>{error("basePrice")}</span>
                  </p>
                ) : (
                  <p className="mt-1 text-xs leading-4 text-muted-foreground">
                    {t("form.basePriceHint")}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ---- Tag and Filter type ---------------------------------- */}
          <div className="flex flex-wrap gap-6">
            <LookupField
              id={FIELD_IDS.tagCode}
              label={t("form.tagLabel")}
              placeholder={t("form.tagPlaceholder")}
              hint={t("form.tagHint")}
              emptyLabel={t("form.noTagsYet")}
              error={error("tagCode")}
              value={values.tagCode}
              options={tags}
              disabled={submitting}
              onChange={(value) => {
                set("tagCode", value);
                blur("tagCode", value);
              }}
            />

            <LookupField
              id={FIELD_IDS.filterTypeCode}
              label={t("form.filterTypeLabel")}
              placeholder={t("form.filterTypePlaceholder")}
              emptyLabel={t("form.noFilterTypesYet")}
              error={error("filterTypeCode")}
              value={values.filterTypeCode}
              options={filterTypes}
              disabled={submitting}
              onChange={(value) => {
                set("filterTypeCode", value);
                blur("filterTypeCode", value);
              }}
            />
          </div>

          {/* ---- Description ------------------------------------------ */}
          <FormField
            label={t("form.descriptionLabel")}
            htmlFor={FIELD_IDS.description}
            error={error("description")}
          >
            <Textarea
              id={FIELD_IDS.description}
              rows={3}
              value={values.description}
              placeholder={t("form.descriptionPlaceholder")}
              disabled={submitting}
              onChange={(e) => set("description", e.target.value)}
            />
          </FormField>

          {/* ---- Handling --------------------------------------------- */}
          <Section title={t("form.handlingHeading")}>
            <ToggleRow
              id="product-returnable"
              label={t("form.returnableLabel")}
              checked={values.isReturnable}
              disabled={submitting}
              onCheckedChange={(checked) => set("isReturnable", checked)}
              hint={
                <>
                  {t("form.returnableHint")}
                  {!values.isReturnable && (
                    <span className="mt-1 block">
                      {t("form.returnableOffHint")}
                    </span>
                  )}
                </>
              }
            />

            <FormField
              label={t("form.sortOrderLabel")}
              htmlFor={FIELD_IDS.sortOrder}
              error={error("sortOrder")}
              hint={t("form.sortOrderHint")}
              className="mt-4 mb-0"
            >
              <QuantityInput
                id={FIELD_IDS.sortOrder}
                value={values.sortOrder}
                min={0}
                max={32767}
                invalid={!!error("sortOrder")}
                disabled={submitting}
                onValueChange={(value) => set("sortOrder", value)}
                onBlur={() => blur("sortOrder", values.sortOrder)}
              />
            </FormField>
          </Section>

          {/* ---- Status — edit only ----------------------------------- */}
          {mode === "edit" && (
            <Section title={t("form.statusHeading")}>
              <ToggleRow
                id="product-active"
                label={t("form.activeLabel")}
                checked={values.isActive}
                disabled={submitting}
                onCheckedChange={(checked) => set("isActive", checked)}
                hint={t("form.activeHint")}
              />
            </Section>
          )}

          <FormActions
            onCancel={cancel}
            // §5.5: the primary is NEVER disabled on a create form — pressing
            // it is how the owner discovers what is still missing.
            dirty={mode === "create" ? true : dirty}
            submitting={submitting}
            submitLabel={
              mode === "create" ? t("form.submitCreate") : t("form.submitEdit")
            }
          />
        </form>
      </Card>

      <ConfirmDialog
        open={discarding}
        onOpenChange={setDiscarding}
        title={
          mode === "create" ? t("discard.createTitle") : t("discard.editTitle")
        }
        description={
          mode === "create"
            ? t("discard.createBody", { title: values.title.trim() || "—" })
            : t("discard.editBody", { title: initial.title })
        }
        confirmLabel={t("discard.confirm")}
        onConfirm={leave}
      />

      <ConfirmDialog
        open={confirmingDeactivate}
        onOpenChange={setConfirmingDeactivate}
        title={t("deactivate.title", { title: initial.title })}
        description={t("deactivate.body")}
        confirmLabel={t("deactivate.confirm")}
        onConfirm={() => {
          setConfirmingDeactivate(false);
          const parsed = updateProductSchema.safeParse(payload());
          if (parsed.success) void save(parsed.data);
        }}
      />
    </>
  );
}

/**
 * The live price delta. Feedback, not validation — so it updates on every
 * keystroke, which the "never validate while typing" rule does not cover.
 */
function PriceDelta({ from, to }: { from: number; to: number }) {
  const t = useTranslations("products.form");
  const was = formatINR(from);

  if (to === 0) {
    return (
      <Badge variant="warning" icon={<TrendingDown aria-hidden />}>
        {t("priceToZero", { was })}
      </Badge>
    );
  }

  // A rise from zero has no meaningful percentage — say so rather than divide.
  if (from === 0) {
    return (
      <Badge variant="warning" icon={<TrendingUp aria-hidden />}>
        {t("priceFromFree", { now: formatINR(to) })}
      </Badge>
    );
  }

  const rising = to > from;
  const percent = (Math.abs(to - from) / from) * 100;

  return (
    <Badge
      variant="warning"
      icon={rising ? <TrendingUp aria-hidden /> : <TrendingDown aria-hidden />}
    >
      {rising
        ? t("priceRise", { was, percent: percent.toFixed(1) })
        : t("priceCut", { was, percent: percent.toFixed(1) })}
    </Badge>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-8">
      <h2 className="mb-4 border-b border-border pb-3 text-h4 font-semibold text-foreground">
        {title}
      </h2>
      {children}
    </div>
  );
}

/** 44px tappable row: switch on the left, label and helper on the right. */
function ToggleRow({
  id,
  label,
  hint,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string;
  label: string;
  hint: React.ReactNode;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        className="mt-0.5"
      />
      <div className="min-w-0">
        <Label htmlFor={id} className="mb-0.5">
          {label}
        </Label>
        <p className="text-xs leading-4 text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

/**
 * A lookup select, 320px.
 *
 * Driven by the lookup TABLE, so a tag the owner adds tomorrow appears here
 * with no code change — which is the entire reason tags are data and not an
 * enum. See .claude/MODULES/02-products.md §6.4
 */
function LookupField({
  id,
  label,
  placeholder,
  hint,
  emptyLabel,
  error,
  value,
  options,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  hint?: string;
  emptyLabel: string;
  error?: string;
  value: string;
  options: LookupDto[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const empty = options.length === 0;

  return (
    <FormField
      label={label}
      required
      htmlFor={id}
      error={error}
      hint={hint}
      className="mb-4 w-80 max-w-full"
    >
      <Select
        value={value || undefined}
        disabled={disabled || empty}
        onValueChange={onChange}
      >
        <SelectTrigger id={id} invalid={!!error}>
          <SelectValue placeholder={empty ? emptyLabel : placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.code} value={option.code}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  );
}

/**
 * A fresh form: returnable ON, sort order 100, everything else blank.
 * `duplicate` pre-fills from an existing product with ` (copy)` appended.
 */
export function blankProduct(
  duplicateOf?: ProductDto,
  copySuffix = " (copy)",
): ProductFormInitial {
  if (duplicateOf) {
    return {
      title: `${duplicateOf.title}${copySuffix}`,
      litres: duplicateOf.litres,
      basePrice: duplicateOf.basePrice,
      tagCode: duplicateOf.tagCode,
      filterTypeCode: duplicateOf.filterTypeCode,
      description: duplicateOf.description ?? "",
      isReturnable: duplicateOf.isReturnable,
      sortOrder: duplicateOf.sortOrder,
      isActive: true,
    };
  }

  return {
    title: "",
    litres: null,
    basePrice: null,
    tagCode: "",
    filterTypeCode: "",
    description: "",
    isReturnable: true,
    sortOrder: 100,
    isActive: true,
  };
}

/** An existing record, ready for the edit form. */
export function toFormInitial(product: ProductDto): ProductFormInitial {
  return {
    title: product.title,
    litres: product.litres,
    basePrice: product.basePrice,
    tagCode: product.tagCode,
    filterTypeCode: product.filterTypeCode,
    description: product.description ?? "",
    isReturnable: product.isReturnable,
    sortOrder: product.sortOrder,
    isActive: product.isActive,
  };
}
