(() => {
  "use strict";
  const CFG = window.CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const V = { inicio: $("v-inicio"), test: $("v-test"), resultado: $("v-resultado") };
  const ORDEN_PARTIDOS = ["PP", "PSOE", "VOX", "FA"];
  const CLAVE = "t29n26";

  let data = null;          // preguntas públicas (sin fuentes)
  let orders = {};          // qid -> [aid,...] orden aleatorio de respuestas
  let answers = {};         // qid -> aid | "none"
  let tie = {};             // desempate aleatorio por partido
  let idx = 0;
  let detalle = null;       // fuentes completas: solo llegan tras verificar el pago
  let muestra = null;       // fuentes de la pregunta 1 (muestra gratuita)
  const PAGO = CLAVE + "-pago";       // localStorage: sesión de Stripe ya verificada
  const PEND = CLAVE + "-pendiente";  // localStorage: respuestas guardadas al ir a pagar

  // ---------- almacenamiento seguro ----------
  const store = {
    get(k, area = "session") { try { return JSON.parse(window[area + "Storage"].getItem(k)); } catch { return null; } },
    set(k, v, area = "session") { try { window[area + "Storage"].setItem(k, JSON.stringify(v)); } catch {} },
    del(k, area = "session") { try { window[area + "Storage"].removeItem(k); } catch {} }
  };

  // ---------- utilidades ----------
  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  // Mezcla las respuestas de cada pregunta al azar, pero sin patrones: en el conjunto del test
  // cada partido aparece un número parecido de veces en cada posición (1.ª, 2.ª, 3.ª, 4.ª).
  function ordenEquilibrado() {
    const n = data.preguntas.length;
    const lim = Math.ceil(n / 4) + 1;
    let mejor = null;
    for (let intento = 0; intento < 400; intento++) {
      const cuenta = {}; const res = {}; let max = 0;
      data.preguntas.forEach((q) => {
        const ord = shuffle(q.respuestas.map((r) => r.id));
        res[q.id] = ord;
        ord.forEach((aid, pos) => {
          const r = q.respuestas.find((x) => x.id === aid);
          const k = pos + "|" + r.p.join("+");
          cuenta[k] = (cuenta[k] || 0) + 1; if (cuenta[k] > max) max = cuenta[k];
        });
      });
      if (!mejor || max < mejor.max) mejor = { res, max };
      if (max <= lim) break;
    }
    return mejor.res;
  }
  const show = (name) => { Object.entries(V).forEach(([k, el]) => { el.hidden = k !== name; }); window.scrollTo(0, 0); };
  const completo = () => !!data && data.preguntas.every((q) => answers[q.id]);
  const qById = (id) => data.preguntas.find((q) => String(q.id) === String(id));
  const nombre = (p) => data.partidos[p] || p;
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) { if (k === "class") n.className = v; else if (k === "text") n.textContent = v; else n.setAttribute(k, v); }
    kids.flat().forEach((c) => n.append(c));
    return n;
  };

  function persist() { store.set(CLAVE, { orders, answers, tie }); }

  // ---------- inicio ----------
  function newRun() {
    orders = {}; answers = {}; idx = 0;
    tie = Object.fromEntries(ORDEN_PARTIDOS.map((p) => [p, Math.random()]));
    orders = ordenEquilibrado();
    persist();
  }

  // ---------- test ----------
  function renderQ() {
    const q = data.preguntas[idx];
    const n = data.preguntas.length;
    $("t-count").textContent = `Pregunta ${idx + 1} de ${n}`;
    $("t-bar").style.width = `${(idx / n) * 100}%`;
    const pb = document.querySelector(".bar");
    pb.setAttribute("aria-valuenow", String(idx + 1)); pb.setAttribute("aria-valuemax", String(n));
    $("t-tema").textContent = q.tema;
    const h = $("t-pregunta"); h.textContent = q.pregunta;
    const box = $("t-opts"); box.replaceChildren();
    const chosen = answers[q.id];
    const mk = (aid, texto, extra = "") => {
      const b = el("button", { type: "button", class: "opt " + extra, "aria-pressed": String(chosen === aid) },
        el("span", { class: "box", "aria-hidden": "true" }), el("span", { text: texto }));
      if (chosen === aid) b.classList.add("is-on");
      b.addEventListener("click", () => choose(q, aid, b));
      return b;
    };
    orders[q.id].forEach((aid) => { const r = q.respuestas.find((x) => x.id === aid); box.append(mk(aid, r.texto)); });
    box.append(mk("none", "Ninguna de estas propuestas me encaja", "none"));
    $("btn-atras").hidden = idx === 0;
    h.focus({ preventScroll: true });
  }

  let locked = false;
  function choose(q, aid, btn) {
    if (locked) return;
    locked = true;
    answers[q.id] = aid; persist();
    document.querySelectorAll("#t-opts .opt").forEach((b) => { b.classList.remove("is-on"); b.setAttribute("aria-pressed", "false"); });
    btn.classList.add("is-on"); btn.setAttribute("aria-pressed", "true");
    setTimeout(() => {
      locked = false;
      if (idx < data.preguntas.length - 1) { idx++; renderQ(); window.scrollTo(0, 0); }
      else { renderResultado(); }
    }, 320);
  }

  // ---------- cálculo (todo en el navegador) ----------
  function calcular() {
    const pts = Object.fromEntries(ORDEN_PARTIDOS.map((p) => [p, 0]));
    let contadas = 0;
    data.preguntas.forEach((q) => {
      const a = answers[q.id];
      if (!a || a === "none") return;
      const r = q.respuestas.find((x) => x.id === a);
      if (!r) return;
      contadas++;
      r.p.forEach((p) => { pts[p]++; });
    });
    const filas = ORDEN_PARTIDOS.map((p) => ({ p, pts: pts[p], pct: contadas ? Math.round((pts[p] / contadas) * 100) : 0 }));
    filas.sort((a, b) => b.pts - a.pts || tie[a.p] - tie[b.p]);
    return { filas, contadas };
  }

  function lista(partidos) {
    const n = partidos.map(nombre);
    return n.length <= 1 ? n.join("") : n.slice(0, -1).join(", ") + " y " + n[n.length - 1];
  }

  // ---------- resultado ----------
  function renderResultado() {
    const { filas, contadas } = calcular();
    show("resultado");
    $("r-sub").textContent = contadas ? `Calculado sobre ${contadas} de ${data.preguntas.length} preguntas` : "Sin propuestas elegidas";
    const max = filas[0].pts;
    const lideres = filas.filter((f) => f.pts === max);
    const h = $("r-titulo");
    h.textContent = !contadas || max === 0
      ? "Ninguna de las propuestas que elegiste coincide con los programas."
      : lideres.length === 1 ? `Coincides más con ${nombre(lideres[0].p)}.`
      : `Empate entre ${lista(lideres.map((l) => l.p))}.`;
    const ol = $("r-ranking"); ol.replaceChildren();
    filas.forEach((f) => {
      const li = el("li", { class: f.pts === max && max > 0 ? "lider" : "" },
        el("span", { class: "nombre", text: nombre(f.p) }),
        el("span", { class: "pct", text: `${f.pct} %` }),
        el("span", { class: "track", "aria-hidden": "true" }, el("span", { class: "fill" })),
        el("span", { class: "det", text: `${f.pts} de ${contadas} propuestas elegidas` }));
      ol.append(li);
      requestAnimationFrame(() => requestAnimationFrame(() => { li.querySelector(".fill").style.width = f.pct + "%"; }));
    });
    $("r-nota").textContent = "Mide coincidencia con propuestas de los programas del 29N, no intención de voto ni calidad de las medidas.";
    renderMuestra();
    actualizarPago();
    h.focus({ preventScroll: true });
  }

  function tarjeta(q, i, dq, abierta) {
    const mi = answers[q.id];
    const caja = el("div", { class: "dq" }, el("h4", {}, el("span", { text: `${i + 1}. ${q.tema}` }), q.pregunta));
    (orders[q.id] || q.respuestas.map((r) => r.id)).forEach((aid) => {
      const r = q.respuestas.find((x) => x.id === aid);
      const d = dq.respuestas[r.id];
      const bloque = el("div", { class: "da" + (mi === r.id ? " elegida" : "") },
        el("p", { text: r.texto }),
        el("div", { class: "quien" }, el("span", { class: "tag", text: lista(d.partidos) }), mi === r.id ? el("span", { class: "mia", text: "Tu elección" }) : ""));
      const det = el("details", {}, el("summary", { text: "Ver fuente en el programa" }));
      if (abierta) det.setAttribute("open", "");
      d.fuentes.forEach((f) => {
        det.append(el("blockquote", {}, `«${f.cita}»`, el("cite", { text: `${nombre(f.partido)} · programa 29N · página ${f.pag} del PDF${f.medida ? " · medida " + f.medida : ""}` })));
      });
      bloque.append(det);
      if (d.nota) bloque.append(el("div", { class: "nota", text: d.nota }));
      caja.append(bloque);
    });
    if (mi === "none") caja.append(el("p", { class: "small", text: "Elegiste «ninguna de estas propuestas me encaja»." }));
    return caja;
  }

  // Muestra gratuita: solo la pregunta 1, con sus fuentes.
  function renderMuestra() {
    const root = $("muestra"); root.replaceChildren();
    const q = data.preguntas[0];
    if (!muestra || !muestra.preguntas[q.id]) return;
    root.append(tarjeta(q, 0, muestra.preguntas[q.id], true));
  }

  // ---------- pago (Stripe) ----------
  const pagado = () => {
    const x = store.get(PAGO, "local");
    return x && x.s && Date.now() - x.t < 30 * 864e5 ? x.s : null;
  };
  function estado(msg, error) {
    document.querySelectorAll(V.resultado.hidden ? ".js-estado-inicio" : ".js-estado").forEach((p) => {
      p.textContent = msg || ""; p.hidden = !msg; p.classList.toggle("err", !!error);
    });
  }
  function actualizarPago() {
    const ok = !!pagado();
    document.querySelectorAll(".js-pdf").forEach((b) => { b.textContent = ok ? "Descargar PDF" : `Descargar PDF · ${CFG.precio || "3 €"}`; });
    document.querySelectorAll(".js-pdf-nota").forEach((p) => {
      p.textContent = ok ? "Ya has pagado: puedes descargarlo las veces que quieras desde este navegador."
        : "Pago único con Stripe. Al terminar el pago, el PDF se descarga automáticamente.";
    });
  }
  const mensajePago = (e) => ({
    no_pagado: "Stripe no confirma el pago de esta compra. Si has pagado, escríbenos con el recibo y lo resolvemos.",
    importe: "Stripe no confirma el pago de esta compra. Si has pagado, escríbenos con el recibo y lo resolvemos.",
    otro_producto: "Ese pago no corresponde al PDF. Si has pagado, escríbenos con el recibo y lo resolvemos.",
    sesion_no_encontrada: "No encontramos ese pago. Si has pagado, escríbenos con el recibo y lo resolvemos.",
    sin_configurar: "El pago todavía no está configurado en la web. Escríbenos y lo resolvemos.",
  }[e] || "No se pudo comprobar el pago ahora mismo. Recarga la página en un momento para volver a intentarlo.");

  async function cargarDetalle(sid) {
    try {
      const r = await fetch("/api/detalle?s=" + encodeURIComponent(sid), { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j && j.preguntas) { detalle = j; return null; }
      return j.error || "error";
    } catch { return "error"; }
  }

  async function botonPdf(ev) {
    const btn = ev && ev.currentTarget;
    const sid = pagado();
    if (sid) {
      if (!detalle) {
        if (btn) btn.disabled = true;
        estado("Preparando tu PDF…");
        const err = await cargarDetalle(sid);
        if (btn) btn.disabled = false;
        if (err) { estado(mensajePago(err), true); return; }
      }
      estado(""); pdf(); return;
    }
    const url = (CFG.pagoUrl || "").trim();
    if (!/^https:\/\/[a-z0-9.-]*stripe\.com\//.test(url)) { estado("El pago todavía no está configurado en la web.", true); return; }
    // Guardamos las respuestas para poder generar el PDF en la pestaña a la que vuelve Stripe.
    store.set(PEND, { orders, answers, tie, t: Date.now() }, "local");
    window.open(url, "_blank", "noopener");
    estado("Se ha abierto el pago de Stripe en una pestaña nueva. Al terminar, el PDF se descargará allí.");
  }

  // Vuelta desde Stripe: ?pago=cs_...
  async function volverDePago(sid) {
    const hayTest = completo();
    if (hayTest) renderResultado(); else show("inicio");
    estado("Comprobando el pago…");
    const err = await cargarDetalle(sid);
    if (err) { estado(mensajePago(err), true); return; }   // dejamos ?pago= en la dirección para poder reintentar recargando
    store.set(PAGO, { s: sid, t: Date.now() }, "local");
    store.del(PEND, "local");
    try { history.replaceState(null, "", location.pathname); } catch {}
    actualizarPago();
    if (hayTest) {
      estado("¡Gracias! Tu PDF se está descargando. Si no empieza, pulsa «Descargar PDF».");
      pdf();
    } else {
      estado("¡Gracias! El pago está confirmado, pero en este navegador no están tus respuestas. Haz el test y al final podrás descargar el PDF sin volver a pagar.");
    }
  }

  // ---------- PDF (se genera en el navegador) ----------
  const limpiar = (s) => String(s)
    .replace(/[   ]/g, " ").replace(/→/g, "->").replace(/≥/g, ">=").replace(/≤/g, "<=")
    .replace(/[^ -ÿ–—‘’“”•…€]/g, "");

  function pdf() {
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) { alert("No se pudo cargar el generador de PDF."); return; }
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const M = 16, W = 210 - 2 * M; let y = M;
    const salto = (h) => { if (y + h > 297 - M) { doc.addPage(); y = M; } };
    const texto = (t, size, style, color, gap = 1.2, indent = 0) => {
      doc.setFont("helvetica", style); doc.setFontSize(size); doc.setTextColor(...color);
      const lines = doc.splitTextToSize(limpiar(t), W - indent);
      const lh = size * 0.4;
      lines.forEach((l) => { salto(lh); doc.text(l, M + indent, y + lh * 0.8); y += lh * 1.1; });
      y += gap;
    };
    const NEGRO = [20, 22, 26], GRIS = [90, 96, 107];
    texto("Test de afinidad electoral 29N", 18, "bold", NEGRO, 1);
    texto("Detalle de tus respuestas. Fuente: programas electorales de las elecciones generales del 29 de noviembre de 2026.", 10, "normal", GRIS, 4);
    const { filas, contadas } = calcular();
    texto(`Tu resultado (sobre ${contadas} propuestas elegidas)`, 13, "bold", NEGRO, 1.5);
    filas.forEach((f) => texto(`${nombre(f.p)}: ${f.pct} %  (${f.pts} de ${contadas})`, 11, "normal", NEGRO, 0.6));
    y += 4;
    data.preguntas.forEach((q, i) => {
      const dq = detalle.preguntas[q.id]; const mi = answers[q.id];
      salto(24);
      texto(`${i + 1}. ${q.tema}`, 9, "normal", GRIS, 0.2);
      texto(q.pregunta, 12, "bold", NEGRO, 1.5);
      q.respuestas.forEach((r) => {
        const d = dq.respuestas[r.id];
        salto(18);
        texto(`${mi === r.id ? "[X] " : "[  ] "}${r.texto}`, 10, mi === r.id ? "bold" : "normal", NEGRO, 0.4, 2);
        texto(`Partido: ${lista(d.partidos)}${mi === r.id ? "  (tu elección)" : ""}`, 9, "bold", GRIS, 0.3, 8);
        d.fuentes.forEach((f) => texto(`${nombre(f.partido)}, pág. ${f.pag} del PDF${f.medida ? ", medida " + f.medida : ""}: «${f.cita}»`, 8.5, "normal", GRIS, 0.4, 8));
        if (d.nota) texto(`Nota: ${d.nota}`, 8.5, "normal", GRIS, 0.4, 8);
        y += 1.2;
      });
      if (mi === "none") texto("Elegiste «ninguna de estas propuestas me encaja».", 9, "normal", GRIS, 1);
      y += 3;
    });
    texto("Herramienta orientativa basada en programas electorales. No es una encuesta ni una recomendación de voto. Proyecto independiente.", 8, "normal", GRIS, 0);
    doc.save("test-afinidad-electoral-29N.pdf");
  }

  // ---------- compartir (imagen creada en el navegador) ----------
  async function compartir() {
    const { filas, contadas } = calcular();
    try { await document.fonts.load('500 40px "Newsreader"'); await document.fonts.load('700 30px "Schibsted Grotesk"'); } catch {}
    const W = 1080, H = 1350, c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d");
    g.fillStyle = "#F3F4F6"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#14161A";
    g.font = '500 76px "Newsreader", Georgia, serif';
    g.textBaseline = "top";
    g.fillText("Mi test de afinidad", 72, 90);
    g.fillText("electoral 29N", 72, 175);
    g.font = '400 34px "Schibsted Grotesk", sans-serif'; g.fillStyle = "#5A606B";
    g.fillText(`Sobre ${contadas} propuestas de programas, sin saber de quién eran`, 72, 290, W - 144);
    let y = 390; const max = filas[0].pts;
    filas.forEach((f) => {
      g.fillStyle = "#14161A"; g.font = '700 40px "Schibsted Grotesk", sans-serif';
      g.fillText(nombre(f.p), 72, y, 760);
      g.textAlign = "right"; g.font = '500 56px "Newsreader", Georgia, serif'; g.fillText(`${f.pct} %`, W - 72, y - 8); g.textAlign = "left";
      g.fillStyle = "#D5D9DF"; g.fillRect(72, y + 70, W - 144, 34);
      g.fillStyle = f.pts === max && max > 0 ? "#FFC400" : "#5A606B";
      g.fillRect(72, y + 70, (W - 144) * f.pct / 100, 34);
      if (f.pts === max && max > 0) { g.strokeStyle = "#14161A"; g.lineWidth = 4; g.strokeRect(72, y + 70, (W - 144) * f.pct / 100, 34); }
      y += 190;
    });
    g.fillStyle = "#14161A"; g.font = '700 38px "Schibsted Grotesk", sans-serif';
    g.fillText("Hazlo tú: " + location.host, 72, H - 120);
    const blob = await new Promise((r) => c.toBlob(r, "image/png"));
    const file = new File([blob], "mi-test-29N.png", { type: "image/png" });
    const msg = "Elige propuestas sin saber de quién son. Yo ya lo he hecho.";
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: msg, url: location.origin }); return; }
    } catch (e) { if (e && e.name === "AbortError") return; }
    const a = el("a", { href: URL.createObjectURL(blob), download: "mi-test-29N.png" }); document.body.append(a); a.click(); a.remove();
  }

  // ---------- arranque ----------
  async function init() {
    try { data = await (await fetch("data/preguntas.json")).json(); }
    catch { V.inicio.querySelector(".lead").textContent = "No se pudieron cargar las preguntas. Recarga la página."; return; }
    try { muestra = await (await fetch("data/muestra.json")).json(); } catch { muestra = null; }
    document.title = `Test de afinidad electoral 29N · ${data.preguntas.length} preguntas`;
    $("btn-empezar").textContent = `Empezar el test · unos ${Math.round(data.preguntas.length / 5)} minutos`;
    document.querySelectorAll("h1 + .lead").forEach(() => {});

    const ig = (CFG.instagramUrl || "").trim();
    document.querySelectorAll("[data-instagram]").forEach((a) => {
      if (!ig) { a.hidden = true; return; }
      a.href = ig;
      const u = a.querySelector("[data-instagram-user]");
      if (u && CFG.instagramUsuario) u.textContent = CFG.instagramUsuario;
    });

    $("btn-empezar").addEventListener("click", () => { newRun(); show("test"); renderQ(); });
    $("btn-atras").addEventListener("click", () => { if (idx > 0) { idx--; renderQ(); } });
    $("btn-repetir").addEventListener("click", () => { newRun(); show("test"); renderQ(); });
    $("btn-compartir").addEventListener("click", compartir);
    document.querySelectorAll(".js-pdf").forEach((b) => b.addEventListener("click", botonPdf));

    const valido = (x) => x && x.answers && x.orders && data.preguntas.every((q) => x.answers[q.id] && x.orders[q.id]);
    const s = store.get(CLAVE);
    const pend = store.get(PEND, "local");
    const sid = new URLSearchParams(location.search).get("pago");
    if (valido(s)) { orders = s.orders; answers = s.answers; tie = s.tie || tie; }
    else if (sid && valido(pend)) { orders = pend.orders; answers = pend.answers; tie = pend.tie || tie; persist(); }
    if (sid) { volverDePago(sid); return; }
    if (completo()) renderResultado();
  }
  init();
})();
