export { CATEGORIES } from "./catalog";

export type Category = string;

export type SaleStatus = "pending" | "paid" | "cancelled";
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
  { id: "outros", label: "Outros" },
];

/** Maps legacy Tipo de Negócio values to the current picker ids. */
export function normalizeBusinessType(value?: string | null): BusinessType {
  if (value === "celular") return "celular";
  if (value === "vestuario") return "vestuario";
  if (value === "consultora") return "consultora";
  if (value === "lar") return "lar";
  if (value === "outros") return "outros";
  if (value === "loja") return "vestuario";
  if (value === "alimentacao" || value === "ambulante") return "alimentacao";
  return "alimentacao";
}

export type Settings = {
  id: "app";
  vendorId: string;
  storeName: string;
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  whatsapp: string;
  rewardLabel: string;
  stampsRequired: number;
  plan: Plan;
  businessType?: BusinessType;
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
