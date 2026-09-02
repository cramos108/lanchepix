export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Dígitos nacionais (DDD + número), sem o 55. */
export function nationalDigits(phone: string): string {
  let digits = digitsOnly(phone);
  if (digits.startsWith("55") && digits.length >= 12) {
    digits = digits.slice(2);
  }
  return digits;
}

export function formatBrPhone(phone: string): string {
  const digits = nationalDigits(phone);
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 0) return "";
  return digits;
}

/** Número no formato wa.me: 55 + DDD + número (cliente BR). */
export function toWhatsAppNumber(phone: string): string {
  const national = nationalDigits(phone);
  if (national.length === 10 || national.length === 11) return `55${national}`;
  const digits = digitsOnly(phone);
  return digits;
}

/** WhatsApp da banca: dígitos com código do país (ex: 5511… ou 1352…). */
export function cleanWhatsAppNumber(phone: string): string {
  const digits = digitsOnly(phone).slice(0, 15);
  if (!digits) return "";
  if (digits.length >= 12) return digits;
  if (digits.length === 11 && digits.startsWith("1")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

/** Input livre com código do país — sem máscara (XX) XXXXX-XXXX. */
export function maskWhatsAppContactInput(value: string): string {
  const plus = value.trim().startsWith("+") || value.startsWith("+");
  const digits = digitsOnly(value).slice(0, 15);
  if (!digits) return plus ? "+" : "";
  return plus ? `+${digits}` : digits;
}

export function isLikelyBrMobile(phone: string): boolean {
  const national = nationalDigits(phone);
  return national.length === 10 || national.length === 11;
}

export function maskPhoneInput(value: string): string {
  const digits = nationalDigits(value).slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
