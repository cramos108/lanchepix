"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, MessageCircle, Star, X } from "lucide-react";
import { AmountAdjuster } from "@/components/AmountAdjuster";
import { Button, EmptyState, Modal } from "@/components/ui";
import { PixQr } from "@/components/PixQr";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/id";
import { formatBRL } from "@/lib/money";
import { formatBrPhone } from "@/lib/phone";
import { buildPixPayload } from "@/lib/pix";
import {
  addStamp,
  cancelSale,
  findCustomerByPhone,
  markSalePaid,
  unpaySale,
  upsertCustomer,
} from "@/lib/repo";
import { toast } from "@/lib/toast";
import { loyaltyStampMessage, paymentReminderMessage, waLink } from "@/lib/whatsapp";
import type { Sale } from "@/lib/types";

export default function PendentesPage() {
  const allSales = useLiveQuery(
    () =>
      db.sales
        .toArray()
        .then((rows) =>
          rows.sort((a, b) => (b.paidAt ?? b.createdAt).localeCompare(a.paidAt ?? a.createdAt)),
        ),
    [],
  );
  const sales = (allSales ?? []).filter((s) => s.status === "pending");
  const history = (allSales ?? []).filter((s) => s.status === "paid");
  const settings = useLiveQuery(() => db.settings.get("app"), []);
  const [tab, setTab] = useState<"open" | "history">("open");
  const [paying, setPaying] = useState<Sale | null>(null);
  const [settle, setSettle] = useState<Sale | null>(null);
  const [settleExtra, setSettleExtra] = useState(0);
  const [stampAsk, setStampAsk] = useState<Sale | null>(null);
  const [detail, setDetail] = useState<Sale | null>(null);

  function startSettle(sale: Sale) {
    setSettle(sale);
    setSettleExtra(sale.extraCents ?? 0);
  }

  async function confirmSettle() {
    if (!settle) return;
    const updated = await markSalePaid(settle.id, settleExtra);
    toast("Marcado como pago. Estoque baixado.");
    setSettle(null);
    setPaying(updated ?? settle);
    if (settle.customerPhone) setStampAsk(settle);
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

  let pixPayload = "";
  if (paying && settings?.pixKey) {
    try {
      pixPayload = buildPixPayload({
        pixKey: settings.pixKey,
        merchantName: settings.merchantName || settings.storeName,
        merchantCity: settings.merchantCity,
        amountCents: paying.totalCents,
        description: paying.productName,
      });
    } catch {
      pixPayload = "";
    }
  }

  const pendingCents = (sales ?? []).reduce((sum, s) => sum + s.totalCents, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-3xl border-2 border-amber bg-surface px-4 py-3">
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-amber">
          A receber · Pix Confiança
        </p>
        <p className="text-3xl font-black tabular-nums text-sun">{formatBRL(pendingCents)}</p>
        <p className="text-sm font-bold text-muted">
          {(sales ?? []).length} {(sales ?? []).length === 1 ? "pedido aberto" : "pedidos abertos"}
        </p>
      </div>
      <p className="text-sm font-bold text-muted">
        Toque em <span className="text-sun">Pago</span> quando o Pix cair. O valor
        entra no lucro de hoje, da semana, do mês e do ano.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setTab("open")}
          className={`min-h-12 rounded-2xl border-2 text-sm font-extrabold uppercase ${
            tab === "open" ? "border-sun bg-sun text-sunink" : "border-line bg-surface"
          }`}
        >
          A receber
        </button>
        <button
          type="button"
          onClick={() => setTab("history")}
          className={`min-h-12 rounded-2xl border-2 text-sm font-extrabold uppercase ${
            tab === "history" ? "border-sun bg-sun text-sunink" : "border-line bg-surface"
          }`}
        >
          Histórico
        </button>
      </div>

      {tab === "history" ? (
        history.length === 0 ? (
          <EmptyState
            title="Sem vendas pagas"
            text="PIX AGORA e Pix Confiança pagos aparecem aqui. Dá para desfazer."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {history.map((sale) => (
              <li key={sale.id}>
                <button
                  type="button"
                  onClick={() => setDetail(sale)}
                  className="w-full rounded-3xl border-2 border-line bg-surface p-4 text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-black leading-tight">
                        {sale.productName} × {sale.quantity}
                      </p>
                      <p className="text-sm font-bold text-muted">
                        {formatDateTime(sale.paidAt ?? sale.createdAt)}
                      </p>
                      <p className="text-xs font-extrabold uppercase text-mint">
                        {sale.paidAt === sale.createdAt ? "PIX AGORA" : "PIX CONFIANÇA"}
                      </p>
                    </div>
                    <p className="text-xl font-black text-sun">{formatBRL(sale.totalCents)}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : sales.length === 0 ? (
        <EmptyState
          title="Nada no Pix Confiança"
          text="Quando alguém levar e pagar depois, a venda aparece aqui."
        />
      ) : null}

      {tab === "open" ? (
      <ul className="flex flex-col gap-3">
        {sales.map((sale) => (
          <li key={sale.id} className="rounded-3xl border-2 border-amber bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xl font-black leading-tight">
                  {sale.productName} × {sale.quantity}
                </p>
                <p className="text-sm font-bold text-muted">{formatDateTime(sale.createdAt)}</p>
                {sale.customerPhone ? (
                  <p className="text-sm font-bold text-sky">
                    {sale.customerName ? `${sale.customerName} · ` : ""}
                    {formatBrPhone(sale.customerPhone)}
                  </p>
                ) : (
                  <p className="text-sm text-muted">Sem telefone</p>
                )}
              </div>
              <p className="text-2xl font-black text-sun">{formatBRL(sale.totalCents)}</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="mint" onClick={() => startSettle(sale)}>
                <Check className="h-5 w-5" />
                Pago
              </Button>
              <Button
                variant="alert"
                onClick={async () => {
                  await cancelSale(sale.id);
                  toast("Venda cancelada");
                }}
              >
                <X className="h-5 w-5" />
                Cancelar
              </Button>
            </div>
            {settings ? (
              <a
                href={waLink(
                  sale.customerPhone,
                  paymentReminderMessage({
                    storeName: settings.storeName,
                    customerName: sale.customerName,
                    productName: sale.productName,
                    quantity: sale.quantity,
                    totalCents: sale.totalCents,
                    pixKey: settings.pixKey,
                  }),
                )}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-line bg-surface2 text-sm font-extrabold uppercase"
              >
                <MessageCircle className="h-5 w-5" />
                Cobrar no WhatsApp
              </a>
            ) : null}
          </li>
        ))}
      </ul>
      ) : null}

      <Modal
        open={Boolean(detail)}
        title="Venda paga"
        onClose={() => setDetail(null)}
      >
        {detail ? (
          <div className="flex flex-col gap-3">
            <p className="text-lg font-bold">
              {detail.productName} × {detail.quantity}
              <span className="mt-1 block text-2xl font-black text-sun">
                {formatBRL(detail.totalCents)}
              </span>
            </p>
            <p className="text-sm font-bold text-muted">
              {formatDateTime(detail.paidAt ?? detail.createdAt)}
            </p>
            {(detail.extraCents ?? 0) !== 0 ? (
              <p className="text-sm font-extrabold text-mint">
                Gorjeta / extra: {formatBRL(detail.extraCents ?? 0)}
              </p>
            ) : null}
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
            <Button variant="mint" onClick={() => void confirmSettle()}>
              <Check className="h-5 w-5" />
              Confirmar pago
            </Button>
          </div>
        ) : null}
      </Modal>

      <Modal open={Boolean(paying)} title="Recebido!" onClose={() => setPaying(null)}>
        {paying && settings ? (
          <div className="flex flex-col gap-4">
            <p className="text-center text-lg font-bold">
              {paying.productName}
              <span className="block text-3xl font-black text-sun">
                {formatBRL(paying.totalCents)}
              </span>
            </p>
            {pixPayload ? (
              <PixQr payload={pixPayload} size={200} label="Se ainda precisar do QR" />
            ) : null}
            <Button variant="ghost" onClick={() => setPaying(null)}>
              Fechar
            </Button>
          </div>
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
