"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadStripe, type Stripe, type StripeEmbeddedCheckout } from "@stripe/stripe-js";
import { Button } from "@/components/ui";
import {
  PLANS,
  STRIPE_PUBLISHABLE_KEY,
  type PaidPlan,
} from "@/lib/plan";
import { activatePlan } from "@/lib/repo";
import { toast } from "@/lib/toast";

const FAIL_MSG = "Transação não concluída, tente novamente";

export function StripeEmbeddedCheckout({
  planId,
  onBack,
  onDone,
}: {
  planId: PaidPlan;
  onBack: () => void;
  onDone: () => void;
}) {
  const plan = PLANS[planId];
  const publicPlan = planId === "equipe" ? "negocio" : "pro";
  const checkoutRef = useRef<StripeEmbeddedCheckout | null>(null);
  const onDoneRef = useRef(onDone);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  const destroyCheckout = useCallback(() => {
    const current = checkoutRef.current;
    checkoutRef.current = null;
    if (!current) return;
    try {
      current.destroy();
    } catch {
      try {
        current.unmount();
      } catch {
        /* already gone */
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setLoading(true);
      setError("");
      destroyCheckout();

      try {
        const response = await fetch("/api/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: publicPlan }),
        });
        const data = (await response.json().catch(() => ({}))) as {
          clientSecret?: string;
          error?: string;
        };
        if (!response.ok || data.error || !data.clientSecret) {
          console.error("[create-checkout-session]", data.error || data, response.status);
          throw new Error(data.error || FAIL_MSG);
        }

        if (!STRIPE_PUBLISHABLE_KEY) {
          console.error("[create-checkout-session] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ausente");
          throw new Error(FAIL_MSG);
        }

        const stripe = await loadStripe(STRIPE_PUBLISHABLE_KEY);
        if (!stripe) throw new Error(FAIL_MSG);
        if (cancelled) return;

        const checkoutApi = stripe as Stripe & {
          initEmbeddedCheckout?: Stripe["createEmbeddedCheckoutPage"];
        };
        const startCheckout =
          checkoutApi.initEmbeddedCheckout ?? checkoutApi.createEmbeddedCheckoutPage;
        const checkout = await startCheckout.call(checkoutApi, {
          clientSecret: data.clientSecret,
          onComplete: () => {
            void (async () => {
              destroyCheckout();
              await activatePlan(planId);
              toast(
                planId === "equipe"
                  ? "Pagamento confirmado. Plano NEGÓCIO ativo neste aparelho."
                  : "Pagamento confirmado. Plano PRO ativo neste aparelho.",
              );
              onDoneRef.current();
            })();
          },
        } as Parameters<Stripe["createEmbeddedCheckoutPage"]>[0]);
        if (cancelled) {
          checkout.destroy();
          return;
        }
        checkoutRef.current = checkout;
        checkout.mount("#checkout-container");
        setLoading(false);
      } catch (err) {
        console.error("[create-checkout-session]", err);
        if (!cancelled) {
          destroyCheckout();
          setError(FAIL_MSG);
          setLoading(false);
        }
      }
    }

    void start();
    return () => {
      cancelled = true;
      destroyCheckout();
    };
  }, [destroyCheckout, planId, publicPlan, retry]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-center text-lg font-black leading-tight">
        {plan.name}
        <span className="mt-1 block text-sm font-bold text-muted">
          {plan.priceLabel} · Pix ou cartão, sem sair do app
        </span>
      </p>

      {error ? (
        <p className="rounded-2xl border-2 border-alert bg-alert/15 px-3 py-3 text-center text-sm font-extrabold text-alert">
          {error}
        </p>
      ) : null}

      {loading && !error ? (
        <p className="text-center text-sm font-bold text-muted">
          Carregando pagamento…
        </p>
      ) : null}

      <div
        id="checkout-container"
        className={`overflow-hidden rounded-2xl bg-white ${
          error ? "hidden" : "min-h-[280px]"
        }`}
      />

      {error ? (
        <Button
          variant="line"
          onClick={() => {
            setRetry((n) => n + 1);
          }}
        >
          Tentar novamente
        </Button>
      ) : null}

      <Button
        variant="ghost"
        onClick={() => {
          destroyCheckout();
          onBack();
        }}
      >
        Voltar aos planos
      </Button>
    </div>
  );
}
