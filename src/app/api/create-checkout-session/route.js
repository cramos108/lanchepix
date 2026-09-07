import Stripe from "stripe";

export const runtime = "nodejs";

const PRICE_IDS = {
  pro: "price_1U96hbBkxEAZdEGdotk2YTG4",
  negocio: "price_1U9XItBkxEAZdEGdmlGyzYsk",
  pro_year:
    process.env.STRIPE_PRICE_PRO_YEAR?.trim() ||
    process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_YEAR?.trim() ||
    "",
  negocio_year:
    process.env.STRIPE_PRICE_NEGOCIO_YEAR?.trim() ||
    process.env.NEXT_PUBLIC_STRIPE_PRICE_NEGOCIO_YEAR?.trim() ||
    "",
};

function planKey(plan) {
  if (plan === "negocio" || plan === "equipe") return "negocio";
  if (plan === "pro") return "pro";
  return "pro";
}

function intervalKey(value) {
  return value === "year" ? "year" : "month";
}

function lineItems(plan, interval) {
  if (interval === "year") {
    const priced = plan === "negocio" ? PRICE_IDS.negocio_year : PRICE_IDS.pro_year;
    if (priced) return [{ price: priced, quantity: 1 }];
    const amount = plan === "negocio" ? 24900 : 9900;
    const name =
      plan === "negocio"
        ? "Pix da Confiança NEGÓCIO Anual"
        : "Pix da Confiança PRO Anual";
    return [
      {
        price_data: {
          currency: "brl",
          product_data: { name },
          unit_amount: amount,
          recurring: { interval: "year" },
        },
        quantity: 1,
      },
    ];
  }
  return [{ price: PRICE_IDS[plan], quantity: 1 }];
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
    const interval = intervalKey(body.interval);
    const customerEmail =
      typeof body.customerEmail === "string" && body.customerEmail.includes("@")
        ? body.customerEmail.trim()
        : undefined;

    const stripe = new Stripe(secret);
    const customer = await stripe.customers.create({
      ...(customerEmail ? { email: customerEmail } : {}),
      address: { country: "BR" },
    });

    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded_page",
      mode: "subscription",
      locale: "pt-BR",
      billing_address_collection: "auto",
      customer: customer.id,
      line_items: lineItems(plan, interval),
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
