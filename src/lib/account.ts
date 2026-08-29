import type { Sale, Settings } from "./types";

export type StaffRole = "dono" | "gerente" | "ajudante";

export const LINKED_OWNER_KEY = "linked_owner_id";
export const ATTENDANT_NAME_LS_KEY = "attendant_name";
export const USER_ROLE_KEY = "user_role";
export const PAIR_OWNER_KEY = "pair_owner_id";
export const PAIR_NAME_KEY = "pair_attendant_name";

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

export function accountVendorId(
  settings?: Pick<Settings, "vendorId" | "pairedOwnerId"> | null,
): string {
  return getActiveOwnerId(settings);
}

export function staffRole(
  settings?: Pick<Settings, "deviceRole" | "pairedOwnerId"> | null,
): StaffRole {
  const role = settings?.deviceRole;
  if (role === "gerente") return "gerente";
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

export function canPairDevices(
  settings?: Pick<Settings, "deviceRole" | "pairedOwnerId"> | null,
): boolean {
  const role = staffRole(settings);
  return role === "dono" || role === "gerente";
}

export function canSeeFinances(
  settings?: Pick<Settings, "deviceRole" | "pairedOwnerId"> | null,
): boolean {
  return staffRole(settings) === "dono";
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
  if (role === "dono") return false;
  if (role === "gerente") return true;
  return isAttendantDevice(settings) && settings.hideStoreTotals !== false;
}

export function visibleSalesForDevice(
  sales: Sale[] | undefined,
  settings?: Settings | null,
): Sale[] {
  const list = sales ?? [];
  if (staffRole(settings) !== "ajudante") return list;
  const name = settings?.attendantName?.trim() ?? "";
  if (!name) return [];
  return list.filter((s) => (s.attendantName ?? "").trim() === name);
}
