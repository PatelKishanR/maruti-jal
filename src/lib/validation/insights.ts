import { z } from "zod";

/**
 * The executive summary takes NO parameters, and the schema says so out loud.
 *
 * `v_exec_summary` is always "as of today, in IST" — the view computes its own
 * `as_of_date` from `(now() AT TIME ZONE 'Asia/Kolkata')::date` rather than
 * accepting one, precisely so the headline figure cannot be made to disagree
 * with the rows beneath it by a stale bookmark or a hand-edited URL.
 *
 * The schema is still declared and still runs. Zod strips every key it does not
 * name, so `?period=today&debug=1` on a bookmarked link is ignored rather than
 * reaching the service or 422-ing. That is the rule ARCHITECTURE §5.1 asks for:
 * every route validates its query, including the ones whose answer is "there
 * are no valid parameters".
 */
export const insightsSummaryQuerySchema = z.object({});

export type InsightsSummaryQuery = z.infer<typeof insightsSummaryQuerySchema>;
