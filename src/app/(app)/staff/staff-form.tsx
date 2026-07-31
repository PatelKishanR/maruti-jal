"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { DateInput, FormActions, FormField } from "@/components/form";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { api, ApiError } from "@/lib/api/client";
import { staffPaths, staffRoutes } from "@/lib/api/routes.staff";
import { todayIST } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  createStaffSchema,
  normalisePhone,
  updateStaffSchema,
} from "@/lib/validation/staff";
import type { StaffDto, StaffListDto } from "@/lib/dto/staff.dto";

/**
 * Add / edit staff. Spec: design/MODULES/01-staff.md §5 and §6
 *
 * One component for both, because they differ by three things — the back link,
 * the Status section, and the verb on the button. Two files would drift.
 *
 * Validation runs the SAME Zod schema the API runs. The client copy exists for
 * speed of feedback, not for safety; the route re-validates everything, so a
 * request that skips this form is checked identically.
 */

interface FormValues {
  name: string;
  phone: string;
  altPhone: string;
  address: string;
  note: string;
  joinedOn: string;
  isActive: boolean;
}

/** A number already on file, and who holds it. */
interface PhoneHolder {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

export function StaffForm({ staff }: { staff?: StaffDto }) {
  const mode = staff ? "edit" : "create";
  const t = useTranslations("staff");
  const tRoot = useTranslations();
  const router = useRouter();

  const initial = useMemo<FormValues>(
    () => ({
      name: staff?.name ?? "",
      phone: staff?.phone ?? "",
      altPhone: staff?.altPhone ?? "",
      address: staff?.address ?? "",
      note: staff?.note ?? "",
      // Pre-filled with today and shown as a real value, not a placeholder —
      // it is right nine times out of ten. §5.5
      joinedOn: staff?.joinedOn ?? todayIST(),
      isActive: staff?.isActive ?? true,
    }),
    [staff],
  );

  const [values, setValues] = useState<FormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<{
    title: string;
    body: string;
  } | null>(null);
  const [statusBlocked, setStatusBlocked] = useState<string | null>(null);
  const [phoneHolder, setPhoneHolder] = useState<PhoneHolder | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const phoneCheck = useRef<ReturnType<typeof setTimeout>>(undefined);

  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initial),
    [values, initial],
  );

  const schema = mode === "edit" ? updateStaffSchema : createStaffSchema;

  /**
   * Validation messages are catalogue KEYS. Resolving them here means the
   * client-side and server-side messages are the same strings in the same
   * language — one error-display path, not two. See ARCHITECTURE §7
   */
  const resolve = useCallback(
    (key: string) => {
      try {
        return tRoot.has(key) ? tRoot(key) : key;
      } catch {
        return key;
      }
    },
    [tRoot],
  );

  const collectErrors = useCallback((): Record<string, string> => {
    const parsed = schema.safeParse(values);
    if (parsed.success) return {};

    const mapped: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "");
      if (field && !mapped[field]) mapped[field] = resolve(issue.message);
    }
    return mapped;
  }, [schema, values, resolve]);

  /** Never while typing. On blur, and only for the field just left. §6.4 */
  function validateField(field: keyof FormValues) {
    const all = collectErrors();
    setErrors((prev) => {
      const next = { ...prev };
      if (all[field]) next[field] = all[field];
      else delete next[field];
      return next;
    });
  }

  function setField<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }));

    // Once a field is in error it re-validates on every keystroke, so the
    // message clears the instant it is fixed. §5.6
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (field === "phone") setPhoneHolder(null);
    if (field === "isActive") setStatusBlocked(null);
  }

  /**
   * Is this number already on file?
   *
   * Checked on blur against the list endpoint rather than on submit alone: a
   * duplicate found after typing four more fields is a duplicate found too
   * late. A number belonging to a DEACTIVATED member is a warning, not an
   * error — that is the returning-worker case, and it is allowed. §5.4
   */
  function checkPhone(raw: string) {
    clearTimeout(phoneCheck.current);
    const phone = normalisePhone(raw);
    if (phone.length !== 10) return;

    phoneCheck.current = setTimeout(async () => {
      try {
        const { result } = await api.get<StaffListDto>(
          staffRoutes.list({ q: phone, status: "all", pageSize: "5" }),
        );
        // The search blob also covers alternate phone and address, so match
        // the primary number exactly — that is what the unique index covers.
        const holder = result.rows.find(
          (row) => row.phone === phone && row.id !== staff?.id,
        );
        if (!holder) {
          setPhoneHolder(null);
          return;
        }

        setPhoneHolder({
          id: holder.id,
          name: holder.name,
          code: holder.code,
          isActive: holder.isActive,
        });
        if (holder.isActive) {
          setErrors((prev) => ({
            ...prev,
            phone: t("errors.phoneTakenDetail", {
              phone,
              name: holder.name,
              code: holder.code,
            }),
          }));
        }
      } catch {
        // A failed availability check must not block entry — the server
        // enforces uniqueness on submit regardless.
        setPhoneHolder(null);
      }
    }, 400);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const found = collectErrors();
    if (Object.keys(found).length > 0) {
      setErrors(found);
      // Focus and scroll to the first problem, in field order.
      const first = FIELD_ORDER.find((field) => found[field]);
      if (first) document.getElementById(`staff-${first}`)?.focus();
      return;
    }

    const payload = schema.parse(values);
    setSubmitting(true);

    try {
      const saved = staff
        ? await api.patch<StaffDto>(staffRoutes.detail(staff.id), payload)
        : await api.post<StaffDto>(staffRoutes.create, payload);

      toast.success(
        mode === "edit"
          ? t("toasts.updated", { name: saved.name })
          : t("toasts.created", { name: saved.name }),
      );

      // Never leave the owner on a form wondering whether it worked. §5.5
      router.push(staffPaths.detail(saved.id));
      router.refresh();
    } catch (error) {
      handleServerError(error);
      setSubmitting(false);
    }
  }

  function handleServerError(error: unknown) {
    if (!(error instanceof ApiError)) {
      setFormError({
        title: t("form.errors.offlineTitle"),
        body: t("form.errors.offlineBody"),
      });
      return;
    }

    // Field errors from the server are catalogue keys too, so they render
    // through exactly the same slot as the client-side ones.
    if (error.fieldErrors) {
      const mapped: Record<string, string> = {};
      for (const [field, keys] of Object.entries(error.fieldErrors)) {
        if (keys?.[0]) mapped[field] = resolve(keys[0]);
      }
      if (Object.keys(mapped).length > 0) {
        setErrors(mapped);
        return;
      }
    }

    const meta = (error.meta ?? {}) as {
      staffId?: string;
      staffName?: string;
      staffCode?: string;
      staffIsActive?: boolean;
    };

    if (error.messageKey === "staff.errors.phoneTaken") {
      setErrors((prev) => ({
        ...prev,
        phone: t("errors.phoneTakenDetail", {
          phone: values.phone,
          name: meta.staffName ?? "",
          code: meta.staffCode ?? "",
        }),
      }));
      if (meta.staffId) {
        setPhoneHolder({
          id: meta.staffId,
          name: meta.staffName ?? "",
          code: meta.staffCode ?? "",
          isActive: meta.staffIsActive ?? true,
        });
      }
      return;
    }

    if (error.messageKey === "staff.errors.deactivateBlocked") {
      // The toggle springs back on: an impossible state is never shown as
      // accepted. The reason replaces its helper text. §6.5
      setValues((prev) => ({ ...prev, isActive: true }));
      setStatusBlocked(t("form.statusBlocked", { name: values.name }));
      return;
    }

    setFormError({
      title: t("form.errors.saveTitle"),
      body: resolve(error.messageKey),
    });
  }

  function cancel() {
    if (dirty) {
      setDiscardOpen(true);
      return;
    }
    router.push(staff ? staffPaths.detail(staff.id) : staffPaths.list);
  }

  /** Browser navigation passes through the same guard as Cancel. §5.6 */
  useEffect(() => {
    if (!dirty || submitting) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, submitting]);

  return (
    <>
      <Card className={cn("max-w-180 p-6", submitting && "opacity-60")}>
        <form onSubmit={submit} noValidate>
          {formError && (
            <Alert
              variant="danger"
              icon={<AlertTriangle aria-hidden />}
              className="mb-4"
              tabIndex={-1}
            >
              <AlertTitle>{formError.title}</AlertTitle>
              <AlertDescription>{formError.body}</AlertDescription>
            </Alert>
          )}

          <FormField
            label={t("form.name.label")}
            required
            htmlFor="staff-name"
            error={errors.name}
            hint={t("form.name.hint")}
          >
            <Input
              id="staff-name"
              // 48px: the primary field on a fast-entry form is taller. §5.3
              inputSize="lg"
              value={values.name}
              // Create autofocuses; edit does NOT — selecting an existing name
              // invites an accidental overwrite. §6.6
              autoFocus={mode === "create"}
              disabled={submitting}
              invalid={!!errors.name}
              placeholder={t("form.name.placeholder")}
              onChange={(e) => setField("name", e.target.value)}
              onBlur={() => validateField("name")}
            />
          </FormField>

          {/* The only paired row on this form; it stacks below md, because two
              50% inputs at 360px are too narrow for a 10-digit number. §5.7 */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <FormField
                label={t("form.phone.label")}
                required
                htmlFor="staff-phone"
                error={errors.phone}
                hint={t("form.phone.hint")}
                className="mb-0"
              >
                <Input
                  id="staff-phone"
                  inputMode="numeric"
                  maxLength={16}
                  // Mono and tabular, but LEFT aligned — a phone number is an
                  // identifier read left to right, not an amount to line up.
                  className="font-mono tabular-nums"
                  value={values.phone}
                  disabled={submitting}
                  invalid={!!errors.phone}
                  placeholder={t("form.phone.placeholder")}
                  onChange={(e) => setField("phone", e.target.value)}
                  onBlur={(e) => {
                    // `+91 98765 43210` becomes `9876543210` on blur, so what
                    // is stored is what the unique index compares.
                    const normalised = normalisePhone(e.target.value);
                    if (normalised !== values.phone) {
                      setValues((prev) => ({ ...prev, phone: normalised }));
                    }
                    validateField("phone");
                    checkPhone(e.target.value);
                  }}
                />
              </FormField>

              {phoneHolder && !phoneHolder.isActive && (
                /* Amber, not red: the number is free, and this is the
                   returning-worker case. Submission stays allowed. §5.5 */
                <p className="mb-4 mt-1 flex items-start gap-1 text-xs leading-4 text-warning">
                  <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                  <span>
                    {t("errors.phoneTakenInactive", {
                      phone: values.phone,
                      name: phoneHolder.name,
                    })}
                  </span>
                </p>
              )}

              {phoneHolder && phoneHolder.isActive && (
                <p className="mb-4 mt-1 text-xs leading-4">
                  <Link
                    href={staffPaths.detail(phoneHolder.id)}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {t("form.viewHolder", { code: phoneHolder.code })}
                  </Link>
                </p>
              )}

              {!phoneHolder && <div className="mb-4" />}
            </div>

            <FormField
              label={t("form.altPhone.label")}
              htmlFor="staff-altPhone"
              error={errors.altPhone}
            >
              <Input
                id="staff-altPhone"
                inputMode="numeric"
                maxLength={16}
                className="font-mono tabular-nums"
                value={values.altPhone}
                disabled={submitting}
                invalid={!!errors.altPhone}
                placeholder={t("form.altPhone.placeholder")}
                onChange={(e) => setField("altPhone", e.target.value)}
                onBlur={(e) => {
                  const normalised = normalisePhone(e.target.value);
                  if (normalised !== values.altPhone) {
                    setValues((prev) => ({ ...prev, altPhone: normalised }));
                  }
                  validateField("altPhone");
                }}
              />
            </FormField>
          </div>

          <FormField
            label={t("form.address.label")}
            htmlFor="staff-address"
            error={errors.address}
          >
            <Textarea
              id="staff-address"
              value={values.address}
              disabled={submitting}
              invalid={!!errors.address}
              placeholder={t("form.address.placeholder")}
              onChange={(e) => setField("address", e.target.value)}
              onBlur={() => validateField("address")}
              onKeyDown={submitOnMetaEnter}
            />
          </FormField>

          <FormField
            label={t("form.joinedOn.label")}
            htmlFor="staff-joinedOn"
            error={errors.joinedOn}
            hint={t("form.joinedOn.hint")}
          >
            <DateInput
              id="staff-joinedOn"
              value={values.joinedOn}
              disabled={submitting}
              invalid={!!errors.joinedOn}
              // A joining date in the future is a typo, not a plan.
              max={todayIST()}
              onValueChange={(next) => setField("joinedOn", next)}
            />
          </FormField>

          <FormField
            label={t("form.note.label")}
            htmlFor="staff-note"
            error={errors.note}
            hint={t("form.note.hint")}
          >
            <Textarea
              id="staff-note"
              value={values.note}
              disabled={submitting}
              invalid={!!errors.note}
              placeholder={t("form.note.placeholder")}
              onChange={(e) => setField("note", e.target.value)}
              onBlur={() => validateField("note")}
              onKeyDown={submitOnMetaEnter}
            />
          </FormField>

          {mode === "edit" && (
            <section className="mt-8 border-t border-border pt-6">
              <h2 className="mb-4 text-h4 font-semibold text-foreground">
                {t("form.statusHeading")}
              </h2>

              <div className="flex min-h-11 items-start gap-3">
                <Switch
                  id="staff-isActive"
                  checked={values.isActive}
                  disabled={submitting}
                  onCheckedChange={(next) => setField("isActive", next)}
                />
                <div className="min-w-0">
                  <Label htmlFor="staff-isActive" className="mb-0 cursor-pointer">
                    {t("form.activeLabel")}
                  </Label>
                  {statusBlocked ? (
                    <Alert
                      variant="danger"
                      icon={<AlertTriangle aria-hidden />}
                      className="mt-2"
                    >
                      {statusBlocked}
                    </Alert>
                  ) : (
                    <p className="mt-1 text-xs leading-4 text-muted-foreground">
                      {t("form.activeHint")}
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}

          <FormActions
            onCancel={cancel}
            submitLabel={mode === "edit" ? t("form.save") : t("form.create")}
            submittingLabel={t("form.saving")}
            // Create is always submittable: pressing it is how the owner
            // surfaces what is missing. Edit follows the shared rule and
            // enables once something has actually changed.
            dirty={mode === "create" ? true : dirty}
            submitting={submitting}
          />
        </form>
      </Card>

      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title={
          mode === "edit"
            ? t("form.discard.editTitle")
            : t("form.discard.createTitle")
        }
        description={
          mode === "edit"
            ? t("form.discard.editBody", { name: initial.name })
            : t("form.discard.createBody", {
                name: values.name || t("form.discard.thisRecord"),
              })
        }
        confirmLabel={t("form.discard.confirm")}
        onConfirm={() =>
          router.push(staff ? staffPaths.detail(staff.id) : staffPaths.list)
        }
      />
    </>
  );
}

const FIELD_ORDER: (keyof FormValues)[] = [
  "name",
  "phone",
  "altPhone",
  "address",
  "joinedOn",
  "note",
];

/** Enter inserts a newline in a textarea; ⌘/Ctrl+Enter submits. §5.6 */
function submitOnMetaEnter(event: React.KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    event.currentTarget.form?.requestSubmit();
  }
}
