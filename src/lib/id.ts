export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Local calendar day start: device timezone midnight (00:00:00.000). */
export function startOfLocalDay(ref = new Date()): Date {
  return new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0, 0);
}

/** Exclusive end of the local calendar day (next midnight). */
export function endOfLocalDay(ref = new Date()): Date {
  const end = startOfLocalDay(ref);
  end.setDate(end.getDate() + 1);
  return end;
}

/** True when `iso` falls in [local midnight, next midnight) on `ref`'s device calendar day. */
export function isWithinLocalDay(iso: string, ref = new Date()): boolean {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return t >= startOfLocalDay(ref).getTime() && t < endOfLocalDay(ref).getTime();
}

export function isSameLocalDay(iso: string, ref = new Date()): boolean {
  return isWithinLocalDay(iso, ref);
}

export function startOfYesterday(ref = new Date()): Date {
  const d = startOfLocalDay(ref);
  d.setDate(d.getDate() - 1);
  return d;
}

export function isYesterday(iso: string, ref = new Date()): boolean {
  return isWithinLocalDay(iso, startOfYesterday(ref));
}

export type DuePeriod = "today" | "yesterday" | "week" | "month" | "all";

export const DUE_PERIODS: Array<{ id: DuePeriod; label: string }> = [
  { id: "today", label: "Hoje" },
  { id: "yesterday", label: "Ontem" },
  { id: "week", label: "Esta Semana" },
  { id: "month", label: "Este Mês" },
  { id: "all", label: "TODOS (Geral)" },
];

export function duePeriodLabel(period: DuePeriod): string {
  return DUE_PERIODS.find((p) => p.id === period)?.label ?? "TODOS (Geral)";
}

/** Pending tickets: sold timestamp vs local calendar filter. `all` = no date bound. */
export function isInDuePeriod(iso: string, period: DuePeriod, ref = new Date()): boolean {
  if (period === "all") return true;
  if (period === "today") return isWithinLocalDay(iso, ref);
  if (period === "yesterday") return isYesterday(iso, ref);
  if (period === "week") return isSameLocalWeek(iso, ref);
  if (period === "month") return isSameLocalMonth(iso, ref);
  return true;
}

export function isSameLocalMonth(iso: string, ref = new Date()): boolean {
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

export function isSameLocalYear(iso: string, ref = new Date()): boolean {
  return new Date(iso).getFullYear() === ref.getFullYear();
}

/** Semana local: segunda 00:00 até domingo 24:00. */
export function startOfLocalWeek(ref = new Date()): Date {
  const start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const weekday = start.getDay();
  const back = weekday === 0 ? 6 : weekday - 1;
  start.setDate(start.getDate() - back);
  return start;
}

export function isSameLocalWeek(iso: string, ref = new Date()): boolean {
  const t = new Date(iso).getTime();
  const start = startOfLocalWeek(ref);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return t >= start.getTime() && t < end.getTime();
}

export function isAfterCut(iso: string, cut?: string): boolean {
  if (!cut) return true;
  return new Date(iso).getTime() >= new Date(cut).getTime();
}

export function periodCut(
  cut: string | undefined,
  inPeriod: (iso: string) => boolean,
): string | undefined {
  if (!cut) return undefined;
  return inPeriod(cut) ? cut : undefined;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
