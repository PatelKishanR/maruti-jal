import { signOut } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/force-signout — clear a stale session and land on /login.
 *
 * WHY THIS EXISTS, and why the authenticated layout must redirect HERE rather
 * than straight to /login:
 *
 * Two layers decide whether you are signed in, and they can disagree.
 *   - middleware (Edge): the JWT is cryptographically valid  → signed in
 *   - the (app) layout (Node): valid AND sessionVersion still matches the
 *     database → signed in
 *
 * After a password change every other device holds a valid-but-stale token.
 * If the layout simply redirected to /login, middleware would see a valid JWT,
 * bounce the user back to /, the layout would reject again — an infinite
 * redirect loop.
 *
 * Clearing the cookie is what makes the two layers agree again.
 *
 * NOTE: deliberately NOT wrapped in createApiHandler. signOut() signals its
 * redirect by throwing, which the wrapper would catch and report as a 500.
 */
export async function GET() {
  await signOut({ redirectTo: "/login?expired=1" });
}
