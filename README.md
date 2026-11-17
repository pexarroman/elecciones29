# Test de afinidad electoral 29N

40 preguntas con 4 respuestas cada una (una de PSOE, PP, Vox y Frente Amplio), sacadas de los programas de las elecciones generales del 29 de noviembre de 2026. Las respuestas se muestran sin partido y en orden aleatorio; al final se ve el porcentaje de cada partido, el más afín, las respuestas elegidas con su partido y la fuente (página y cita) de todas las respuestas. Todo es gratis.

Web 100 % estática: no hay servidor, base de datos ni pagos. Se puede publicar en Cloudflare Pages, GitHub Pages, Netlify, etc.

```
public/                  lo que se publica
  index.html, app.js, style.css, config.js, legal.html
  img/instagram.svg      icono del enlace a Instagram (puedes sustituirlo)
  data/preguntas.json    preguntas y respuestas
  data/detalle.json      partido, página y cita de cada respuesta
  vendor/jspdf…          generador de PDF (local, sin CDN)
  fonts/                 tipografías locales (sin Google Fonts: RGPD)
banco-preguntas-29N.json fuente de verdad del banco
tools/build_data.py      regenera preguntas.json y detalle.json
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

## Probar en local

```
npm run dev          # http://localhost:8788
```

## Cambiar preguntas

Edita `banco-preguntas-29N.json` y ejecuta `npm run datos`. Cada pregunta debe tener exactamente 4 respuestas, una por partido (el script lo comprueba). Verifica antes cada cita contra el PDF del programa.

## Privacidad

Las respuestas se calculan en el navegador y no se envían a ningún sitio.
