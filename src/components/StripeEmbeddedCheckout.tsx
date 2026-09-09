"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { loadStripe, type StripeEmbeddedCheckout } from "@stripe/stripe-js";
import { Button, Field, inputClass } from "@/components/ui";
import { db } from "@/lib/db";
import {
  PLANS,
  STRIPE_PUBLISHABLE_KEY,
  planPriceLabel,
  type BillingInterval,
  type PaidPlan,
} from "@/lib/plan";
import { digitsOnly } from "@/lib/phone";
import { activatePlan } from "@/lib/repo";
import { toast } from "@/lib/toast";

function isValidBrTaxId(value: string): boolean {
  const digits = digitsOnly(value);
  return digits.length === 11 || digits.length === 14;
}

function errorLabel(message: string): string {
  const text = message.trim() || "Transação não concluída, tente novamente";
  return text.startsWith("Error:") ? text : `Error: ${text}`;
}

export function StripeEmbeddedCheckout({
  planId,
  interval = "month",
  onBack,
  onDone,
}: {
  planId: PaidPlan;
  interval?: BillingInterval;
  onBack: () => void;
  onDone: () => void;
}) {
  const plan = PLANS[planId];
  const publicPlan = planId === "equipe" ? "negocio" : "pro";
  const priceLabel = planPriceLabel(planId === "equipe" ? "equipe" : "pro", interval);
  const checkoutRef = useRef<StripeEmbeddedCheckout | null>(null);
  const onDoneRef = useRef(onDone);
  const settings = useLiveQuery(() => db.settings.get("app"), []);
  const [taxId, setTaxId] = useState("");
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
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
    if (!started) return;
    let cancelled = false;

    async function start() {
      setLoading(true);
      setError("");
      destroyCheckout();

      try {
        const response = await fetch("/api/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plan: publicPlan,
            interval,
            vendorId: settings?.vendorId || "",
            taxId: digitsOnly(taxId),
          }),
        });
        const data = (await response.json().catch(() => ({}))) as {
          clientSecret?: string;
          error?: string;
        };

        if (!response.ok || data.error || !data.clientSecret) {
          const apiError = data.error || `HTTP ${response.status}`;
          console.error("Stripe Session Error:", apiError, data);
          throw new Error(apiError);
        }

        if (!STRIPE_PUBLISHABLE_KEY) {
          throw new Error("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ausente");
        }

        const stripe = await loadStripe(STRIPE_PUBLISHABLE_KEY);
        if (!stripe) throw new Error("Falha ao carregar Stripe.js");
        if (cancelled) return;

        if (typeof stripe.createEmbeddedCheckoutPage !== "function") {
          throw new Error("stripe.createEmbeddedCheckoutPage indisponível");
        }
        const checkout = await stripe.createEmbeddedCheckoutPage({
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
        });
        if (cancelled) {
          checkout.destroy();
          return;
        }
        checkoutRef.current = checkout;
        checkout.mount("#checkout-container");
        setLoading(false);
      } catch (err) {
        console.error("Stripe Session Error:", err);
        if (!cancelled) {
          destroyCheckout();
          const message = err instanceof Error ? err.message : String(err);
          setError(errorLabel(message));
          setLoading(false);
        }
      }
    }

    void start();
    return () => {
      cancelled = true;
      destroyCheckout();
    };
  }, [destroyCheckout, interval, planId, publicPlan, retry, settings?.vendorId, started, taxId]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-center text-lg font-black leading-tight">
        {plan.name}
        <span className="mt-1 block text-sm font-bold text-muted">
          {priceLabel} · Pix ou cartão, sem sair do app
        </span>
      </p>

      {!started ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!isValidBrTaxId(taxId)) {
              toast("Informe um CPF ou CNPJ válido.", "err");
              return;
            }
            setStarted(true);
          }}
        >
          <Field
            label="CPF ou CNPJ"
            hint="Obrigatório para Pix. No teste, use 000.000.000-00."
          >
            <input
              className={inputClass}
              inputMode="numeric"
              autoComplete="off"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              placeholder="000.000.000-00"
            />
          </Field>
          <Button type="submit">Continuar para Pix ou cartão</Button>
        </form>
      ) : null}

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
          error || !started ? "hidden" : "min-h-[280px]"
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
