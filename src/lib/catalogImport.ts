import { CATEGORIES } from "./catalog";
import { db } from "./db";
import { newId, nowIso } from "./id";
import { parseMoneyToCents } from "./money";
import type { Product } from "./types";

const CUSTOM_CATS_KEY = "lanchepix_custom_categories";
export const DEFAULT_IMPORT_CATEGORY = "Geral";
export const NEW_CATEGORY_VALUE = "__nova__";

export type CatalogImportRow = {
  name: string;
  priceLabel: string;
  category: string;
  priceCents: number;
};

export const SAMPLE_CATALOG_CSV =
  "Nome do Produto,Preco,Categoria\n" +
  "Óculos de Sol,25.00,Acessórios\n" +
  "Capinha de Celular,35.00,Capinhas\n";

export function loadCustomCategories(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_CATS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((c): c is string => typeof c === "string")
      .map((c) => c.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function saveCustomCategories(cats: string[]): void {
  try {
    localStorage.setItem(CUSTOM_CATS_KEY, JSON.stringify(cats));
  } catch {
    /* private mode */
  }
}

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function knownCategories(extra: string[]): string[] {
  return [...CATEGORIES, DEFAULT_IMPORT_CATEGORY, ...loadCustomCategories(), ...extra];
}

/** Register a category on this device if it is new. Blank -> Geral. */
export function rememberCategory(raw: string, existing: string[]): string {
  const category = raw.trim() || DEFAULT_IMPORT_CATEGORY;
  const known = knownCategories(existing);
  const hit = known.find(
    (c) => c.toLocaleLowerCase("pt-BR") === category.toLocaleLowerCase("pt-BR"),
  );
  if (hit) return hit;
  const next = [...loadCustomCategories(), category];
  saveCustomCategories(next);
  existing.push(category);
  return category;
}

export function downloadSampleCatalogCsv(): void {
  const blob = new Blob([SAMPLE_CATALOG_CSV], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "catalogo-exemplo.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/\d/g, "")) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return Math.max(0, n - 1);
}

function parseCsvText(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const first = src.split("\n")[0] ?? "";
  const comma = (first.match(/,/g) ?? []).length;
  const semi = (first.match(/;/g) ?? []).length;
  const tab = (first.match(/\t/g) ?? []).length;
  const delim = tab > comma && tab > semi ? "\t" : semi > comma ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === delim) {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell.trim());
      cell = "";
      if (row.some((c) => c)) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  row.push(cell.trim());
  if (row.some((c) => c)) rows.push(row);
  return rows;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Este aparelho não lê XLSX. Salve a planilha como CSV.");
  }
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  const stream = new Blob([copy]).stream().pipeThrough(
    new DecompressionStream("deflate-raw"),
  );
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

async function unzipXml(buf: ArrayBuffer): Promise<Record<string, string>> {
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);
  const decoder = new TextDecoder("utf-8");
  let eocd = -1;
  const min = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= min; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Arquivo XLSX inválido.");
  const count = view.getUint16(eocd + 10, true);
  let cd = view.getUint32(eocd + 16, true);
  const files: Record<string, string> = {};
  for (let n = 0; n < count; n++) {
    if (view.getUint32(cd, true) !== 0x02014b50) break;
    const method = view.getUint16(cd + 10, true);
    const compSize = view.getUint32(cd + 20, true);
    const nameLen = view.getUint16(cd + 28, true);
    const extraLen = view.getUint16(cd + 30, true);
    const commentLen = view.getUint16(cd + 32, true);
    const localOff = view.getUint32(cd + 42, true);
    const name = decoder.decode(bytes.subarray(cd + 46, cd + 46 + nameLen));
    const localNameLen = view.getUint16(localOff + 26, true);
    const localExtra = view.getUint16(localOff + 28, true);
    const dataStart = localOff + 30 + localNameLen + localExtra;
    const compressed = bytes.subarray(dataStart, dataStart + compSize);
    let data: Uint8Array;
    if (method === 0) data = compressed;
    else if (method === 8) data = await inflateRaw(compressed);
    else throw new Error("XLSX compactado de um jeito que este app não lê. Use CSV.");
    files[name.replace(/\\/g, "/")] = decoder.decode(data);
    cd += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  const blocks = xml.match(/<si[\s\S]*?<\/si>/g) ?? [];
  for (const si of blocks) {
    const parts = [...si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) =>
      decodeXml(m[1] ?? ""),
    );
    out.push(parts.join(""));
  }
  return out;
}

function parseSheetRows(xml: string, strings: string[]): string[][] {
  const rows: string[][] = [];
  const rowTags = xml.match(/<row[^>]*>[\s\S]*?<\/row>/g) ?? [];
  for (const rowXml of rowTags) {
    const line: string[] = [];
    const cells = [...rowXml.matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)];
    for (const [, attrs, body] of cells) {
      const ref = /r="([A-Z]+)\d+"/i.exec(attrs ?? "")?.[1] ?? "A";
      const col = colIndex(ref.toUpperCase());
      const t = /(?:^|\s)t="([^"]+)"/.exec(attrs ?? "")?.[1];
      let value = "";
      if (t === "s") {
        const idx = Number(/<v>(.*?)<\/v>/.exec(body ?? "")?.[1] ?? "");
        value = strings[idx] ?? "";
      } else if (t === "inlineStr") {
        value = [...(body ?? "").matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
          .map((m) => decodeXml(m[1] ?? ""))
          .join("");
      } else {
        value = /<v>(.*?)<\/v>/.exec(body ?? "")?.[1] ?? "";
      }
      line[col] = value.trim();
    }
    if (line.some((c) => c)) rows.push(line.map((c) => c ?? ""));
  }
  return rows;
}

