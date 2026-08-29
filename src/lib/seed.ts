import { NICHES, type CatalogTemplate } from "./catalog";
import { normalizeBusinessType } from "./types";
import type { Product } from "./types";
import { db } from "./db";
import { newId, nowIso } from "./id";

export function nicheIdForBusinessType(businessType?: string | null): string {
  const type = normalizeBusinessType(businessType);
  if (type === "consultora") return "cosmeticos";
  return type;
}

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
  try {
    const { pushProductsImmediate } = await import("./sync");
    await pushProductsImmediate(rows);
  } catch (err) {
    const message =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message ?? "").trim()
        : err instanceof Error
          ? err.message
          : String(err);
    console.error("products bulk insert", err);
    throw new Error(message || "Não deu pra gravar os exemplos.");
  }
  return rows.length;
}

export async function seedDemoProducts(businessType?: string | null): Promise<number> {
  return seedNiche(nicheIdForBusinessType(businessType));
}

export async function seedNiche(nicheId: string): Promise<number> {
  const niche = NICHES.find((n) => n.id === nicheId);
  if (!niche) return 0;
  return seedTemplates(niche.templates);
}
