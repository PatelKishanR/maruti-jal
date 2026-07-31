"use client";

import { useCallback, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TABLE_PARAMS, type SortDir } from "@/lib/table/types";

/**
 * All table state lives in the URL.
 *
 * That is what makes views shareable ("here's the link to Ramesh's unsettled
 * orders"), makes browser back/forward work, and lets a filtered list be
 * bookmarked. It also means the server is the single source of truth — there
 * is no client-side table state to fall out of sync.
 *
 * `isPending` is the important return value: it drives dimming the existing
 * rows rather than replacing them with a skeleton. Swapping loaded data for
 * grey bars reads as slower than it is. See DESIGN-STANDARDS §5.6
 */
export function useTableParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const setParams = useCallback(
    (patch: Record<string, string | number | undefined | null>) => {
      const next = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === null || value === "") {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }

      // Any change other than paging returns to page 1 — otherwise you filter
      // a 20-page list down to 2 pages while sitting on page 14 and get an
      // empty screen that looks like a bug.
      if (!(TABLE_PARAMS.page in patch)) {
        next.delete(TABLE_PARAMS.page);
      }

      const qs = next.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [router, pathname, searchParams],
  );

  const get = useCallback(
    (key: string) => searchParams.get(key) ?? undefined,
    [searchParams],
  );

  const toggleSort = useCallback(
    (key: string, currentKey: string | undefined, currentDir: SortDir | undefined) => {
      // none -> asc -> desc -> none
      if (currentKey !== key) {
        setParams({ [TABLE_PARAMS.sort]: key, [TABLE_PARAMS.dir]: "asc" });
      } else if (currentDir === "asc") {
        setParams({ [TABLE_PARAMS.sort]: key, [TABLE_PARAMS.dir]: "desc" });
      } else {
        setParams({ [TABLE_PARAMS.sort]: undefined, [TABLE_PARAMS.dir]: undefined });
      }
    },
    [setParams],
  );

  const clearAll = useCallback(() => {
    startTransition(() => router.replace(pathname, { scroll: false }));
  }, [router, pathname]);

  return {
    params: searchParams,
    get,
    setParams,
    toggleSort,
    clearAll,
    isPending,
    activeCount: countActive(searchParams),
  };
}

/** How many real filters are applied — excludes paging and sorting. */
function countActive(params: URLSearchParams): number {
  const structural = new Set<string>(Object.values(TABLE_PARAMS));
  let count = 0;
  for (const [key, value] of params.entries()) {
    if (!structural.has(key) && value) count += 1;
  }
  return count;
}