function headerIndex(headers: string[], kind: "name" | "price" | "category"): number {
  const folded = headers.map(fold);
  const match = (pred: (h: string) => boolean) => folded.findIndex(pred);
  if (kind === "name") {
    const i = match((h) => h.includes("nome") || h === "produto" || h === "name");
    return i >= 0 ? i : 0;
  }
  if (kind === "price") {
    const i = match(
      (h) =>
        h.includes("preco") ||
        h.includes("price") ||
        h === "valor" ||
        h.includes("r$"),
    );
    return i >= 0 ? i : 1;
  }
  const i = match(
    (h) =>
      h.includes("categoria") || h.includes("category") || h.includes("nicho"),
  );
  return i >= 0 ? i : 2;
}

function looksLikeHeader(row: string[]): boolean {
  const joined = fold(row.join(" "));
  return (
    joined.includes("nome") ||
    joined.includes("preco") ||
    joined.includes("produto") ||
    joined.includes("categoria")
  );
}

function rowsToImport(table: string[][]): CatalogImportRow[] {
  if (!table.length) return [];
  const header = looksLikeHeader(table[0]) ? table[0] : [];
  const body = header.length ? table.slice(1) : table;
  const nameIdx = header.length ? headerIndex(header, "name") : 0;
  const priceIdx = header.length ? headerIndex(header, "price") : 1;
  const catIdx = header.length ? headerIndex(header, "category") : 2;
  const out: CatalogImportRow[] = [];
  for (const row of body) {
    const name = (row[nameIdx] ?? "").trim();
    const priceLabel = String(row[priceIdx] ?? "").trim();
    const category = (row[catIdx] ?? "").trim();
    if (!name && !priceLabel) continue;
    out.push({
      name,
      priceLabel,
      category,
      priceCents: parseMoneyToCents(priceLabel),
    });
  }
  return out;
}

export async function parseCatalogFile(file: File): Promise<CatalogImportRow[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xlsm")) {
    const buf = await file.arrayBuffer();
    const files = await unzipXml(buf);
    const strings = parseSharedStrings(files["xl/sharedStrings.xml"] ?? "");
    const sheetName =
      Object.keys(files).find((k) => k.startsWith("xl/worksheets/sheet")) ?? "";
    if (!sheetName) throw new Error("Planilha sem aba de produtos.");
    return rowsToImport(parseSheetRows(files[sheetName], strings));
  }
  const text = await file.text();
  return rowsToImport(parseCsvText(text));
}

/** Append-only. Never overwrites existing catalog rows. */
export async function importCatalogProducts(
  rows: CatalogImportRow[],
): Promise<{ added: number; skipped: number; categories: string[] }> {
  const existing = await db.products.toArray();
  const existingCats = existing.map((p) => p.category).filter(Boolean);
  const now = nowIso();
  const products: Product[] = [];
  const newCategories: string[] = [];
  let skipped = 0;
  for (const row of rows) {
    const name = row.name.trim();
    if (!name || row.priceCents <= 0) {
      skipped += 1;
      continue;
    }
    const before = existingCats.length;
    const category = rememberCategory(row.category, existingCats);
    if (existingCats.length > before) newCategories.push(category);
    products.push({
      id: newId(),
      name,
      priceCents: row.priceCents,
      priceMode: "fixed",
      category,
      stock: 10,
      active: true,
      createdAt: now,
      updatedAt: now,
      dirty: true,
    });
  }
  if (products.length) {
    await db.products.bulkAdd(products);
    void import("./persist").then((m) => m.backupCatalog());
    try {
      const sync = await import("./sync");
      if (typeof navigator === "undefined" || navigator.onLine) {
        await sync.pushProductsImmediate(products);
      }
      sync.scheduleSync();
    } catch {
      try {
        const { scheduleSync } = await import("./sync");
        scheduleSync();
      } catch {
        /* offline */
      }
    }
  }
  return { added: products.length, skipped, categories: newCategories };
}
