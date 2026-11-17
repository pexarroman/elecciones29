import re, sys, json
from playwright.sync_api import sync_playwright
URL="http://localhost:8788/"
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome") if False else p.chromium.launch()
    ctx=b.new_context(viewport={"width":390,"height":844}, device_scale_factor=2, accept_downloads=True)
    pg=ctx.new_page()
    pg.on("console", lambda m: errs.append(("console",m.type,m.text)) if m.type in("error","warning") else None)
    pg.on("pageerror", lambda e: errs.append(("pageerror",str(e))))
    pg.on("requestfailed", lambda r: errs.append(("reqfail",r.url)))
    ext=[]
    pg.on("request", lambda r: ext.append(r.url) if not r.url.startswith(URL) else None)
    pg.goto(URL); pg.wait_for_selector("#btn-empezar")
    pg.screenshot(path=".tmp/shots/01-inicio.png", full_page=True)
    pg.click("#btn-empezar")
    partidos=re.compile(r"\b(PP|PSOE|Vox|VOX|Frente Amplio|Sumar|Podemos)\b")
    for i in range(40):
        pg.wait_for_selector("#t-opts .opt")
        txt=pg.inner_text("#t-opts")+" "+pg.inner_text("#t-pregunta")
        assert not partidos.search(txt), ("PARTIDO visible en test", i, partidos.search(txt).group())
        if i in (0,5): pg.screenshot(path=f".tmp/shots/02-pregunta{i+1}.png")
        n=pg.locator("#t-opts .opt").count()
        pg.locator("#t-opts .opt").nth(0 if i%3 else min(1,n-2)).click()
        pg.wait_for_timeout(420)
    pg.wait_for_selector("#v-resultado:not([hidden])")
    pg.wait_for_timeout(1000)
    print("TITULO:", pg.inner_text("#r-titulo"))
    print(pg.inner_text("#r-ranking"))
    pg.screenshot(path=".tmp/shots/03-resultado.png", full_page=True)
    pg.wait_for_selector("#detalle:not([hidden])"); pg.wait_for_timeout(800)
    pg.locator("#d-lista details summary").first.click()
    pg.screenshot(path=".tmp/shots/04-detalle.png")
    print("tarjetas detalle:", pg.locator("#d-lista .dq").count(), "elegidas:", pg.locator(".da.elegida").count())
    print("instagram:", pg.get_attribute(".top .ig","href"))
    with pg.expect_download() as d:
        pg.click("#btn-pdf")
    d.value.save_as(".tmp/out.pdf"); print("PDF ok", d.value.suggested_filename)
    # recargar: debe mantener resultado y desbloqueo
    pg.reload(); pg.wait_for_selector("#v-resultado:not([hidden])", timeout=5000); print("persistencia tras recarga OK")
    # desktop + dark
    ctx2=b.new_context(viewport={"width":1280,"height":900}, color_scheme="dark"); p2=ctx2.new_page(); p2.goto(URL); p2.screenshot(path=".tmp/shots/05-desktop-dark.png")
    print("externos:", ext, "\nerrores:", errs)
    b.close()
