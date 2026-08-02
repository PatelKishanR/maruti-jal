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
  staff: {
    list: "/api/staff",
    detail: (id: string) => `/api/staff/${id}`,
    reactivate: (id: string) => `/api/staff/${id}/reactivate`,
    options: "/api/staff/options",
  },
  products: {
    list: "/api/products",
    detail: (id: string) => `/api/products/${id}`,
    reactivate: (id: string) => `/api/products/${id}/reactivate`,
    options: "/api/products/options",
    lookups: "/api/products/lookups",
  },
  coinTypes: {
    list: "/api/coin-types",
    detail: (id: string) => `/api/coin-types/${id}`,
    ledger: (id: string) => `/api/coin-types/${id}/ledger`,
    reactivate: (id: string) => `/api/coin-types/${id}/reactivate`,
    options: "/api/coin-types/options",
  },
  expenseCategories: {
    list: "/api/expense-categories",
    detail: (id: string) => `/api/expense-categories/${id}`,
    reactivate: (id: string) => `/api/expense-categories/${id}/reactivate`,
    reorder: "/api/expense-categories/reorder",
    options: "/api/expense-categories/options",
  },
  dashboard: {
    summary: (period: string = "today") =>
      `/api/dashboard/summary?period=${encodeURIComponent(period)}`,
  },
  insights: {
    /** `v_exec_summary` on its own — takes no parameters by design. */
    summary: "/api/insights/summary",
    /**
     * The whole executive dashboard in one response. `from`/`to` are only read
     * when `period=custom`; anything else is resolved server-side so the URL
     * and the figures cannot disagree.
     */
    dashboard: (params?: { period?: string; from?: string; to?: string }) => {
      const search = new URLSearchParams();
      if (params?.period) search.set("period", params.period);
      if (params?.from) search.set("from", params.from);
      if (params?.to) search.set("to", params.to);
      const qs = search.toString();
      return `/api/insights/dashboard${qs ? `?${qs}` : ""}`;
    },
  },
} as const;
