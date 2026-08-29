import { isStaffDevice } from "./account";
import { db, ensureSettings } from "./db";
import { nationalDigits } from "./phone";
import type { Plan, Sale, Settings } from "./types";

export const STRIPE_PRO_URL = "https://buy.stripe.com/6oU7sK3TQ0X77vr5VC4ko00";
export const STRIPE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";
export const STRIPE_PRICE_PRO =
  process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO?.trim() ?? "";
export const STRIPE_PRICE_NEGOCIO =
  process.env.NEXT_PUBLIC_STRIPE_PRICE_NEGOCIO?.trim() ?? "";
export const FREE_LOYALTY_LIMIT = 100;
/** Grátis: Pix Confiança ilimitado. Mantido por compatibilidade. */
export const FREE_CONFIANCA_LIMIT = Number.POSITIVE_INFINITY;
/** @deprecated use FREE_CONFIANCA_LIMIT */
export const FREE_FIADO_MONTH_LIMIT = FREE_CONFIANCA_LIMIT;
export const PRO_PRICE_LABEL = "R$ 9,90/mês";
export const NEGOCIO_PRICE_LABEL = "R$ 24,90/mês";
/** @deprecated use NEGOCIO_PRICE_LABEL */
export const EQUIPE_PRICE_LABEL = NEGOCIO_PRICE_LABEL;

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
    name: "PRO",
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
    name: "NEGÓCIO",
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

const DEV_PLAN_KEY = "dev_plan_override";
const DEV_LIMIT_KEY = "dev_simulate_free_limit";
const ACTIVE_PLAN_KEY = "active_plan";
const DEV_CYCLE: Plan[] = ["free", "pro", "equipe"];

const devListeners = new Set<() => void>();
let devPlanMemory: Plan | null | undefined;
let devLimitMemory: boolean | undefined;
let activePlanMemory: Plan | null | undefined;
let devBooted = false;

function emitDev() {
  devListeners.forEach((l) => l());
}

function parseStoredPlan(value: string | null): Plan | null {
  if (value === "pro") return "pro";
  if (value === "equipe" || value === "negocio") return "equipe";
  if (value === "free") return "free";
  return null;
}

function bootDev() {
  if (devBooted || typeof window === "undefined") return;
  try {
    devPlanMemory = parseStoredPlan(localStorage.getItem(DEV_PLAN_KEY));
    devLimitMemory = localStorage.getItem(DEV_LIMIT_KEY) === "true";
    activePlanMemory = parseStoredPlan(localStorage.getItem(ACTIVE_PLAN_KEY));
  } catch {
    devPlanMemory = null;
    devLimitMemory = false;
    activePlanMemory = null;
  }
  devBooted = true;
}

export function subscribeDevPlan(listener: () => void): () => void {
  devListeners.add(listener);
  return () => devListeners.delete(listener);
}

export function getDevPlanOverride(): Plan | null {
  if (typeof window === "undefined") return null;
  bootDev();
  return devPlanMemory ?? null;
}

export function setDevPlanOverride(plan: Plan | null): void {
  bootDev();
  devPlanMemory = plan;
  try {
    if (plan) localStorage.setItem(DEV_PLAN_KEY, plan);
    else localStorage.removeItem(DEV_PLAN_KEY);
  } catch {
    /* private mode */
  }
  emitDev();
}

export function getDevSimulateLimit(): boolean {
  if (typeof window === "undefined") return false;
  bootDev();
  return Boolean(devLimitMemory);
}

export function setDevSimulateLimit(on: boolean): void {
  bootDev();
  devLimitMemory = on;
  try {
    if (on) localStorage.setItem(DEV_LIMIT_KEY, "true");
    else localStorage.removeItem(DEV_LIMIT_KEY);
  } catch {
    /* private mode */
  }
  emitDev();
}

export function cycleDevPlan(current?: Plan | null): Plan {
  const cur = getDevPlanOverride() ?? current ?? "free";
  const idx = Math.max(0, DEV_CYCLE.indexOf(cur));
  const next = DEV_CYCLE[(idx + 1) % DEV_CYCLE.length];
  setDevSimulateLimit(false);
  setDevPlanOverride(next);
  return next;
}

export function clearDevOverrides(): void {
  setDevSimulateLimit(false);
  setDevPlanOverride(null);
}

export function getStoredActivePlan(): Plan | null {
  if (typeof window === "undefined") return null;
  bootDev();
  return activePlanMemory ?? null;
}

/** Persistência local do plano pago: 'pro' | 'negocio'. */
export function persistActivePlan(plan: "pro" | "negocio" | "free"): void {
  bootDev();
  if (plan === "free") {
    activePlanMemory = null;
    try {
      localStorage.removeItem(ACTIVE_PLAN_KEY);
    } catch {
      /* private mode */
    }
  } else {
    activePlanMemory = parseStoredPlan(plan);
    try {
      localStorage.setItem(ACTIVE_PLAN_KEY, plan);
    } catch {
      /* private mode */
    }
  }
  emitDev();
}

export function normalizePlan(plan?: string | null): Plan {
  if (plan === "pro") return "pro";
  if (plan === "equipe" || plan === "negocio") return "equipe";
  return "free";
}

export function effectivePlan(settings?: Pick<Settings, "plan"> | null): Plan {
  return getDevPlanOverride() ?? getStoredActivePlan() ?? normalizePlan(settings?.plan);
}

/** Pro e Negócio liberam os recursos pagos. Ajudantes herdam o plano Negócio. */
export function isPro(
  settings?: Pick<Settings, "plan" | "deviceRole" | "pairedOwnerId"> | null,
): boolean {
  if (isStaffDevice(settings)) return true;
  const plan = effectivePlan(settings);
  return plan === "pro" || plan === "equipe";
}

export function isEquipe(
  settings?: Pick<Settings, "plan" | "deviceRole" | "pairedOwnerId"> | null,
): boolean {
  if (isStaffDevice(settings)) return true;
  return effectivePlan(settings) === "equipe";
}

export function isNegocio(
  settings?: Pick<Settings, "plan" | "deviceRole" | "pairedOwnerId"> | null,
): boolean {
  return isEquipe(settings);
}

export function planLabel(plan?: Plan | string | null): string {
  const p = normalizePlan(plan);
  if (p === "equipe") return "NEGÓCIO";
  if (p === "pro") return "PRO";
  return "GRÁTIS";
}

export function planBadge(settings?: Pick<Settings, "plan"> | null): string | null {
  const plan = effectivePlan(settings);
  if (plan === "equipe") return "NEGÓCIO";
  if (plan === "pro") return "PRO";
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
  if (getDevSimulateLimit()) return false;
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

export function simulateFreePlanLimit(): void {
  setDevSimulateLimit(true);
  openUpgradeModal();
}

export function subscribeUpgradeModal(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function openStripeCheckout(): void {
  window.open(STRIPE_PRO_URL, "_blank", "noopener,noreferrer");
}
