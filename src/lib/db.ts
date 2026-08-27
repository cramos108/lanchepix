import "fake-indexeddb/auto";
import Dexie, { type Table } from "dexie";
import type { Customer, Product, Sale, Settings } from "./types";
import { newId, nowIso } from "./id";

export class LanchePixDB extends Dexie {
  products!: Table<Product, string>;
  sales!: Table<Sale, string>;
  customers!: Table<Customer, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super("lanchepix");
    this.version(1).stores({
      products: "id, category, updatedAt, dirty, deleted, active",
      sales: "id, status, createdAt, customerPhone, dirty, productId",
      customers: "id, phone, dirty",
      settings: "id, vendorId",
    });
  }
}

export const db = new LanchePixDB();

export async function ensureSettings(): Promise<Settings> {
  const existing = await db.settings.get("app");
  if (existing) {
    if (existing.plan) return existing;
    const patched = { ...existing, plan: "free" as const };
    await db.settings.put(patched);
    return patched;
  }
  const created: Settings = {
    id: "app",
    vendorId: newId(),
    storeName: "Meu Lanche",
    pixKey: "",
    merchantName: "MEU LANCHE",
    merchantCity: "SAO PAULO",
    whatsapp: "",
    rewardLabel: "1 lanche grátis",
    stampsRequired: 10,
    plan: "free",
    updatedAt: nowIso(),
    dirty: true,
  };
  await db.settings.put(created);
  return created;
}
