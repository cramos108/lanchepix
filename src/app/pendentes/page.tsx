"use client";

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, FileDown, FileSpreadsheet, Lock, MessageCircle, RefreshCw, Star, X } from "lucide-react";
import { AmountAdjuster } from "@/components/AmountAdjuster";
import { Button, EmptyState, Modal, inputClass } from "@/components/ui";
import { db } from "@/lib/db";
import {
  DUE_PERIODS,
  duePeriodLabel,
  formatDateTime,
  isInDuePeriod,
  type DuePeriod,
} from "@/lib/id";
import { Money, Price } from "@/components/Money";
import { formatBrPhone } from "@/lib/phone";
import { canSeeFinances, isAttendantDevice, visibleSalesForDevice } from "@/lib/account";
import {
  canExportSalesExcel,
  canExportSalesPdf,
  canFilterByHelper,
  canSendWhatsAppReminders,
  isNegocio,
  openUpgradeModal,
} from "@/lib/plan";
import {
  addStamp,
  cancelSale,
  findCustomerByPhone,
  markSalePaid,
  unpaySale,
  upsertCustomer,
} from "@/lib/repo";
import { downloadSalesXlsx } from "@/lib/excelExport";
import { attendantPerformance, dailyClosing, downloadMeiPdf } from "@/lib/salesReport";
import { fetchVendorSalesFromSupabase, pushAndPull, refetchOwnerSales, sellerNameFromSale } from "@/lib/sync";
import { toast } from "@/lib/toast";
import { CheckoutPay } from "@/components/CheckoutPay";
import {
  dailyClosingWhatsAppMessage,
  loyaltyStampMessage,
  openPaidSaleWhatsApp,
  pendingPixReminderMessage,
  waLink,
} from "@/lib/whatsapp";
import { useT } from "@/lib/i18n";
import type { Sale } from "@/lib/types";

