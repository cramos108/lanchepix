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
  await db.products.put(row);
  scheduleSync();
  return row;
}

export async function removeProduct(id: string): Promise<void> {
  const existing = await db.products.get(id);
  if (!existing) return;
  await touch("products", { ...existing, active: false, deleted: true });
}

export async function createSale(input: {
  product: Product;
  quantity: number;
  status: "pending" | "paid";
  extraCents?: number;
  customerPhone?: string;
  customerName?: string;
  notes?: string;
}): Promise<Sale> {
  if (input.status === "pending") {
    const { canAddFiadoThisMonth } = await import("./plan");
    if (!(await canAddFiadoThisMonth())) {
      throw new Error("PLAN_LIMIT_FIADO");
    }
  }
  const now = nowIso();
  const qty = Math.max(1, Math.floor(input.quantity));
  const extraCents = input.extraCents ?? 0;
  const base = input.product.priceCents * qty;
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
  return next;
}

export async function cancelSale(id: string): Promise<void> {
  const sale = await db.sales.get(id);
  if (!sale || sale.status === "cancelled") return;
  const now = nowIso();
  await db.transaction("rw", db.sales, db.products, async () => {
    await db.sales.put({ ...sale, status: "cancelled", updatedAt: now, dirty: true });
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
  scheduleSync();
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
  return created;
}

export async function activatePro(): Promise<Settings> {
  return saveSettings({ plan: "pro" });
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
