import {
  ATTENDANT_NAME_LS_KEY,
  cacheChefePixKey,
  CHEFE_PIX_KEY,
  LINKED_OWNER_KEY,
  PAIR_NAME_KEY,
  PAIR_OWNER_KEY,
  USER_ROLE_KEY,
  type StaffRole,
} from "./account";
import { db, ensureSettings } from "./db";
import { nowIso } from "./id";
import { supabase, supabaseConfigured } from "./supabase";
import type { Settings } from "./types";

export { PAIR_OWNER_KEY, PAIR_NAME_KEY, LINKED_OWNER_KEY, ATTENDANT_NAME_LS_KEY };
export const PAIR_HIDE_KEY = "pair_hide_store_totals";
export const PAIR_ROLE_KEY = "pair_staff_role";
export const PAIR_PRICES_KEY = "pair_allow_helper_edit_prices";
const PAIR_FALLBACK_KEY = "pair_codes_fallback";
const PAIR_TTL_MS = 24 * 60 * 60 * 1000;

const joinListeners = new Set<() => void>();

export function openPairingJoinModal(): void {
  joinListeners.forEach((l) => l());
}

export function subscribePairingJoinModal(listener: () => void): () => void {
  joinListeners.add(listener);
  return () => joinListeners.delete(listener);
}

type PairingCodeRow = {
  code: string;
  owner_id: string;
  metadata?: string | null;
};

type FallbackEntry = {
  owner_id: string;
  store_name: string;
  expires_at: string;
  hide_store_totals: boolean;
  allow_helper_edit_prices: boolean;
  role: StaffRole;
  pix_key?: string;
  chave_pix?: string;
};

function normalizePairRole(value?: string | null): StaffRole {
  if (value === "gerente") return "gerente";
  if (value === "dono" || value === "owner") return "dono";
  return "ajudante";
}

function randomCode(): string {
  return String(100000 + Math.floor(Math.random() * 900000));
}

function parseMetadata(raw?: string | null): {
  store_name?: string;
  expires_at?: string;
  hide_store_totals?: boolean;
  allow_helper_edit_prices?: boolean;
  role?: StaffRole;
  pix_key?: string;
  chave_pix?: string;
} {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as {
      store_name?: string;
      expires_at?: string;
      hide_store_totals?: boolean;
      allow_helper_edit_prices?: boolean;
      role?: string;
      pix_key?: string;
      chave_pix?: string;
    };
    if (!value || typeof value !== "object") return {};
    return { ...value, role: normalizePairRole(value.role) };
  } catch {
    return {};
  }
}

