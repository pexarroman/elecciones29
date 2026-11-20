// Servidor local de pruebas: sirve public/ en http://localhost:8788 y la función /api/detalle.
// Con MOCK_STRIPE=1 simula Stripe (sesiones cs_test_pagado, cs_test_impagado, cs_test_barato, cs_test_otro).
// Sin MOCK_STRIPE usa la clave real de la variable de entorno STRIPE_SECRET_KEY.
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { onRequest } from "../functions/api/detalle.js";
const root = path.resolve("public");
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png" };
const env = { STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || "", STRIPE_PAYMENT_LINK: process.env.STRIPE_PAYMENT_LINK || "" };

if (process.env.MOCK_STRIPE) {
  env.STRIPE_SECRET_KEY = "rk_test_simulada"; env.STRIPE_PAYMENT_LINK = "plink_pdf";
  const S = {
    cs_test_pagado00000: { payment_status: "paid", currency: "eur", amount_total: 300, payment_link: "plink_pdf" },
    cs_test_impagado000: { payment_status: "unpaid", currency: "eur", amount_total: 300, payment_link: "plink_pdf" },
    cs_test_barato00000: { payment_status: "paid", currency: "eur", amount_total: 100, payment_link: "plink_pdf" },
    cs_test_otro0000000: { payment_status: "paid", currency: "eur", amount_total: 500, payment_link: "plink_donacion" },
  };
  const real = globalThis.fetch;
  globalThis.fetch = async (url, opt) => {
    const m = String(url).match(/api\.stripe\.com\/v1\/checkout\/sessions\/(.+)$/);
    if (!m) return real(url, opt);
    const ses = S[decodeURIComponent(m[1])];
    return new Response(JSON.stringify(ses || { error: {} }), { status: ses ? 200 : 404 });
  };
}

http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://localhost:8788");
  if (u.pathname === "/api/detalle") {
    const r = await onRequest({ request: new Request(u, { method: req.method }), env });
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(await r.text()); return;
  }
  let p = decodeURIComponent(u.pathname); if (p.endsWith("/")) p += "index.html";
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); res.end("404"); return; }
  res.writeHead(200, { "content-type": mime[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
}).listen(8788, () => console.log("http://localhost:8788"));
