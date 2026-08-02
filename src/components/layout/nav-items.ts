import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Banknote,
  ClipboardList,
  Coins,
  Droplet,
  FileBarChart,
  LayoutDashboard,
  Package,
  PartyPopper,
  Receipt,
  Tags,
  Users,
} from "lucide-react";

/**
 * Navigation. Icons come from the shared map in
 * .claude/design/DESIGN-STANDARDS.md §17 — the same icon means the same thing
 * everywhere in the app.
 *
 * `ready: false` items render disabled with a "soon" affordance, so the shape
 * of the finished app is visible from Phase 1 without pretending routes exist.
 */
export interface NavItem {
  /** Message-catalogue key under `nav`. */
  key: string;
  href: string;
  icon: LucideIcon;
  ready: boolean;
}

export interface NavGroup {
  /** Message key under `nav.groups`, or null for ungrouped top items. */
  labelKey: string | null;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    labelKey: null,
    items: [
      { key: "dashboard", href: "/", icon: LayoutDashboard, ready: true },
    ],
  },
  {
    labelKey: "operations",
    items: [
      { key: "deliveryOrders", href: "/orders", icon: ClipboardList, ready: true },
      { key: "coinIssues", href: "/coins/issues", icon: Coins, ready: true },
      { key: "partyOrders", href: "/party-orders", icon: PartyPopper, ready: true },
      { key: "directSales", href: "/direct-sales", icon: Droplet, ready: true },
    ],
  },
  {
    labelKey: "masters",
    items: [
      { key: "staff", href: "/staff", icon: Users, ready: true },
      { key: "products", href: "/products", icon: Package, ready: true },
      { key: "coinTypes", href: "/coins/types", icon: Coins, ready: true },
      { key: "expenseCategories", href: "/expenses/categories", icon: Tags, ready: true },
    ],
  },
  {
    labelKey: "money",
    items: [
      { key: "expenses", href: "/expenses", icon: Receipt, ready: true },
      { key: "payments", href: "/payments", icon: Banknote, ready: false },
    ],
  },
  {
    labelKey: "insights",
    items: [
      { key: "reports", href: "/reports", icon: FileBarChart, ready: false },
      /* The coin ledger is a tab on each coin type, not a standalone route —
         a top-level link here would 404. Stock adjustments is the real page. */
      { key: "coinAdjustments", href: "/coins/adjustments", icon: BookOpen, ready: true },
    ],
  },
];
