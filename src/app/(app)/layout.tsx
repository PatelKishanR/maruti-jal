import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { api } from "@/lib/api/client";
import type { SessionStateDto } from "@/lib/dto/dashboard.dto";

/**
 * Authenticated shell.
 *
 * `runtime = 'nodejs'` is defensive: App Router segments already default to
 * Node, but anything under this layout may reach TypeORM and Edge would
 * explode. `force-dynamic` because this is an internal tool — nothing here is
 * statically cacheable. See .claude/ARCHITECTURE.md §1.2
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware already gated this, but a layout that assumes a session without
  // checking is how a refactor silently opens a hole.
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  /**
   * Enforce sessionVersion.
   *
   * The JWT carries the value it was minted with. Changing a password bumps
   * the stored value, so every OTHER device's token no longer matches and is
   * rejected here. This check has to live on Node — Edge middleware cannot
   * reach the database — and this layout gates every authenticated page, so
   * it is the right place.
   *
   * Costs one indexed lookup per page load. Acceptable for a single-user tool;
   * revisit if the app ever serves many concurrent users.
   */
  const { valid } = await api
    .get<SessionStateDto>("/api/auth/session-state")
    .catch(() => ({ valid: false }));

  /**
   * Redirect to force-signout, NOT to /login.
   *
   * A stale token is still cryptographically valid, so middleware would treat
   * the user as signed in and bounce them straight back here — an infinite
   * loop. force-signout clears the cookie first, which is what makes
   * middleware and this layout agree again. See that route for the full note.
   */
  if (!valid) redirect("/api/auth/force-signout");

  return (
    <div className="flex min-h-dvh">
      <AppSidebar className="hidden md:flex" />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          name={session.user.name ?? "User"}
          email={session.user.email ?? ""}
        />

        <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
