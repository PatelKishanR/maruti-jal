import "server-only";
import { coinCirculationRepository } from "@/lib/repositories/insights/coin-circulation.repository";
import { dailySalesRepository } from "@/lib/repositories/insights/daily-sales.repository";
import { execSummaryRepository } from "@/lib/repositories/insights/exec-summary.repository";
import { productSalesRepository } from "@/lib/repositories/insights/product-sales.repository";
import { staffJarBalanceRepository } from "@/lib/repositories/insights/staff-jar-balance.repository";
import { staffOutstandingRepository } from "@/lib/repositories/insights/staff-outstanding.repository";
import { monthBounds } from "@/lib/dates";
import {
  toCoinCirculationDto,
  toCoinCirculationTotalsDto,
  toDailySalesDto,
  toExecSummaryDto,
  toProductSalesDto,
  toSalesChannelTotalsDto,
  toSalesTotalsDto,
  toStaffJarBalanceDto,
  toStaffJarBalanceTotalsDto,
  toStaffOutstandingDto,
  toStaffOutstandingTotalsDto,
  type CoinCirculationDto,
  type CoinCirculationTotalsDto,
  type DailySalesDto,
  type ExecSummaryDto,
  type ProductSalesDto,
  type SalesChannelTotalsDto,
  type SalesTotalsDto,
  type StaffJarBalanceDto,
  type StaffJarBalanceTotalsDto,
  type StaffOutstandingDto,
  type StaffOutstandingTotalsDto,
} from "@/lib/dto/insights.dto";

/**
 * The insights layer — the seven dashboard views, exposed as DTOs.
 *
 * This service is deliberately THIN. Every figure it returns was computed by
 * PostgreSQL inside a view; there is nothing here to decide and nothing to add
 * up. Its whole job is the two rules that hold everywhere else in this
 * codebase: call repositories, return DTOs. See ARCHITECTURE §4.
 *
 * WHO CALLS WHAT. The module services (`staff.service`, `product.service`,
 * `coin-type.service`, `expense.service`) do NOT call this file — a service
 * calling another service is how the layering rule dies. They call the same
 * insights REPOSITORIES directly, which is the composition rule working
 * exactly as intended: one service, several repositories. This file exists for
 * the dashboard, which has no module of its own to belong to.
 */

/* ── Executive summary ───────────────────────────────────────────────────── */

/** The dashboard headline. Always one row, even on an empty database. */
export async function getExecSummary(): Promise<ExecSummaryDto> {
  return toExecSummaryDto(await execSummaryRepository.find());
}

/* ── Staff ───────────────────────────────────────────────────────────────── */

export async function listStaffOutstanding(): Promise<StaffOutstandingDto[]> {
  const rows = await staffOutstandingRepository.findAll();
  return rows.map(toStaffOutstandingDto);
}

export async function getStaffOutstandingTotals(): Promise<StaffOutstandingTotalsDto> {
  return toStaffOutstandingTotalsDto(await staffOutstandingRepository.totals());
}

export async function listStaffJarBalances(): Promise<StaffJarBalanceDto[]> {
  const rows = await staffJarBalanceRepository.findAll();
  return rows.map(toStaffJarBalanceDto);
}

export async function getStaffJarTotals(): Promise<StaffJarBalanceTotalsDto> {
  return toStaffJarBalanceTotalsDto(await staffJarBalanceRepository.totals());
}

/* ── Coins ───────────────────────────────────────────────────────────────── */

export async function listCoinsInCirculation(): Promise<CoinCirculationDto[]> {
  const rows = await coinCirculationRepository.findAll();
  return rows.map(toCoinCirculationDto);
}

export async function getCoinCirculationTotals(): Promise<CoinCirculationTotalsDto> {
  return toCoinCirculationTotalsDto(await coinCirculationRepository.totals());
}

/* ── Sales ───────────────────────────────────────────────────────────────── */

/** Date × channel rows for a window, oldest first — the trend chart's series. */
export async function listDailySales(
  from: string,
  to: string,
): Promise<DailySalesDto[]> {
  const rows = await dailySalesRepository.findBetween(from, to);
  return rows.map(toDailySalesDto);
}

export async function getSalesTotals(
  from: string,
  to: string,
): Promise<SalesTotalsDto> {
  return toSalesTotalsDto(await dailySalesRepository.totalsBetween(from, to));
}

export async function getSalesByChannel(
  from: string,
  to: string,
): Promise<SalesChannelTotalsDto[]> {
  const rows = await dailySalesRepository.totalsByChannelBetween(from, to);
  return rows.map(toSalesChannelTotalsDto);
}

/* ── Products ────────────────────────────────────────────────────────────── */

/**
 * Every product that moved in a month.
 *
 * `month` is `'YYYY-MM'` at this boundary because that is what the rest of the
 * application speaks; the view keys on the first day of the month, so the
 * conversion happens once, here, rather than in every caller.
 */
export async function listProductSales(
  month: string,
): Promise<ProductSalesDto[]> {
  const rows = await productSalesRepository.findByMonth(monthStart(month));
  return rows.map(toProductSalesDto);
}

export async function getProductSalesHistory(
  productId: string,
): Promise<ProductSalesDto[]> {
  const rows = await productSalesRepository.findByProductId(productId);
  return rows.map(toProductSalesDto);
}

/** `'YYYY-MM'` → `'YYYY-MM-01'`, the key `v_product_sales` groups on. */
function monthStart(month: string): string {
  return monthBounds(`${month}-01`).from;
}
