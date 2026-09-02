import { db, ensureSettings } from "./db";
import { newId, nowIso } from "./id";
import { nationalDigits } from "./phone";
import type { Customer, Product, Sale, Settings } from "./types";

function scheduleSync() {
  void import("./sync").then((m) => m.scheduleSync());
}

async function touch<T extends { updatedAt: string; dirty?: boolean }>(
  table: "products" | "sales" | "customers",
  record: T,
): Promise<T> {
  const next = { ...record, updatedAt: nowIso(), dirty: true };
  await db.table(table).put(next);
  scheduleSync();
  return next;
}

export async function saveProduct(
  input: Omit<Product, "createdAt" | "updatedAt" | "dirty"> & {
    createdAt?: string;
  },
): Promise<Product> {
  const existing = await db.products.get(input.id);
  const now = nowIso();
  const row: Product = {
    ...existing,
    ...input,
    createdAt: existing?.createdAt ?? input.createdAt ?? now,
    updatedAt: now,
    dirty: true,
    deleted: false,
  };
  const sync = await import("./sync");
  try {
    if (existing) {
      await db.products.put(row);
      await sync.pushProductImmediate(row);
      void import("./persist").then((m) => m.backupCatalog());
      scheduleSync();
      return row;
    }
    if (typeof navigator !== "undefined" && navigator.onLine) {
      const remoteId = await sync.pushProductImmediate(row);
      const saved: Product = {
        ...row,
        id: remoteId || row.id,
        dirty: false,
      };
      await db.products.put(saved);
      void import("./persist").then((m) => m.backupCatalog());
      scheduleSync();
      return saved;
    }
  } catch (err) {
    const { isOfflineError } = await import("./persist");
    if (!existing && isOfflineError(err)) {
      await db.products.put(row);
      void import("./persist").then((m) => m.backupCatalog());
      scheduleSync();
      return row;
    }
    const message =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message ?? "").trim()
        : err instanceof Error
          ? err.message
          : String(err);
    console.error("products insert", err);
    throw new Error(message || "Não deu pra gravar o produto.");
  }
  await db.products.put(row);
  void import("./persist").then((m) => m.backupCatalog());
  scheduleSync();
  return row;
}

export async function removeProduct(id: string): Promise<void> {
  const existing = await db.products.get(id);
  if (!existing) return;
  try {
    await import("./sync").then((m) => m.deleteRemoteProduct(id));
  } catch (err) {
    const { isOfflineError } = await import("./persist");
    if (!isOfflineError(err)) throw err;
  }
  await db.products.delete(id);
  void import("./persist").then((m) => m.backupCatalog());
}

