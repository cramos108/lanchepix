import {
  getActiveOwnerId,
  getAttendantNameLocal,
  isOwnerDevice,
  LINKED_OWNER_KEY,
  staffRole,
} from "./account";
import { db, ensureSettings } from "./db";
import { backupCatalog, clearCatalogBackup, isOfflineError } from "./persist";
import { supabase, supabaseConfigured } from "./supabase";
import { normalizeCurrency, normalizeLang } from "./locale";
import { setPrefs } from "./prefs";
import { normalizeBusinessType, type Customer, type Product, type Sale, type Settings } from "./types";

let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;
let productFetchLock: Promise<number> | null = null;
let liveRealtime: { ownerId: string; stop: () => void } | null = null;
let lastError: string | null = null;
let lastSyncAt: string | null = null;

const listeners = new Set<() => void>();

export function getSyncState() {
  return { running, lastError, lastSyncAt };
}

export function subscribeSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  listeners.forEach((l) => l());
}

export function scheduleSync(): void {
  if (typeof window === "undefined") return;
  if (!navigator.onLine || !supabaseConfigured) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    void pushAndPull();
  }, 500);
}

function isNewer(a?: string, b?: string): boolean {
  if (!a) return false;
  if (!b) return true;
  return new Date(a).getTime() > new Date(b).getTime();
}

/**
 * products, sales, and customers are owned by owner_id (account id).
 * settings still uses vendor_id as its primary key.
 * pairing_codes also uses owner_id.
 */
export const OWNERSHIP_COLUMN = "owner_id" as const;

type RemoteProduct = {
  id: string;
  owner_id: string;
  vendor_id: string;
  name: string;
  price_cents: number;
  price_mode: string | null;
  image_data?: string | null;
  category: string;
  stock: number;
  active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type RemoteSale = {
  id: string;
  owner_id: string;
  vendor_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
  price_mode?: string | null;
  status: Sale["status"];
  customer_phone: string | null;
  customer_name: string | null;
  attendant_name?: string | null;
  notes: string | null;
  created_at: string;
  paid_at: string | null;
  updated_at: string;
};

type RemoteCustomer = {
  id: string;
  owner_id: string;
  vendor_id: string;
  phone: string;
  name: string;
  stamps: number;
  total_stamps: number;
  rewards_claimed: number;
  created_at: string;
  updated_at: string;
};

type RemoteSettings = {
  vendor_id: string;
  store_name: string;
  pix_key: string;
  merchant_name: string;
  merchant_city: string;
  whatsapp: string;
  reward_label: string;
  stamps_required: number;
  plan: Settings["plan"] | null;
  business_type: string | null;
  allow_helper_edit_prices?: boolean | null;
  currency?: string | null;
  language?: string | null;
  payment_link?: string | null;
  updated_at: string;
};

function isSchemaCacheError(error: { message?: string } | null | undefined): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  return msg.includes("schema cache") || msg.includes("could not find");
}

function productCorePayload(product: Product, ownerId: string): Record<string, unknown> {
  return {
    name: product.name,
    price_cents: product.priceCents,
    category: product.category,
    stock: product.stock,
    active: true,
    owner_id: ownerId,
    vendor_id: ownerId,
  };
}

function productInsertPayload(product: Product, ownerId: string): Record<string, unknown> {
  const row = productCorePayload(product, ownerId);
  if (product.priceMode === "fixed" || product.priceMode === "suggested") {
    row.price_mode = product.priceMode;
  }
  const image = product.image_data || product.imageData;
  if (image) row.image_data = image;
  delete row.id;
  return row;
}

function toRemoteProduct(ownerId: string, p: Product): RemoteProduct {
  return {
    id: p.id,
    ...productInsertPayload(p, ownerId),
  } as unknown as RemoteProduct;
}

async function adoptRemoteProductId(localId: string, remoteId: string): Promise<void> {
  if (!remoteId || remoteId === localId) {
    const row = await db.products.get(localId);
    if (row) await db.products.put({ ...row, dirty: false });
    return;
  }
  const local = await db.products.get(localId);
  if (!local) return;
  await db.transaction("rw", db.products, db.sales, async () => {
    await db.products.delete(localId);
    await db.products.put({ ...local, id: remoteId, dirty: false });
    const linked = await db.sales.where("productId").equals(localId).toArray();
    for (const sale of linked) {
      await db.sales.put({ ...sale, productId: remoteId });
    }
  });
}

