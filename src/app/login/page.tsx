import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Droplet } from "lucide-react";
import { LanguageToggle } from "@/components/layout/language-toggle";
import { LoginForm } from "./login-form";
import { ForgotPasswordDialog } from "./forgot-password-dialog";

export const runtime = "nodejs";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return {
    title: `${t("auth.signIn.title")} · ${t("brand.name")}`,
  };
}

/**
 * Sign in. Spec: .claude/design/MODULES/00-auth.md §3
 *
 * A centred card rather than a split-screen brand panel. A half-width
 * marketing panel exists to sell a product to a stranger; this app has one
 * user who already knows what it is. The card degrades to mobile with no work
 * and reads as a tool rather than a landing page.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const t = await getTranslations();

  const nextParam = params.next;
  const redirectTo =
    typeof nextParam === "string" && /^\/(?!\/)/.test(nextParam) ? nextParam : "/";

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-12 md:justify-center">
      {/* Mobile sits the card near the top so it doesn't jump when the
          keyboard opens; desktop centres it. */}
      <div className="absolute right-4 top-4 md:right-6 md:top-6">
        <LanguageToggle />
      </div>

      <main className="w-full max-w-[400px]">
        <div className="rounded-lg border border-border bg-card p-8 shadow-lg">
          <div className="mb-8 flex flex-col items-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary">
              <Droplet
                className="size-5 text-primary-foreground"
                strokeWidth={2}
                aria-hidden
              />
            </div>
            <p className="mt-3 text-h4 font-semibold text-foreground">
              {t("brand.name")}
            </p>
          </div>

          <h1 className="text-h2 font-semibold text-foreground">
            {t("auth.signIn.title")}
          </h1>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">
            {t("auth.signIn.subtitle")}
          </p>

          <LoginForm redirectTo={redirectTo} wasRedirected={!!params.next} />

          <div className="mt-5">
            <ForgotPasswordDialog />
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          {t("brand.name")} · {t("brand.tagline")}
        </p>
      </main>
    </div>
  );
}
