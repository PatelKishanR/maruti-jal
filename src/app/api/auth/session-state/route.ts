import { createApiHandler } from "@/lib/api/handler";
import { auth } from "@/auth";
import { isSessionValid } from "@/lib/services/auth.service";
import type { SessionStateDto } from "@/lib/dto/dashboard.dto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/session-state
 *
 * Is the caller's token still valid for their account? The JWT carries the
 * sessionVersion it was minted with; changing a password bumps the stored
 * value, so every OTHER device's token stops matching.
 *
 * This lives behind the API rather than being called directly from the
 * authenticated layout, so the rule stays absolute: nothing under app/ or
 * components/ imports a service or repository.
 */
export const GET = createApiHandler({
  name: "GET /api/auth/session-state",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  handler: async ({ ctx }): Promise<SessionStateDto> => {
    const session = await auth();
    const valid = await isSessionValid(ctx.userId, session?.user?.sessionVersion);
    return { valid };
  },
});
