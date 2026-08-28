import { NICHES, type CatalogTemplate } from "./catalog";
import type { Product } from "./types";
import { db } from "./db";
import { newId, nowIso } from "./id";

export async function seedTemplates(templates: CatalogTemplate[]): Promise<number> {
  const now = nowIso();
  const rows: Product[] = templates.map((item) => ({
    id: newId(),
    name: item.name,
    priceCents: item.priceCents,
    priceMode: "fixed",
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

export async function seedDemoProducts(): Promise<number> {
  return seedTemplates(NICHES[0].templates);
}

export async function seedNiche(nicheId: string): Promise<number> {
  const niche = NICHES.find((n) => n.id === nicheId);
  if (!niche) return 0;
  return seedTemplates(niche.templates);
}
