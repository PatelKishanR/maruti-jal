import { z } from "zod";
import { isBusinessDate, todayIST } from "@/lib/dates";

/**
 * Staff validation — shared by the client form and the API route.
 *
 * Imports nothing server-side, so the same schema runs in the browser (instant
 * feedback) and in the route handler (the actual guarantee). One schema, one
 * set of rules, no drift.
 *
 * Messages are CATALOGUE KEYS, never sentences — the form resolves them in the
 * active language. See .claude/I18N.md §5.4
 *
 * **No character-class restriction on name, address or note.** A `[A-Za-z]`
 * pattern silently rejects "રમેશ પટેલ" and surfaces as "the app won't let me
 * save". Length is the only limit. Phone is the single exception, because a
 * phone number genuinely is ten Latin digits. See MODULES/01-staff.md §4
 */

/* ═══════════════════════════════════════════════════════════════════════
   Phone
   ═══════════════════════════════════════════════════════════════════════ */

const GUJARATI_ZERO = 0x0ae6;

/**
 * Gujarati numerals (૦–૯) → 0–9.
 *
 * The app renders Latin digits everywhere, but a Gujarati keyboard still emits
 * Gujarati ones. Rejecting them would read as a broken app rather than as a
 * validation rule. See .claude/I18N.md §3.1
 */
function latiniseDigits(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    out +=
      code >= GUJARATI_ZERO && code <= GUJARATI_ZERO + 9
        ? String(code - GUJARATI_ZERO)
        : ch;
  }
  return out;
}

/**
 * `+91 98765 43210`, `098765 43210` and `91-9876543210` all become
 * `9876543210`.
 *
 * Normalising here rather than in the form means the API accepts whatever the
 * owner pastes off a WhatsApp message, and the database only ever holds one
 * shape — which is what makes the uniqueness index meaningful.
 */
export function normalisePhone(input: string): string {
  const digits = latiniseDigits(input).replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

/** Indian mobile: ten digits starting 6, 7, 8 or 9. */
export function isValidPhone(value: string): boolean {
  return /^[6-9]\d{9}$/.test(value);
}

const phoneSchema = z
  .string()
  .transform(normalisePhone)
  .superRefine((value, ctx) => {
    if (value.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "staff.errors.phoneRequired",
      });
      return;
    }
    if (value.length !== 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "staff.errors.phoneLength",
      });
      return;
    }
    if (!isValidPhone(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "staff.errors.phoneStart",
      });
    }
  });

const optionalPhoneSchema = z
  .string()
  .nullish()
  .transform((value) => (value == null ? "" : normalisePhone(value)))
  .superRefine((value, ctx) => {
    if (value.length === 0) return;
    if (value.length !== 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "staff.errors.phoneLength",
      });
      return;
    }
    if (!isValidPhone(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "staff.errors.phoneStart",
      });
    }
  })
  // An empty optional field is NULL, never "". Otherwise "no alternate phone"
  // and "an alternate phone that is the empty string" become two states.
  .transform((value) => (value.length === 0 ? null : value));

/* ═══════════════════════════════════════════════════════════════════════
   Free text — length only, any script
   ═══════════════════════════════════════════════════════════════════════ */

function optionalText(max: number, tooLongKey: string) {
  return z
    .string()
    .nullish()
    .transform((value) => (value ?? "").trim())
    .refine((value) => value.length <= max, { message: tooLongKey })
    .transform((value) => (value.length === 0 ? null : value));
}

/* ═══════════════════════════════════════════════════════════════════════
   Joined-on — a business date STRING, never a Date
   ═══════════════════════════════════════════════════════════════════════ */

const joinedOnSchema = z
  .string()
  .nullish()
  .transform((value) => {
    const trimmed = (value ?? "").trim();
    return trimmed.length === 0 ? null : trimmed;
  })
  .superRefine((value, ctx) => {
    if (value === null) return;
    if (!isBusinessDate(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "staff.errors.joinedOnInvalid",
      });
      return;
    }
    // String comparison is correct for 'YYYY-MM-DD' and needs no timezone.
    if (value > todayIST()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "staff.errors.joinedOnFuture",
      });
    }
  });

/* ═══════════════════════════════════════════════════════════════════════
   The forms
   ═══════════════════════════════════════════════════════════════════════ */

const staffFields = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "staff.errors.nameRequired" })
    .max(120, { message: "staff.errors.nameTooLong" }),
  phone: phoneSchema,
  altPhone: optionalPhoneSchema,
  address: optionalText(500, "staff.errors.addressTooLong"),
  note: optionalText(2000, "staff.errors.noteTooLong"),
  joinedOn: joinedOnSchema,
});

/**
 * Two numbers for the same person is a data-entry slip, not a second contact.
 *
 * Both fields are optional here so one predicate serves the full create schema
 * AND the partial update schema. On a PATCH that sends neither, there is
 * nothing to compare and the rule passes — the stored pair was already checked
 * when it was written.
 */
const altPhoneIsDifferent = (value: {
  phone?: string;
  altPhone?: string | null;
}) =>
  value.phone === undefined ||
  value.altPhone === undefined ||
  value.altPhone === null ||
  value.altPhone !== value.phone;

const ALT_PHONE_SAME = {
  message: "staff.errors.altPhoneSame",
  path: ["altPhone"] as const,
};

export const createStaffSchema = staffFields.refine(altPhoneIsDifferent, {
  ...ALT_PHONE_SAME,
  path: ["altPhone"],
});

/**
 * PATCH means PARTIAL, so every field is optional and the service applies only
 * what was sent.
 *
 * The edit form happens to send everything, so a non-partial schema "worked" —
 * but it made the API a lie: a caller wanting to flip `isActive` alone got a
 * 422 demanding a name and phone it had no reason to know. `.partial()` comes
 * BEFORE `.refine()`, because refine returns a ZodEffects that has no
 * `.partial()`.
 */
export const updateStaffSchema = staffFields
  .extend({
    /** The service refuses to switch this off while dues exist. */
    isActive: z.boolean(),
  })
  .partial()
  .refine(altPhoneIsDifferent, { ...ALT_PHONE_SAME, path: ["altPhone"] });

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;

/* ═══════════════════════════════════════════════════════════════════════
   List query
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Deliberately permissive strings.
 *
 * The real defence is `parseListQuery` + `staffTableConfig`: the sort key must
 * be a KEY of the sortable allowlist, page numbers are clamped, and unknown or
 * malformed filters are dropped. That is the audited path (ARCHITECTURE §6.2),
 * and it degrades to the default view rather than erroring.
 *
 * This schema's job is narrower: prove the shape is a flat string map, cap the
 * lengths so nothing absurd reaches the parser, and drop unknown keys. Note
 * the `.catch(undefined)` on every field — a stale bookmarked URL must never
 * 422. An error page teaches the owner nothing; an unfiltered list is
 * recoverable in one click.
 */
const listParam = (max: number) =>
  z.string().max(max).optional().catch(undefined);

export const staffListQuerySchema = z.object({
  page: listParam(10),
  pageSize: listParam(10),
  q: listParam(100),
  sort: listParam(40),
  dir: listParam(4),
  status: listParam(10),
  hasBalance: listParam(1),
  hasJars: listParam(1),
});

export type StaffListQuery = z.infer<typeof staffListQuerySchema>;

/** `GET /api/staff/options?q=` — the shared EntityCombobox contract. */
export const staffOptionsQuerySchema = z.object({
  q: listParam(100),
});

/** Every dynamic segment is validated, same as body and query. */
export const staffIdParamsSchema = z.object({
  id: z.string().uuid({ message: "common.notFound" }),
});
