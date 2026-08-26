import type { Product } from "./types";
import { db } from "./db";
import { newId, nowIso } from "./id";

const DEMO: Array<Pick<Product, "name" | "priceCents" | "category" | "stock">> = [
  { name: "Coxinha", priceCents: 800, category: "Salgados", stock: 20 },
  { name: "Pão de queijo", priceCents: 500, category: "Salgados", stock: 30 },
  { name: "Pastel de carne", priceCents: 1000, category: "Salgados", stock: 15 },
  { name: "Pastel de queijo", priceCents: 900, category: "Salgados", stock: 15 },
  { name: "Kibe", priceCents: 800, category: "Salgados", stock: 12 },
  { name: "Enroladinho", priceCents: 700, category: "Salgados", stock: 18 },
  { name: "Empada", priceCents: 800, category: "Salgados", stock: 12 },
  { name: "Esfirra", priceCents: 700, category: "Salgados", stock: 16 },
  { name: "Brigadeiro", priceCents: 400, category: "Doces", stock: 24 },
  { name: "Beijinho", priceCents: 400, category: "Doces", stock: 24 },
  { name: "Bolo no pote", priceCents: 1200, category: "Doces", stock: 8 },
  { name: "Refrigerante lata", priceCents: 600, category: "Bebidas", stock: 20 },
  { name: "Água mineral", priceCents: 300, category: "Bebidas", stock: 24 },
  { name: "Café", priceCents: 400, category: "Bebidas", stock: 25 },
  { name: "Suco natural", priceCents: 800, category: "Bebidas", stock: 10 },
  { name: "Combo salgado + refri", priceCents: 1300, category: "Combos", stock: 10 },
];

export async function seedDemoProducts(): Promise<number> {
  const now = nowIso();
  const rows: Product[] = DEMO.map((item) => ({
    id: newId(),
    name: item.name,
    priceCents: item.priceCents,
    category: item.category,
    stock: item.stock,
    active: true,
    createdAt: now,
    updatedAt: now,
    dirty: true,
  }));
  await db.products.bulkAdd(rows);
  return rows.length;
}
