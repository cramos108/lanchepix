import type { Settings } from "./types";

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
