import Stripe from "stripe";

export const runtime = "nodejs";

const PRICE_IDS = {
  pro: "price_1U96hbBkxEAZdEGdotk2YTG4",
  negocio: "price_1U9XItBkxEAZdEGdmlGyzYsk",
};

function planKey(plan) {
  if (plan === "negocio" || plan === "equipe") return "negocio";
  if (plan === "pro") return "pro";
  return "pro";
}

function returnUrl(request) {
  const referer =
    request.headers.get("referer") ||
    request.headers.get("referrer") ||
    request.headers.get("origin");
  const base = (referer || "https://pixdaconfianca.com").replace(/\/$/, "");
  return `${base}/?session_id={CHECKOUT_SESSION_ID}`;
}

export async function POST(request) {
  try {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      const err = new Error("STRIPE_SECRET_KEY ausente");
      console.error("Stripe Session Error:", err);
      return Response.json({ error: err.message }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const plan = planKey(typeof body.plan === "string" ? body.plan : "pro");
    const selectedPriceId = PRICE_IDS[plan];

    const stripe = new Stripe(secret);
    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      mode: "subscription",
      line_items: [{ price: selectedPriceId, quantity: 1 }],
      return_url: returnUrl(request),
    });

    return Response.json({
      clientSecret: session.client_secret,
      sessionId: session.id,
    });
  } catch (err) {
    console.error("Stripe Session Error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 400 });
  }
}
