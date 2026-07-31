import { LanguageToggle } from "./language-toggle";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

/**
 * Topbar. Spec: .claude/design/DESIGN-STANDARDS.md §3.2
 * 64px, sticky, 1px bottom border. Breadcrumb left; controls right.
 */
export function Topbar({
  name,
  email,
  breadcrumb,
}: {
  name: string;
  email: string;
  breadcrumb?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-[var(--topbar-height)] shrink-0 items-center justify-between gap-4 border-b border-border bg-background px-4 md:px-6">
      <div className="min-w-0 flex-1 text-sm text-muted-foreground">
        {breadcrumb}
      </div>

      <div className="flex items-center gap-1.5">
        <LanguageToggle authenticated />
        <ThemeToggle />
        <UserMenu name={name} email={email} />
      </div>
    </header>
  );
}
