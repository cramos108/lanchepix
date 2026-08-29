import { db, ensureSettings } from "./db";
import { nowIso } from "./id";
import { supabase, supabaseConfigured } from "./supabase";
import type { Settings } from "./types";

export const PAIR_OWNER_KEY = "pair_owner_id";
export const PAIR_NAME_KEY = "pair_attendant_name";
export const PAIR_HIDE_KEY = "pair_hide_store_totals";
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
};

function randomCode(): string {
  return String(100000 + Math.floor(Math.random() * 900000));
}

function parseMetadata(raw?: string | null): {
  store_name?: string;
  expires_at?: string;
  hide_store_totals?: boolean;
} {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as {
      store_name?: string;
      expires_at?: string;
      hide_store_totals?: boolean;
    };
    return value && typeof value === "object" ? value : {};
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
): void {
  const map = readFallbackMap();
  map[code] = {
    owner_id: ownerId,
    store_name: storeName,
    expires_at: expiresAt,
    hide_store_totals: hideStoreTotals,
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
): void {
  try {
    localStorage.setItem(PAIR_OWNER_KEY, ownerId);
    localStorage.setItem(PAIR_NAME_KEY, attendantName);
    localStorage.setItem(PAIR_HIDE_KEY, hideStoreTotals ? "true" : "false");
  } catch {
    /* private mode */
  }
}

export async function restorePairFromLocal(): Promise<void> {
  const settings = await ensureSettings();
  if (settings.pairedOwnerId) return;
  try {
    const owner = localStorage.getItem(PAIR_OWNER_KEY);
    const name = localStorage.getItem(PAIR_NAME_KEY) ?? "";
    const hide = localStorage.getItem(PAIR_HIDE_KEY);
    if (!owner) return;
    await db.settings.put({
      ...settings,
      pairedOwnerId: owner,
      attendantName: name || settings.attendantName,
      deviceRole: "attendant",
      hideStoreTotals: hide !== "false",
      plan: "equipe",
      dirty: false,
    });
  } catch {
    /* private mode */
  }
}

export function clearPairLocal(): void {
  try {
    localStorage.removeItem(PAIR_OWNER_KEY);
    localStorage.removeItem(PAIR_NAME_KEY);
    localStorage.removeItem(PAIR_HIDE_KEY);
  } catch {
    /* private mode */
  }
}

export async function createPairingCode(): Promise<{
  code: string;
  expiresAt: string;
  url: string;
}> {
  const settings = await ensureSettings();
  const expiresAt = new Date(Date.now() + PAIR_TTL_MS).toISOString();
  const code = randomCode();
  const ownerId = settings.vendorId;
  const storeName = settings.storeName || "Meu negócio";
  const hideStoreTotals = settings.hideStoreTotals !== false;
  const metadata = JSON.stringify({
    store_name: storeName,
    expires_at: expiresAt,
    hide_store_totals: hideStoreTotals,
  });

  try {
    if (!supabaseConfigured) throw new Error("Supabase não configurado");
    const payload = { code, owner_id: ownerId };
    const first = await supabase.from("pairing_codes").insert({ ...payload, metadata });
    if (first.error) {
      const second = await supabase.from("pairing_codes").insert(payload);
      if (second.error) throw second.error;
    }
  } catch (err) {
    console.error("Pairing code insert failed, using local fallback:", err);
    saveLocalFallback(code, ownerId, storeName, expiresAt, hideStoreTotals);
  }

  saveLocalFallback(code, ownerId, storeName, expiresAt, hideStoreTotals);
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

  try {
    if (!supabaseConfigured) throw new Error("Supabase não configurado");
    let query = await supabase
      .from("pairing_codes")
      .select("code, owner_id, metadata")
      .eq("code", code)
      .maybeSingle();
    if (query.error) {
      query = await supabase
        .from("pairing_codes")
        .select("code, owner_id")
        .eq("code", code)
        .maybeSingle();
    }
    if (query.error) throw query.error;
    const row = query.data as PairingCodeRow | null;
    if (!row?.owner_id) throw new Error("Código não encontrado.");
    ownerId = row.owner_id;
    const extra = parseMetadata(row.metadata);
    storeName = extra.store_name ?? "";
    expiresAt = extra.expires_at ?? "";
    hideStoreTotals = extra.hide_store_totals !== false;
  } catch (err) {
    console.error("Pairing code select failed, trying local fallback:", err);
    const local = lookupLocalFallback(code);
    if (!local) {
      throw err instanceof Error ? err : new Error("Código não encontrado.");
    }
    ownerId = local.owner_id;
    storeName = local.store_name;
    expiresAt = local.expires_at;
    hideStoreTotals = local.hide_store_totals !== false;
  }

  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
    throw new Error("Este código expirou. Peça um novo ao dono do negócio.");
  }

  const settings = await ensureSettings();
  const next: Settings = {
    ...settings,
    pairedOwnerId: ownerId,
    attendantName: name,
    deviceRole: "attendant",
    hideStoreTotals,
    plan: "equipe",
    storeName: storeName || settings.storeName,
    updatedAt: nowIso(),
    dirty: false,
  };
  await db.settings.put(next);
  persistPairLocal(ownerId, name, hideStoreTotals);
  try {
    const { persistActivePlan } = await import("./plan");
    persistActivePlan("negocio");
  } catch {
    /* ignore */
  }
  const { pushAndPull } = await import("./sync");
  await pushAndPull();
  return next;
}

export async function disconnectAttendant(): Promise<Settings> {
  const settings = await ensureSettings();
  const next: Settings = {
    ...settings,
    pairedOwnerId: undefined,
    deviceRole: "owner",
    updatedAt: nowIso(),
    dirty: false,
  };
  await db.settings.put(next);
  clearPairLocal();
  return next;
}
