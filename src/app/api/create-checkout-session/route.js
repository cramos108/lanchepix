import Stripe from "stripe";

export const runtime = "nodejs";

const PRICE_IDS = {
  pro: "price_1U96hbBkxEAZdEGdotk2YTG4",
  negocio: "price_1U9XItBkxEAZdEGdmlGyzYsk",
};

function originFromRequest(request) {
  const env = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (env) return env;
  const proto = request.headers.get("x-forwarded-proto") || "http";
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    "localhost:3000";
  return `${proto}://${host}`;
}

function planKey(plan) {
  if (plan === "negocio" || plan === "equipe") return "negocio";
  return "pro";
}

export async function POST(request) {
  try {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      return Response.json(
        { error: "Stripe não configurado" },
        { status: 500 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const plan = planKey(body.plan);
    const priceId = PRICE_IDS[plan];

    const stripe = new Stripe(secret);
    const origin = originFromRequest(request);
    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      locale: "pt-BR",
      return_url: `${origin}/pro/sucesso?session_id={CHECKOUT_SESSION_ID}&plan=${plan}`,
      metadata: { plan },
    });

    return Response.json({
      clientSecret: session.client_secret,
      sessionId: session.id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao criar sessão";
    console.error("[create-checkout-session]", error);
    return Response.json({ error: message }, { status: 500 });
  }
}
