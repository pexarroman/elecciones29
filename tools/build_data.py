import json, sys
src = sys.argv[1]
d = json.load(open(src, encoding="utf-8"))
COD = {"PP": "PP", "PSOE": "PSOE", "VOX": "VOX", "FA": "FA"}
NOM = {"PP": "PP", "PSOE": "PSOE", "VOX": "Vox", "FA": "Frente Amplio"}
pub = {"version": d["version"], "programas": "2026", "partidos": NOM, "preguntas": []}
det = {"version": d["version"], "fuente": d["fuente"], "partidos": NOM, "preguntas": {}}
for q in d["preguntas"]:
    qid = str(q["id"])
    assert len(q["respuestas"]) == 4, f"La pregunta {qid} no tiene 4 respuestas"
    assert sorted(p for a in q["respuestas"] for p in a["partidos"]) == sorted(COD), f"La pregunta {qid} no tiene una respuesta por partido"
    pq = {"id": q["id"], "tema": q["tema"], "pregunta": q["pregunta"], "respuestas": []}
    dq = {"nota": q.get("nota"), "respuestas": {}}
    for i, a in enumerate(q["respuestas"], 1):
        aid = f"{qid}.{i}"
        pq["respuestas"].append({"id": aid, "texto": a["texto"], "p": [COD[p] for p in a["partidos"]]})
        dq["respuestas"][aid] = {
            "partidos": [COD[p] for p in a["partidos"]],
            "nota": a.get("nota"),
            "fuentes": [{"partido": COD[c["partido"]], "pag": c["pdf_pagina"], "medida": c.get("medida"), "cita": c["cita"]} for c in a["fuentes"]],
        }
    pub["preguntas"].append(pq)
    det["preguntas"][qid] = dq
json.dump(pub, open("public/data/preguntas.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
# Fuentes completas: NO van en public/. Las entrega solo functions/api/detalle.js tras verificar el pago.
import os
os.makedirs("privado", exist_ok=True)
with open("privado/detalle.js", "w", encoding="utf-8") as f:
    f.write("// Generado por tools/build_data.py. No editar a mano.\nexport default ")
    json.dump(det, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")
# Muestra gratuita: solo la pregunta 1.
muestra = {"partidos": NOM, "preguntas": {"1": det["preguntas"]["1"]}}
json.dump(muestra, open("public/data/muestra.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
if os.path.exists("public/data/detalle.json"):
    os.remove("public/data/detalle.json")
print(len(pub["preguntas"]), "preguntas;", sum(len(q["respuestas"]) for q in pub["preguntas"]), "respuestas")
