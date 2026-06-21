import type { OrderListRow, OrderStatus } from "@/features/orders/types";
import type { InvoiceListRow } from "@/features/invoices/types";

export const BOARD_STATUSES: OrderStatus[] = [
  "intake", "diagnosis", "estimate", "awaiting_approval", "in_progress", "qc", "ready",
];

const round3 = (n: number): number => Math.round(n * 1000 + Number.EPSILON) / 1000;

// Compare by UTC date parts so results are timezone-independent.
// Real app passes `new Date()` (local now) while issued_at is a UTC Postgres timestamp.
// Using UTC date-parts means "today" equals the UTC calendar day — acceptable MVP
// simplification for a single-branch Jordan shop; a TZ-aware version is a later refinement.
const sameDay = (a: Date, b: Date): boolean =>
  a.getUTCFullYear() === b.getUTCFullYear() &&
  a.getUTCMonth() === b.getUTCMonth() &&
  a.getUTCDate() === b.getUTCDate();

export interface BoardColumn {
  status: OrderStatus;
  orders: OrderListRow[];
}

export interface DashboardStats {
  carsInWorkshop: number;
  awaitingApproval: number;
  readyForHandover: number;
  invoicedToday: number;
  board: BoardColumn[];
}

export function computeDashboard(
  orders: OrderListRow[],
  invoices: InvoiceListRow[],
  now: Date,
): DashboardStats {
  const active = new Set<OrderStatus>(BOARD_STATUSES);
  const carsInWorkshop = orders.filter((o) => active.has(o.status)).length;
  const awaitingApproval = orders.filter((o) => o.status === "awaiting_approval").length;
  const readyForHandover = orders.filter((o) => o.status === "ready").length;
  const invoicedToday = round3(
    invoices
      .filter((i) => i.issued_at && sameDay(new Date(i.issued_at), now))
      .reduce((s, i) => s + i.total, 0),
  );
  const board: BoardColumn[] = BOARD_STATUSES
    .map((status) => ({ status, orders: orders.filter((o) => o.status === status) }))
    .filter((col) => col.orders.length > 0);
  return { carsInWorkshop, awaitingApproval, readyForHandover, invoicedToday, board };
}
