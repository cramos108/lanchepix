"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, MessageCircle, Star, X } from "lucide-react";
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
  upsertCustomer,
} from "@/lib/repo";
import { toast } from "@/lib/toast";
import { loyaltyStampMessage, paymentReminderMessage, waLink } from "@/lib/whatsapp";
import type { Sale } from "@/lib/types";

export default function PendentesPage() {
  const sales = useLiveQuery(
    () =>
      db.sales
        .filter((s) => s.status === "pending")
        .toArray()
        .then((rows) =>
          rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        ),
    [],
  );
  const settings = useLiveQuery(() => db.settings.get("app"), []);
  const [paying, setPaying] = useState<Sale | null>(null);
  const [stampAsk, setStampAsk] = useState<Sale | null>(null);

  async function pay(sale: Sale) {
    const updated = await markSalePaid(sale.id);
    toast("Marcado como pago. Estoque baixado.");
    setPaying(updated ?? sale);
    if (sale.customerPhone) setStampAsk(sale);
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

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-bold text-muted">
        Toque em <span className="text-sun">Pago</span> quando o Pix cair. Só aí o
        estoque é descontado. Esta lista é o Pix Confiança.
      </p>

      {sales && sales.length === 0 ? (
        <EmptyState
          title="Nada no Pix Confiança"
          text="Quando alguém levar e pagar depois, a venda aparece aqui."
        />
      ) : null}

      <ul className="flex flex-col gap-3">
        {sales?.map((sale) => (
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
              <Button variant="mint" onClick={() => void pay(sale)}>
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
