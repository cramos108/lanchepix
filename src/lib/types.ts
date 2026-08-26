export const CATEGORIES = [
  "Salgados",
  "Doces",
  "Bebidas",
  "Combos",
  "Outros",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type SaleStatus = "pending" | "paid" | "cancelled";

export type Product = {
  id: string;
  name: string;
  priceCents: number;
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
  updatedAt: string;
  dirty?: boolean;
};
