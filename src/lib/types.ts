export { CATEGORIES } from "./catalog";

export type Category = string;

export type SaleStatus =
  | "pending"
  | "paid"
  | "cancelled"
  | "perda"
  | "pago"
  | "a_receber"
  | "cancelado";

/** Canonical: pending (a_receber), paid (pago), cancelled (cancelado), perda. */
export function normalizeSaleStatus(status?: string | null): SaleStatus {
  const s = String(status ?? "").toLowerCase().trim();
  if (s === "paid" || s === "pago") return "paid";
  if (s === "cancelled" || s === "canceled" || s === "cancelado") return "cancelled";
  if (s === "perda" || s === "baixado") return "perda";
  return "pending";
}

export function isReceivableStatus(status?: string | null): boolean {
  return normalizeSaleStatus(status) === "pending";
}

export function isPaidStatus(status?: string | null): boolean {
  return normalizeSaleStatus(status) === "paid";
}

export function isCancelledStatus(status?: string | null): boolean {
  return normalizeSaleStatus(status) === "cancelled";
}

export function isLossStatus(status?: string | null): boolean {
  return normalizeSaleStatus(status) === "perda";
}
export type PriceMode = "fixed" | "suggested";

export type Product = {
  id: string;
  name: string;
  priceCents: number;
  priceMode?: PriceMode;
  imageData?: string;
  image_data?: string | null;
  category: Category | string;
  stock: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
  dirty?: boolean;
};

export type Sale = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  extraCents?: number;
  priceMode?: PriceMode;
  status: SaleStatus;
  customerPhone?: string;
  customerName?: string;
  attendantName?: string;
  notes?: string;
  paymentMethod?: PayMethod;
  createdAt: string;
  paidAt?: string;
  updatedAt: string;
  dirty?: boolean;
};

export type Customer = {
  id: string;
  phone: string;
  name: string;
  stamps: number;
  totalStamps: number;
  rewardsClaimed: number;
  createdAt: string;
  updatedAt: string;
  dirty?: boolean;
};

export type Plan = "free" | "pro" | "equipe";
export type AppCurrency = "BRL" | "USD" | "EUR";
export type AppLanguage = "pt" | "en" | "es";
export type PayMethod = "pix" | "cash" | "link";

export type BusinessType =
  | "alimentacao"
  | "celular"
  | "vestuario"
  | "consultora"
  | "lar"
  | "outros"
  | "ambulante"
  | "loja";

export const BUSINESS_TYPES: Array<{ id: BusinessType; label: string }> = [
  { id: "alimentacao", label: "Alimentação" },
  { id: "celular", label: "Acessórios para Celular" },
  { id: "vestuario", label: "Vestuário" },
  { id: "consultora", label: "Consultora / Revendedora" },
  { id: "lar", label: "Utilidades e Lar" },
  { id: "outros", label: "Outros / Geral" },
];

const KNOWN_BUSINESS_TYPES = new Set<string>(BUSINESS_TYPES.map((t) => t.id));

export function isKnownBusinessType(value?: string | null): value is BusinessType {
  return Boolean(value && KNOWN_BUSINESS_TYPES.has(value));
}

/** Picker id. Custom labels (e.g. "Pet Shop") map to Outros / Geral. */
export function normalizeBusinessType(value?: string | null): BusinessType {
  if (value === "celular") return "celular";
  if (value === "vestuario") return "vestuario";
  if (value === "consultora") return "consultora";
  if (value === "lar") return "lar";
  if (value === "outros") return "outros";
  if (value === "loja") return "vestuario";
  if (value === "alimentacao" || value === "ambulante") return "alimentacao";
  if (value && value.trim()) return "outros";
  return "alimentacao";
}

/** Value stored in settings.businessType / Supabase business_type. */
export function persistBusinessType(
  picker: BusinessType,
  customLabel?: string,
): string {
  if (picker !== "outros") return picker;
  const custom = customLabel?.trim() || "";
  return custom || "outros";
}

export function customBusinessTypeLabel(value?: string | null): string {
  const raw = (value ?? "").trim();
  if (!raw || isKnownBusinessType(raw)) return "";
  return raw;
}

export type Settings = {
  id: "app";
  vendorId: string;
  storeName: string;
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  whatsapp: string;
  currency?: AppCurrency;
  language?: AppLanguage;
  paymentLink?: string;
  rewardLabel: string;
  stampsRequired: number;
  plan: Plan;
  businessType?: BusinessType | string;
  attendantName?: string;
  pairedOwnerId?: string;
  deviceRole?: "dono" | "gerente" | "ajudante" | "owner" | "attendant";
  /** When true, helpers cannot see store-wide totals (default). */
  hideStoreTotals?: boolean;
  /** When true, Ajudante can change prices in catalog/cart (default false). */
  allowHelperEditPrices?: boolean;
  resetDayAt?: string;
  resetWeekAt?: string;
  resetMonthAt?: string;
  resetYearAt?: string;
  updatedAt: string;
  dirty?: boolean;
};
