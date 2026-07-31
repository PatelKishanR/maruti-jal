import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getDataSource } from "@/lib/db/data-source";
import { User } from "@/lib/db/entities";

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
  const ds = await getDataSource();
  const current = await ds.getRepository(User).findOne({
    where: { id: session.user.id },
    select: { id: true, sessionVersion: true, isActive: true },
  });

  if (!current || !current.isActive || current.sessionVersion !== session.user.sessionVersion) {
    redirect("/login");
  }

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
