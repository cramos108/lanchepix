import { saleSellerName } from "./account";
import { formatDateTime, isWithinLocalDay } from "./id";
import { formatBRL } from "./money";
import { isLossStatus, isPaidStatus, isReceivableStatus, type Sale } from "./types";

function pdfSafe(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export type AttendantStats = {
  name: string;
  salesCount: number;
  quantity: number;
  totalCents: number;
  pixAgoraCents: number;
  pixConfiancaCents: number;
};

export function paidSales(sales: Sale[]): Sale[] {
  return sales
    .filter((s) => isPaidStatus(s.status))
    .sort((a, b) => (b.paidAt ?? b.createdAt).localeCompare(a.paidAt ?? a.createdAt));
}

export function lossSales(sales: Sale[]): Sale[] {
  return sales.filter((s) => isLossStatus(s.status));
}

export function lossTotalCents(sales: Sale[]): number {
  return lossSales(sales).reduce((sum, s) => sum + s.totalCents, 0);
}

export function attendantPerformance(sales: Sale[]): AttendantStats[] {
  const map = new Map<string, AttendantStats>();
  for (const sale of paidSales(sales)) {
    const raw = sale.attendantName?.trim() || "";
    const name =
      raw && !/^desconhecido$/i.test(raw) ? raw : "Chefe";
    const current = map.get(name) ?? {
      name,
      salesCount: 0,
      quantity: 0,
      totalCents: 0,
      pixAgoraCents: 0,
      pixConfiancaCents: 0,
    };
    current.salesCount += 1;
    current.quantity += sale.quantity;
    current.totalCents += sale.totalCents;
    if (sale.paidAt === sale.createdAt) current.pixAgoraCents += sale.totalCents;
    else current.pixConfiancaCents += sale.totalCents;
    map.set(name, current);
  }
  return [...map.values()].sort((a, b) => b.totalCents - a.totalCents);
}

export type HelperSubtotal = {
  name: string;
  salesCount: number;
  totalCents: number;
};

export type DailyClosing = {
  dateLabel: string;
  paidCount: number;
  totalPaidCents: number;
  chefeCents: number;
  chefeCount: number;
  helpers: HelperSubtotal[];
  pendingCents: number;
  pendingCount: number;
};

function isChefeSellerName(name: string, storeName?: string): boolean {
  const n = name.trim();
  if (!n || /^desconhecido$/i.test(n) || /^chefe$/i.test(n)) return true;
  const store = storeName?.trim() || "";
  if (!store) return false;
  return n.toLocaleLowerCase("pt-BR") === store.toLocaleLowerCase("pt-BR");
}

function sellerLabel(sale: Sale): string {
  return saleSellerName(sale) || sale.attendantName?.trim() || "";
}

/** Fechamento do dia: paid + pending in the local calendar day (device midnight). */
export function dailyClosing(
  sales: Sale[],
  opts?: { now?: Date; storeName?: string },
): DailyClosing {
  const now = opts?.now ?? new Date();
  const storeName = opts?.storeName;
  const todayPaid = sales.filter((s) => {
    if (!isPaidStatus(s.status)) return false;
    return isWithinLocalDay(s.paidAt ?? s.createdAt, now);
  });
  const todayPending = sales.filter((s) => {
    if (!isReceivableStatus(s.status)) return false;
    return isWithinLocalDay(s.createdAt, now);
  });

  let chefeCents = 0;
  let chefeCount = 0;
  const helperMap = new Map<string, HelperSubtotal>();
  for (const sale of todayPaid) {
    const name = sellerLabel(sale);
    if (isChefeSellerName(name, storeName)) {
      chefeCents += sale.totalCents;
      chefeCount += 1;
      continue;
    }
    const current = helperMap.get(name) ?? {
      name,
      salesCount: 0,
      totalCents: 0,
    };
    current.salesCount += 1;
    current.totalCents += sale.totalCents;
    helperMap.set(name, current);
  }

  return {
    dateLabel: now.toLocaleDateString("pt-BR"),
    paidCount: todayPaid.length,
    totalPaidCents: todayPaid.reduce((sum, s) => sum + s.totalCents, 0),
    chefeCents,
    chefeCount,
    helpers: [...helperMap.values()].sort((a, b) => b.totalCents - a.totalCents),
    pendingCents: todayPending.reduce((sum, s) => sum + s.totalCents, 0),
    pendingCount: todayPending.length,
  };
}

export async function downloadMeiPdf(sales: Sale[], storeName: string): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const rows = paidSales(sales);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 16;

  const line = (text: string, size = 11, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const wrapped = doc.splitTextToSize(pdfSafe(text), pageWidth - 28);
    doc.text(wrapped, 14, y);
    y += wrapped.length * (size * 0.45) + 2;
    if (y > 280) {
      doc.addPage();
      y = 16;
    }
  };

  const total = rows.reduce((sum, s) => sum + s.totalCents, 0);
  const agora = rows
    .filter((s) => s.paidAt === s.createdAt)
    .reduce((sum, s) => sum + s.totalCents, 0);
  const confianca = total - agora;

  line("Pix da Confianca — Relatorio de Vendas MEI", 16, true);
  line(storeName || "Meu negocio", 12, true);
  line(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 10);
  line(`Vendas pagas: ${rows.length}  |  Total: ${formatBRL(total)}`, 11, true);
  line(`PIX AGORA: ${formatBRL(agora)}  |  PIX CONFIANCA: ${formatBRL(confianca)}`, 10);
  const perdas = lossTotalCents(sales);
  line(`Perdas / Fiado Nao Pago: ${formatBRL(perdas)}`, 10);
  y += 2;

  for (const sale of rows) {
    const kind = sale.paidAt === sale.createdAt ? "PIX AGORA" : "PIX CONFIANCA";
    const who = sale.attendantName ? `  |  Ajudante: ${sale.attendantName}` : "";
    line(
      `${formatDateTime(sale.paidAt ?? sale.createdAt)}  ${sale.productName} x${sale.quantity}  ${formatBRL(sale.totalCents)}  ${kind}${who}`,
      9,
    );
  }

  if (rows.length === 0) {
    line("Nenhuma venda paga no periodo.", 10);
  }

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`relatorio-mei-${stamp}.pdf`);
}
