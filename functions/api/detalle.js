// Cloudflare Pages Function: GET /api/detalle?s=<id de sesión de Stripe Checkout>
// Comprueba con Stripe que esa sesión está pagada y, solo entonces, devuelve las fuentes completas.
//
// Variables de entorno (Cloudflare → tu proyecto → Settings → Variables and Secrets):
//   STRIPE_SECRET_KEY    (obligatoria, tipo Secret) clave restringida rk_live_... con permiso de lectura de Checkout Sessions
//   STRIPE_PAYMENT_LINK  (recomendada) id del Payment Link del PDF, empieza por plink_...
//   PRECIO_CENTIMOS      (opcional) importe mínimo en céntimos; por defecto 300 (3 €)
import detalle from "../../privado/detalle.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
});

export async function onRequest({ request, env }) {
  if (request.method !== "GET") return json({ error: "metodo" }, 405);
  const id = new URL(request.url).searchParams.get("s") || "";
  if (!/^cs_(live|test)_[A-Za-z0-9]{10,200}$/.test(id)) return json({ error: "sesion_invalida" }, 400);
  if (!env.STRIPE_SECRET_KEY) return json({ error: "sin_configurar" }, 500);

  let ses;
  try {
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions/" + encodeURIComponent(id), {
      headers: { authorization: "Bearer " + env.STRIPE_SECRET_KEY },
    });
    if (r.status === 404) return json({ error: "sesion_no_encontrada" }, 404);
    if (!r.ok) return json({ error: "stripe_" + r.status }, 502);
    ses = await r.json();
  } catch {
    return json({ error: "stripe_no_responde" }, 502);
  }

  const minimo = parseInt(env.PRECIO_CENTIMOS || "300", 10);
  const pagado = ses.payment_status === "paid" || ses.payment_status === "no_payment_required";
  if (!pagado) return json({ error: "no_pagado" }, 402);
  if (env.STRIPE_PAYMENT_LINK && ses.payment_link !== env.STRIPE_PAYMENT_LINK) return json({ error: "otro_producto" }, 402);
  if (String(ses.currency).toLowerCase() !== "eur" || !(ses.amount_total >= minimo)) return json({ error: "importe" }, 402);

  return json(detalle);
}
