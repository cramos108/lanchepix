"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, Copy, Sparkles } from "lucide-react";
import { PixQr } from "@/components/PixQr";
import { Button, Modal } from "@/components/ui";
import { APP_NAME } from "@/lib/brand";
import { formatBRL } from "@/lib/money";
import { buildPixPayload } from "@/lib/pix";
import {
  PLANS,
  SUBSCRIBE_PIX_CITY,
  SUBSCRIBE_PIX_KEY,
  SUBSCRIBE_PIX_NAME,
  subscribeUpgradeModal,
  type PaidPlan,
} from "@/lib/plan";
import { activatePlan } from "@/lib/repo";
import { toast } from "@/lib/toast";

export function UpgradeModal() {
  const [open, setOpen] = useState(false);
  const [checkout, setCheckout] = useState<PaidPlan | null>(null);

  useEffect(() => subscribeUpgradeModal(() => {
    setCheckout(null);
    setOpen(true);
  }), []);

  function close() {
    setOpen(false);
    setCheckout(null);
  }

  return (
    <Modal
      open={open}
      title={checkout ? "Assinar via Pix" : "GRÁTIS · PRO · NEGÓCIO"}
      onClose={close}
    >
      {checkout ? (
        <PixCheckout
          planId={checkout}
          onBack={() => setCheckout(null)}
          onDone={close}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-bold text-muted">
            Escolha o plano do {APP_NAME}. O Pix Confiança básico continua
            ilimitado no grátis.
          </p>
          <PlanCard
            name={PLANS.free.name}
            price={PLANS.free.priceLabel}
            features={[...PLANS.free.features]}
            tone="free"
            action={
              <Button variant="line" className="w-full" onClick={close}>
                Continuar grátis
              </Button>
            }
          />
          <PlanCard
            name={PLANS.pro.name}
            price={PLANS.pro.priceLabel}
            features={[...PLANS.pro.features]}
            tone="pro"
            action={
              <Button className="w-full" onClick={() => setCheckout("pro")}>
                <Sparkles className="h-5 w-5" />
                Assinar via Pix
              </Button>
            }
          />
          <PlanCard
            name={PLANS.equipe.name}
            price={PLANS.equipe.priceLabel}
            features={[...PLANS.equipe.features]}
            tone="equipe"
            action={
              <Button variant="mint" className="w-full" onClick={() => setCheckout("equipe")}>
                <Sparkles className="h-5 w-5" />
                Assinar via Pix
              </Button>
            }
          />
        </div>
      )}
    </Modal>
  );
}

function PlanCard({
  name,
  price,
  features,
  tone,
  action,
}: {
  name: string;
  price: string;
  features: string[];
  tone: "free" | "pro" | "equipe";
  action: ReactNode;
}) {
  const border =
    tone === "pro"
      ? "border-sun"
      : tone === "equipe"
        ? "border-mint"
        : "border-line";
  const priceColor =
    tone === "pro" ? "text-sun" : tone === "equipe" ? "text-mint" : "text-white";
  return (
    <section className={`rounded-3xl border-2 ${border} bg-surface p-4`}>
      <p className="text-xs font-extrabold uppercase tracking-widest text-muted">
        {name}
      </p>
      <p className={`mt-1 text-2xl font-black ${priceColor}`}>{price}</p>
      <ul className="mt-3 flex flex-col gap-1.5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm font-bold leading-snug">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-mint" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4">{action}</div>
    </section>
  );
}

function PixCheckout({
  planId,
  onBack,
  onDone,
}: {
  planId: PaidPlan;
  onBack: () => void;
  onDone: () => void;
}) {
  const plan = PLANS[planId];
  const payload = useMemo(() => {
    try {
      return buildPixPayload({
        pixKey: SUBSCRIBE_PIX_KEY,
        merchantName: SUBSCRIBE_PIX_NAME,
        merchantCity: SUBSCRIBE_PIX_CITY,
        amountCents: plan.cents,
        description: planId === "equipe" ? "Plano Negocio" : "Plano Pro",
      });
    } catch {
      return "";
    }
  }, [plan.cents, planId]);

  async function copyPix() {
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(payload);
      toast("Código Pix copiado");
    } catch {
      toast("Não deu para copiar. Selecione o código.", "err");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-lg font-black leading-tight">
        {plan.name}
        <span className="mt-1 block text-3xl text-sun">{formatBRL(plan.cents)}</span>
        <span className="block text-sm font-bold text-muted">por mês, via Pix</span>
      </p>
      {payload ? (
        <PixQr payload={payload} size={220} label="Pague no app do seu banco" />
      ) : (
        <p className="text-center text-sm font-bold text-alert">
          Não foi possível gerar o QR. Pague {formatBRL(plan.cents)} via Pix e
          toque em Já paguei.
        </p>
      )}
      {payload ? (
        <Button variant="line" onClick={() => void copyPix()}>
          <Copy className="h-5 w-5" />
          Copiar código Pix
        </Button>
      ) : null}
      <Button
        onClick={async () => {
          await activatePlan(planId);
          onDone();
          toast(
            planId === "equipe"
              ? "Plano Negócio ativado neste aparelho"
              : "Plano Pro ativado neste aparelho",
          );
        }}
      >
        Já paguei — ativar {planId === "equipe" ? "Negócio" : "Pro"}
      </Button>
      <Button variant="ghost" onClick={onBack}>
        Voltar aos planos
      </Button>
    </div>
  );
}
