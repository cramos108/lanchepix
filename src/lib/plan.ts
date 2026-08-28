import { db, ensureSettings } from "./db";
import { nationalDigits } from "./phone";
import type { Plan, Sale, Settings } from "./types";

export const STRIPE_PRO_URL = "https://buy.stripe.com/6oU7sK3TQ0X77vr5VC4ko00";
export const FREE_LOYALTY_LIMIT = 100;
/** Grátis: Pix Confiança ilimitado. Mantido por compatibilidade. */
export const FREE_CONFIANCA_LIMIT = Number.POSITIVE_INFINITY;
/** @deprecated use FREE_CONFIANCA_LIMIT */
export const FREE_FIADO_MONTH_LIMIT = FREE_CONFIANCA_LIMIT;
export const PRO_PRICE_LABEL = "R$ 9,90/mês";
export const EQUIPE_PRICE_LABEL = "R$ 24,90/mês";

export const SUBSCRIBE_PIX_KEY =
  process.env.NEXT_PUBLIC_SUBSCRIBE_PIX_KEY?.trim() ||
  "pixdaconfianca@pagamentos.app";
export const SUBSCRIBE_PIX_NAME = "PIX DA CONFIANCA";
export const SUBSCRIBE_PIX_CITY = "SAO PAULO";

export const PLANS = {
  free: {
    id: "free" as const,
    name: "GRÁTIS",
    priceLabel: "R$ 0,00",
    cents: 0,
    features: [
      "Registro ilimitado de vendas no Pix Confiança",
      "Até 100 cartões fidelidade ativos",
      "Adesivos QR Code simples",
    ],
  },
  pro: {
    id: "pro" as const,
    name: "PLANO PRO",
    priceLabel: "R$ 9,90 / mês",
    cents: 990,
    features: [
      "Lembretes de cobrança no WhatsApp em lote (1 toque)",
      "Cartões Fidelidade Ilimitados",
      "Adesivos QR Code Premium com sua marca/Instagram",
      "Exportação de Relatórios de Vendas em PDF para MEI/Controle",
    ],
  },
  equipe: {
    id: "equipe" as const,
    name: "PLANO EQUIPE / NEGÓCIO",
    priceLabel: "R$ 24,90 / mês",
    cents: 2490,
    features: [
      "Tudo do Plano Pro +",
      "Acesso Multi-Dispositivo (Sincronização em tempo real para atendentes/ajudantes)",
      "Relatório de desempenho de vendas por ajudante/banca",
    ],
  },
} as const;

export type PaidPlan = "pro" | "equipe";

/** Pro e Equipe liberam os recursos pagos. */
export function isPro(settings?: Pick<Settings, "plan"> | null): boolean {
  return settings?.plan === "pro" || settings?.plan === "equipe";
}

export function isEquipe(settings?: Pick<Settings, "plan"> | null): boolean {
  return settings?.plan === "equipe";
}

export function planLabel(plan?: Plan | null): string {
  if (plan === "equipe") return "Equipe / Negócio";
  if (plan === "pro") return "Pro";
  return "Grátis";
}

export function planBadge(settings?: Pick<Settings, "plan"> | null): string | null {
  if (settings?.plan === "equipe") return "Equipe";
  if (settings?.plan === "pro") return "Pro";
  return null;
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

/** Grátis: Pix Confiança ilimitado. */
export async function canAddFiadoThisMonth(): Promise<boolean> {
  return true;
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
