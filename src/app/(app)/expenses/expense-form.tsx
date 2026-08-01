"use client";

import type {
  ExpenseFormInitial,
  ExpenseSelectOption,
} from "./expense-form-model";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import {
  AlertTriangle,
  Download,
  FileText,
  ImageIcon,
  Info,
  Plus,
  Upload,
  X,
} from "lucide-react";
import {
  DateInput,
  FormActions,
  FormField,
  MoneyInput,
} from "@/components/form";
import { useFormErrors } from "@/components/form/use-form-errors";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { api } from "@/lib/api/client";
import { todayIST } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { ExpensePaymentMode } from "@/lib/db/entities/enums";
import {
  expenseCategoryRoutes,
  type ExpenseCategoryDto,
} from "@/lib/dto/expense-category.dto";
import {
  expensePaths,
  expenseRoutes,
  type ExpenseDto,
} from "@/lib/dto/expense.dto";
import {
  createExpenseSchema,
  expenseAmountSchema,
  expenseCategoryIdSchema,
  expenseDateSchema,
  expenseNoteSchema,
  expensePaidToSchema,
  expensePaymentModeSchema,
  updateExpenseSchema,
} from "@/lib/validation/expense";
import { categoryDotColour } from "./expense-category-colour";
import { monthAsDate, monthOf } from "./expense-months";

/**
 * Add / Edit expense. Spec: design/MODULES/07-expenses.md §4
 *
 * One component for both, because the edit form IS the add form plus a
 * month-impact banner. Two copies would drift within a month, and the fields
 * are the contract.
 *
 * Talks to the API only. See .claude/ARCHITECTURE.md §4
 *
 * The target is fifteen seconds per entry: Amount is autofocused and is the
 * biggest control on the card, the date defaults to today, the category
 * defaults to the last one used, and `⌘/Ctrl + Enter` saves from anywhere on
 * the form. §4.1, §4.6
 */

/**
 * The payment modes, taken from the SCHEMA rather than from the entity enum.
 *
 * `check-layering.mjs` bans every value import of `lib/db/**` from the
 * frontend, and reading `.options` off the zod enum that already validates this
 * field beats a second hand-written list: the dropdown and the validator cannot
 * disagree about what a payment mode is.
 */
const PAYMENT_MODES = expensePaymentModeSchema.options;

interface FormValues {
  expenseDate: string;
  categoryId: string;
  amount: number | null;
  paymentMode: ExpensePaymentMode;
  paidTo: string;
  staffId: string | null;
  note: string;
  receiptUrl: string | null;
}

const FIELD_IDS = {
  amount: "expense-amount",
  expenseDate: "expense-date",
  categoryId: "expense-category",
  paymentMode: "expense-payment-mode",
  paidTo: "expense-paid-to",
  staffId: "expense-staff",
  note: "expense-note",
} as const;

type FieldName = keyof typeof FIELD_IDS;

/**
 * Blur-time validation reuses the exact schemas the server enforces, so the two
 * can never disagree about what a valid expense is. Messages are catalogue
 * KEYS on both sides and are resolved through one path.
 */
const FIELD_SCHEMAS = {
  amount: expenseAmountSchema,
  expenseDate: expenseDateSchema,
  categoryId: expenseCategoryIdSchema,
  paymentMode: expensePaymentModeSchema,
  paidTo: expensePaidToSchema,
  note: expenseNoteSchema,
} as const;

const NO_STAFF = "__none__";

