# Test de afinidad electoral 29N

40 preguntas con 4 respuestas cada una (una de PSOE, PP, Vox y Frente Amplio), sacadas de los programas de las elecciones generales del 29 de noviembre de 2026. Las respuestas se muestran sin partido y en orden aleatorio; al final se ve el porcentaje de cada partido, el más afín, las respuestas elegidas con su partido y la fuente (página y cita) de todas las respuestas. El test y el resultado son gratis; el PDF con las fuentes de las 40 preguntas cuesta 3 € (pago con Stripe).

Web estática con una sola función de servidor (`functions/api/detalle.js`) que comprueba el pago con Stripe y entrega las fuentes. Se puede publicar en Cloudflare Pages, GitHub Pages, Netlify, etc.

```
public/                  lo que se publica
  index.html, app.js, style.css, config.js, legal.html
  img/instagram.svg      icono del enlace a Instagram (puedes sustituirlo)
  data/preguntas.json    preguntas y respuestas
  data/muestra.json      fuentes de la pregunta 1 (muestra gratis)
functions/api/detalle.js comprueba el pago con Stripe y devuelve las fuentes
privado/detalle.js       fuentes de las 40 preguntas (NO se publica en public/)
  vendor/jspdf…          generador de PDF (local, sin CDN)
  fonts/                 tipografías locales (sin Google Fonts: RGPD)
banco-preguntas-29N.json fuente de verdad del banco
tools/build_data.py      regenera preguntas.json, muestra.json y privado/detalle.js
```

## Antes de publicar

1. `public/legal.html`: rellena titular y correo de contacto.
2. `public/config.js`: cuenta de Instagram (ya puesta: @reino.naciente).
3. Dominio propio (sin nombres de partidos).

## Despliegue (Cloudflare Pages)

1. Sube esta carpeta a tu repositorio de GitHub (puede ser público).
2. **Cloudflare → Workers & Pages → Create → Pages → Connect to Git**: elige el repo.
   - Framework: None · Build command: (vacío) · Build output directory: `public`
3. **Custom domains**: añade tu dominio.

## Pago (Stripe)

- `public/config.js` → `pagoUrl`: enlace de pago (Payment Link) de 3 €.
- En el Payment Link, tras el pago, redirigir a `https://elecciones29.pages.dev/?pago={CHECKOUT_SESSION_ID}`.
- Cloudflare → Settings → Variables and Secrets: `STRIPE_SECRET_KEY` (Secret, clave restringida con lectura de Checkout Sessions) y `STRIPE_PAYMENT_LINK` (id `plink_...`).

## Probar en local

```
MOCK_STRIPE=1 npm run dev    # http://localhost:8788, Stripe simulado (?pago=cs_test_pagado00000)
```

## Cambiar preguntas

Edita `banco-preguntas-29N.json` y ejecuta `npm run datos`. Cada pregunta debe tener exactamente 4 respuestas, una por partido (el script lo comprueba). Verifica antes cada cita contra el PDF del programa.

## Privacidad

Las respuestas se calculan en el navegador y no se envían a ningún sitio.
