import {
  getActiveOwnerId,
  getAttendantNameLocal,
  isOwnerDevice,
  staffRole,
} from "./account";
import { db, ensureSettings } from "./db";
import { supabase, supabaseConfigured } from "./supabase";
import { normalizeBusinessType, type Customer, type Product, type Sale, type Settings } from "./types";

let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;
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
 * sales / customers / settings are owned by vendor_id (device account id).
 * products catalog uses owner_id (same uuid as the owner's account).
 * pairing_codes also uses owner_id.
 */
export const OWNERSHIP_COLUMN = "vendor_id" as const;

/** products are fetched, saved, and filtered by owner_id. */
export const PRODUCT_OWNER_COLUMN = "owner_id" as const;

function ownershipEq(ownerId: string) {
  return `${OWNERSHIP_COLUMN}=eq.${ownerId}`;
}

function productOwnershipEq(ownerId: string) {
  return `${PRODUCT_OWNER_COLUMN}=eq.${ownerId}`;
}

type RemoteProduct = {
  id: string;
  owner_id: string;
  vendor_id: string;
  name: string;
  price_cents: number;
  price_mode: string | null;
  image_data: string | null;
  category: string;
  stock: number;
  active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type RemoteSale = {
  id: string;
  vendor_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
  extra_cents: number | null;
  price_mode: string | null;
  status: Sale["status"];
  customer_phone: string | null;
  customer_name: string | null;
  attendant_name: string | null;
  notes: string | null;
  created_at: string;
  paid_at: string | null;
  updated_at: string;
};

type RemoteCustomer = {
  id: string;
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
  updated_at: string;
};

function toRemoteProduct(ownerId: string, p: Product): RemoteProduct {
  return {
    id: p.id,
    owner_id: ownerId,
    vendor_id: ownerId,
    name: p.name,
    price_cents: p.priceCents,
    price_mode: p.priceMode ?? "fixed",
    image_data: p.imageData ?? null,
    category: p.category,
    stock: p.stock,
    active: p.active,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
    deleted_at: p.deleted ? p.updatedAt : null,
  };
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
    active: r.active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deleted: Boolean(r.deleted_at),
    dirty: false,
  };
}

function toRemoteSale(vendorId: string, s: Sale): RemoteSale {
  return {
    id: s.id,
    [OWNERSHIP_COLUMN]: vendorId,
    product_id: s.productId || null,
    product_name: s.productName,
    quantity: s.quantity,
    unit_price_cents: s.unitPriceCents,
    total_cents: s.totalCents,
    extra_cents: s.extraCents ?? 0,
    price_mode: s.priceMode ?? "fixed",
    status: s.status,
    customer_phone: s.customerPhone ?? null,
    customer_name: s.customerName ?? null,
    attendant_name:
      getAttendantNameLocal() || s.attendantName || "Desconhecido",
    notes: s.notes ?? null,
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
    extraCents: r.extra_cents ?? 0,
    priceMode: r.price_mode === "suggested" ? "suggested" : "fixed",
    status: r.status,
    customerPhone: r.customer_phone ?? undefined,
    customerName: r.customer_name ?? undefined,
    attendantName: r.attendant_name ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
    paidAt: r.paid_at ?? undefined,
    updatedAt: r.updated_at,
    dirty: false,
  };
}

function toRemoteCustomer(vendorId: string, c: Customer): RemoteCustomer {
  return {
    id: c.id,
    [OWNERSHIP_COLUMN]: vendorId,
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

function toRemoteSettings(s: Settings): RemoteSettings {
  return {
    [OWNERSHIP_COLUMN]: s.vendorId,
    store_name: s.storeName,
    pix_key: s.pixKey,
    merchant_name: s.merchantName,
    merchant_city: s.merchantCity,
    whatsapp: s.whatsapp,
    reward_label: s.rewardLabel,
    stamps_required: s.stampsRequired,
    plan: s.plan ?? "free",
    business_type: normalizeBusinessType(s.businessType),
    updated_at: s.updatedAt,
  };
}

async function upsertOwned(table: string, rows: object[]) {
  return supabase.from(table).upsert(rows);
}

async function selectOwned(table: string, ownerId: string) {
  return supabase.from(table).select("*").eq(OWNERSHIP_COLUMN, ownerId);
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

function friendlyCatalogError(error: unknown): string {
  const raw = remoteErrorMessage(error).toLowerCase();
  if (
    raw.includes("failed to fetch") ||
    raw.includes("network") ||
    raw.includes("offline") ||
    raw.includes("internet")
  ) {
    return "Sem internet. Conecte o celular e toque em Atualizar.";
  }
  if (raw.includes("timeout")) {
    return "A conexão demorou demais. Tente atualizar de novo.";
  }
  if (raw.includes("não configurado") || raw.includes("sem conexão com o servidor")) {
    return "Sem conexão com o servidor. Tente de novo em instantes.";
  }
  return "Não deu pra atualizar o catálogo. Confira a internet e tente de novo.";
}

async function fetchProductsByOwnerId(activeOwnerId: string) {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("owner_id", activeOwnerId);
  console.log(
    "Fetching products for owner_id:",
    activeOwnerId,
    "Result:",
    data,
    "Error:",
    error,
  );
  return { data, error };
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
      const { error } = await upsertOwned(
        "products",
        dirtyProducts.map((p) => toRemoteProduct(activeOwnerId, p)),
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
      const { error } = await upsertOwned(
        "sales",
        dirtySales.map((s) => toRemoteSale(activeOwnerId, s)),
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
      const { error } = await supabase.from("settings").upsert(toRemoteSettings(settings));
      if (error) throw error;
      const current = await db.settings.get("app");
      if (current && current.updatedAt === settings.updatedAt) {
        await db.settings.put({ ...current, dirty: false });
      }
    }

    const { data: remoteProducts, error: pErr } = await fetchProductsByOwnerId(activeOwnerId);
    if (pErr) {
      console.error("products fetch", pErr);
      throw new Error(friendlyCatalogError(pErr));
    }
    if (remoteProducts) {
      const rows = remoteProducts as RemoteProduct[];
      if (staff) {
        const keep = new Set(rows.map((r) => r.id));
        const locals = await db.products.toArray();
        for (const p of locals) {
          if (!keep.has(p.id)) await db.products.delete(p.id);
        }
        for (const row of rows) {
          await db.products.put(fromRemoteProduct(row));
        }
      } else {
        for (const row of rows) {
          const local = await db.products.get(row.id);
          if (!local || (!local.dirty && isNewer(row.updated_at, local.updatedAt))) {
            await db.products.put(fromRemoteProduct(row));
          }
        }
      }
    }

    const { data: remoteSales, error: sErr } = await selectOwned("sales", activeOwnerId);
    if (sErr) throw sErr;
    if (remoteSales) {
      for (const row of remoteSales as RemoteSale[]) {
        const local = await db.sales.get(row.id);
        if (!local || (!local.dirty && isNewer(row.updated_at, local.updatedAt))) {
          await db.sales.put(fromRemoteSale(row));
        }
      }
    }

    const { data: remoteCustomers, error: cErr } = await selectOwned("customers", activeOwnerId);
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
      .eq(OWNERSHIP_COLUMN, activeOwnerId)
      .maybeSingle();
    if (stErr) throw stErr;
    if (remoteSettings) {
      const remote = remoteSettings as RemoteSettings;
      const local = await db.settings.get("app");
      if (
        local &&
        (staff || (!local.dirty && isNewer(remote.updated_at, local.updatedAt)))
      ) {
        const merged: Settings = {
          ...local,
          storeName: remote.store_name,
          pixKey: remote.pix_key,
          merchantName: remote.merchant_name,
          merchantCity: remote.merchant_city,
          whatsapp: remote.whatsapp,
          rewardLabel: remote.reward_label,
          stampsRequired: remote.stamps_required,
          plan: staff
            ? "equipe"
            : remote.plan === "equipe"
              ? "equipe"
              : remote.plan === "pro"
                ? "pro"
                : "free",
          businessType: normalizeBusinessType(remote.business_type),
          updatedAt: staff ? local.updatedAt : remote.updated_at,
          dirty: false,
          pairedOwnerId: local.pairedOwnerId,
          deviceRole: local.deviceRole,
          attendantName: local.attendantName,
          hideStoreTotals: local.hideStoreTotals,
        };
        await db.settings.put(merged);
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

/** Desktop/Negócio: persist a product with owner_id = owner's id immediately. */
export async function pushProductImmediate(product: Product): Promise<void> {
  if (!supabaseConfigured) return;
  const settings = await ensureSettings();
  const activeOwnerId = getActiveOwnerId(settings);
  if (!activeOwnerId) throw new Error("Não deu pra gravar o produto. Tente de novo.");
  const payload = {
    ...toRemoteProduct(activeOwnerId, product),
    owner_id: activeOwnerId,
    vendor_id: activeOwnerId,
  };
  const { error } = await upsertOwned("products", [payload]);
  if (error) throw error;
}

export async function pushSaleImmediate(sale: Sale): Promise<void> {
  const { toast } = await import("./toast");
  try {
    if (!supabaseConfigured) {
      throw new Error("Supabase não configurado. A venda ficou só neste aparelho.");
    }
    const settings = await ensureSettings();
    const activeOwnerId = getActiveOwnerId(settings);
    if (!activeOwnerId) throw new Error("vendor_id (ID do chefe) ausente.");
    let attendantName = "Desconhecido";
    try {
      attendantName = localStorage.getItem("attendant_name")?.trim() || "Desconhecido";
    } catch {
      attendantName = getAttendantNameLocal(settings) || "Desconhecido";
    }
    const payload = {
      ...toRemoteSale(activeOwnerId, sale),
      [OWNERSHIP_COLUMN]: activeOwnerId,
      attendant_name: attendantName,
    };
    const inserted = await supabase.from("sales").insert(payload);
    if (inserted.error) {
      const retry = await upsertOwned("sales", [payload]);
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
    toast(message, "err");
    throw new Error(message);
  }
}

export async function refetchOwnerProducts(): Promise<number> {
  const settings = await ensureSettings();
  const activeOwnerId = getActiveOwnerId(settings);
  if (!activeOwnerId) {
    throw new Error("Não deu pra atualizar o catálogo. Confira a internet e tente de novo.");
  }
  if (!supabaseConfigured) {
    throw new Error("Sem conexão com o servidor. Tente de novo em instantes.");
  }
  const { data, error } = await fetchProductsByOwnerId(activeOwnerId);
  if (error) {
    console.error("products fetch", error);
    throw new Error(friendlyCatalogError(error));
  }
  const rows = (data ?? []) as RemoteProduct[];
  const keep = new Set(rows.map((r) => r.id));
  const locals = await db.products.toArray();
  for (const p of locals) {
    if (!keep.has(p.id)) await db.products.delete(p.id);
  }
  for (const row of rows) {
    await db.products.put(fromRemoteProduct(row));
  }
  return rows.length;
}

export async function fetchVendorSalesFromSupabase(): Promise<Sale[]> {
  const settings = await ensureSettings();
  if (!supabaseConfigured) {
    return db.sales.toArray();
  }
  const { data, error } = await selectOwned("sales", getActiveOwnerId(settings));
  if (error || !data) {
    return db.sales.toArray();
  }
  return (data as RemoteSale[]).map(fromRemoteSale);
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
  const ownerId = getActiveOwnerId() || vendorId;
  const filter = ownershipEq(ownerId);
  const productFilter = productOwnershipEq(ownerId);
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
      { event: "INSERT", schema: "public", table: "products", filter: productFilter },
      (payload) => handleProductChange(payload),
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "products", filter: productFilter },
      (payload) => handleProductChange(payload),
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "products", filter: productFilter },
      (payload) => handleProductChange(payload),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "customers", filter },
      (payload) => handleCustomerChange(payload),
    );
  channel.subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function deleteRemoteVendorData(vendorId: string): Promise<void> {
  if (!supabaseConfigured || !vendorId) return;
  await supabase.from("sales").delete().eq(OWNERSHIP_COLUMN, vendorId);
  await supabase.from("products").delete().eq(PRODUCT_OWNER_COLUMN, vendorId);
  await supabase.from("products").delete().eq(OWNERSHIP_COLUMN, vendorId);
  await supabase.from("customers").delete().eq(OWNERSHIP_COLUMN, vendorId);
  await supabase.from("settings").delete().eq(OWNERSHIP_COLUMN, vendorId);
}