function fromRemoteProduct(r: RemoteProduct): Product {
  return {
    id: r.id,
    name: r.name,
    priceCents: r.price_cents,
    priceMode: r.price_mode === "suggested" ? "suggested" : "fixed",
    imageData: r.image_data ?? undefined,
    category: r.category,
    stock: r.stock,
    active: true,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deleted: Boolean(r.deleted_at),
    dirty: false,
  };
}

function saleHelperNote(s: Sale): string | null {
  const helper = (getAttendantNameLocal() || s.attendantName || "").trim();
  const bits = [
    s.notes?.trim().replace(/^(Vendido por|Ajudante):\s*.+$/i, "").trim(),
    helper ? `Vendido por: ${helper}` : "",
  ].filter(Boolean);
  return bits.length ? bits.join(" · ") : null;
}

export function sellerNameFromSale(sale: {
  attendantName?: string;
  notes?: string;
}): string {
  const named = sale.attendantName?.trim();
  if (named) return named;
  const fromNotes = sale.notes?.match(/(?:Vendido por|Ajudante):\s*(.+?)(?:\s·|$)/i);
  return fromNotes?.[1]?.trim() || "";
}

function toRemoteSale(ownerId: string, s: Sale): RemoteSale {
  return {
    id: s.id,
    owner_id: ownerId,
    vendor_id: ownerId,
    product_id: s.productId || null,
    product_name: s.productName,
    quantity: s.quantity,
    unit_price_cents: s.unitPriceCents,
    total_cents: s.totalCents,
    status: s.status,
    customer_phone: s.customerPhone ?? null,
    customer_name: s.customerName ?? null,
    notes: saleHelperNote(s),
    created_at: s.createdAt,
    paid_at: s.paidAt ?? null,
    updated_at: s.updatedAt,
  };
}

function fromRemoteSale(r: RemoteSale): Sale {
  return {
    id: r.id,
    productId: r.product_id ?? "",
    productName: r.product_name,
    quantity: r.quantity,
    unitPriceCents: r.unit_price_cents,
    totalCents: r.total_cents,
    extraCents: 0,
    priceMode: r.price_mode === "suggested" ? "suggested" : "fixed",
    status: r.status,
    customerPhone: r.customer_phone ?? undefined,
    customerName: r.customer_name ?? undefined,
    attendantName:
      r.attendant_name ??
      (r.notes?.match(/(?:Vendido por|Ajudante):\s*(.+?)(?:\s·|$)/i)?.[1]?.trim() ||
        undefined),
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
    paidAt: r.paid_at ?? undefined,
    updatedAt: r.updated_at,
    dirty: false,
  };
}

