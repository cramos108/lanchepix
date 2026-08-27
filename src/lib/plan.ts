import { db, ensureSettings } from "./db";
import { nationalDigits } from "./phone";
import type { Sale, Settings } from "./types";

export const STRIPE_PRO_URL = "https://buy.stripe.com/6oU7sK3TQ0X77vr5VC4ko00";
export const FREE_LOYALTY_LIMIT = 25;
export const FREE_CONFIANCA_LIMIT = 50;
/** @deprecated use FREE_CONFIANCA_LIMIT */
export const FREE_FIADO_MONTH_LIMIT = FREE_CONFIANCA_LIMIT;
export const PRO_PRICE_LABEL = "R$ 9,90/mês";

export function isPro(settings?: Pick<Settings, "plan"> | null): boolean {
  return settings?.plan === "pro";
}

export function isSameLocalMonth(iso: string, ref = new Date()): boolean {
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

/** Pix Confiança = venda que não foi PIX AGORA (pagoAt diferente do createdAt). */
export function isConfiancaSale(sale: Sale): boolean {
  return sale.paidAt !== sale.createdAt;
}

export function countConfiancaSales(sales: Sale[]): number {
  return sales.filter(isConfiancaSale).length;
}

export function countFiadoThisMonth(sales: Sale[]): number {
  return countConfiancaSales(sales);
}

export async function canAddLoyaltyCard(phone: string): Promise<boolean> {
  const settings = await ensureSettings();
  if (isPro(settings)) return true;
  const needle = nationalDigits(phone);
  const all = await db.customers.toArray();
  if (all.some((c) => nationalDigits(c.phone) === needle)) return true;
  return all.length < FREE_LOYALTY_LIMIT;
}

export async function canAddFiadoThisMonth(): Promise<boolean> {
  const settings = await ensureSettings();
  if (isPro(settings)) return true;
  const sales = await db.sales.toArray();
  return countConfiancaSales(sales) < FREE_CONFIANCA_LIMIT;
}

const listeners = new Set<() => void>();

export function openUpgradeModal(): void {
  listeners.forEach((l) => l());
}

export function subscribeUpgradeModal(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function openStripeCheckout(): void {
  window.open(STRIPE_PRO_URL, "_blank", "noopener,noreferrer");
}
