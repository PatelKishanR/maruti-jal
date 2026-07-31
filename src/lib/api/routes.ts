/**
 * Every API path in one place.
 *
 * Components import from here rather than typing string literals, so a route
 * rename is a single edit and a typo is a type error.
 */
export const apiRoutes = {
  account: {
    me: "/api/account/me",
    profile: "/api/account/profile",
    preferences: "/api/account/preferences",
    password: "/api/account/password",
  },
  dashboard: {
    summary: (period: string = "today") =>
      `/api/dashboard/summary?period=${encodeURIComponent(period)}`,
  },
} as const;
