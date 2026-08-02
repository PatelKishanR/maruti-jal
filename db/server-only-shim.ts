/**
 * `server-only` resolved to a no-op, for scripts run by tsx.
 *
 * The real package throws when imported outside a React Server Component, which
 * is exactly the guard we want in the app — a client component importing the
 * DataSource must fail the build.
 *
 * A seed script is legitimately server-side but is not a React render, so it
 * trips the same wire. Aliasing it here keeps the guard fully intact for the
 * application and lets `db/*.ts` call the service layer — which is the point:
 * seeding through services exercises the same business rules and triggers the
 * UI does, instead of inventing a second, untested write path.
 */
export {};
