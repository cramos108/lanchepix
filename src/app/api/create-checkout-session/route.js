import Stripe from "stripe";

export const runtime = "nodejs";

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

function catalogFor(plan) {
  const isNegocio = plan === "negocio" || plan === "equipe";
  return {
    key: isNegocio ? "negocio" : "pro",
    name: isNegocio ? "Pix da Confiança Negócio" : "Pix da Confiança Pro",
    amount: isNegocio ? 2490 : 990,
    priceId:
      (isNegocio
        ? process.env.STRIPE_PRICE_NEGOCIO || process.env.NEXT_PUBLIC_STRIPE_PRICE_NEGOCIO
        : process.env.STRIPE_PRICE_PRO || process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO) || "",
  };
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
    const requestedPriceId =
      typeof body.priceId === "string" ? body.priceId.trim() : "";
    const catalog = catalogFor(body.plan);
    const allowed = [
      process.env.STRIPE_PRICE_PRO,
      process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO,
      process.env.STRIPE_PRICE_NEGOCIO,
      process.env.NEXT_PUBLIC_STRIPE_PRICE_NEGOCIO,
    ].filter(Boolean);

    let lineItems;
    if (requestedPriceId && allowed.includes(requestedPriceId)) {
      lineItems = [{ price: requestedPriceId, quantity: 1 }];
    } else if (catalog.priceId) {
      lineItems = [{ price: catalog.priceId, quantity: 1 }];
    } else {
      lineItems = [
        {
          price_data: {
            currency: "brl",
            product_data: { name: catalog.name },
            unit_amount: catalog.amount,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ];
    }

    const stripe = new Stripe(secret);
    const origin = originFromRequest(request);
    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      mode: "subscription",
      line_items: lineItems,
      locale: "pt-BR",
      return_url: `${origin}/pro/sucesso?session_id={CHECKOUT_SESSION_ID}&plan=${catalog.key}`,
      metadata: { plan: catalog.key },
    });

    return Response.json({
      clientSecret: session.client_secret,
      sessionId: session.id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao criar sessão";
    return Response.json({ error: message }, { status: 500 });
  }
}