function toRemoteCustomer(ownerId: string, c: Customer): RemoteCustomer {
  return {
    id: c.id,
    owner_id: ownerId,
    vendor_id: ownerId,
    phone: c.phone,
    name: c.name,
    stamps: c.stamps,
    total_stamps: c.totalStamps,
    rewards_claimed: c.rewardsClaimed,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

function fromRemoteCustomer(r: RemoteCustomer): Customer {
  return {
    id: r.id,
    phone: r.phone,
    name: r.name,
    stamps: r.stamps,
    totalStamps: r.total_stamps,
    rewardsClaimed: r.rewards_claimed,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    dirty: false,
  };
}

function toRemoteSettings(s: Settings): Record<string, unknown> {
  return {
    vendor_id: s.vendorId,
    store_name: s.storeName,
    pix_key: s.pixKey,
    merchant_name: s.merchantName,
    merchant_city: s.merchantCity,
    whatsapp: s.whatsapp,
    reward_label: s.rewardLabel,
    stamps_required: s.stampsRequired,
    plan: s.plan ?? "free",
    business_type: normalizeBusinessType(s.businessType),
    allow_helper_edit_prices: s.allowHelperEditPrices === true,
    currency: s.currency || "BRL",
    language: s.language || "pt",
    payment_link: s.paymentLink || "",
    updated_at: s.updatedAt,
  };
}

function billingFromRemote(remote: RemoteSettings, local: Settings): Partial<Settings> {
  return {
    storeName: remote.store_name || local.storeName,
    pixKey: String(remote.pix_key ?? "").trim() || local.pixKey || "",
    merchantName: remote.merchant_name || local.merchantName,
    merchantCity: remote.merchant_city || local.merchantCity,
    whatsapp: String(remote.whatsapp ?? "").trim() || local.whatsapp || "",
    rewardLabel: remote.reward_label || local.rewardLabel,
    stampsRequired: remote.stamps_required || local.stampsRequired,
    currency: normalizeCurrency(remote.currency || local.currency),
    language: normalizeLang(remote.language || local.language),
    paymentLink: String(remote.payment_link ?? "").trim() || local.paymentLink || "",
    allowHelperEditPrices: remote.allow_helper_edit_prices === true,
  };
}

function rememberPrefs(row: Settings) {
  setPrefs({ currency: row.currency, language: row.language });
}

async function upsertOwned(table: string, rows: object[]) {
  return supabase.from(table).upsert(rows);
}

function remoteErrorMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "object" && error !== null && "message" in error) {
    const msg = String((error as { message: unknown }).message ?? "").trim();
    if (msg) return msg;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

async function fetchProductsByOwnerId(currentUserId?: string | null) {
  let linked: string | null = null;
  try {
    linked = localStorage.getItem(LINKED_OWNER_KEY);
  } catch {
    linked = null;
  }
  const settings = await ensureSettings();
  const activeOwnerId = isOwnerDevice(settings)
    ? settings.vendorId || currentUserId || ""
    : linked || currentUserId || "";
  console.log("Fetching products with owner_id:", activeOwnerId);
  const { data, error } = await supabase.from("products").select("*").eq("owner_id", activeOwnerId);
  return { data, error, activeOwnerId };
}

async function applyFetchedProducts(rows: RemoteProduct[]): Promise<void> {
  const byId = new Map<string, RemoteProduct>();
  for (const row of rows) {
    if (!row?.id || row.deleted_at) continue;
    byId.set(row.id, row);
  }
  const unique = Array.from(new Map([...byId.values()].map((item) => [item.id, item])).values()).map(
    fromRemoteProduct,
  );
  await db.transaction("rw", db.products, async () => {
    await db.products.clear();
    if (unique.length) await db.products.bulkPut(unique);
  });
  clearCatalogBackup();
  await backupCatalog();
}

export async function pushAndPull(): Promise<void> {
  if (running || !supabaseConfigured) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  running = true;
  lastError = null;
  emit();
  try {
    const settings = await ensureSettings();
    const vendorId = getActiveOwnerId(settings);
    const activeOwnerId = vendorId;
    const staff = !isOwnerDevice(settings);
    const role = staffRole(settings);

    const dirtyProducts = await db.products.filter((p) => Boolean(p.dirty)).toArray();
    if (dirtyProducts.length && role !== "ajudante") {
      const currentUserId = settings.vendorId;
      if (!currentUserId) {
        console.error("PRODUCT INSERT BLOCKED: currentUser.id is missing. owner_id was not set.");
      }
      const { error } = await upsertOwned(
        "products",
        dirtyProducts.map((p) => toRemoteProduct(currentUserId || activeOwnerId, p)),
      );
      if (error) throw error;
      await db.transaction("rw", db.products, async () => {
        for (const p of dirtyProducts) {
          const current = await db.products.get(p.id);
          if (current && current.updatedAt === p.updatedAt) {
            await db.products.put({ ...current, dirty: false });
          }
        }
      });
    }

    const dirtySales = await db.sales.filter((s) => Boolean(s.dirty)).toArray();
    if (dirtySales.length) {
      const saleOwnerId = isOwnerDevice(settings)
        ? settings.vendorId
        : chefeOwnerIdForSales(settings);
      if (!saleOwnerId) throw new Error("owner_id (ID do Chefe) ausente.");
      const { error } = await upsertOwned(
        "sales",
        dirtySales.map((s) => ({
          ...toRemoteSale(saleOwnerId, s),
          owner_id: saleOwnerId,
        })),
      );
      if (error) throw error;
      await db.transaction("rw", db.sales, async () => {
        for (const s of dirtySales) {
          const current = await db.sales.get(s.id);
          if (current && current.updatedAt === s.updatedAt) {
            await db.sales.put({ ...current, dirty: false });
          }
        }
      });
    }

    const dirtyCustomers = await db.customers.filter((c) => Boolean(c.dirty)).toArray();
    if (dirtyCustomers.length) {
      const { error } = await upsertOwned(
        "customers",
        dirtyCustomers.map((c) => toRemoteCustomer(activeOwnerId, c)),
      );
      if (error) throw error;
      await db.transaction("rw", db.customers, async () => {
        for (const c of dirtyCustomers) {
          const current = await db.customers.get(c.id);
          if (current && current.updatedAt === c.updatedAt) {
            await db.customers.put({ ...current, dirty: false });
          }
        }
      });
    }

    if (settings.dirty && isOwnerDevice(settings)) {
      const full = toRemoteSettings(settings);
      let { error } = await supabase.from("settings").upsert(full);
      if (error && isSchemaCacheError(error)) {
        const core = { ...full };
        delete core.currency;
        delete core.language;
        delete core.payment_link;
        ({ error } = await supabase.from("settings").upsert(core));
      }
      if (error) throw error;
      const current = await db.settings.get("app");
      if (current && current.updatedAt === settings.updatedAt) {
        await db.settings.put({ ...current, dirty: false });
      }
    }

    const { data: remoteProducts, error: pErr } = await fetchProductsByOwnerId(
      settings.vendorId,
    );
    if (pErr) {
      console.error("products fetch", pErr);
      throw new Error(remoteErrorMessage(pErr) || pErr.message || "products fetch failed");
    }
    if (remoteProducts) {
      await applyFetchedProducts(remoteProducts as RemoteProduct[]);
    }

    const { data: remoteSales, error: sErr } = await querySalesByOwnerId(activeOwnerId);
    if (sErr) throw sErr;
    if (remoteSales) {
      for (const row of remoteSales as RemoteSale[]) {
        const local = await db.sales.get(row.id);
        if (!local || (!local.dirty && isNewer(row.updated_at, local.updatedAt))) {
          await db.sales.put(fromRemoteSale(row));
        }
      }
    }

    const { data: remoteCustomers, error: cErr } = await supabase
      .from("customers")
      .select("*")
      .eq("owner_id", activeOwnerId);
    if (cErr) throw cErr;
    if (remoteCustomers) {
      const rows = remoteCustomers as RemoteCustomer[];
      if (staff) {
        const keep = new Set(rows.map((r) => r.id));
        const locals = await db.customers.toArray();
        for (const c of locals) {
          if (!keep.has(c.id) && !c.dirty) await db.customers.delete(c.id);
        }
      }
      for (const row of rows) {
        const local = await db.customers.get(row.id);
        if (!local || (!local.dirty && isNewer(row.updated_at, local.updatedAt))) {
          await db.customers.put(fromRemoteCustomer(row));
        }
      }
    }

    const { data: remoteSettings, error: stErr } = await supabase
      .from("settings")
      .select("*")
      .eq("vendor_id", activeOwnerId)
      .maybeSingle();
    if (stErr) throw stErr;
    if (remoteSettings) {
      const remote = remoteSettings as RemoteSettings;
      const local = await db.settings.get("app");
      if (local && (staff || !local.dirty)) {
        const merged: Settings = {
          ...local,
          ...billingFromRemote(remote, local),
          plan: staff
            ? "equipe"
            : remote.plan === "equipe"
              ? "equipe"
              : remote.plan === "pro"
                ? "pro"
                : "free",
          businessType: normalizeBusinessType(remote.business_type),
          updatedAt: staff ? local.updatedAt : remote.updated_at,
          dirty: staff ? false : false,
          pairedOwnerId: local.pairedOwnerId,
          deviceRole: local.deviceRole,
          attendantName: local.attendantName,
          hideStoreTotals: local.hideStoreTotals,
        };
        await db.settings.put(merged);
        rememberPrefs(merged);
      }
    }

    lastSyncAt = new Date().toISOString();
  } catch (error) {
    lastError = error instanceof Error ? error.message : "Falha na sincronização";
  } finally {
    running = false;
    emit();
  }
}

export async function applyRemoteSaleRow(row: RemoteSale, force = false): Promise<void> {
  const local = await db.sales.get(row.id);
  if (force || !local || (!local.dirty && isNewer(row.updated_at, local.updatedAt))) {
    await db.sales.put(fromRemoteSale(row));
  }
}

export async function applyRemoteProductRow(row: RemoteProduct): Promise<void> {
  if (!row?.id) return;
  await db.products.put(fromRemoteProduct(row));
}

/** Replace the local product with the same id (UPDATE). */
export async function replaceLocalProduct(row: RemoteProduct): Promise<void> {
  const incoming = fromRemoteProduct(row);
  const existing = await db.products.get(incoming.id);
  if (!existing) {
    await db.products.put(incoming);
    return;
  }
  await db.products.put({ ...existing, ...incoming, id: incoming.id, dirty: false });
}

export async function removeLocalProduct(id: string): Promise<void> {
  if (id) await db.products.delete(id);
}

export async function applyRemoteCustomerRow(row: RemoteCustomer): Promise<void> {
  const local = await db.customers.get(row.id);
  if (!local || (!local.dirty && isNewer(row.updated_at, local.updatedAt))) {
    await db.customers.put(fromRemoteCustomer(row));
  }
}

/** Desktop/Negócio: persist products with owner_id = currentUser.id immediately. */
export async function pushProductsImmediate(products: Product[]): Promise<void> {
  for (const product of products) {
    await pushProductImmediate(product);
  }
}

export async function pushProductImmediate(product: Product): Promise<string | undefined> {
  if (!supabaseConfigured) return;
  const settings = await ensureSettings();
  const currentUser = { id: settings.vendorId };
  if (!currentUser?.id) {
    console.error("PRODUCT INSERT BLOCKED: currentUser.id is missing. owner_id was not set.");
    throw new Error("currentUser.id ausente: owner_id não foi definido.");
  }
  const ownerId = currentUser.id;
  const fields: Record<string, unknown> = {
    ...productInsertPayload(product, ownerId),
    owner_id: currentUser?.id,
  };
  delete fields.id;
  const core: Record<string, unknown> = {
    ...productCorePayload(product, ownerId),
    owner_id: currentUser?.id,
  };
  delete core.id;

  const updated = await supabase
    .from("products")
    .update(fields)
    .eq("id", product.id)
    .select("id");
  if (!updated.error && (updated.data?.length ?? 0) > 0) return product.id;
  if (updated.error && isSchemaCacheError(updated.error)) {
    const coreUpdated = await supabase
      .from("products")
      .update(core)
      .eq("id", product.id)
      .select("id");
    if (!coreUpdated.error && (coreUpdated.data?.length ?? 0) > 0) return product.id;
  }

  let inserted = await supabase.from("products").insert(fields).select("id");
  if (inserted.error && isSchemaCacheError(inserted.error)) {
    inserted = await supabase.from("products").insert(core).select("id");
  }
  if (inserted.error) throw new Error(inserted.error.message);
  const remoteId = inserted.data?.[0]?.id;
  if (typeof remoteId === "string") {
    const local = await db.products.get(product.id);
    if (local) await adoptRemoteProductId(product.id, remoteId);
    return remoteId;
  }
  return product.id;
}

function chefeOwnerIdForSales(
  settings?: Pick<Settings, "vendorId" | "pairedOwnerId" | "deviceRole"> | null,
): string {
  let linked = "";
  try {
    linked = localStorage.getItem(LINKED_OWNER_KEY)?.trim() || "";
  } catch {
    linked = "";
  }
  if (!isOwnerDevice(settings)) {
    return linked || settings?.pairedOwnerId || "";
  }
  return settings?.vendorId || "";
}

function resolveSaleOwnerId(
  settings?: Pick<Settings, "vendorId" | "pairedOwnerId" | "deviceRole"> | null,
): string {
  return chefeOwnerIdForSales(settings) || getActiveOwnerId(settings) || "";
}

export async function pushSaleImmediate(sale: Sale): Promise<void> {
  const { toast } = await import("./toast");
  try {
    if (!supabaseConfigured) {
      throw new Error("Supabase não configurado. A venda ficou só neste aparelho.");
    }
    const settings = await ensureSettings();
    const linkedChefeId = (() => {
      try {
        return localStorage.getItem(LINKED_OWNER_KEY)?.trim() || "";
      } catch {
        return "";
      }
    })();
    const ownerId = isOwnerDevice(settings)
      ? settings.vendorId
      : linkedChefeId || settings.pairedOwnerId || "";
    if (!ownerId || (!isOwnerDevice(settings) && ownerId === settings.vendorId)) {
      console.error(
        "SALE INSERT BLOCKED: Ajudante owner_id must be the Chefe id. linked=",
        linkedChefeId,
        "paired=",
        settings.pairedOwnerId,
        "localVendor=",
        settings.vendorId,
      );
      throw new Error("owner_id (ID do Chefe) ausente. Emparelhe o aparelho de novo.");
    }
    let attendantName = "Desconhecido";
    try {
      attendantName = localStorage.getItem("attendant_name")?.trim() || "Desconhecido";
    } catch {
      attendantName = getAttendantNameLocal(settings) || "Desconhecido";
    }
    const payload = {
      id: sale.id,
      owner_id: ownerId,
      vendor_id: ownerId,
      product_id: sale.productId || null,
      product_name: sale.productName,
      quantity: sale.quantity,
      unit_price_cents: sale.unitPriceCents,
      total_cents: sale.totalCents,
      status: sale.status,
      customer_phone: sale.customerPhone ?? null,
      customer_name: sale.customerName ?? null,
      notes: saleHelperNote({ ...sale, attendantName }),
      created_at: sale.createdAt,
      paid_at: sale.paidAt ?? null,
      updated_at: sale.updatedAt,
    };
    if (!payload.owner_id) {
      console.error("SALE INSERT BLOCKED: payload.owner_id is null/undefined.");
      throw new Error("owner_id (ID do chefe) ausente.");
    }
    console.log("Inserting sale with owner_id:", payload.owner_id);
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new Error("OFFLINE_QUEUED");
    }
    const writePayload = { ...payload, owner_id: ownerId };
    if (sale.status === "pending") {
      const inserted = await supabase.from("sales").insert(writePayload);
      if (!inserted.error) return;
      const stripped = {
        id: sale.id,
        owner_id: ownerId,
        vendor_id: ownerId,
        product_id: null,
        product_name: sale.productName,
        quantity: sale.quantity,
        unit_price_cents: sale.unitPriceCents,
        total_cents: sale.totalCents,
        status: sale.status,
        customer_phone: sale.customerPhone ?? null,
        customer_name: sale.customerName ?? null,
        notes: saleHelperNote({ ...sale, attendantName }),
        created_at: sale.createdAt,
        paid_at: null,
        updated_at: sale.updatedAt,
      };
      const retry = await supabase.from("sales").upsert(stripped);
      if (retry.error) throw retry.error;
      return;
    }
    const updated = await supabase
      .from("sales")
      .update(writePayload)
      .eq("id", sale.id)
      .select("id");
    if (!updated.error && (updated.data?.length ?? 0) > 0) return;
    const inserted = await supabase.from("sales").insert(writePayload);
    if (inserted.error) {
      const retry = await supabase.from("sales").upsert(writePayload);
      if (retry.error) throw retry.error;
    }
  } catch (err) {
    const message =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: string }).message)
        : err instanceof Error
          ? err.message
          : String(err);
    console.error("sales insert", err);
    if (isOfflineError(err) || message === "OFFLINE_QUEUED") {
      throw new Error("OFFLINE_QUEUED");
    }
    toast(message, "err");
    throw new Error(message);
  }
}

