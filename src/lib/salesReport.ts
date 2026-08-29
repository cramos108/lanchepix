import { formatDateTime } from "./id";
import { formatBRL } from "./money";
import type { Sale } from "./types";

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
    .filter((s) => s.status === "paid")
    .sort((a, b) => (b.paidAt ?? b.createdAt).localeCompare(a.paidAt ?? a.createdAt));
}

export function attendantPerformance(sales: Sale[]): AttendantStats[] {
  const map = new Map<string, AttendantStats>();
  for (const sale of paidSales(sales)) {
    const name = sale.attendantName?.trim() || "Sem nome";
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
