import { db, ensureSettings } from "./db";
import { nowIso } from "./id";
import { supabase, supabaseConfigured } from "./supabase";
import type { Settings } from "./types";

export const PAIR_OWNER_KEY = "pair_owner_id";
export const PAIR_NAME_KEY = "pair_attendant_name";
const PAIR_TTL_MS = 24 * 60 * 60 * 1000;

export type PairingCodeRow = {
  code: string;
  owner_vendor_id: string;
  store_name: string;
  expires_at: string;
  created_at: string;
};

function randomCode(): string {
  return String(100000 + Math.floor(Math.random() * 900000));
}

export function inviteUrl(code: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://pixdaconfianca.com";
  return `${origin}/?pair_code=${code}`;
}

export function persistPairLocal(ownerId: string, attendantName: string): void {
  try {
    localStorage.setItem(PAIR_OWNER_KEY, ownerId);
    localStorage.setItem(PAIR_NAME_KEY, attendantName);
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
    if (!owner) return;
    await db.settings.put({
      ...settings,
      pairedOwnerId: owner,
      attendantName: name || settings.attendantName,
      deviceRole: "attendant",
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
  } catch {
    /* private mode */
  }
}

export async function createPairingCode(): Promise<{
  code: string;
  expiresAt: string;
  url: string;
}> {
  if (!supabaseConfigured) {
    throw new Error("Sem conexão com o servidor. Tente com internet.");
  }
  const settings = await ensureSettings();
  const expiresAt = new Date(Date.now() + PAIR_TTL_MS).toISOString();
  let lastError = "Não deu para gerar o código.";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = randomCode();
    const { error } = await supabase.from("pairing_codes").upsert({
      code,
      owner_vendor_id: settings.vendorId,
      store_name: settings.storeName || "Meu negócio",
      expires_at: expiresAt,
      created_at: nowIso(),
    });
    if (!error) {
      return { code, expiresAt, url: inviteUrl(code) };
    }
    lastError = error.message;
  }
  throw new Error(lastError);
}

export async function redeemPairingCode(
  rawCode: string,
  attendantName: string,
): Promise<Settings> {
  if (!supabaseConfigured) {
    throw new Error("Sem conexão com o servidor. Tente com internet.");
  }
  const code = rawCode.replace(/\D/g, "").slice(0, 6);
  const name = attendantName.trim();
  if (code.length !== 6) throw new Error("Digite o código de 6 dígitos.");
  if (name.length < 2) throw new Error("Digite o nome do ajudante / banca.");

  const { data, error } = await supabase
    .from("pairing_codes")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as PairingCodeRow | null;
  if (!row) throw new Error("Código não encontrado.");
  if (new Date(row.expires_at).getTime() < Date.now()) {
    throw new Error("Este código expirou. Peça um novo ao dono do negócio.");
  }

  const settings = await ensureSettings();
  const next: Settings = {
    ...settings,
    pairedOwnerId: row.owner_vendor_id,
    attendantName: name,
    deviceRole: "attendant",
    storeName: row.store_name || settings.storeName,
    updatedAt: nowIso(),
    dirty: false,
  };
  await db.settings.put(next);
  persistPairLocal(row.owner_vendor_id, name);
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
