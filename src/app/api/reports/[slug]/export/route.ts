import { createApiHandler } from "@/lib/api/handler";
import { renderReportCsv } from "@/lib/services/report.service";
import {
  reportExportQuerySchema,
  reportSlugParamsSchema,
} from "@/lib/validation/report";

export const runtime = "nodejs";

/**
 * The CSV download — design/MODULES/09-reports.md §13.3.
 *
 * A REAL FILE RESPONSE, not a blob assembled in the browser. `Content-
 * Disposition: attachment` means the browser saves it under the server's
 * filename with no JavaScript involved, and — the part that matters — the bytes
 * that land on disk are the ones the server computed from the same filters that
 * produced the table on screen. A client-side export re-serialises whatever the
 * page happens to be holding, which is how an export starts disagreeing with
 * the report it was taken from.
 *
 * `raw: true` skips the JSON envelope only. Authentication, the role check and
 * Zod on the slug and every filter all still run — see `createApiHandler`.
 *
 * The body is already BOM-prefixed UTF-8 (§13.3), so the charset is declared
 * and `Content-Length` is left to the runtime: a BOM makes the byte length
 * differ from the string length, and getting that wrong truncates the file.
 */
export const GET = createApiHandler({
  name: "GET /api/reports/[slug]/export",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  params: reportSlugParamsSchema,
  query: reportExportQuerySchema,
  raw: true,
  handler: async ({ params, query }) => {
    const { filename, body } = await renderReportCsv(params.slug, query);

    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        // Latin-only by construction (see `csvFilename`), so no RFC 5987
        // `filename*` form is needed and every client agrees on the name.
        "content-disposition": `attachment; filename="${filename}"`,
        "cache-control": "no-store",
      },
    });
  },
});