export function ExpenseForm({
  mode,
  expenseId,
  expenseCode,
  initial,
  categories,
  staffOptions,
  canAddCategory = true,
}: {
  mode: "create" | "edit";
  /** Required in `edit` mode. */
  expenseId?: string;
  expenseCode?: string;
  initial: ExpenseFormInitial;
  /** Active categories, plus this record's own if it has been retired. */
  categories: ExpenseSelectOption[];
  staffOptions: ExpenseSelectOption[];
  canAddCategory?: boolean;
}) {
  const t = useTranslations("expenses");
  const tRoot = useTranslations();
  const format = useFormatter();
  const router = useRouter();

  const [values, setValues] = useState<FormValues>(() => ({ ...initial }));
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [categoryList, setCategoryList] = useState(categories);
  const [addingCategory, setAddingCategory] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [submitting, startSubmit] = useTransition();
  const amountRef = useRef<HTMLInputElement>(null);

  const { fieldErrors, formError, setFieldErrors, setFormError, handle } =
    useFormErrors();

  /** Server field errors arrive as catalogue KEYS; so do ours. One path. */
  const resolve = (key: string) => (tRoot.has(key) ? tRoot(key) : key);

  // §4.6: Amount is autofocused. `MoneyInput` forwards its ref to the input, so
  // this is the focus call rather than an `autoFocus` prop it does not take.
  useEffect(() => {
    if (mode === "create") amountRef.current?.focus();
  }, [mode]);

  const dirty = useMemo(
    () =>
      values.expenseDate !== initial.expenseDate ||
      values.categoryId !== initial.categoryId ||
      values.amount !== initial.amount ||
      values.paymentMode !== initial.paymentMode ||
      values.paidTo !== initial.paidTo ||
      values.staffId !== initial.staffId ||
      values.note !== initial.note ||
      values.receiptUrl !== initial.receiptUrl,
    [values, initial],
  );

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setFormError(null);
    // Once a field is in error it re-validates live, so the message clears the
    // moment it is fixed. Before that, never interrupt someone mid-entry. §4.6
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

  function payload() {
    return {
      expenseDate: values.expenseDate,
      categoryId: values.categoryId,
      // Sent RAW: the schema turns a blank into "enter an amount" rather than
      // into zero, so a cleared required field still errors instead of being
      // quietly saved as free.
      amount: values.amount,
      paymentMode: values.paymentMode,
      paidTo: values.paidTo,
      staffId: values.staffId,
      note: values.note,
      receiptUrl: values.receiptUrl,
    };
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (uploadBusy) return;

    // On submit, validate everything at once, then focus the first error. §4.6
    const schema = mode === "create" ? createExpenseSchema : updateExpenseSchema;
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

    void save(parsed.data);
  }

  async function save(body: unknown) {
    setFormError(null);

    startSubmit(async () => {
      try {
        const saved =
          mode === "create"
            ? await api.post<ExpenseDto>(expenseRoutes.create, body)
            : await api.patch<ExpenseDto>(expenseRoutes.byId(expenseId!), body);

        toast.success(
          saved.hasReceipt
            ? t("toast.savedWithReceipt", { amount: formatINR(saved.amount) })
            : t("toast.saved", { amount: formatINR(saved.amount) }),
        );

        // Never leave the owner on a form wondering whether it worked.
        router.push(expensePaths.detail(saved.id));
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
    router.push(
      mode === "edit" && expenseId
        ? expensePaths.detail(expenseId)
        : expensePaths.list,
    );
  }

  const error = (name: FieldName) =>
    touched[name] || fieldErrors[name] ? fieldErrors[name] : undefined;

  const monthLabel = format.dateTime(monthAsDate(monthOf(values.expenseDate)), {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <>
      <Card className="max-w-180 p-6">
        <form
          onSubmit={submit}
          noValidate
          // §4.6: `⌘/Ctrl + Enter` submits from anywhere, including the note
          // textarea, where a bare Enter has to keep inserting a newline.
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              submit(event);
            }
          }}
        >
          {mode === "edit" && (
            /* Not dismissible. Changing an amount or a date moves money
               between months, and the profit figure the owner checked
               yesterday will not match what he sees tomorrow. §4.4 */
            <Alert
              variant="warning"
              icon={<Info aria-hidden />}
              className="mb-6"
              role="note"
            >
              {t("form.monthImpact", {
                code: expenseCode ?? "",
                month: monthLabel,
              })}
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

          {/* ---- Amount and Date ------------------------------------
              Sized to their content, not 50% each. Amount is the primary
              field on a fast-entry form and gets the widest, tallest box. */}
          <div className="flex flex-wrap items-start gap-6">
            <FormField
              label={t("form.amountLabel")}
              required
              htmlFor={FIELD_IDS.amount}
              error={error("amount")}
            >
              <MoneyInput
                ref={amountRef}
                id={FIELD_IDS.amount}
                value={values.amount}
                invalid={!!error("amount")}
                disabled={submitting}
                onValueChange={(value) => set("amount", value)}
                onBlur={() => blur("amount", values.amount)}
              />
            </FormField>

            <FormField
              label={t("form.dateLabel")}
              required
              htmlFor={FIELD_IDS.expenseDate}
              error={error("expenseDate")}
            >
              <DateInput
                id={FIELD_IDS.expenseDate}
                value={values.expenseDate}
                // Money cannot be spent tomorrow. The schema refuses it too;
                // this stops it being offered in the first place. §4.3
                max={todayIST()}
                invalid={!!error("expenseDate")}
                disabled={submitting}
                onValueChange={(value) => {
                  set("expenseDate", value);
                  blur("expenseDate", value);
                }}
              />
            </FormField>
          </div>

          {/* ---- Category and Payment mode --------------------------- */}
          <div className="flex flex-wrap items-start gap-6">
            <div className="w-80 max-w-full">
              <FormField
                label={t("form.categoryLabel")}
                required
                htmlFor={FIELD_IDS.categoryId}
                error={error("categoryId")}
                className="mb-1"
              >
                <Select
                  value={values.categoryId || undefined}
                  disabled={submitting || categoryList.length === 0}
                  onValueChange={(value) => {
                    set("categoryId", value);
                    blur("categoryId", value);
                  }}
                >
                  <SelectTrigger
                    id={FIELD_IDS.categoryId}
                    invalid={!!error("categoryId")}
                  >
                    <SelectValue
                      placeholder={
                        categoryList.length === 0
                          ? t("form.noCategories")
                          : t("form.categoryPlaceholder")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryList.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className="size-2 shrink-0 rounded-full"
                            style={{
                              backgroundColor: categoryDotColour(option.id),
                            }}
                          />
                          {option.label}
                          {option.inactive && (
                            <span className="text-muted-foreground">
                              {t("form.categoryInactiveSuffix")}
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              {/* A category the owner needs but hasn't created yet must not
                  send him to another screen mid-entry. §4.3 */}
              {canAddCategory && (
                <button
                  type="button"
                  onClick={() => setAddingCategory(true)}
                  className="mb-4 inline-flex items-center gap-1 text-caption text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <Plus className="size-3.5" aria-hidden />
                  {t("form.addCategory")}
                </button>
              )}

              {values.categoryId &&
                categoryList.find((c) => c.id === values.categoryId)?.inactive && (
                  <p className="mb-4 text-caption text-muted-foreground">
                    {t("form.categoryInactiveHint")}
                  </p>
                )}
            </div>

            <FormField
              label={t("form.paymentModeLabel")}
              required
              htmlFor={FIELD_IDS.paymentMode}
              error={error("paymentMode")}
              className="w-60 max-w-full"
            >
              <Select
                value={values.paymentMode}
                disabled={submitting}
                onValueChange={(value) =>
                  set("paymentMode", value as FormValues["paymentMode"])
                }
              >
                <SelectTrigger
                  id={FIELD_IDS.paymentMode}
                  invalid={!!error("paymentMode")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_MODES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`paymentModes.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          {/* ---- Paid to and Linked staff ---------------------------- */}
          <div className="flex flex-wrap items-start gap-6">
            <FormField
              label={t("form.paidToLabel")}
              htmlFor={FIELD_IDS.paidTo}
              error={error("paidTo")}
              hint={t("form.paidToHint")}
              className="w-80 max-w-full"
            >
              <Input
                id={FIELD_IDS.paidTo}
                value={values.paidTo}
                placeholder={t("form.paidToPlaceholder")}
                invalid={!!error("paidTo")}
                disabled={submitting}
                onChange={(e) => set("paidTo", e.target.value)}
                onBlur={(e) => blur("paidTo", e.target.value)}
              />
            </FormField>

            <FormField
              label={t("form.staffLabel")}
              htmlFor={FIELD_IDS.staffId}
              hint={
                values.staffId
                  ? t("form.staffSelectedHint", {
                      name:
                        staffOptions.find((s) => s.id === values.staffId)?.label ??
                        "",
                    })
                  : t("form.staffHint")
              }
              className="w-80 max-w-full"
            >
              <Select
                value={values.staffId ?? NO_STAFF}
                disabled={submitting}
                onValueChange={(value) =>
                  set("staffId", value === NO_STAFF ? null : value)
                }
              >
                <SelectTrigger id={FIELD_IDS.staffId}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_STAFF}>{t("form.noStaff")}</SelectItem>
                  {staffOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.hint
                        ? `${option.label} · ${option.hint}`
                        : option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          {/* ---- Note ------------------------------------------------ */}
          <FormField
            label={t("form.noteLabel")}
            htmlFor={FIELD_IDS.note}
            error={error("note")}
          >
            <Textarea
              id={FIELD_IDS.note}
              rows={3}
              value={values.note}
              placeholder={t("form.notePlaceholder")}
              invalid={!!error("note")}
              disabled={submitting}
              onChange={(e) => set("note", e.target.value)}
              onBlur={(e) => blur("note", e.target.value)}
            />
          </FormField>

          {/* ---- Receipt --------------------------------------------- */}
          <ReceiptDropzone
            storedUrl={initial.receiptUrl}
            disabled={submitting}
            onBusyChange={setUploadBusy}
            onUrlChange={(url) => set("receiptUrl", url)}
          />

          <FormActions
            onCancel={cancel}
            // §5.5: the primary is NEVER disabled on a create form — pressing
            // it is how the owner discovers what is still missing.
            dirty={mode === "create" ? true : dirty}
            alwaysEnabled={mode === "create"}
            submitting={submitting}
            // A receipt still uploading would be lost by an early save; a
            // FAILED one never blocks, which is the point of §4.5.
            disabled={uploadBusy}
            submitLabel={
              mode === "create" ? t("form.submitCreate") : t("form.submitEdit")
            }
          />
        </form>
      </Card>

      <ConfirmDialog
        open={discarding}
        onOpenChange={setDiscarding}
        title={t("discard.title")}
        description={t("discard.body", {
          amount:
            values.amount === null ? t("discard.noAmount") : formatINR(values.amount),
          paidTo: values.paidTo.trim() || t("noPayee"),
        })}
        confirmLabel={t("discard.confirm")}
        onConfirm={leave}
      />

      <AddCategoryDialog
        open={addingCategory}
        onOpenChange={setAddingCategory}
        onCreated={(category) => {
          setCategoryList((list) => [
            ...list,
            { id: category.id, label: category.name },
          ]);
          set("categoryId", category.id);
          toast.success(t("form.categoryAdded", { name: category.name }));
        }}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Receipt
// ─────────────────────────────────────────────────────────────────────────────

/** §4.4: `JPG, PNG or PDF · up to 5 MB`. */
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const ACCEPT_ATTR = "image/jpeg,image/png,application/pdf";

interface ReceiptFile {
  name: string;
  /** Bytes. Null for a stored receipt, whose size we were never told. */
  size: number | null;
  /** Object URL for a local preview, or the stored URL. */
  previewUrl: string | null;
  isPdf: boolean;
}

type UploadFailure = "unavailable" | "offline" | "failed";

type ReceiptState =
  | { kind: "empty" }
  | { kind: "rejected"; messageKey: string; detail: string }
  | { kind: "uploading"; file: ReceiptFile; progress: number }
  | { kind: "failed"; file: ReceiptFile; reason: UploadFailure }
  | { kind: "attached"; file: ReceiptFile; url: string };

/**
 * THE ONE SEAM between this dropzone and a storage provider.
 *
 * TODO(infra): no file-storage provider is configured. S3, R2 and UploadThing
 * are all viable and picking one is an infrastructure decision nobody has made
 * — adding a dependency here would make that decision silently, and the wrong
 * one is expensive to unpick once receipts are in it. Replace the body with a
 * signed-upload call; the signature, the progress callback and every state
 * below are already built for it.
 *
 * Until then it reports `unavailable`, which the dropzone SAYS OUT LOUD. A
 * dropzone that accepts a file and quietly discards it is far worse than one
 * that admits storage isn't wired yet: the owner would believe the bill was
 * filed and throw away the paper.
 */
async function uploadReceipt(
  _file: File,
  _onProgress: (percent: number) => void,
): Promise<{ ok: true; url: string } | { ok: false; reason: UploadFailure }> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ok: false, reason: "offline" };
  }
  return { ok: false, reason: "unavailable" };
}

function fileFromUrl(url: string): ReceiptFile {
  const name = decodeURIComponent(url.split("?")[0].split("/").pop() ?? url);
  return {
    name,
    size: null,
    previewUrl: url,
    isPdf: name.toLowerCase().endsWith(".pdf"),
  };
}

/** `1.4 MB`. Latin digits in both languages, like every other figure. */
function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1
    ? `${mb.toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * The receipt dropzone. Spec §4.3, §4.4, §4.5
 *
 * Every state the design asks for is here: idle, drag-over, uploading with
 * progress, attached, too large, wrong type, upload failed and offline — plus
 * the one this codebase actually has, which is "storage isn't configured".
 *
 * **A failed receipt never blocks the expense.** The form stays submittable in
 * every failure state; only an upload still IN FLIGHT holds Save, because
 * saving mid-upload would drop the file the owner is watching. §4.5
 */
function ReceiptDropzone({
  storedUrl,
  disabled,
  onUrlChange,
  onBusyChange,
}: {
  storedUrl: string | null;
  disabled?: boolean;
  onUrlChange: (url: string | null) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const t = useTranslations("expenses.receipt");
  const [state, setState] = useState<ReceiptState>(() =>
    storedUrl
      ? { kind: "attached", file: fileFromUrl(storedUrl), url: storedUrl }
      : { kind: "empty" },
  );
  const [dragging, setDragging] = useState(false);
  const [undoable, setUndoable] = useState<ReceiptState | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const objectUrl = useRef<string | null>(null);
  /** Held so `Retry` can re-run the upload without re-picking the file. */
  const lastFile = useRef<File | null>(null);

  useEffect(() => {
    onBusyChange(state.kind === "uploading");
  }, [state.kind, onBusyChange]);

  // Object URLs are a leak if they outlive the component.
  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    [],
  );

  // §4.6: `Receipt removed · Undo` for 8 seconds, then it is really gone.
  useEffect(() => {
    if (!undoable) return;
    const timer = setTimeout(() => setUndoable(null), 8000);
    return () => clearTimeout(timer);
  }, [undoable]);

  function reject(messageKey: string, detail: string) {
    setState({ kind: "rejected", messageKey, detail });
    onUrlChange(null);
    // §4.5: focus moves to the dropzone so the reason is announced and the
    // retry is one keystroke away.
    requestAnimationFrame(() => zoneRef.current?.focus());
  }

  async function accept(file: File) {
    // Errors state the ACTUAL size or extension and what to do about it —
    // "invalid file" tells the owner nothing he can act on. §4.4
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".heic") || lower.endsWith(".heif")) {
      reject("heic", "");
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      reject("wrongType", file.name.split(".").pop()?.toUpperCase() ?? "");
      return;
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      reject("tooLarge", formatBytes(file.size));
      return;
    }

    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    const isPdf = file.type === "application/pdf";
    const preview = isPdf ? null : URL.createObjectURL(file);
    objectUrl.current = preview;

    const meta: ReceiptFile = {
      name: file.name,
      size: file.size,
      previewUrl: preview,
      isPdf,
    };

    setState({ kind: "uploading", file: meta, progress: 0 });
    lastFile.current = file;

    const result = await uploadReceipt(file, (percent) =>
      setState((current) =>
        current.kind === "uploading"
          ? { ...current, progress: Math.min(100, Math.max(0, percent)) }
          : current,
      ),
    );

    if (result.ok) {
      setState({ kind: "attached", file: meta, url: result.url });
      onUrlChange(result.url);
      return;
    }

    setState({ kind: "failed", file: meta, reason: result.reason });
    // The expense saves without it. Nothing is lost that was not already lost.
    onUrlChange(null);
  }

  function remove() {
    setUndoable(state);
    if (objectUrl.current) {
      URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = null;
    }
    setState({ kind: "empty" });
    onUrlChange(null);
  }

  function undo() {
    if (!undoable) return;
    setState(undoable);
    onUrlChange(undoable.kind === "attached" ? undoable.url : null);
    setUndoable(null);
  }

  function pick() {
    if (disabled) return;
    inputRef.current?.click();
  }

  return (
    <div className="mb-4">
      <Label htmlFor="expense-receipt">{t("label")}</Label>

      <input
        ref={inputRef}
        id="expense-receipt"
        type="file"
        accept={ACCEPT_ATTR}
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Reset so re-picking the SAME file after a failure still fires.
          event.target.value = "";
          if (file) void accept(file);
        }}
      />

      <div
        ref={zoneRef}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-describedby="expense-receipt-hint"
        onClick={state.kind === "empty" || state.kind === "rejected" ? pick : undefined}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            pick();
          }
        }}
        onPaste={(event) => {
          // §4.6: pasting a screenshot of the bill attaches it.
          const file = event.clipboardData?.files?.[0];
          if (file) {
            event.preventDefault();
            void accept(file);
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file && !disabled) void accept(file);
        }}
        className={cn(
          "rounded-md border transition-colors duration-100",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          state.kind === "empty" || state.kind === "rejected"
            ? "cursor-pointer border-dashed"
            : "border-solid",
          dragging
            ? "border-2 border-primary bg-[var(--badge-primary-bg)]"
            : state.kind === "rejected" || state.kind === "failed"
              ? "border-destructive bg-destructive/10"
              : "border-input bg-muted",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        {dragging ? (
          <Centered>
            <Upload className="size-6 text-primary" aria-hidden />
            <p className="text-sm font-medium text-primary">{t("dropToAttach")}</p>
          </Centered>
        ) : state.kind === "empty" ? (
          <Centered>
            <Upload className="size-6 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">{t("empty.title")}</p>
            <p className="text-caption text-muted-foreground">{t("empty.hint")}</p>
          </Centered>
        ) : state.kind === "rejected" ? (
          <Centered>
            <AlertTriangle className="size-6 text-destructive" aria-hidden />
            <p className="text-sm text-destructive" role="alert">
              {state.messageKey === "tooLarge"
                ? t("errors.tooLarge", { size: state.detail })
                : state.messageKey === "heic"
                  ? t("errors.heic")
                  : t("errors.wrongType", { extension: state.detail })}
            </p>
            <p className="text-caption text-muted-foreground">{t("empty.hint")}</p>
          </Centered>
        ) : (
          <FileRow
            file={state.file}
            progress={state.kind === "uploading" ? state.progress : null}
            failure={state.kind === "failed" ? state.reason : null}
            url={state.kind === "attached" ? state.url : null}
            disabled={disabled}
            onReplace={pick}
            onRemove={remove}
            onRetry={() => {
              if (lastFile.current) void accept(lastFile.current);
            }}
          />
        )}
      </div>

      <p id="expense-receipt-hint" className="mt-1 min-h-5 text-caption text-muted-foreground">
        {undoable ? (
          <>
            {t("removed")}{" "}
            <button
              type="button"
              onClick={undo}
              className="text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {t("undo")}
            </button>
          </>
        ) : (
          t("hint")
        )}
      </p>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-30 flex-col items-center justify-center gap-1 px-4 py-6 text-center">
      {children}
    </div>
  );
}

/**
 * The filled row — 88px, thumbnail left, actions right.
 *
 * One component for `uploading`, `failed` and `attached` so the row never
 * changes height between them; a dropzone that grows and shrinks under the
 * cursor is how a form loses its place mid-entry.
 */
function FileRow({
  file,
  progress,
  failure,
  url,
  disabled,
  onReplace,
  onRemove,
  onRetry,
}: {
  file: ReceiptFile;
  progress: number | null;
  failure: UploadFailure | null;
  url: string | null;
  disabled?: boolean;
  onReplace: () => void;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const t = useTranslations("expenses.receipt");

  return (
    <div className="flex items-center gap-3 p-3">
      {/* PDFs get an icon; photos get the real thumbnail, undimmed — the owner
          is reading a printed bill and needs it true. §4.8 */}
      <span
        className={cn(
          "flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border bg-card",
          progress !== null && "opacity-40",
        )}
      >
        {file.isPdf ? (
          <FileText className="size-6 text-muted-foreground" aria-hidden />
        ) : file.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a blob: URL
          // has no remote loader and next/image cannot optimise it.
          <img
            src={file.previewUrl}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <ImageIcon className="size-6 text-muted-foreground" aria-hidden />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{file.name}</p>

        {progress !== null ? (
          <>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-border">
              <div
                className="h-full bg-primary transition-[width] duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1 text-caption text-muted-foreground">
              {t("uploading", { percent: progress })}
            </p>
          </>
        ) : failure ? (
          <p className="mt-0.5 text-caption text-destructive" role="alert">
            {failure === "offline"
              ? t("errors.offline")
              : failure === "unavailable"
                ? t("errors.storageNotConfigured")
                : t("errors.uploadFailed")}
          </p>
        ) : (
          <p className="mt-0.5 text-caption text-muted-foreground">
            {[file.size === null ? null : formatBytes(file.size), t("attached")]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}

        {progress === null && (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {url && (
              <Button variant="ghost" size="sm" asChild>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <Download aria-hidden />
                  {t("view")}
                </a>
              </Button>
            )}
            {failure && failure !== "unavailable" && (
              <Button variant="ghost" size="sm" onClick={onRetry} disabled={disabled}>
                {t("retry")}
              </Button>
            )}
            {failure !== "unavailable" && (
              <Button variant="ghost" size="sm" onClick={onReplace} disabled={disabled}>
                {t("replace")}
              </Button>
            )}
          </div>
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={t("remove")}
        disabled={disabled}
        onClick={onRemove}
      >
        <X aria-hidden />
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add category
// ─────────────────────────────────────────────────────────────────────────────

/**
 * §4.4: a 420px dialog with one field, so a missing category never costs the
 * owner the half-typed expense behind it.
 */
function AddCategoryDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (category: ExpenseCategoryDto) => void;
}) {
  const t = useTranslations("expenses.form");
  const tRoot = useTranslations();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const created = await api.post<ExpenseCategoryDto>(
        expenseCategoryRoutes.create,
        { name },
      );
      onCreated(created);
      onOpenChange(false);
      setName("");
    } catch (e) {
      const key =
        e && typeof e === "object" && "messageKey" in e
          ? String((e as { messageKey: unknown }).messageKey)
          : "common.somethingWentWrong";
      setError(tRoot.has(key) ? tRoot(key) : tRoot("common.somethingWentWrong"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="max-w-105">
        <DialogTitle>{t("addCategoryTitle")}</DialogTitle>
        <DialogDescription className="sr-only">
          {t("addCategoryTitle")}
        </DialogDescription>

        <div className="mt-3">
          <Label htmlFor="new-category-name" required>
            {t("categoryNameLabel")}
          </Label>
          <Input
            id="new-category-name"
            autoFocus
            value={name}
            placeholder={t("categoryNamePlaceholder")}
            invalid={!!error}
            disabled={busy}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void create();
              }
            }}
          />
          <div className="min-h-5">
            {error && (
              <p className="mt-1 text-xs text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {tRoot("common.cancel")}
          </Button>
          <Button loading={busy} onClick={() => void create()}>
            {t("addCategoryConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Type only. The BUILDERS are deliberately NOT re-exported here: a server
// component calling an export of a "use client" module is exactly the error
// that split fixes. Import them from ./expense-form-model instead.
export type { ExpenseFormInitial } from "./expense-form-model";
