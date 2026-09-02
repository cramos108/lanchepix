import "fake-indexeddb/auto";
import Dexie, { type Table } from "dexie";
import type { Customer, Product, Sale, Settings } from "./types";
import { newId, nowIso } from "./id";
import { detectBrowserLang } from "./locale";

export class AppDB extends Dexie {
  products!: Table<Product, string>;
  sales!: Table<Sale, string>;
  customers!: Table<Customer, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super("lanchepix"); // IndexedDB key — do not rename (wipes local data)
    this.version(1).stores({
      products: "id, category, updatedAt, dirty, deleted, active",
      sales: "id, status, createdAt, customerPhone, dirty, productId",
      customers: "id, phone, dirty",
      settings: "id, vendorId",
    });
  }
}

export const db = new AppDB();

export async function ensureSettings(): Promise<Settings> {
  const existing = await db.settings.get("app");
  if (existing) {
    const patched = {
      ...existing,
      plan: existing.plan || ("free" as const),
      currency: existing.currency || ("BRL" as const),
      language: existing.language || detectBrowserLang(),
      paymentLink: existing.paymentLink || "",
    };
    if (
      patched.plan !== existing.plan ||
      patched.currency !== existing.currency ||
      patched.language !== existing.language ||
      patched.paymentLink !== existing.paymentLink
    ) {
      await db.settings.put(patched);
    }
    return patched;
  }
  const created: Settings = {
    id: "app",
    vendorId: newId(),
    storeName: "Meu negócio",
    pixKey: "",
    merchantName: "MEU NEGOCIO",
    merchantCity: "SAO PAULO",
    whatsapp: "",
    currency: "BRL",
    language: detectBrowserLang(),
    paymentLink: "",
    rewardLabel: "1 brinde grátis",
    stampsRequired: 10,
    plan: "free",
    businessType: "alimentacao",
    updatedAt: nowIso(),
    dirty: true,
  };
  await db.settings.put(created);
  return created;
}