export async function createSale(input: {
  product: Product;
  quantity: number;
  status: "pending" | "paid";
  extraCents?: number;
  customerPhone?: string;
  customerName?: string;
  attendantName?: string;
  notes?: string;
}): Promise<Sale> {
  if (input.status === "pending") {
    const { canAddFiadoThisMonth } = await import("./plan");
    if (!(await canAddFiadoThisMonth())) {
      throw new Error("PLAN_LIMIT_FIADO");
    }
  }
  const settings = await ensureSettings();
  const now = nowIso();
  const qty = Math.max(1, Math.floor(input.quantity));
  const extraCents = input.extraCents ?? 0;
  const base = input.product.priceCents * qty;
  const { getAttendantNameLocal } = await import("./account");
  const attendantName =
    input.attendantName?.trim() ||
    getAttendantNameLocal(settings) ||
    settings.attendantName?.trim() ||
    undefined;
  const sale: Sale = {
    id: newId(),
    productId: input.product.id,
    productName: input.product.name,
    quantity: qty,
    unitPriceCents: input.product.priceCents,
    totalCents: Math.max(0, base + extraCents),
    extraCents,
    priceMode: input.product.priceMode ?? "fixed",
    status: input.status,
    customerPhone: input.customerPhone,
    customerName: input.customerName,
    attendantName,
    notes: input.notes,
    createdAt: now,
    paidAt: input.status === "paid" ? now : undefined,
    updatedAt: now,
    dirty: true,
  };
  await db.transaction("rw", db.sales, db.products, async () => {
    await db.sales.put(sale);
    if (input.status === "paid") {
      const product = await db.products.get(input.product.id);
      if (product) {
        await db.products.put({
          ...product,
          stock: product.stock - qty,
          updatedAt: now,
          dirty: true,
        });
      }
    }
  });
  scheduleSync();
  try {
    await import("./sync").then((m) => m.pushSaleImmediate(sale));
  } catch (err) {
    const { isOfflineError } = await import("./persist");
    if (isOfflineError(err) || (err instanceof Error && err.message === "OFFLINE_QUEUED")) {
      scheduleSync();
      return sale;
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(message);
  }
  return sale;
}

export async function markSalePaid(
  id: string,
  extraCents = 0,
): Promise<Sale | undefined> {
  const sale = await db.sales.get(id);
  if (!sale || sale.status === "paid") return sale;
  const now = nowIso();
  const base = sale.unitPriceCents * sale.quantity;
  const next: Sale = {
    ...sale,
    extraCents,
    totalCents: Math.max(0, base + extraCents),
    status: "paid",
    paidAt: now,
    updatedAt: now,
    dirty: true,
  };
  await db.transaction("rw", db.sales, db.products, async () => {
    await db.sales.put(next);
    if (sale.status === "pending") {
      const product = await db.products.get(sale.productId);
      if (product) {
        await db.products.put({
          ...product,
          stock: product.stock - sale.quantity,
          updatedAt: now,
          dirty: true,
        });
      }
    }
  });
  scheduleSync();
  try {
    await import("./sync").then((m) => m.pushSaleImmediate(next));
  } catch (err) {
    const { isOfflineError } = await import("./persist");
    if (isOfflineError(err) || (err instanceof Error && err.message === "OFFLINE_QUEUED")) {
      scheduleSync();
      return next;
    }
    throw err;
  }
  return next;
}

export async function unpaySale(id: string): Promise<Sale | undefined> {
  const sale = await db.sales.get(id);
  if (!sale || sale.status !== "paid") return sale;
  const now = nowIso();
  const next: Sale = {
    ...sale,
    status: "pending",
    paidAt: undefined,
    updatedAt: now,
    dirty: true,
  };
  await db.transaction("rw", db.sales, db.products, async () => {
    await db.sales.put(next);
    const product = await db.products.get(sale.productId);
    if (product) {
      await db.products.put({
        ...product,
        stock: product.stock + sale.quantity,
        updatedAt: now,
        dirty: true,
      });
    }
  });
  scheduleSync();
  try {
    await import("./sync").then((m) => m.pushSaleImmediate(next));
  } catch (err) {
    const { isOfflineError } = await import("./persist");
    if (isOfflineError(err) || (err instanceof Error && err.message === "OFFLINE_QUEUED")) {
      scheduleSync();
      return next;
    }
    throw err;
  }
  return next;
}

export async function deleteSale(id: string): Promise<void> {
  await cancelSale(id);
}

export async function cancelSale(id: string): Promise<void> {
  const sale = await db.sales.get(id);
  if (!sale || sale.status === "cancelled") return;
  const now = nowIso();
  try {
    await import("./sync").then((m) => m.deleteRemoteSale(id));
  } catch (err) {
    const { isOfflineError } = await import("./persist");
    if (!isOfflineError(err) && !(err instanceof Error && err.message === "OFFLINE_QUEUED")) {
      throw err;
    }
  }
  await db.transaction("rw", db.sales, db.products, async () => {
    await db.sales.delete(id);
    if (sale.status === "paid") {
      const product = await db.products.get(sale.productId);
      if (product) {
        await db.products.put({
          ...product,
          stock: product.stock + sale.quantity,
          updatedAt: now,
          dirty: true,
        });
      }
    }
  });
}

export async function attachCustomerToSale(
  saleId: string,
  phone: string,
  name?: string,
): Promise<void> {
  const sale = await db.sales.get(saleId);
  if (!sale) return;
  await touch("sales", { ...sale, customerPhone: phone, customerName: name });
}

export async function findCustomerByPhone(phone: string): Promise<Customer | undefined> {
  const needle = nationalDigits(phone);
  if (!needle) return undefined;
  const all = await db.customers.toArray();
  return all.find((c) => nationalDigits(c.phone) === needle);
}

export async function upsertCustomer(input: {
  phone: string;
  name?: string;
}): Promise<Customer> {
  const phone = nationalDigits(input.phone);
  const existing = await findCustomerByPhone(phone);
  const now = nowIso();
  if (existing) {
    const next: Customer = {
      ...existing,
      phone,
      name: input.name?.trim() ? input.name.trim() : existing.name,
      updatedAt: now,
      dirty: true,
    };
    await db.customers.put(next);
    scheduleSync();
    try {
      await import("./sync").then((m) => m.pushCustomerImmediate(next));
    } catch (err) {
      console.error("customers upsert", err);
    }
    return next;
  }
  const { canAddLoyaltyCard } = await import("./plan");
  if (!(await canAddLoyaltyCard(phone))) {
    throw new Error("PLAN_LIMIT_LOYALTY");
  }
  const created: Customer = {
    id: newId(),
    phone,
    name: input.name?.trim() ?? "",
    stamps: 0,
    totalStamps: 0,
    rewardsClaimed: 0,
    createdAt: now,
    updatedAt: now,
    dirty: true,
  };
  await db.customers.put(created);
  scheduleSync();
  try {
    await import("./sync").then((m) => m.pushCustomerImmediate(created));
  } catch (err) {
    console.error("customers insert", err);
  }
  return created;
}

export async function activatePlan(plan: "pro" | "equipe"): Promise<Settings> {
  const { clearDevOverrides, persistActivePlan } = await import("./plan");
  clearDevOverrides();
  persistActivePlan(plan === "equipe" ? "negocio" : "pro");
  return saveSettings({ plan });
}

export async function activatePro(): Promise<Settings> {
  return activatePlan("pro");
}

export async function activateEquipe(): Promise<Settings> {
  return activatePlan("equipe");
}

export async function deleteAccountAndAllData(): Promise<void> {
  const {
    clearDevOverrides,
    persistActivePlan,
    restorePaidPlanIfNeeded,
    getDevPlanOverride,
    getStoredActivePlan,
  } = await import("./plan");
  const { clearPairLocal } = await import("./pairing");
  const keepPaid =
    typeof window !== "undefined" &&
    (new URLSearchParams(window.location.search).get("dev") === "true" ||
      getDevPlanOverride() === "equipe" ||
      getStoredActivePlan() === "equipe" ||
      getDevPlanOverride() === "pro" ||
      getStoredActivePlan() === "pro");
  if (!keepPaid) {
    clearDevOverrides();
    persistActivePlan("free");
  }
  clearPairLocal();
  const current = await ensureSettings();
  const vendorId = current.vendorId;
  try {
    const { deleteRemoteVendorData } = await import("./sync");
    await deleteRemoteVendorData(vendorId);
  } catch {
    /* offline or no backend */
  }
  await db.transaction("rw", db.products, db.sales, db.customers, db.settings, async () => {
    await db.products.clear();
    await db.sales.clear();
    await db.customers.clear();
    await db.settings.put({
      id: "app",
      vendorId: newId(),
      storeName: "Meu negócio",
      pixKey: "",
      merchantName: "MEU NEGOCIO",
      merchantCity: "SAO PAULO",
      whatsapp: "",
      rewardLabel: "1 brinde grátis",
      stampsRequired: 10,
      plan: keepPaid
        ? getDevPlanOverride() === "pro" || getStoredActivePlan() === "pro"
          ? "pro"
          : "equipe"
        : "free",
      businessType: "alimentacao",
      updatedAt: nowIso(),
      dirty: true,
    });
  });
  const { clearCatalogBackup } = await import("./persist");
  clearCatalogBackup();
  if (keepPaid) await restorePaidPlanIfNeeded();
}

export async function addStamp(customerId: string): Promise<Customer | undefined> {
  const customer = await db.customers.get(customerId);
  const settings = await ensureSettings();
  if (!customer) return undefined;
  if (customer.stamps >= settings.stampsRequired) return customer;
  const next: Customer = {
    ...customer,
    stamps: customer.stamps + 1,
    totalStamps: customer.totalStamps + 1,
    updatedAt: nowIso(),
    dirty: true,
  };
  await db.customers.put(next);
  scheduleSync();
  try {
    await import("./sync").then((m) => m.pushCustomerImmediate(next));
  } catch (err) {
    console.error("customers stamp", err);
  }
  return next;
}

export async function redeemReward(customerId: string): Promise<Customer | undefined> {
  const customer = await db.customers.get(customerId);
  const settings = await ensureSettings();
  if (!customer || customer.stamps < settings.stampsRequired) return customer;
  const next: Customer = {
    ...customer,
    stamps: 0,
    rewardsClaimed: customer.rewardsClaimed + 1,
    updatedAt: nowIso(),
    dirty: true,
  };
  await db.customers.put(next);
  scheduleSync();
  return next;
}

export async function saveSettings(patch: Partial<Omit<Settings, "id" | "vendorId">>): Promise<Settings> {
  const current = await ensureSettings();
  const next: Settings = {
    ...current,
    ...patch,
    id: "app",
    vendorId: current.vendorId,
    updatedAt: nowIso(),
    dirty: true,
  };
  await db.settings.put(next);
  scheduleSync();
  return next;
}
