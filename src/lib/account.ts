import type { Sale, Settings } from "./types";

export function accountVendorId(
  settings?: Pick<Settings, "vendorId" | "pairedOwnerId"> | null,
): string {
  return settings?.pairedOwnerId || settings?.vendorId || "";
}

export function isAttendantDevice(
  settings?: Pick<Settings, "deviceRole" | "pairedOwnerId"> | null,
): boolean {
  return settings?.deviceRole === "attendant" && Boolean(settings.pairedOwnerId);
}

/** Default ON for privacy: helpers do not see banca-wide totals. */
export function helperHidesStoreTotals(
  settings?: Pick<Settings, "deviceRole" | "pairedOwnerId" | "hideStoreTotals"> | null,
): boolean {
  return isAttendantDevice(settings) && settings?.hideStoreTotals !== false;
}

export function visibleSalesForDevice(
  sales: Sale[] | undefined,
  settings?: Settings | null,
): Sale[] {
  const list = sales ?? [];
  if (!helperHidesStoreTotals(settings)) return list;
  const name = settings?.attendantName?.trim() ?? "";
  if (!name) return [];
  return list.filter((s) => (s.attendantName ?? "").trim() === name);
}
