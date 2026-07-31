"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Droplet } from "lucide-react";
import { cn } from "@/lib/utils";
import { navGroups } from "./nav-items";

/**
 * Sidebar. Spec: .claude/design/DESIGN-STANDARDS.md §3.1
 *
 * 240px. Items 40px tall with a 20px icon. Active state is a 3px Nova Blue
 * left border plus a light-blue background — the design doc's signature.
 */
export function AppSidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <aside
      className={cn(
        "flex w-[var(--sidebar-width)] shrink-0 flex-col border-r border-sidebar-border bg-sidebar",
        className,
      )}
    >
      <div className="flex h-[var(--topbar-height)] items-center gap-2.5 px-4">
        <div className="flex size-8 items-center justify-center rounded-md bg-primary">
          <Droplet
            className="size-4 text-primary-foreground"
            strokeWidth={2}
            aria-hidden
          />
        </div>
        <span className="text-[15px] font-semibold text-sidebar-foreground">
          Maruti Jal
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {navGroups.map((group, i) => (
          <div key={group.labelKey ?? `group-${i}`} className={i === 0 ? "" : "mt-5"}>
            {group.labelKey && (
              <p className="px-3 pb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t(`groups.${group.labelKey}`)}
              </p>
            )}

            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                const Icon = item.icon;

                const inner = (
                  <>
                    <Icon className="size-5 shrink-0" aria-hidden />
                    <span className="truncate">{t(item.key)}</span>
                  </>
                );

                const base =
                  "relative flex h-10 items-center gap-2 rounded-md px-3 text-sm transition-colors duration-100";

                if (!item.ready) {
                  return (
                    <li key={item.key}>
                      <span
                        aria-disabled="true"
                        title="Coming in a later phase"
                        className={cn(
                          base,
                          "cursor-not-allowed text-muted-foreground/50",
                        )}
                      >
                        {inner}
                      </span>
                    </li>
                  );
                }

                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        base,
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                        active
                          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-r before:bg-primary"
                          : "text-sidebar-foreground hover:bg-muted",
                      )}
                    >
                      {inner}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
