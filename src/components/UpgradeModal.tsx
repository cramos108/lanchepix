"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check, Sparkles } from "lucide-react";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { Button, Modal } from "@/components/ui";
import { APP_NAME } from "@/lib/brand";
import { PLANS, subscribeUpgradeModal, type PaidPlan } from "@/lib/plan";

export function UpgradeModal() {
  const [open, setOpen] = useState(false);
  const [checkout, setCheckout] = useState<PaidPlan | null>(null);

  useEffect(() => subscribeUpgradeModal(() => {
    setCheckout(null);
    setOpen(true);
  }), []);

  function close() {
    if (checkout) {
      setCheckout(null);
      return;
    }
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
          onBack={() => setCheckout(null)}
          onDone={() => {
            setCheckout(null);
            setOpen(false);
          }}
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
              <Button variant="line" className="w-full" onClick={() => setOpen(false)}>
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