export async function pushCustomerImmediate(customer: Customer): Promise<void> {
  if (!supabaseConfigured) return;
  const settings = await ensureSettings();
  const activeOwnerId = getActiveOwnerId(settings);
  if (!activeOwnerId) {
    console.error("CUSTOMER WRITE BLOCKED: owner_id (ID do chefe) ausente.");
    return;
  }
  const payload = {
    ...toRemoteCustomer(activeOwnerId, customer),
    owner_id: activeOwnerId,
    vendor_id: activeOwnerId,
  };
  const { error } = await supabase.from("customers").upsert(payload);
  if (error) throw error;
}

export async function refetchOwnerProducts(): Promise<number> {
  if (productFetchLock) return productFetchLock;
  productFetchLock = (async () => {
    const settings = await ensureSettings();
    let linkedOwnerId = "";
    try {
      linkedOwnerId = localStorage.getItem(LINKED_OWNER_KEY)?.trim() || "";
    } catch {
      linkedOwnerId = "";
    }
    const ownerId = isOwnerDevice(settings)
      ? settings.vendorId
      : linkedOwnerId || settings.vendorId;
    console.log("Fetching products with owner_id:", ownerId);
    if (!ownerId) {
      console.error("PRODUCT FETCH BLOCKED: owner_id is missing.");
      throw new Error("owner_id ausente.");
    }
    if (!supabaseConfigured) throw new Error("Sem conexão com o servidor.");
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("owner_id", ownerId);
    if (error) {
      console.error("products fetch", error);
      throw new Error(error.message);
    }
    const rows = (data ?? []) as RemoteProduct[];
    await applyFetchedProducts(rows);
    return rows.length;
  })().finally(() => {
    productFetchLock = null;
  });
  return productFetchLock;
}

