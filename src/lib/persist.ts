import { db } from "./db";
import type { Product } from "./types";

const CART_KEY = "lanchepix_cart_qty";
const CATALOG_KEY = "lanchepix_catalog_backup";

export function loadCartQty(): Record<string, number> {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveCartQty(qtyById: Record<string, number>): void {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(qtyById));
  } catch {
    /* private mode / quota */
  }
}

export async function backupCatalog(): Promise<void> {
  try {
    const rows = await db.products.toArray();
    localStorage.setItem(CATALOG_KEY, JSON.stringify(rows));
  } catch {
    /* private mode / quota */
  }
}

export async function restoreCatalogBackupIfEmpty(): Promise<void> {
  try {
    const count = await db.products.count();
    if (count > 0) return;
    const raw = localStorage.getItem(CATALOG_KEY);
    if (!raw) return;
    const rows = JSON.parse(raw) as Product[];
    if (!Array.isArray(rows) || !rows.length) return;
    await db.products.bulkPut(rows);
  } catch {
    /* ignore corrupt backup */
  }
}

export function isOfflineError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : error instanceof Error
        ? error.message
        : String(error ?? "");
  const lower = message.toLowerCase();
  return (
    lower === "offline_queued" ||
    lower.includes("failed to fetch") ||
    lower.includes("network") ||
    lower.includes("offline") ||
    lower.includes("internet") ||
    lower.includes("fetch")
  );
}
