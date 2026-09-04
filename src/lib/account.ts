import type { Sale, Settings } from "./types";

export type StaffRole = "dono" | "gerente" | "ajudante";

export const LINKED_OWNER_KEY = "linked_owner_id";
export const ATTENDANT_NAME_LS_KEY = "attendant_name";
export const USER_ROLE_KEY = "user_role";
export const PAIR_OWNER_KEY = "pair_owner_id";
export const PAIR_NAME_KEY = "pair_attendant_name";
export const CHEFE_PIX_KEY = "pix_confianca_chefe_key";
const LEGACY_CHEFE_PIX_KEY = "chefe_pix_key";

function readLs(key: string): string {
  try {
    return localStorage.getItem(key)?.trim() || "";
  } catch {
    return "";
  }
}

/**
 * Store id for ALL products/sales/loyalty queries.
 * `linked_owner_id` always overrides this device's local vendor id.
 */
export function getActiveOwnerId(
  settings?: Pick<Settings, "vendorId" | "pairedOwnerId"> | null,
): string {
  const linked = readLs(LINKED_OWNER_KEY);
  if (linked) return linked;
  const legacy = readLs(PAIR_OWNER_KEY);
  if (legacy) {
    try {
      localStorage.setItem(LINKED_OWNER_KEY, legacy);
    } catch {
      /* private mode */
    }
    return legacy;
  }
  return settings?.pairedOwnerId || settings?.vendorId || "";
}

export function getAttendantNameLocal(
  settings?: Pick<Settings, "attendantName"> | null,
): string {
  return (
    readLs(ATTENDANT_NAME_LS_KEY) ||
    readLs(PAIR_NAME_KEY) ||
    settings?.attendantName?.trim() ||
    ""
  );
}

/** Snapshot of the Pix key already stored on this device. No listeners. */
export function readLocalPixKey(
  settings?: Pick<Settings, "pixKey"> | null,
): string {
  return resolveActivePixKey(settings);
}

/**
 * localChavePix || session.chefe_chave_pix || session.master_chave_pix
 * Passive read only — no live sync.
 */
export function resolveActivePixKey(
  settings?: Pick<Settings, "pixKey"> | null,
  masterPixKey?: string | null,
): string {
  const localChavePix = String(settings?.pixKey ?? "").trim();
  const chefeChavePix =
    readLs(CHEFE_PIX_KEY) || readLs(LEGACY_CHEFE_PIX_KEY);
  const masterChavePix = String(masterPixKey ?? "").trim();
  return localChavePix || chefeChavePix || masterChavePix;
}

/** Cache Chefe Pix key once (pairing / one-shot settings fetch). Not a live listener. */
export function cacheChefePixKey(pixKey?: string | null): void {
  const key = String(pixKey ?? "").trim();
  if (!key) return;
  try {
    localStorage.setItem(CHEFE_PIX_KEY, key);
    localStorage.setItem(LEGACY_CHEFE_PIX_KEY, key);
  } catch {
    /* private mode */
  }
}

export function accountVendorId(
  settings?: Pick<Settings, "vendorId" | "pairedOwnerId"> | null,
): string {
  return getActiveOwnerId(settings);
}

export function staffRole(
  settings?: Pick<Settings, "deviceRole" | "pairedOwnerId"> | null,
): StaffRole {
  const fromLs =
    readLs(USER_ROLE_KEY) ||
    readLs("pair_staff_role") ||
    readLs("device_role") ||
    readLs("staff_role");
  const role = settings?.deviceRole || fromLs;
  if (role === "gerente" || fromLs === "gerente") return "gerente";
  if (role === "ajudante" || role === "attendant") return "ajudante";
  if (role === "dono" || role === "owner" || !settings?.pairedOwnerId) return "dono";
  return "ajudante";
}

export function staffRoleLabel(role: StaffRole): string {
  if (role === "gerente") return "Gerente";
  if (role === "ajudante") return "Ajudante";
  return "Dono";
}

export function isOwnerDevice(
  settings?: Pick<Settings, "deviceRole" | "pairedOwnerId"> | null,
): boolean {
  return staffRole(settings) === "dono";
}

export function isManagerDevice(
  settings?: Pick<Settings, "deviceRole" | "pairedOwnerId"> | null,
): boolean {
  return staffRole(settings) === "gerente";
}

/** Paired sales assistant (not gerente, not dono). */
export function isAttendantDevice(
  settings?: Pick<Settings, "deviceRole" | "pairedOwnerId"> | null,
): boolean {
  return staffRole(settings) === "ajudante" && Boolean(settings?.pairedOwnerId);
}

export function isStaffDevice(
  settings?: Pick<Settings, "deviceRole" | "pairedOwnerId"> | null,
): boolean {
  return staffRole(settings) !== "dono";
}

export function canEditCatalog(
  settings?: Pick<Settings, "deviceRole" | "pairedOwnerId"> | null,
): boolean {
  const role = staffRole(settings);
  return role === "dono" || role === "gerente";
}

export function canEditPrices(
  settings?: Pick<Settings, "deviceRole" | "pairedOwnerId" | "allowHelperEditPrices"> | null,
): boolean {
  const role = staffRole(settings);
  if (role === "dono" || role === "gerente") return true;
  return settings?.allowHelperEditPrices === true;
}

export function canPairDevices(
  settings?: Pick<Settings, "deviceRole" | "pairedOwnerId"> | null,
): boolean {
  const role = staffRole(settings);
  return role === "dono" || role === "gerente";
}

export function canSeeFinances(
  settings?: Pick<Settings, "deviceRole" | "pairedOwnerId"> | null,
): boolean {
  const role = staffRole(settings);
  return role === "dono" || role === "gerente";
}

export function canEditBilling(
  settings?: Pick<Settings, "deviceRole" | "pairedOwnerId"> | null,
): boolean {
  return staffRole(settings) === "dono";
}

/** Ajudante: only own sales. Gerente/Dono: all sales (finances still gated in UI). */
export function helperHidesStoreTotals(
  settings?: Pick<Settings, "deviceRole" | "pairedOwnerId" | "hideStoreTotals"> | null,
): boolean {
  if (!settings) return false;
  const role = staffRole(settings);
  if (role === "dono" || role === "gerente") return false;
  return isAttendantDevice(settings) && settings.hideStoreTotals !== false;
}

export function saleSellerName(sale: {
  attendantName?: string;
  notes?: string;
}): string {
  const named = sale.attendantName?.trim();
  if (named) return named;
  const fromNotes = sale.notes?.match(/(?:Vendido por|Ajudante):\s*(.+?)(?:\s·|$)/i);
  return fromNotes?.[1]?.trim() || "";
}

export function getLocalDeviceId(
  settings?: Pick<Settings, "vendorId"> | null,
): string {
  return readLs("device_id") || settings?.vendorId || "";
}

export function visibleSalesForDevice(
  sales: Sale[] | undefined,
  settings?: Settings | null,
): Sale[] {
  const list = sales ?? [];
  const role = staffRole(settings);
  if (role === "dono" || role === "gerente") return list;
  const name =
    getAttendantNameLocal(settings) || settings?.attendantName?.trim() || "";
  const deviceId = getLocalDeviceId(settings);
  return list.filter((s) => {
    if (name && saleSellerName(s) === name) return true;
    if (deviceId && (s.notes ?? "").includes(`device:${deviceId}`)) return true;
    return false;
  });
}
