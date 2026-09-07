"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, Sparkles } from "lucide-react";
import { BillingToggle } from "@/components/BillingToggle";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { Button, Modal } from "@/components/ui";
import { APP_NAME } from "@/lib/brand";
import {
  getUpgradeReason,
  PLANS,
  planAnnualSaveHint,
  planPriceLabel,
  subscribeUpgradeModal,
  type BillingInterval,
  type PaidPlan,
} from "@/lib/plan";

export function UpgradeModal() {
  const [open, setOpen] = useState(false);
  const [checkout, setCheckout] = useState<PaidPlan | null>(null);
  const [reason, setReason] = useState("");
  const [interval, setInterval] = useState<BillingInterval>("month");

  useEffect(() => subscribeUpgradeModal(() => {
    setCheckout(null);
    setReason(getUpgradeReason());
    setOpen(true);
  }), []);

  function close() {
    if (checkout) {
      setCheckout(null);
      return;
    }
    setReason("");
    setOpen(false);
  }

  return (
    <Modal
      open={open}
      title={checkout ? "Assinar via Pix" : "GRÁTIS · PRO · NEGÓCIO"}
      onClose={close}
      wide={Boolean(checkout)}
    >
      {checkout ? (
        <StripeEmbeddedCheckout
          planId={checkout}
          interval={interval}
          onBack={() => setCheckout(null)}
          onDone={() => {
            setCheckout(null);
            setOpen(false);
          }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {reason ? (
            <p className="rounded-2xl border-2 border-sun bg-ink px-3 py-2 text-sm font-extrabold leading-snug text-sun">
              {reason}
            </p>
          ) : null}
          <p className="text-sm font-bold text-muted">
            Escolha o plano do {APP_NAME}. O Pix Confiança básico continua
            ilimitado no grátis.
          </p>
          <BillingToggle value={interval} onChange={setInterval} />
          <PlanCard
            name={PLANS.free.name}
            price={planPriceLabel("free", interval)}
            features={[...PLANS.free.features]}
            tone="free"
            action={
              <Button variant="line" className="w-full" onClick={() => setOpen(false)}>
                Continuar grátis
              </Button>
            }
          />
          <PlanCard
            name={PLANS.pro.name}
            price={planPriceLabel("pro", interval)}
            hint={interval === "year" ? planAnnualSaveHint("pro") : undefined}
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
            price={planPriceLabel("equipe", interval)}
            hint={
              interval === "year"
                ? `Mais Popular · ${planAnnualSaveHint("equipe")}`
                : "Mais Popular"
            }
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
  hint,
  features,
  tone,
  action,
}: {
  name: string;
  price: string;
  hint?: string;
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
      {hint ? (
        <p className="mt-1 text-xs font-extrabold uppercase tracking-wide text-sun">
          {hint}
        </p>
      ) : null}
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
