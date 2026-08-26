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

/** Número no formato wa.me: 55 + DDD + número. */
export function toWhatsAppNumber(phone: string): string {
  const national = nationalDigits(phone);
  if (national.length === 10 || national.length === 11) return `55${national}`;
  const digits = digitsOnly(phone);
  return digits;
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
