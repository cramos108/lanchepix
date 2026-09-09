import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function supabaseAdmin() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
    .replace(/\/rest\/v1\/?$/, "")
    .replace(/\/$/, "");
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    "";
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function paidPlanFromMeta(meta) {
  const plan = String(meta?.plan ?? "").trim();
  if (plan === "equipe" || plan === "negocio") return "equipe";
  return "pro";
}

async function activateRemotePlan(vendorId, plan) {
  const id = String(vendorId ?? "").trim();
  if (!id) return;
  const db = supabaseAdmin();
  if (!db) {
    console.error("Stripe webhook: Supabase não configurado");
    return;
  }
  const { error } = await db
    .from("settings")
    .update({
      plan,
      updated_at: new Date().toISOString(),
    })
    .eq("vendor_id", id);
  if (error) {
    console.error("Stripe webhook: falha ao atualizar plano", error.message);
  }
}

function metaFromSession(session) {
  return {
    vendorId: session.client_reference_id || session.metadata?.vendor_id || "",
    plan: paidPlanFromMeta(session.metadata),
  };
}

export async function POST(request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret || !webhookSecret) {
    return Response.json({ error: "Stripe webhook não configurado" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Assinatura ausente" }, { status: 400 });
  }

  const payload = await request.text();
  const stripe = new Stripe(secret);
  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Stripe webhook signature:", message);
    return Response.json({ error: "Assinatura inválida" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      if (session.payment_status === "paid" || session.status === "complete") {
        const { vendorId, plan } = metaFromSession(session);
        await activateRemotePlan(vendorId, plan);
      }
    }

    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object;
      const vendorId = intent.metadata?.vendor_id || "";
      const plan = paidPlanFromMeta(intent.metadata);
      if (vendorId) await activateRemotePlan(vendorId, plan);
    }

    if (event.type === "invoice.paid") {
      const invoice = event.data.object;
      const vendorId =
        invoice.subscription_details?.metadata?.vendor_id ||
        invoice.parent?.subscription_details?.metadata?.vendor_id ||
        invoice.metadata?.vendor_id ||
        "";
      const plan = paidPlanFromMeta(
        invoice.subscription_details?.metadata ||
          invoice.parent?.subscription_details?.metadata ||
          invoice.metadata,
      );
      if (vendorId) await activateRemotePlan(vendorId, plan);
    }
  } catch (err) {
    console.error("Stripe webhook handler:", err);
    return Response.json({ error: "Falha ao processar evento" }, { status: 500 });
  }

  return Response.json({ received: true });
}
