import {
  Calendar,
  CalendarPlus,
  BarChart3,
  Inbox,
  SearchX,
  Banknote,
  CheckCircle2,
  BookOpen,
  ClipboardList,
  Coins,
  Droplet,
  IndianRupee,
  Package,
  PackageCheck,
  PackageX,
  PartyPopper,
  Receipt,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * Icons addressed by NAME, not by reference.
 *
 * A `LucideIcon` is a function, and React refuses to serialise a function
 * across the server→client boundary — `icon={Coins}` from a server component
 * fails with "Only plain objects can be passed to Client Components".
 *
 * That is a real constraint, not a quirk, and the wrong place to solve it is
 * per-module: Products worked around it by wrapping its whole KPI strip in a
 * client island, while Staff and Coin Types hit the error. Passing a string
 * makes `KpiCard` usable from a server component directly, which is where a
 * KPI strip naturally lives — its data is already fetched on the server.
 *
 * Names follow the icon map in .claude/design/DESIGN-STANDARDS.md §17, so the
 * same concept gets the same glyph everywhere.
 */
export const APP_ICONS = {
  staff: Users,
  staffActive: UserCheck,
  active: CheckCircle2,
  product: Package,
  order: ClipboardList,
  coin: Coins,
  ledger: BookOpen,
  party: PartyPopper,
  calendar: Calendar,
  calendarAdd: CalendarPlus,
  directSale: Droplet,
  expense: Receipt,
  payment: Banknote,
  cash: Wallet,
  rupee: IndianRupee,
  jarsOut: PackageX,
  returned: PackageCheck,
  refund: RotateCcw,
  chart: BarChart3,
  search: SearchX,
  inbox: Inbox,
  trendUp: TrendingUp,
  trendDown: TrendingDown,
} as const satisfies Record<string, LucideIcon>;

export type AppIconName = keyof typeof APP_ICONS;

/** Back-compat alias — KpiCard was the first component to need this. */
export const KPI_ICONS = APP_ICONS;
export type KpiIconName = AppIconName;