/** Ajudante/Desktop: inherit Chefe pix, WhatsApp, currency, language, payment link. */
export async function refetchOwnerSettings(): Promise<Settings> {
  const local = await ensureSettings();
  if (!supabaseConfigured) {
    rememberPrefs(local);
    return local;
  }
  const ownerId = isOwnerDevice(local)
    ? local.vendorId
    : getActiveOwnerId(local);
  if (!ownerId) {
    rememberPrefs(local);
    return local;
  }
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("vendor_id", ownerId)
    .maybeSingle();
  if (error || !data) {
    rememberPrefs(local);
    return local;
  }
  const remote = data as RemoteSettings;
  const staff = !isOwnerDevice(local);
  if (!staff && local.dirty) {
    rememberPrefs(local);
    return local;
  }
  const merged: Settings = {
    ...local,
    ...billingFromRemote(remote, local),
    dirty: staff ? false : local.dirty,
    updatedAt: staff ? local.updatedAt : remote.updated_at || local.updatedAt,
  };
  await db.settings.put(merged);
  rememberPrefs(merged);
  return merged;
}

function desktopOrLinkedOwnerId(settings: { vendorId: string; pairedOwnerId?: string }): string {
  const currentUser = { id: settings.vendorId };
  if (isOwnerDevice(settings)) return currentUser?.id || "";
  let linked = "";
  try {
    linked = localStorage.getItem("linked_owner_id")?.trim() || "";
  } catch {
    linked = "";
  }
  return linked || currentUser?.id || "";
}

