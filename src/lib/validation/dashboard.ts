import { z } from "zod";

/**
 * Query params arrive as strings, so every schema here coerces and defaults.
 * Unknown keys are dropped by Zod rather than reaching a service.
 */
export const dashboardSummaryQuerySchema = z.object({
  period: z
    .enum(["today", "week", "month", "last-month"], {
      message: "common.invalidRequest",
    })
    .default("today"),
});

export type DashboardSummaryQuery = z.infer<typeof dashboardSummaryQuerySchema>;
