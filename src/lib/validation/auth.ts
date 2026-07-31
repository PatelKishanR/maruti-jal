import { z } from 'zod';

/**
 * Shared between the client form and the server action. Imports nothing
 * server-side, so it is safe in both places.
 *
 * Messages are CATALOGUE KEYS, not sentences — the form layer resolves them
 * through the active language. See .claude/I18N.md §5.4
 */

export const emailSchema = z
  .string()
  .trim()
  .min(1, { message: 'auth.errors.emailRequired' })
  .email({ message: 'auth.errors.emailInvalid' })
  .transform((v) => v.toLowerCase());

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: 'auth.errors.passwordRequired' }),
  keepSignedIn: z.coerce.boolean().default(false),
  /**
   * Where to go after signing in.
   *
   * Must be a RELATIVE path inside this app. Accepting an absolute URL would
   * turn the login page into an open redirect — a convincing way to send
   * someone to a fake. Rejected values fall back to "/".
   */
  redirectTo: z
    .string()
    .optional()
    .transform((v) => (v && /^\/(?!\/)/.test(v) ? v : '/')),
});

export type SignInInput = z.infer<typeof signInSchema>;

/**
 * Minimum 8 characters, no composition rules.
 *
 * Forced symbols and digits push people towards `Password1!` and a sticky
 * note. Length is what matters. See MODULES/00-auth.md §5.6
 */
export const passwordSchema = z
  .string()
  .min(8, { message: 'account.changePasswordModal.errors.tooShort' })
  .max(200);

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { message: 'auth.errors.passwordRequired' }),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'account.changePasswordModal.errors.mismatch',
    path: ['confirmPassword'],
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: 'account.changePasswordModal.errors.sameAsCurrent',
    path: ['newPassword'],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const updateProfileSchema = z.object({
  /**
   * Length only — NO character-class restriction.
   *
   * A `[A-Za-z]` pattern here would silently block "રમેશ પટેલ" and present as
   * "the app won't let me save". See .claude/I18N.md §3.1
   */
  name: z.string().trim().min(1).max(120),
  email: emailSchema,
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const updatePreferencesSchema = z.object({
  locale: z.enum(['en', 'gu']),
  theme: z.enum(['light', 'dark', 'system']),
});