export default function PendentesPage() {
  const t = useT();
  const allSales = useLiveQuery(
    () =>
      db.sales
        .toArray()
        .then((rows) =>
          rows.sort((a, b) => (b.paidAt ?? b.createdAt).localeCompare(a.paidAt ?? a.createdAt)),
        ),
    [],
  );
  const settings = useLiveQuery(() => db.settings.get("app"), []);
  const scoped = visibleSalesForDevice(allSales, settings);
  const sales = scoped.filter((s) => s.status === "pending");
  const history = scoped
    .filter((s) => s.status === "pending" || s.status === "paid")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const [tab, setTab] = useState<"open" | "history" | "reports">("open");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [xlsxBusy, setXlsxBusy] = useState(false);
  const [paying, setPaying] = useState<Sale | null>(null);
  const [settle, setSettle] = useState<Sale | null>(null);
  const [settleExtra, setSettleExtra] = useState(0);
  const [stampAsk, setStampAsk] = useState<Sale | null>(null);
  const [detail, setDetail] = useState<Sale | null>(null);
  const [settling, setSettling] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [helperFilter, setHelperFilter] = useState("");
  const [duePeriod, setDuePeriod] = useState<DuePeriod>("all");

  function startSettle(sale: Sale) {
    setSettle(sale);
    setSettleExtra(sale.extraCents ?? 0);
  }

  async function confirmSettle() {
    if (!settle || settling) return;
    setSettling(true);
    try {
      const updated = await markSalePaid(settle.id, settleExtra);
      await refetchOwnerSales().catch(() => undefined);
      toast("Marcado como pago. Estoque baixado.");
      const paid = updated ?? settle;
      const receiptPhone = paid.customerPhone;
      const receipt = receiptPhone
        ? {
            phone: receiptPhone,
            storeName: settings?.storeName,
            productName: paid.productName,
            quantity: paid.quantity,
            totalCents: paid.totalCents,
            paidAt: paid.paidAt ?? paid.createdAt,
            sellerName: sellerNameFromSale(paid) || "Chefe",
          }
        : null;
      setSettle(null);
      setPaying(null);
      if (receipt) openPaidSaleWhatsApp(receipt);
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Não deu pra marcar como pago.",
        "err",
      );
    } finally {
      setSettling(false);
    }
  }

  async function giveStamp(sale: Sale) {
    if (!sale.customerPhone) return;
    const customer = await upsertCustomer({
      phone: sale.customerPhone,
      name: sale.customerName,
    });
    const next = await addStamp(customer.id);
    const required = settings?.stampsRequired ?? 10;
    if (next && next.stamps >= required) {
      toast("Cartão completo! Cliente ganhou o prêmio.");
    } else {
      toast(`Carimbo ${next?.stamps ?? 0}/${required}`);
    }
    setStampAsk(null);
  }

  const helperNames = useMemo(() => {
    const names = new Set<string>();
    for (const sale of scoped) {
      const name = sellerNameFromSale(sale);
      if (name) names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [scoped]);
  const matchHelper = (sale: Sale) =>
    !helperFilter || sellerNameFromSale(sale) === helperFilter;
  const filteredPending = sales.filter(matchHelper);
  const duePending = filteredPending.filter((s) => isInDuePeriod(s.createdAt, duePeriod));
  const duePendingCents = duePending.reduce((sum, s) => sum + s.totalCents, 0);
  const filteredHistory = history.filter(matchHelper);
  const pendingCents = sales.reduce((sum, s) => sum + s.totalCents, 0);
  const pendingFilteredCents = filteredPending.reduce((sum, s) => sum + s.totalCents, 0);
  const historyCents = history.reduce((sum, s) => sum + s.totalCents, 0);
  const historyFilteredCents = filteredHistory.reduce((sum, s) => sum + s.totalCents, 0);
  const helpers = attendantPerformance(scoped);
  const closing = useMemo(
    () => dailyClosing(scoped, { storeName: settings?.storeName }),
    [scoped, settings?.storeName],
  );
  const canRemind = canSendWhatsAppReminders(settings);
  const canPdf = canExportSalesPdf(settings);
  const canExcel = canExportSalesExcel(settings);
  const hideStore = !canSeeFinances(settings);
  const showReports = canSeeFinances(settings);
  const showHelperReports = isNegocio(settings) && canSeeFinances(settings);
  const showHelperFilter = canFilterByHelper(settings);
  const tabTotalGeral = tab === "open" ? pendingCents : historyCents;
  const tabTotalAjudante = tab === "open" ? pendingFilteredCents : historyFilteredCents;

  useEffect(() => {
    void refetchOwnerSales().catch(() => undefined);
  }, [tab]);

  async function refreshHistory() {
    setHistoryBusy(true);
    try {
      await refetchOwnerSales();
      const rows = await db.sales.toArray();
      const n = visibleSalesForDevice(rows, settings).length;
      toast(n > 0 ? `Histórico atualizado · ${n} vendas` : "Histórico atualizado");
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Não deu pra atualizar o histórico.",
        "err",
      );
    } finally {
      setHistoryBusy(false);
    }
  }

  function reminderHref(sale: Sale): string {
    const rawMessage = pendingPixReminderMessage({
      customerName: sale.customerName,
      storeName: settings?.storeName,
      totalCents: sale.totalCents,
      pixKey: settings?.pixKey,
    });
    return waLink(sale.customerPhone ?? "", rawMessage);
  }

  function chargeSale(sale: Sale) {
    if (!canRemind) {
      openUpgradeModal();
      return;
    }
    window.open(reminderHref(sale), "_blank", "noopener,noreferrer");
  }

  function chargeAllPending() {
    if (!canRemind) {
      openUpgradeModal();
      return;
    }
    const due = duePending.filter((s) => s.customerPhone);
    if (!due.length) {
      toast("Nenhum pedido com WhatsApp");
      return;
    }
    window.open(reminderHref(due[0]), "_blank", "noopener,noreferrer");
    toast(
      due.length === 1
        ? "Lembrete aberto no WhatsApp"
        : `${due.length} cobranças — o primeiro abriu; toque nos outros pedidos.`,
    );
  }

  async function downloadReport() {
    if (!canPdf) {
      openUpgradeModal();
      return;
    }
    setPdfBusy(true);
    try {
      await pushAndPull();
      const rows = await fetchVendorSalesFromSupabase();
      await downloadMeiPdf(rows, settings?.storeName ?? "Meu negócio");
      toast("Relatório PDF salvo");
    } catch {
      toast("Não deu para gerar o PDF.", "err");
    } finally {
      setPdfBusy(false);
    }
  }

  function downloadExcel() {
    if (!canExcel) {
      openUpgradeModal(
        "Exportação em Excel e planilhas é exclusiva do Plano Negócio",
      );
      return;
    }
    setXlsxBusy(true);
    try {
      downloadSalesXlsx(scoped, settings?.storeName);
      toast("Planilha Excel salva");
    } catch {
      toast("Não deu para gerar o Excel.", "err");
    } finally {
      setXlsxBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {hideStore ? (
        <div className="rounded-3xl border-2 border-amber bg-surface px-4 py-3">
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-amber">
            Seus pedidos abertos
          </p>
          <p className="text-3xl font-black">{sales.length}</p>
        </div>
      ) : (
      <div className="rounded-3xl border-2 border-amber bg-surface px-4 py-3">
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-amber">
          {t("history.due")}
        </p>
        <p className="text-3xl font-black tabular-nums text-sun">
          <Money cents={pendingCents} />
        </p>
        <p className="text-sm font-bold text-muted">
          {(sales ?? []).length} {(sales ?? []).length === 1 ? "pedido aberto" : "pedidos abertos"}
        </p>
      </div>
      )}
      <p className="text-sm font-bold text-muted">
        {t("history.hint")}
      </p>

      <div className={`grid gap-2 ${showReports ? "grid-cols-3" : "grid-cols-2"}`}>
        <button
          type="button"
          onClick={() => setTab("open")}
          className={`min-h-12 rounded-2xl border-2 px-1 text-sm font-extrabold uppercase ${
            tab === "open" ? "border-sun bg-sun text-sunink" : "border-line bg-surface"
          }`}
        >
          {t("tab.open")}
        </button>
        <button
          type="button"
          onClick={() => setTab("history")}
          className={`min-h-12 rounded-2xl border-2 px-1 text-sm font-extrabold uppercase ${
            tab === "history" ? "border-sun bg-sun text-sunink" : "border-line bg-surface"
          }`}
        >
          {t("tab.history")}
        </button>
        {showReports ? (
          <button
            type="button"
            onClick={() => setTab("reports")}
            className={`min-h-12 rounded-2xl border-2 px-1 text-sm font-extrabold uppercase ${
              tab === "reports" ? "border-sun bg-sun text-sunink" : "border-line bg-surface"
            }`}
          >
            {t("tab.reports")}
          </button>
        ) : null}
      </div>

      {showHelperFilter && tab !== "reports" ? (
        <section className="rounded-3xl border-2 border-line bg-surface p-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-extrabold uppercase tracking-widest text-sun">
              {t("filter.helper")}
            </span>
            <select
              className={inputClass}
              value={helperFilter}
              onChange={(e) => setHelperFilter(e.target.value)}
            >
              <option value="">{t("filter.helpersAll")}</option>
              {helperNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border-2 border-sun/70 bg-ink px-3 py-3">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-sun">
                {t("metric.totalAll")}
              </p>
              <p className="text-xl font-black tabular-nums">
                <Money cents={tabTotalGeral} />
              </p>
            </div>
            <div className="rounded-2xl border-2 border-mint/70 bg-ink px-3 py-3">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-mint">
                {t("metric.totalHelper")}
              </p>
              <p className="text-xl font-black tabular-nums">
                <Money cents={helperFilter ? tabTotalAjudante : tabTotalGeral} />
              </p>
              <p className="text-[11px] font-bold text-muted">
                {helperFilter || t("filter.helpersAll")}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {tab === "reports" && showReports ? (
        <section className="flex flex-col gap-3">
          <div className="rounded-3xl border-2 border-sun/70 bg-surface p-4">
            <Button
              className="w-full"
              variant={canPdf ? "sun" : "line"}
              disabled={pdfBusy}
              onClick={() => void downloadReport()}
            >
              <FileDown className="h-5 w-5" />
              {pdfBusy ? "Gerando PDF…" : "Exportar PDF"}
            </Button>
            <Button
              className="mt-2 w-full"
              variant={canExcel ? "mint" : "line"}
              disabled={xlsxBusy}
              onClick={downloadExcel}
            >
              {canExcel ? (
                <FileSpreadsheet className="h-5 w-5" />
              ) : (
                <Lock className="h-5 w-5" />
              )}
              {xlsxBusy ? "Gerando Excel…" : "Baixar Excel (XLSX)"}
            </Button>
            {!canExcel ? (
              <p className="mt-2 text-center text-xs font-bold text-muted">
                Exportação em Excel e planilhas é exclusiva do Plano Negócio
              </p>
            ) : null}
          </div>
          <article className="rounded-3xl border-2 border-sun bg-surface p-4">
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-sun">
              Fechamento do dia
            </p>
            <h2 className="text-2xl font-black leading-tight">FECHAMENTO DO DIA</h2>
            <p className="text-sm font-bold text-muted">{closing.dateLabel}</p>
            <div className="mt-3 grid gap-2">
              <div className="rounded-2xl border-2 border-sun/70 bg-ink px-3 py-3">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-sun">
                  Total Geral do Dia
                </p>
                <p className="text-2xl font-black tabular-nums text-sun">
                  <Money cents={closing.totalPaidCents} />
                </p>
                <p className="text-xs font-bold text-muted">
                  {closing.paidCount}{" "}
                  {closing.paidCount === 1 ? "venda paga" : "vendas pagas"}
                </p>
              </div>
              {showHelperReports ? (
                <div className="rounded-2xl border-2 border-mint/70 bg-ink px-3 py-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-mint">
                    Vendas do Chefe
                  </p>
                  <p className="text-xl font-black tabular-nums">
                    <Money cents={closing.chefeCents} />
                  </p>
                  <p className="text-xs font-bold text-muted">
                    {closing.chefeCount}{" "}
                    {closing.chefeCount === 1 ? "venda" : "vendas"}
                  </p>
                </div>
              ) : null}
            </div>
            {showHelperReports ? (
              <div className="mt-3 rounded-2xl border-2 border-line bg-ink px-3 py-3">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-sun">
                  Por Ajudante (hoje)
                </p>
                {closing.helpers.length === 0 ? (
                  <p className="mt-1 text-sm font-bold text-muted">
                    Nenhuma venda de ajudante hoje.
                  </p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-2">
                    {closing.helpers.map((row) => (
                      <li
                        key={row.name}
                        className="flex items-start justify-between gap-3"
                      >
                        <div>
                          <p className="font-black">{row.name}</p>
                          <p className="text-xs font-bold text-muted">
                            {row.salesCount}{" "}
                            {row.salesCount === 1 ? "venda" : "vendas"}
                          </p>
                        </div>
                        <p className="text-lg font-black tabular-nums text-sun">
                          <Money cents={row.totalCents} />
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
            {showHelperReports ? (
              <Button
                className="mt-3 w-full"
                variant="mint"
                onClick={() => {
                  window.open(
                    waLink(
                      "",
                      dailyClosingWhatsAppMessage({
                        storeName: settings?.storeName,
                        closing,
                      }),
                    ),
                    "_blank",
                    "noopener,noreferrer",
                  );
                }}
              >
                <MessageCircle className="h-5 w-5" />
                Enviar fechamento no WhatsApp
              </Button>
            ) : null}
          </article>

          <section className="rounded-3xl border-2 border-amber bg-surface p-4">
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-amber">
              Pedidos a receber
            </p>
            <h2 className="text-xl font-black leading-tight">PEDIDOS A RECEBER</h2>
            <div className="mt-3">
              <DueFilterBar value={duePeriod} onChange={setDuePeriod} />
            </div>
            <div className="mt-3 rounded-2xl border-2 border-amber/70 bg-ink px-3 py-3">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-amber">
                Total a receber ({duePeriodLabel(duePeriod)})
              </p>
              <p className="text-2xl font-black tabular-nums text-amber">
                <Money cents={duePendingCents} />
              </p>
              <p className="text-sm font-bold text-muted">
                {duePending.length}{" "}
                {duePending.length === 1 ? "pedido em aberto" : "pedidos em aberto"}
              </p>
            </div>
            {duePending.length === 0 ? (
              <p className="mt-3 text-sm font-bold text-muted">
                Nenhum pedido em aberto neste período.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {duePending.map((sale) => (
                  <PendingTicket
                    key={sale.id}
                    sale={sale}
                    canRemind={canRemind}
                    onPaid={() => startSettle(sale)}
                    onCharge={() => chargeSale(sale)}
                  />
                ))}
              </ul>
            )}
          </section>

          {showHelperReports ? (
            <>
              <div>
                <h2 className="text-lg font-black">Desempenho por Ajudante</h2>
                <p className="text-sm font-bold text-muted">
                  Totais de vendas pagas neste negócio, por nome do aparelho/atendente.
                </p>
              </div>
              {helpers.length === 0 ? (
                <EmptyState
                  title="Sem dados de ajudante"
                  text="Cadastre o nome do atendente nas configurações e registre vendas neste aparelho."
                />
              ) : (
                helpers.map((row) => (
                  <article
                    key={row.name}
                    className="rounded-3xl border-2 border-line bg-surface p-4"
                  >
                    <p className="text-lg font-black">{row.name}</p>
                    <p className="text-sm font-bold text-muted">
                      {row.salesCount} {row.salesCount === 1 ? "venda" : "vendas"} ·{" "}
                      {row.quantity} un.
                    </p>
                    <p className="mt-1 text-2xl font-black text-sun">
                      <Money cents={row.totalCents} />
                    </p>
                    <p className="text-xs font-extrabold uppercase tracking-wide text-muted">
                      PIX AGORA <Money cents={row.pixAgoraCents} /> · PIX CONFIANÇA{" "}
                      <Money cents={row.pixConfiancaCents} />
                    </p>
                  </article>
                ))
              )}
            </>
          ) : (
            <div className="relative overflow-hidden rounded-3xl border-2 border-sun bg-surface p-4">
              <div className="pointer-events-none select-none blur-[2px] opacity-40" aria-hidden>
                <h2 className="text-lg font-black">Desempenho por Ajudante</h2>
                <p className="mt-3 text-lg font-black">Maria</p>
                <p className="text-2xl font-black text-sun">R$ ●●●●</p>
                <p className="mt-3 text-lg font-black">João</p>
                <p className="text-2xl font-black text-sun">R$ ●●●●</p>
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/80 px-4 text-center">
                <Lock className="h-8 w-8 text-sun" />
                <p className="text-sm font-extrabold leading-snug">
                  Relatório de desempenho por Ajudante exclusivo do Plano Negócio
                </p>
                <Button onClick={openUpgradeModal}>Fazer upgrade</Button>
              </div>
            </div>
          )}
        </section>
      ) : null}

      {tab === "history" ? (
        <ul className="flex flex-col gap-3">
          <li className="rounded-3xl border-2 border-sun/70 bg-surface px-4 py-3">
            <Button
              className="w-full"
              variant="line"
              disabled={historyBusy}
              onClick={() => void refreshHistory()}
            >
              <RefreshCw className="h-5 w-5" />
              {historyBusy ? "…" : t("btn.update")}
            </Button>
            {hideStore ? null : (
            <Button
              className="mt-3 w-full"
              variant={canPdf ? "sun" : "line"}
              disabled={pdfBusy}
              onClick={() => void downloadReport()}
            >
              <FileDown className="h-5 w-5" />
              {pdfBusy ? "Gerando PDF…" : "Baixar Relatório PDF (MEI)"}
            </Button>
            )}
          </li>
          {filteredHistory.length === 0 ? (
            <li>
              <EmptyState
                title={t("history.emptySales")}
                text="PIX AGORA, Pix Confiança em aberto e pagos aparecem aqui."
              />
            </li>
          ) : (
            filteredHistory.map((sale) => (
              <li key={sale.id} className="rounded-3xl border-2 border-line bg-surface p-4">
                <button
                  type="button"
                  onClick={() => setDetail(sale)}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-black leading-tight">
                        {sale.productName} × {sale.quantity}
                      </p>
                      <p className="text-sm font-bold text-muted">
                        {formatDateTime(sale.paidAt ?? sale.createdAt)}
                      </p>
                      <p
                        className={`text-xs font-extrabold uppercase ${
                          sale.status === "pending" ? "text-amber" : "text-mint"
                        }`}
                      >
                        {sale.status === "pending"
                          ? "PIX CONFIANÇA · ABERTO"
                          : sale.paidAt === sale.createdAt
                            ? "PIX AGORA"
                            : "PIX CONFIANÇA · PAGO"}
                      </p>
                      <p className="text-xs font-bold text-mint">
                        Vendido por: {sellerNameFromSale(sale) || "Chefe"}
                      </p>
                    </div>
                    <p className="text-xl font-black text-sun">
                      <Money cents={sale.totalCents} />
                    </p>
                  </div>
                </button>
                {sale.status === "paid" && sale.customerPhone ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openPaidSaleWhatsApp({
                        phone: sale.customerPhone,
                        storeName: settings?.storeName,
                        productName: sale.productName,
                        quantity: sale.quantity,
                        totalCents: sale.totalCents,
                        paidAt: sale.paidAt ?? sale.createdAt,
                        sellerName: sellerNameFromSale(sale) || "Chefe",
                      });
                    }}
                    className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-extrabold uppercase text-mint"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Reenviar Comprovante
                  </button>
                ) : null}
              </li>
            ))
          )}
        </ul>
      ) : null}

      {tab === "open" ? (
      <ul className="flex flex-col gap-3">
        <li className="rounded-3xl border-2 border-amber bg-surface p-4">
          <DueFilterBar value={duePeriod} onChange={setDuePeriod} />
          <div className="mt-3 rounded-2xl border-2 border-amber/70 bg-ink px-3 py-3">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-amber">
              Total a receber ({duePeriodLabel(duePeriod)})
            </p>
            <p className="text-2xl font-black tabular-nums text-amber">
              <Money cents={duePendingCents} />
            </p>
            <p className="text-sm font-bold text-muted">
              {duePending.length}{" "}
              {duePending.length === 1 ? "pedido em aberto" : "pedidos em aberto"}
            </p>
          </div>
        </li>
        <li>
          <Button
            variant="line"
            className="w-full"
            disabled={historyBusy}
            onClick={() => void refreshHistory()}
          >
            <RefreshCw className="h-5 w-5" />
            {historyBusy ? "Atualizando…" : "Atualizar Histórico"}
          </Button>
          <Button
            className="mt-2 w-full"
            variant={canRemind ? "mint" : "line"}
            onClick={chargeAllPending}
          >
            <MessageCircle className="h-5 w-5" />
            Lembrar todos no WhatsApp
          </Button>
        </li>
        {duePending.length === 0 ? (
          <li>
            <EmptyState
              title={t("history.empty")}
              text="Nenhum pedido em aberto neste período."
            />
          </li>
        ) : (
          duePending.map((sale) => (
            <PendingTicket
              key={sale.id}
              sale={sale}
              canRemind={canRemind}
              onPaid={() => startSettle(sale)}
              onCharge={() => chargeSale(sale)}
              onCancel={async () => {
                await cancelSale(sale.id);
                await refetchOwnerSales().catch(() => undefined);
                toast("Venda cancelada");
              }}
            />
          ))
        )}
      </ul>
      ) : null}

      <Modal
        open={Boolean(detail)}
        title={detail?.status === "pending" ? "Pix Confiança" : "Venda"}
        onClose={() => setDetail(null)}
      >
        {detail ? (
          <div className="flex flex-col gap-3">
            <p className="text-lg font-bold">
              {detail.productName} × {detail.quantity}
              <span className="mt-1 block text-2xl font-black text-sun">
                <Money cents={detail.totalCents} />
              </span>
            </p>
            <p className="text-sm font-bold text-muted">
              {formatDateTime(detail.paidAt ?? detail.createdAt)}
            </p>
            <p className="text-sm font-bold text-mint">
              Vendido por: {sellerNameFromSale(detail) || "Chefe"}
            </p>
            {(detail.extraCents ?? 0) !== 0 ? (
              <p className="text-sm font-extrabold text-mint">
                Gorjeta / extra: <Money cents={detail.extraCents ?? 0} />
              </p>
            ) : null}
            {isAttendantDevice(settings) ? null : (
              <>
            <Button
              variant="amber"
              onClick={async () => {
                await unpaySale(detail.id);
                setDetail(null);
                setTab("open");
                toast("Voltou para Pix Confiança. Saiu do lucro.");
              }}
            >
              Desfazer pagamento
            </Button>
            <Button
              variant="alert"
              onClick={async () => {
                const ok = window.confirm(
                  "Excluir esta venda? O estoque volta e o valor sai de Hoje, Semana, Mês e Ano.",
                );
                if (!ok) return;
                await cancelSale(detail.id);
                setDetail(null);
                toast("Venda excluída. Estoque devolvido.");
              }}
            >
              Excluir venda
            </Button>
              </>
            )}
            <Button variant="ghost" onClick={() => setDetail(null)}>
              Fechar
            </Button>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(settle)}
        title="PIX CONFIANÇA · receber"
        onClose={() => setSettle(null)}
      >
        {settle ? (
          <div className="flex flex-col gap-4">
            <p className="text-lg font-bold">
              {settle.productName} × {settle.quantity}
            </p>
            <AmountAdjuster
              baseCents={settle.unitPriceCents * settle.quantity}
              extraCents={settleExtra}
              onChange={setSettleExtra}
              suggested={settle.priceMode === "suggested"}
            />
            <Button
              variant="mint"
              disabled={settling}
              onClick={() => void confirmSettle()}
            >
              <Check className="h-5 w-5" />
              {settling ? "Salvando…" : "Confirmar pago"}
            </Button>
          </div>
        ) : null}
      </Modal>

      <Modal open={Boolean(paying)} title={t("pay.title")} onClose={() => setPaying(null)}>
        {paying && settings ? (
          <CheckoutPay sale={paying} settings={settings} onClose={() => setPaying(null)} />
        ) : null}
      </Modal>

      <Modal
        open={Boolean(stampAsk)}
        title="Dar carimbo?"
        onClose={() => setStampAsk(null)}
      >
        {stampAsk ? (
          <div className="flex flex-col gap-3">
            <p className="text-muted">
              Cliente {stampAsk.customerName || formatBrPhone(stampAsk.customerPhone ?? "")}.
              Somar 1 carimbo no cartão fidelidade?
            </p>
            <Button
              onClick={async () => {
                await giveStamp(stampAsk);
                const customer = await findCustomerByPhone(stampAsk.customerPhone ?? "");
                if (customer && settings) {
                  window.open(
                    waLink(
                      customer.phone,
                      loyaltyStampMessage({
                        storeName: settings.storeName,
                        customerName: customer.name,
                        stamps: customer.stamps,
                        required: settings.stampsRequired,
                        rewardLabel: settings.rewardLabel,
                      }),
                    ),
                    "_blank",
                  );
                }
              }}
            >
              <Star className="h-5 w-5" />
              Carimbar e avisar no WhatsApp
            </Button>
            <Button variant="line" onClick={() => void giveStamp(stampAsk)}>
              Só carimbar
            </Button>
            <Button variant="ghost" onClick={() => setStampAsk(null)}>
              Agora não
            </Button>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function DueFilterBar({
  value,
  onChange,
}: {
  value: DuePeriod;
  onChange: (next: DuePeriod) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {DUE_PERIODS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onChange(p.id)}
          className={`min-h-10 rounded-2xl border-2 px-3 text-[11px] font-extrabold uppercase ${
            value === p.id
              ? "border-sun bg-sun text-sunink"
              : "border-line bg-surface2 text-white"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

function PendingTicket({
  sale,
  canRemind,
  onPaid,
  onCharge,
  onCancel,
}: {
  sale: Sale;
  canRemind: boolean;
  onPaid: () => void;
  onCharge: () => void;
  onCancel?: () => void;
}) {
  const t = useT();
  const contact = sale.customerPhone
    ? `${sale.customerName ? `${sale.customerName} · ` : ""}${formatBrPhone(sale.customerPhone)}`
    : sale.customerName?.trim() || "Sem telefone";
  return (
    <li className="rounded-3xl border-2 border-amber bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-sky">{contact}</p>
          <p className="text-xl font-black leading-tight">
            {sale.productName} × {sale.quantity}
          </p>
          <p className="text-sm font-bold text-muted">
            {formatDateTime(sale.createdAt)}
          </p>
          <p className="text-xs font-bold text-mint">
            Vendido por: {sellerNameFromSale(sale) || "Chefe"}
          </p>
        </div>
        <p className="text-2xl font-black text-sun">
          <Price cents={sale.totalCents} />
        </p>
      </div>
      <div className={`mt-3 grid gap-2 ${onCancel ? "grid-cols-2" : "grid-cols-1"}`}>
        <Button variant="mint" onClick={onPaid}>
          <Check className="h-5 w-5" />
          {t("btn.paid")}
        </Button>
        {onCancel ? (
          <Button variant="alert" onClick={() => void onCancel()}>
            <X className="h-5 w-5" />
            {t("btn.cancel")}
          </Button>
        ) : null}
      </div>
      {sale.customerPhone ? (
        <Button variant="line" className="mt-2 w-full" onClick={onCharge}>
          <MessageCircle className="h-5 w-5" />
          {t("wa.charge")}
        </Button>
      ) : null}
    </li>
  );
}
