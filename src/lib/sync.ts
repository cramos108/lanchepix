import { accountVendorId, isOwnerDevice, staffRole } from "./account";
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

type RemoteProduct = {
  id: string;
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

function toRemoteProduct(vendorId: string, p: Product): RemoteProduct {
  return {
    id: p.id,
    vendor_id: vendorId,
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
    vendor_id: vendorId,
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
    attendant_name: s.attendantName ?? null,
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
    vendor_id: vendorId,
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
    updated_at: s.updatedAt,
  };
}

export async function pushAndPull(): Promise<void> {
  if (running || !supabaseConfigured) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  running = true;
  lastError = null;
  emit();
  try {
    const settings = await ensureSettings();
    const vendorId = accountVendorId(settings);
    const staff = !isOwnerDevice(settings);
    const role = staffRole(settings);

    const dirtyProducts = await db.products.filter((p) => Boolean(p.dirty)).toArray();
    if (dirtyProducts.length && role !== "ajudante") {
      const { error } = await supabase
        .from("products")
        .upsert(dirtyProducts.map((p) => toRemoteProduct(vendorId, p)));
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
      const { error } = await supabase
        .from("sales")
        .upsert(dirtySales.map((s) => toRemoteSale(vendorId, s)));
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
    if (dirtyCustomers.length && role !== "ajudante") {
      const { error } = await supabase
        .from("customers")
        .upsert(dirtyCustomers.map((c) => toRemoteCustomer(vendorId, c)));
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

    const { data: remoteProducts, error: pErr } = await supabase
      .from("products")
      .select("*")
      .eq("vendor_id", vendorId);
    if (pErr) throw pErr;
    if (remoteProducts) {
      for (const row of remoteProducts as RemoteProduct[]) {
        const local = await db.products.get(row.id);
        if (!local || (!local.dirty && isNewer(row.updated_at, local.updatedAt))) {
          await db.products.put(fromRemoteProduct(row));
        }
      }
    }

    const { data: remoteSales, error: sErr } = await supabase
      .from("sales")
      .select("*")
      .eq("vendor_id", vendorId);
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
      .eq("vendor_id", vendorId);
    if (cErr) throw cErr;
    if (remoteCustomers) {
      for (const row of remoteCustomers as RemoteCustomer[]) {
        const local = await db.customers.get(row.id);
        if (!local || (!local.dirty && isNewer(row.updated_at, local.updatedAt))) {
          await db.customers.put(fromRemoteCustomer(row));
        }
      }
    }

    const { data: remoteSettings, error: stErr } = await supabase
      .from("settings")
      .select("*")
      .eq("vendor_id", vendorId)
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

export async function applyRemoteSaleRow(row: RemoteSale): Promise<void> {
  const local = await db.sales.get(row.id);
  if (!local || (!local.dirty && isNewer(row.updated_at, local.updatedAt))) {
    await db.sales.put(fromRemoteSale(row));
  }
}

export async function fetchVendorSalesFromSupabase(): Promise<Sale[]> {
  const settings = await ensureSettings();
  if (!supabaseConfigured) {
    return db.sales.toArray();
  }
  const { data, error } = await supabase
    .from("sales")
    .select("*")
    .eq("vendor_id", accountVendorId(settings));
  if (error || !data) {
    return db.sales.toArray();
  }
  return (data as RemoteSale[]).map(fromRemoteSale);
}

export function startSalesRealtime(vendorId: string): () => void {
  if (!supabaseConfigured || !vendorId) return () => undefined;
  const channel = supabase
    .channel(`sales-${vendorId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "sales",
        filter: `vendor_id=eq.${vendorId}`,
      },
      (payload) => {
        if (payload.eventType === "DELETE") {
          const id = (payload.old as { id?: string } | null)?.id;
          if (id) void db.sales.delete(id);
          return;
        }
        const row = payload.new as RemoteSale | null;
        if (row?.id) void applyRemoteSaleRow(row);
      },
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function deleteRemoteVendorData(vendorId: string): Promise<void> {
  if (!supabaseConfigured || !vendorId) return;
  await supabase.from("sales").delete().eq("vendor_id", vendorId);
  await supabase.from("products").delete().eq("vendor_id", vendorId);
  await supabase.from("customers").delete().eq("vendor_id", vendorId);
  await supabase.from("settings").delete().eq("vendor_id", vendorId);
}