async function querySalesByOwnerId(ownerId: string) {
  console.log("Fetching sales with owner_id:", ownerId);
  const result = await supabase
    .from("sales")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  console.log("Sales fetch result count:", result.data?.length ?? 0, "error:", result.error);
  return result;
}

export async function fetchVendorSalesFromSupabase(): Promise<Sale[]> {
  const settings = await ensureSettings();
  if (!supabaseConfigured) {
    return db.sales.toArray();
  }
  const currentUser = { id: settings.vendorId };
  const ownerId = isOwnerDevice(settings)
    ? currentUser.id
    : chefeOwnerIdForSales(settings) || currentUser.id;
  const { data, error } = await querySalesByOwnerId(ownerId);
  if (error) {
    console.error("sales fetch", error);
    return db.sales.toArray();
  }
  return ((data ?? []) as RemoteSale[]).map(fromRemoteSale);
}

export async function refetchOwnerSales(): Promise<number> {
  const settings = await ensureSettings();
  const currentUser = { id: settings.vendorId };
  const ownerId = isOwnerDevice(settings)
    ? currentUser.id
    : chefeOwnerIdForSales(settings);
  if (!ownerId) throw new Error("owner_id ausente.");
  if (!supabaseConfigured) throw new Error("Sem conexão com o servidor.");
  console.log("ATUALIZAR HISTÓRICO owner_id=", ownerId);
  const { data, error } = await supabase
    .from("sales")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as RemoteSale[];
  const incoming = rows.filter((r) => r?.id).map(fromRemoteSale);
  const keep = new Set(incoming.map((s) => s.id));
  await db.transaction("rw", db.sales, async () => {
    const dirty = (await db.sales.toArray()).filter((s) => s.dirty && !keep.has(s.id));
    await db.sales.clear();
    if (incoming.length) await db.sales.bulkPut(incoming);
    if (dirty.length) await db.sales.bulkPut(dirty);
  });
  return incoming.length;
}

