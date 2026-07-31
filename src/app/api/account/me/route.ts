import { createApiHandler } from "@/lib/api/handler";
import { getUserById } from "@/lib/services/auth.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/account/me — the signed-in user's profile. */
export const GET = createApiHandler({
  name: "GET /api/account/me",
  roles: ["OWNER", "ADMIN", "MANAGER", "VIEWER"],
  handler: ({ ctx }) => getUserById(ctx.userId),
});
