"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { reportRoutes } from "@/lib/api/routes.report";
import type { ReportFilters } from "@/lib/validation/report";

/**
 * The export bar. Spec: design/MODULES/09-reports.md §13
 *
 * ── CSV IS A REAL DOWNLOAD, NOT A BLOB ──────────────────────────────────────
 *
 * The button is an anchor pointing at `/api/reports/[slug]/export`, which
 * answers with `Content-Disposition: attachment`. There is no `URL.createObject
 * URL`, no client-side serialisation and no second copy of the report's shape
 * in the browser — the bytes that land on disk are the ones the server computed
 * from the same filters that produced the table above. A client-side export
 * re-serialises whatever the page happens to be holding, which is how an export
 * starts quietly disagreeing with the report it was taken from. §13.3
 *
 * The filters are rebuilt from the SAME `ReportFilters` object the report ran
 * with, through `reportRoutes.export`, so "respects every applied filter"
 * (§13.3) is structural rather than a promise.
 *
 * ── PDF IS THE BROWSER'S OWN DIALOGUE, DELIBERATELY ─────────────────────────
 *
 * No PDF library is installed and adding one is an infrastructure decision, not
 * a module decision. `window.print()` against the A4 stylesheet in
 * `report-print.css` produces a correct, selectable, Gujarati-shaping A4 PDF
 * through the browser's own "Save as PDF", at zero dependency cost — and,
 * unlike a server renderer, it is guaranteed to match what `Print` shows
 * because it IS what `Print` shows. §12.6 asks for exactly this CSS.
 *
 * What is NOT delivered by this route: a `PDF ready` toast with a re-download
 * action, the multi-page overflow prompt, and the Gujarati font-fallback
 * blocking modal (§12.5). All three presuppose a server-rendered file. Reported
 * as a gap rather than faked.
 */
export function ExportBar({
  filters,
  generatedAt,
  rowCount,
  printable,
  disabled,
}: {
  filters: ReportFilters;
  /** Already formatted — `14 Aug 2026, 6:05 pm`. */
  generatedAt: string;
  rowCount: number;
  printable: boolean;
  /** Nothing ran, or it returned no rows. §13.5 */
  disabled: boolean;
}) {
  const t = useTranslations("reports.export");
  const href = reportRoutes.export(filters.slug, filters);

  return (
    <Card className="mt-6 flex flex-col gap-3 p-4 print:hidden sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="min-w-0">
        <p className="text-caption text-muted-foreground">
          {t("generated", {
            time: generatedAt,
            rows: String(rowCount),
          })}
        </p>
        {!printable ? (
          <p className="mt-1 text-caption text-muted-foreground">
            {t("noPdf")}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <Button
          asChild={!disabled}
          variant="secondary"
          disabled={disabled}
          className="flex-1 sm:flex-none"
          title={disabled ? t("nothingToExport") : undefined}
        >
          {disabled ? (
            <span>
              <Download className="size-4" aria-hidden />
              {t("csv")}
            </span>
          ) : (
            /* `download` is advisory only — the server's Content-Disposition
               names the file. Both are set so a middlebox stripping one still
               leaves a download rather than a page of CSV. */
            <a href={href} download>
              <Download className="size-4" aria-hidden />
              {t("csv")}
            </a>
          )}
        </Button>

        {printable ? (
          <Button
            type="button"
            variant="secondary"
            disabled={disabled}
            onClick={() => window.print()}
            className="flex-1 sm:flex-none"
          >
            <Download className="size-4" aria-hidden />
            {t("pdf")}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

/**
 * `🖨 Print` in the page header — an action on the current view rather than a
 * file, which is why it lives up there and not in the export bar. §13.3
 *
 * `⌘/Ctrl + P` is bound to the same thing on the three printed reports (§4.6).
 * The browser would open its own print dialogue anyway; binding it here means
 * the shortcut and the button cannot diverge if the print path ever changes.
 */
export function PrintButton() {
  const t = useTranslations("reports.export");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p") {
        event.preventDefault();
        window.print();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <Button type="button" variant="secondary" onClick={() => window.print()}>
      <Printer className="size-4" aria-hidden />
      {t("print")}
    </Button>
  );
}