export function startSalesRealtime(vendorId: string): () => void {
  return startAccountRealtime(vendorId);
}

type ChangePayload = {
  eventType?: string;
  event?: string;
  new?: Record<string, unknown> | null;
  old?: Record<string, unknown> | null;
  payload?: {
    eventType?: string;
    new?: Record<string, unknown> | null;
    old?: Record<string, unknown> | null;
  };
};

function normalizeChange(raw: ChangePayload): {
  event: string;
  newRow: Record<string, unknown> | null;
  oldRow: Record<string, unknown> | null;
} {
  const inner = raw.payload ?? raw;
  return {
    event: String(raw.eventType || raw.event || inner.eventType || "").toUpperCase(),
    newRow: (raw.new ?? inner.new ?? null) as Record<string, unknown> | null,
    oldRow: (raw.old ?? inner.old ?? null) as Record<string, unknown> | null,
  };
}

function handleProductChange(payload: ChangePayload): void {
  const { event, newRow, oldRow } = normalizeChange(payload);
  if (event === "DELETE") {
    const id = oldRow?.id as string | undefined;
    if (id) void removeLocalProduct(id);
    return;
  }
  if (event === "UPDATE") {
    const row = newRow as RemoteProduct | null;
    if (row?.id) void replaceLocalProduct(row);
    return;
  }
  if (event === "INSERT") {
    const row = newRow as RemoteProduct | null;
    if (row?.id) void applyRemoteProductRow(row);
  }
}

