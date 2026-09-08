import { APP_NAME } from "@/lib/brand";

export const DEFAULT_QR_FOOTER =
  `${APP_NAME} • Escaneie e fale no WhatsApp para pagar no Pix!`;

export function normalizeInstagramHandle(raw: string): string {
  let value = raw.trim();
  value = value.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "");
  value = value.replace(/[/?].*$/, "");
  value = value.replace(/^@+/, "");
  value = value.replace(/[^a-zA-Z0-9._]/g, "");
  return value ? `@${value}` : "";
}
