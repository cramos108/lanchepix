import type { Sale, Settings } from "./types";

export type StaffRole = "dono" | "gerente" | "ajudante";

export function accountVendorId(
  settings?: Pick<Settings, "vendorId" | "pairedOwnerId"> | null,
): string {
  return settings?.pairedOwnerId || settings?.vendorId || "";
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
