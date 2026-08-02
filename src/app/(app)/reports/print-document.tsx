import * as React from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { formatDate, formatDateRange, formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/config";
import type { ReportMetaDto } from "@/lib/dto/report.dto";

/**
 * The A4 document. Spec: design/MODULES/09-reports.md §12 · DESIGN-STANDARDS §19
 *
 * NOT A SCREENSHOT OF THE SCREEN. Everything the screen carries in colour has
 * to survive as a word here: status prints as `Partial — ₹450.00 due`, never as
 * an amber pill, because a badge tint is invisible on a mono laser printer and
 * these documents are read across a table by someone who did not open them.
 *
 * The document and the screen are both in the DOM. This block is
 * `hidden print:block`; everything on the screen is `print:hidden`. That is why
 * there is no `/reports/…/print` route — a second route would be a second place
 * the figures were assembled, and two assemblies of one statement will
 * eventually disagree about a rupee.
 *
 * GUJARATI. `--font-sans` ends in Noto Sans Gujarati and `report-print.css`
 * never re-declares a font family without repeating that fallback, so a name
 * typed as `રમેશ પટેલ` prints as `રમેશ પટેલ` rather than as tofu. Gujarati lines
 * take 16pt leading against the document's 14pt, because matras sit above and
 * below the baseline. §12.1
 */

export function PrintDocument({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article className={cn("report-print hidden print:block", className)}>
      {children}
    </article>
  );
}

/**
 * The shared header block — top 35mm of page 1. §12.1
 *
 * `Generated …` is always present, so a printed copy found in six months is not
 * mistaken for a current one. The document code is right-aligned on the same
 * baseline, which is what lets two copies of the same day's sheet be recognised
 * as the same document.
 */
export async function PrintHeader({
  meta,
  title,
  /** `Period 01 Jul – 14 Aug 2026`, or `For 14 Aug 2026` on the day sheet. */
  periodMode = "range",
}: {
  meta: ReportMetaDto;
  title: string;
  periodMode?: "range" | "date" | "none";
}) {
  const t = await getTranslations("reports.print");
  const locale = (await getLocale()) as Locale;

  return (
    <header>
      <h1>{t("businessName")}</h1>
      <p className="caption">{t("businessLine")}</p>

      <div className="mt-2 border-b border-black" />

      <h2 className="mt-3">{title}</h2>

      {meta.subject ? (
        <p className="subject mt-1">
          {meta.subject}
          {meta.subjectMeta ? ` · ${meta.subjectMeta}` : ""}
        </p>
      ) : null}

      {periodMode === "range" ? (
        <p className="period mt-0.5">
          {t("period", { range: formatDateRange(meta.from, meta.to, locale) })}
        </p>
      ) : periodMode === "date" ? (
        <p className="period mt-0.5">
          {t("forDate", { date: formatDate(meta.date, locale) })}
        </p>
      ) : null}

      <div className="mt-1 flex items-baseline justify-between gap-4">
        <p className="caption">
          {t("generated", {
            timestamp: formatDateTime(meta.generatedAt, locale),
          })}
        </p>
        <p className="caption font-mono">{meta.documentCode}</p>
      </div>
    </header>
  );
}

/**
 * The running footer: `Page n of m`, the document code and the timestamp, on
 * EVERY page.
 *
 * The page numbers are CSS counters — `counter(page)` and `counter(pages)` are
 * only defined in paged media, so they cannot be rendered as React content and
 * the element has to be `position: fixed` for the browser to repeat it. See
 * `.report-print__footer` in report-print.css.
 */
export async function PrintFooter({ meta }: { meta: ReportMetaDto }) {
  const t = await getTranslations("reports.print");
  const locale = (await getLocale()) as Locale;

  return (
    <footer className="report-print__footer">
      <span className="font-mono">
        {t("businessName")} · {meta.documentCode}
      </span>
      <span>
        {t("pageLabel")}{" "}
        {/*
          * The " of " between the counters comes from the catalogue, via a CSS
          * custom property — `content:` cannot read a translation, and a
          * hardcoded separator printed "પૃષ્ઠ 1 of 2" on every page of a
          * Gujarati statement.
          */}
        <span
          className="report-print__page"
          style={{ "--page-of": `" ${t("pageOf")} "` } as React.CSSProperties}
        />
      </span>
      <span>
        {t("generated", {
          timestamp: formatDateTime(meta.generatedAt, locale),
        })}
      </span>
    </footer>
  );
}

/** A section heading on the page — `A · OPEN DELIVERY ORDERS`. */
export function PrintSection({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="section">
      <h3 className="section-heading">
        {title}
        {note ? <span className="caption font-normal"> {note}</span> : null}
      </h3>
      {children}
    </section>
  );
}

/**
 * The right-aligned summary list at the top of a statement.
 *
 * NOT the screen's four-column band. A band of large figures reads as a poster;
 * a settlement document needs a running total the eye can add down. §12.2
 */
export function PrintSummary({
  rows,
  total,
  note,
}: {
  rows: Array<{ label: string; value: string }>;
  total?: { label: string; value: string };
  note?: string;
}) {
  return (
    <div className="avoid-break mt-4 flex justify-end">
      <table className="w-[60mm]">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="plain">{row.label}</td>
              <td className="figure plain">{row.value}</td>
            </tr>
          ))}
          {total ? (
            <tr className="rule-top">
              <td className="plain">{total.label}</td>
              <td className="figure plain">{total.value}</td>
            </tr>
          ) : null}
          {note ? (
            <tr>
              <td className="caption plain" colSpan={2}>
                {note}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The signature block. §12.2, §12.4
 *
 * On the staff statement and the collection sheet only — those two are filled
 * in by hand after printing, and the `Counted` / `Difference` rules on the
 * collection sheet are the entire reason that document exists on paper.
 */
export function PrintSignatures({
  blocks,
}: {
  blocks: Array<{ label: string; under?: string; dateLabel: string }>;
}) {
  return (
    <div className="avoid-break mt-12 flex flex-wrap gap-x-16 gap-y-8">
      {blocks.map((block) => (
        <div key={block.label}>
          <span className="sign-rule" />
          <p className="caption mt-1">{block.label}</p>
          {block.under ? <p className="caption">{block.under}</p> : null}
          <p className="caption mt-4">
            {block.dateLabel} <span className="sign-rule w-30" />
          </p>
        </div>
      ))}
    </div>
  );
}
