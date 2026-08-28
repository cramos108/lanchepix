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

export type Plan = "free" | "pro";

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
  resetDayAt?: string;
  resetWeekAt?: string;
  resetMonthAt?: string;
  resetYearAt?: string;
  updatedAt: string;
  dirty?: boolean;
};