function readFallbackMap(): Record<string, FallbackEntry> {
  try {
    const raw = localStorage.getItem(PAIR_FALLBACK_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, FallbackEntry>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeFallbackMap(map: Record<string, FallbackEntry>): void {
  try {
    localStorage.setItem(PAIR_FALLBACK_KEY, JSON.stringify(map));
  } catch {
    /* private mode */
  }
}

function saveLocalFallback(
  code: string,
  ownerId: string,
  storeName: string,
  expiresAt: string,
  hideStoreTotals: boolean,
  role: StaffRole,
  allowHelperEditPrices = false,
  pixKey = "",
): void {
  const map = readFallbackMap();
  map[code] = {
    owner_id: ownerId,
    store_name: storeName,
    expires_at: expiresAt,
    hide_store_totals: hideStoreTotals,
    allow_helper_edit_prices: allowHelperEditPrices,
    role,
    pix_key: pixKey,
    chave_pix: pixKey,
  };
  writeFallbackMap(map);
}

function lookupLocalFallback(code: string): FallbackEntry | null {
  return readFallbackMap()[code] ?? null;
}

export function inviteUrl(code: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://pixdaconfianca.com";
  return `${origin}/?pair_code=${code}`;
}

export function persistPairLocal(
  ownerId: string,
  attendantName: string,
  hideStoreTotals: boolean,
  role: StaffRole,
  allowHelperEditPrices = false,
): void {
  try {
    localStorage.setItem(LINKED_OWNER_KEY, ownerId);
    localStorage.setItem(PAIR_OWNER_KEY, ownerId);
    localStorage.setItem(PAIR_NAME_KEY, attendantName);
    localStorage.setItem(ATTENDANT_NAME_LS_KEY, attendantName);
    localStorage.setItem(PAIR_HIDE_KEY, hideStoreTotals ? "true" : "false");
    localStorage.setItem(PAIR_PRICES_KEY, allowHelperEditPrices ? "true" : "false");
    localStorage.setItem(PAIR_ROLE_KEY, role);
    localStorage.setItem(USER_ROLE_KEY, role);
    localStorage.setItem("device_role", role);
    localStorage.setItem("staff_role", role);
  } catch {
    /* private mode */
  }
}

async function upsertDeviceSession(
  deviceId: string,
  ownerId: string,
  role: StaffRole,
  attendantName: string,
): Promise<void> {
  if (!supabaseConfigured || !deviceId || !ownerId) return;
  const row = {
    device_id: deviceId,
    owner_id: ownerId,
    role,
    attendant_name: attendantName,
    updated_at: nowIso(),
  };
  const first = await supabase.from("device_sessions").upsert(row);
  if (first.error) {
    await supabase.from("device_sessions").upsert({
      device_id: deviceId,
      owner_id: ownerId,
      role,
    });
  }
}

export async function restorePairFromLocal(): Promise<void> {
  const settings = await ensureSettings();
  try {
    const owner =
      localStorage.getItem(LINKED_OWNER_KEY) ||
      localStorage.getItem(PAIR_OWNER_KEY) ||
      settings.pairedOwnerId ||
      "";
    const name =
      localStorage.getItem(ATTENDANT_NAME_LS_KEY) ||
      localStorage.getItem(PAIR_NAME_KEY) ||
      "";
    const hide = localStorage.getItem(PAIR_HIDE_KEY);
    const prices = localStorage.getItem(PAIR_PRICES_KEY);
    const role = normalizePairRole(
      localStorage.getItem(PAIR_ROLE_KEY) ||
        localStorage.getItem(USER_ROLE_KEY) ||
        localStorage.getItem("device_role"),
    );
    if (!owner && !settings.pairedOwnerId) return;
    const nextRole: StaffRole =
      role === "gerente" || settings.deviceRole === "gerente" ? "gerente" : role || "ajudante";
    const linked = owner || settings.pairedOwnerId || "";
    if (!linked) return;
    persistPairLocal(
      linked,
      name || settings.attendantName || "",
      nextRole === "gerente" ? false : hide !== "false",
      nextRole,
      prices === "true" || settings.allowHelperEditPrices === true,
    );
    try {
      localStorage.setItem("device_id", settings.vendorId);
    } catch {
      /* private mode */
    }
    if (
      settings.pairedOwnerId === linked &&
      settings.deviceRole === nextRole &&
      (nextRole !== "gerente" || settings.hideStoreTotals === false)
    ) {
      return;
    }
    await db.settings.put({
      ...settings,
      pairedOwnerId: linked,
      attendantName: name || settings.attendantName,
      deviceRole: nextRole,
      hideStoreTotals: nextRole === "gerente" ? false : hide !== "false",
      allowHelperEditPrices: prices === "true" || settings.allowHelperEditPrices,
      plan: "equipe",
      dirty: false,
    });
  } catch {
    /* private mode */
  }
}

export function clearPairLocal(): void {
  try {
    localStorage.removeItem(LINKED_OWNER_KEY);
    localStorage.removeItem(PAIR_OWNER_KEY);
    localStorage.removeItem(PAIR_NAME_KEY);
    localStorage.removeItem(ATTENDANT_NAME_LS_KEY);
    localStorage.removeItem(PAIR_HIDE_KEY);
    localStorage.removeItem(PAIR_PRICES_KEY);
    localStorage.removeItem(PAIR_ROLE_KEY);
    localStorage.removeItem(USER_ROLE_KEY);
    localStorage.removeItem("device_role");
    localStorage.removeItem("staff_role");
    localStorage.removeItem(CHEFE_PIX_KEY);
    localStorage.removeItem("chefe_pix_key");
  } catch {
    /* private mode */
  }
}

export async function createPairingCode(
  role: StaffRole = "ajudante",
): Promise<{
  code: string;
  expiresAt: string;
  url: string;
}> {
  const settings = await ensureSettings();
  const expiresAt = new Date(Date.now() + PAIR_TTL_MS).toISOString();
  const code = randomCode();
  const ownerId = settings.vendorId;
  const storeName = settings.storeName || "Meu negócio";
  const assignedRole: StaffRole = role === "gerente" ? "gerente" : "ajudante";
  const hideStoreTotals =
    assignedRole === "gerente" ? false : settings.hideStoreTotals !== false;
  const allowHelperEditPrices = settings.allowHelperEditPrices === true;
  const pixKey = String(settings.pixKey ?? "").trim();
  const metadata = JSON.stringify({
    store_name: storeName,
    expires_at: expiresAt,
    hide_store_totals: hideStoreTotals,
    allow_helper_edit_prices: allowHelperEditPrices,
    role: assignedRole,
    pix_key: pixKey,
    chave_pix: pixKey,
  });

  try {
    if (!supabaseConfigured) throw new Error("Supabase não configurado");
    const payload = { code, owner_id: ownerId };
    const withRole = await supabase
      .from("pairing_codes")
      .insert({ ...payload, metadata, role: assignedRole });
    if (withRole.error) {
      const withMeta = await supabase.from("pairing_codes").insert({ ...payload, metadata });
      if (withMeta.error) {
        const second = await supabase.from("pairing_codes").insert(payload);
        if (second.error) throw second.error;
      }
    }
  } catch (err) {
    console.error("Pairing code insert failed, using local fallback:", err);
    saveLocalFallback(
      code,
      ownerId,
      storeName,
      expiresAt,
      hideStoreTotals,
      assignedRole,
      allowHelperEditPrices,
      pixKey,
    );
  }

  saveLocalFallback(
    code,
    ownerId,
    storeName,
    expiresAt,
    hideStoreTotals,
    assignedRole,
    allowHelperEditPrices,
    pixKey,
  );
  return { code, expiresAt, url: inviteUrl(code) };
}

export async function redeemPairingCode(
  rawCode: string,
  attendantName: string,
): Promise<Settings> {
  const code = rawCode.replace(/\D/g, "").slice(0, 6);
  const name = attendantName.trim();
  if (code.length !== 6) throw new Error("Digite o código de 6 dígitos.");
  if (name.length < 2) throw new Error("Digite o nome do ajudante / banca.");

  let ownerId = "";
  let storeName = "";
  let expiresAt = "";
  let hideStoreTotals = true;
  let allowHelperEditPrices = false;
  let role: StaffRole = "ajudante";
  let pixKeyFromCode = "";

  try {
    if (!supabaseConfigured) throw new Error("Supabase não configurado");
    let query = await supabase
      .from("pairing_codes")
      .select("code, owner_id, metadata, role")
      .eq("code", code)
      .maybeSingle();
    if (query.error) {
      query = await supabase
        .from("pairing_codes")
        .select("code, owner_id, metadata")
        .eq("code", code)
        .maybeSingle();
    }
    if (query.error) {
      query = await supabase
        .from("pairing_codes")
        .select("code, owner_id")
        .eq("code", code)
        .maybeSingle();
    }
    if (query.error) throw query.error;
    const row = query.data as (PairingCodeRow & { role?: string | null }) | null;
    if (!row?.owner_id) throw new Error("Código não encontrado.");
    ownerId = row.owner_id;
    const extra = parseMetadata(row.metadata);
    storeName = extra.store_name ?? "";
    expiresAt = extra.expires_at ?? "";
    allowHelperEditPrices = extra.allow_helper_edit_prices === true;
    role = normalizePairRole(row.role || extra.role);
    hideStoreTotals =
      role === "gerente" ? false : extra.hide_store_totals !== false;
    pixKeyFromCode = String(extra.chave_pix || extra.pix_key || "").trim();
  } catch (err) {
    console.error("Pairing code select failed, trying local fallback:", err);
    const local = lookupLocalFallback(code);
    if (!local) {
      throw err instanceof Error ? err : new Error("Código não encontrado.");
    }
    ownerId = local.owner_id;
    storeName = local.store_name;
    expiresAt = local.expires_at;
    allowHelperEditPrices = local.allow_helper_edit_prices === true;
    role = local.role === "gerente" ? "gerente" : "ajudante";
    hideStoreTotals = role === "gerente" ? false : local.hide_store_totals !== false;
    pixKeyFromCode = String(local.chave_pix || local.pix_key || "").trim();
  }

  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
    throw new Error("Este código expirou. Peça um novo ao dono do negócio.");
  }

  const settings = await ensureSettings();
  const next: Settings = {
    ...settings,
    pairedOwnerId: ownerId,
    attendantName: name,
    deviceRole: role === "gerente" ? "gerente" : "ajudante",
    hideStoreTotals: role === "gerente" ? false : hideStoreTotals,
    allowHelperEditPrices,
    plan: "equipe",
    storeName: storeName || settings.storeName,
    pixKey: pixKeyFromCode || settings.pixKey,
    updatedAt: nowIso(),
    dirty: false,
  };
  if (pixKeyFromCode) cacheChefePixKey(pixKeyFromCode);
  persistPairLocal(
    ownerId,
    name,
    next.hideStoreTotals === true,
    next.deviceRole === "gerente" ? "gerente" : "ajudante",
    allowHelperEditPrices,
  );
  try {
    localStorage.setItem("device_id", settings.vendorId);
  } catch {
    /* private mode */
  }
  void upsertDeviceSession(
    settings.vendorId,
    ownerId,
    next.deviceRole === "gerente" ? "gerente" : "ajudante",
    name,
  );
  await db.transaction("rw", db.products, db.sales, db.customers, db.settings, async () => {
    await db.products.clear();
    await db.sales.clear();
    await db.customers.clear();
    await db.settings.put(next);
  });
  try {
    const { persistActivePlan } = await import("./plan");
    persistActivePlan("negocio");
  } catch {
    /* ignore */
  }
  const { pushAndPull, refetchOwnerSettings, refetchOwnerProducts } = await import("./sync");
  await pushAndPull();
  const inherited = await refetchOwnerSettings().catch(() => undefined);
  if (inherited?.pixKey) cacheChefePixKey(inherited.pixKey);
  await refetchOwnerProducts().catch(() => undefined);
  return inherited ?? next;
}

export async function disconnectAttendant(): Promise<Settings> {
  const settings = await ensureSettings();
  clearPairLocal();
  try {
    const { persistActivePlan } = await import("./plan");
    persistActivePlan("free");
  } catch {
    /* ignore */
  }
  const next: Settings = {
    ...settings,
    pairedOwnerId: undefined,
    deviceRole: "dono",
    attendantName: "",
    hideStoreTotals: true,
    plan: "free",
    updatedAt: nowIso(),
    dirty: false,
  };
  await db.transaction("rw", db.products, db.sales, db.customers, db.settings, async () => {
    await db.products.clear();
    await db.sales.clear();
    await db.customers.clear();
    await db.settings.put(next);
  });
  if (typeof window !== "undefined") {
    window.location.reload();
  }
  return next;
}
