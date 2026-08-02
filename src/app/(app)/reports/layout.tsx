import "./report-print.css";

/**
 * The reports segment.
 *
 * Its only job is to load `report-print.css`, which is scoped to this route by
 * being imported here: three of the seven reports are printed and handed to
 * people, and the stylesheet has to hide the sidebar and topbar with element
 * selectors it must not apply anywhere else in the app.
 *
 * `runtime = 'nodejs'` and `force-dynamic` for the same reason the app shell
 * declares them: every figure below reaches PostgreSQL, and nothing on a
 * reporting screen is ever safe to serve from a cache the owner cannot see.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