function handleSaleChange(payload: ChangePayload): void {
  const { event, newRow, oldRow } = normalizeChange(payload);
  if (event === "DELETE") {
    const id = oldRow?.id as string | undefined;
    if (id) void db.sales.delete(id);
    return;
  }
  const row = newRow as RemoteSale | null;
  if (!row?.id) return;
  if (event === "INSERT" || event === "UPDATE") {
    void applyRemoteSaleRow(row, true);
  }
}

function handleCustomerChange(payload: ChangePayload): void {
  const { event, newRow, oldRow } = normalizeChange(payload);
  if (event === "DELETE") {
    const id = oldRow?.id as string | undefined;
    if (id) void db.customers.delete(id);
    return;
  }
  const row = newRow as RemoteCustomer | null;
  if (row?.id) void applyRemoteCustomerRow(row);
}

export function startAccountRealtime(vendorId: string): () => void {
  if (!supabaseConfigured || !vendorId) return () => undefined;
  let linked = "";
  try {
    linked = localStorage.getItem("linked_owner_id")?.trim() || "";
  } catch {
    linked = "";
  }
  const ownerId = linked || getActiveOwnerId() || vendorId;
  if (liveRealtime?.ownerId === ownerId) {
    return liveRealtime.stop;
  }
  if (liveRealtime) {
    liveRealtime.stop();
    liveRealtime = null;
  }
  const filter = `owner_id=eq.${ownerId}`;
  const channel = supabase
    .channel(`account-${ownerId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "sales", filter },
      (payload) => handleSaleChange(payload),
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "sales", filter },
      (payload) => handleSaleChange(payload),
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "sales", filter },
      (payload) => handleSaleChange(payload),
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "products", filter },
      (payload) => handleProductChange(payload),
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "products", filter },
      (payload) => handleProductChange(payload),
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "products", filter },
      (payload) => handleProductChange(payload),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "customers", filter },
      (payload) => handleCustomerChange(payload),
    );
  channel.subscribe();
  const stop = () => {
    if (liveRealtime?.stop === stop) liveRealtime = null;
    void supabase.removeChannel(channel);
  };
  liveRealtime = { ownerId, stop };
  return stop;
}

export async function deleteRemoteVendorData(vendorId: string): Promise<void> {
  if (!supabaseConfigured || !vendorId) return;
  await deleteRemoteOwnerCatalogAndOrders(vendorId);
  await supabase.from("customers").delete().eq("owner_id", vendorId);
  await supabase.from("customers").delete().eq("vendor_id", vendorId);
  await supabase.from("settings").delete().eq("vendor_id", vendorId);
}

/** Hard wipe of catalog and orders for this owner in Supabase. */
export async function deleteRemoteSale(saleId: string): Promise<void> {
  if (!supabaseConfigured || !saleId) return;
  const { error } = await supabase.from("sales").delete().eq("id", saleId);
  if (error) throw new Error(error.message);
}

export async function deleteRemoteProduct(productId: string): Promise<void> {
  if (!supabaseConfigured || !productId) return;
  const { error } = await supabase.from("products").delete().eq("id", productId);
  if (error) throw new Error(error.message);
}

export async function deleteRemoteOwnerCatalogAndOrders(ownerId: string): Promise<void> {
  if (!supabaseConfigured || !ownerId) return;
  await supabase.from("sales").delete().eq("owner_id", ownerId);
  await supabase.from("sales").delete().eq("vendor_id", ownerId);
  await supabase.from("products").delete().eq("owner_id", ownerId);
  await supabase.from("products").delete().eq("vendor_id", ownerId);
}
