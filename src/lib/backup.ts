import { db, ensureSettings } from "./db";
import { nowIso } from "./id";
import type { Product, Sale, Settings } from "./types";

export const BACKUP_VERSION = 1;
export const BACKUP_APP = "pixdaconfianca";

export type AppBackup = {
  version: number;
  app: string;
  exportedAt: string;
  settings: Settings;
  products: Product[];
  sales: Sale[];
};

export async function buildBackup(): Promise<AppBackup> {
  const settings = await ensureSettings();
  const [products, sales] = await Promise.all([
    db.products.toArray(),
    db.sales.toArray(),
  ]);
  return {
    version: BACKUP_VERSION,
    app: BACKUP_APP,
    exportedAt: nowIso(),
    settings,
    products,
    sales,
  };
}

export async function downloadBackup(): Promise<void> {
  const data = await buildBackup();
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const stamp = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pix-da-confianca-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseBackup(raw: unknown): AppBackup {
  if (!raw || typeof raw !== "object") {
    throw new Error("Arquivo de backup inválido.");
  }
  const obj = raw as Record<string, unknown>;
  if (!obj.settings || typeof obj.settings !== "object") {
    throw new Error("Backup sem configurações locais.");
  }
  if (!Array.isArray(obj.products)) {
    throw new Error("Backup sem catálogo de produtos.");
  }
  if (!Array.isArray(obj.sales)) {
    throw new Error("Backup sem histórico de vendas.");
  }
  return {
    version: typeof obj.version === "number" ? obj.version : BACKUP_VERSION,
    app: typeof obj.app === "string" ? obj.app : BACKUP_APP,
    exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : nowIso(),
    settings: obj.settings as Settings,
    products: obj.products as Product[],
    sales: obj.sales as Sale[],
  };
}

/** Local Dexie restore only. Does not touch Supabase sync listeners. */
export async function restoreBackup(backup: AppBackup): Promise<void> {
  const nextSettings: Settings = {
    ...backup.settings,
    id: "app",
  };
  await db.transaction("rw", db.settings, db.products, db.sales, async () => {
    await db.products.clear();
    await db.sales.clear();
    await db.settings.put(nextSettings);
    if (backup.products.length) await db.products.bulkPut(backup.products);
    if (backup.sales.length) await db.sales.bulkPut(backup.sales);
  });
}

export async function restoreBackupFromFile(file: File): Promise<AppBackup> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error("O arquivo não é um JSON válido.");
  }
  const backup = parseBackup(parsed);
  await restoreBackup(backup);
  return backup;
}
