import { formatPixAmount } from "./money";

function tlv(id: string, value: string): string {
  const length = value.length.toString().padStart(2, "0");
  return `${id}${length}${value}`;
}

/** CRC-16/CCITT-FALSE (polinômio 0x1021, init 0xFFFF). */
export function crc16ccitt(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function pixText(value: string, max: number): string {
  return stripAccents(value)
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Normaliza chave Pix (telefone vira +55..., e-mail em minúsculas). */
export function normalizePixKey(raw: string): string {
  const key = raw.trim();
  if (!key) return "";
  if (key.includes("@")) return key.toLowerCase();
  const digits = key.replace(/\D/g, "");
  if (digits.length === 11 && !key.includes("-")) return digits;
  if (digits.length === 14 && !key.includes("-")) return digits;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  if (digits.length === 12 || digits.length === 13) {
    return digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
  }
  return key;
}

export function detectPixKeyType(key: string): string {
  const k = key.trim();
  if (!k) return "Não informada";
  if (k.includes("@")) return "E-mail";
  const digits = k.replace(/\D/g, "");
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k)) {
    return "Chave aleatória";
  }
  if (digits.length === 11 && !k.startsWith("+")) return "CPF";
  if (digits.length === 14) return "CNPJ";
  if (k.startsWith("+") || digits.length === 12 || digits.length === 13) return "Celular";
  return "Chave Pix";
}

export type PixPayloadInput = {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amountCents?: number;
  txid?: string;
  description?: string;
};

/**
 * Payload EMV BR Code estático (Copia e Cola) conforme Manual do Pix / BR Code.
 * QR estático (Point of Initiation Method = 11).
 */
export function buildPixPayload(input: PixPayloadInput): string {
  const pixKey = normalizePixKey(input.pixKey);
  if (!pixKey) throw new Error("Informe a chave Pix nas configurações.");

  const name = pixText(input.merchantName || "MEU LANCHE", 25) || "MEU LANCHE";
  const city = pixText(input.merchantCity || "SAO PAULO", 15) || "SAO PAULO";
  const txid = (input.txid ?? "***").replace(/[^A-Za-z0-9*]/g, "").slice(0, 25) || "***";

  let merchantAccount = tlv("00", "br.gov.bcb.pix") + tlv("01", pixKey);
  if (input.description) {
    const info = pixText(input.description, 25);
    if (info) merchantAccount += tlv("02", info);
  }

  let payload = "";
  payload += tlv("00", "01");
  payload += tlv("01", "11");
  payload += tlv("26", merchantAccount);
  payload += tlv("52", "0000");
  payload += tlv("53", "986");
  if (typeof input.amountCents === "number" && input.amountCents > 0) {
    payload += tlv("54", formatPixAmount(input.amountCents));
  }
  payload += tlv("58", "BR");
  payload += tlv("59", name);
  payload += tlv("60", city);
  payload += tlv("62", tlv("05", txid));
  payload += "6304";
  return payload + crc16ccitt(payload);
}
