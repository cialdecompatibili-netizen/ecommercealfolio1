# -*- coding: utf-8 -*-
"""
prodotti.py - catalogo e-commerce (_data/catalogo.json): prodotti e categorie. Elenca, crea, cambia, nascondi/mostra,
testo, elimina, importa da CSV. Stessa fonte e stesso formato dell'admin (Prodotti / Categorie prodotti).

PUNTI CRITICI
1) Fonte UNICA: _data/catalogo.json. Il formato (una voce per riga, _nota in testa, niente BOM) e' IDENTICO a quello scritto da
   admin/admin-ecommerce.js (ser): non cambiare l'uno senza l'altro. Le chiavi extra scritte a mano restano.
2) L'id di prodotto/categoria e' l'URL (/negozio/<id>/, /negozio/categoria/<id>/) e la chiave di carrello e ordini: solo a-z 0-9 e '-'.
   Dopo la creazione NON si cambia. 'categoria' e' riservato.
3) Prezzo: si passa in EURO ("29,90" o "29.90"), nel file e' prezzo_centesimi intero (Stripe lavora in centesimi).
4) tipo = fisico | digitale (digitale = nessun indirizzo di spedizione). Mancante = fisico.
5) Pubblicare = --push (commit + push): _data/catalogo.json fa partire il deploy da solo (deploy.yml). Prima di scrivere si crea
   il checkpoint-AAAA-MM-GG (common/sito.py) per tornare indietro. Con --dry-run non si scrive nulla.
6) Una categoria con prodotti non si elimina (come l'admin). Una categoria senza prodotti visibili non ha pagina ne' voce nel menu.

Uso (scrittura: --sito --dry-run --push --conferma):
  python -m automazioni prodotti elenco [--categoria casa] [--tipo digitale] [--nascosti]
  python -m automazioni prodotti crea --nome "Olio EVO" --prezzo 11,90 --categoria dispensa [--tipo fisico] [--breve "..."]
         [--testo-file lungo.txt] [--icona X] [--immagine assets/img/prodotti/olio.jpg] [--id olio-evo] [--nascosto]
  python -m automazioni prodotti campo <id> prezzo=12,50 nome="Nuovo nome" categoria=regali [--rimuovi immagine]
  python -m automazioni prodotti testo <id> --testo-file lungo.txt        (descrizione completa; ogni a capo = paragrafo)
  python -m automazioni prodotti nascondi <id> | mostra <id>
  python -m automazioni prodotti elimina <id> [--si]                      (senza --si solo anteprima)
  python -m automazioni prodotti importa prodotti.csv                     (crea o aggiorna in blocco; colonne sotto)
  python -m automazioni prodotti cat-elenco | cat-crea --nome "Casa" [--icona X] [--id casa]
  python -m automazioni prodotti cat-campo <id> nome="..." icona=X | cat-sposta <id> su|giu | cat-elimina <id>

CSV (UTF-8, separatore , o ;): id,nome,descrizione,descrizione_completa,categoria,tipo,prezzo,icona,immagine,visibile
  Solo "nome" e "prezzo" sono obbligatori per un prodotto nuovo; per uno esistente (stesso id) si aggiornano le sole colonne non vuote.
  La categoria deve esistere (id oppure nome): se non c'e' si crea. visibile = si/no/true/false.
"""
import argparse
import csv
import io
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from automazioni.common import sito  # noqa: E402

PERCORSO = "_data/catalogo.json"
ID_RE = re.compile(r"^[a-z0-9-]+$")
CAMPI_TESTO = {"nome", "descrizione", "descrizione_completa", "categoria", "icona", "tipo", "immagine"}


# ---------------------------------------------------------------- lettura / scrittura (stesso formato dell'admin)

def _carica(base):
    p = base / PERCORSO
    if not p.exists():
        raise sito.Errore(f"{PERCORSO} non esiste in {base.name}: questo sito non ha l'e-commerce")
    dati = p.read_bytes()
    try:
        d = json.loads(dati.decode("utf-8-sig"))
    except ValueError as e:
        raise sito.Errore(f"{PERCORSO} non si legge ({e}): controllalo prima di continuare")
    if not isinstance(d, dict):
        d = {}
    if not isinstance(d.get("categorie"), list):
        d["categorie"] = []
    if not isinstance(d.get("prodotti"), list):
        d["prodotti"] = []
    return d, dati


def _serializza(d, nl=b"\n"):
    riga = lambda x: "  " + json.dumps(x, ensure_ascii=False)  # noqa: E731
    t = ('{\n "_nota": ' + json.dumps(d.get("_nota", ""), ensure_ascii=False) + ',\n "categorie": [\n'
         + ",\n".join(map(riga, d["categorie"])) + '\n ],\n "prodotti": [\n' + ",\n".join(map(riga, d["prodotti"])) + "\n ]\n}\n")
    return t.replace("\n", nl.decode()).encode("utf-8")


def _scrivi(base, a, d, vecchio, messaggio):
    nuovo = _serializza(d, sito.eol(vecchio) if vecchio else b"\n")
    sito.applica(base, a, {PERCORSO: nuovo} if nuovo != vecchio else {}, [PERCORSO], messaggio)


def _cerca(arr, id_):
    for x in arr:
        if x.get("id") == id_:
            return x
    return None


def _prodotto(d, id_):
    p = _cerca(d["prodotti"], id_)
    if not p:
        raise sito.Errore(f"prodotto '{id_}' non trovato (vedi: prodotti elenco)")
    return p


def _centesimi(s):
    try:
        n = float(str(s).strip().replace(",", "."))
    except ValueError:
        n = 0
    if not (0 < n <= 10000):
        raise sito.Errore(f"prezzo non valido: '{s}' (scrivi euro, es. 29,90; massimo 10000)")
    return round(n * 100)


def _euro(c):
    return f"{(c or 0) / 100:.2f}".replace(".", ",")


def _id_valido(i):
    if not ID_RE.match(i) or i == "categoria":
        raise sito.Errore(f"id '{i}' non valido: solo a-z 0-9 e '-' (e 'categoria' e' riservato)")
    return i


def _cat_id(d, valore):
    """Accetta id o nome della categoria; '' = nessuna. Errore se non esiste."""
    if not valore:
        return ""
    for k in d["categorie"]:
        if valore == k["id"] or valore.lower() == str(k.get("nome", "")).lower():
            return k["id"]
    raise sito.Errore(f"categoria '{valore}' non trovata (vedi: prodotti cat-elenco, oppure cat-crea)")


def _tipo(t):
    t = (t or "fisico").strip().lower()
    if t not in ("fisico", "digitale"):
        raise sito.Errore(f"tipo '{t}' non valido: fisico oppure digitale")
    return t


def _bool(v):
    return str(v).strip().lower() in ("1", "true", "si", "sì", "yes", "y", "visibile")


def _testo_file(a):
    if getattr(a, "testo_file", None):
        return pathlib.Path(a.testo_file).read_text(encoding="utf-8-sig").strip()
    return None


def _img(v):
    v = (v or "").strip()
    return v if re.match(r"^(https?:)?//", v) else re.sub(r"^.*?(assets/img/)", r"\1", v)


# ---------------------------------------------------------------- comandi: prodotti

def cmd_elenco(a):
    base = sito.trova_sito(a.sito)
    d, _ = _carica(base)
    n = 0
    for p in d["prodotti"]:
        if a.categoria and p.get("categoria") != _cat_id(d, a.categoria):
            continue
        if a.tipo and (p.get("tipo") or "fisico") != a.tipo:
            continue
        nasc = p.get("visibile") is False
        if a.nascosti and not nasc:
            continue
        n += 1
        print(f"[{p['id']}] {p.get('nome', '')} | {p.get('categoria') or '-'} | {p.get('tipo') or 'fisico'} | "
              f"{_euro(p.get('prezzo_centesimi'))} EUR" + (" | NASCOSTO" if nasc else "") + (" | foto" if p.get("immagine") else ""))
    print(f"{n} prodotti ({len(d['prodotti'])} totali, {len(d['categorie'])} categorie)")


def cmd_crea(a):
    base = sito.prepara(a)
    d, vecchio = _carica(base)
    id_ = _id_valido(a.id or sito.slug(a.nome))
    if _cerca(d["prodotti"], id_):
        raise sito.Errore(f"esiste gia' un prodotto '{id_}': usa 'campo' per cambiarlo")
    n = {"id": id_, "nome": a.nome.strip(), "descrizione": (a.breve or "").strip(), "categoria": _cat_id(d, a.categoria),
         "icona": a.icona or "📦", "tipo": _tipo(a.tipo), "prezzo_centesimi": _centesimi(a.prezzo)}
    lungo = _testo_file(a)
    if lungo:
        n["descrizione_completa"] = lungo
    if a.immagine:
        n["immagine"] = _img(a.immagine)
    n["visibile"] = not a.nascosto
    d["prodotti"].append(n)
    _scrivi(base, a, d, vecchio, f"prodotti: nuovo {id_}")


def cmd_campo(a):
    base = sito.prepara(a)
    d, vecchio = _carica(base)
    p = _prodotto(d, a.id)
    for c in a.coppie:
        if "=" not in c:
            raise sito.Errore(f"'{c}': usa chiave=valore")
        k, v = c.split("=", 1)
        k = k.strip()
        if k == "id":
            raise sito.Errore("l'id non si cambia: e' l'URL e la chiave di carrello e ordini")
        if k in ("prezzo", "prezzo_centesimi"):
            p["prezzo_centesimi"] = _centesimi(v)
        elif k == "categoria":
            p["categoria"] = _cat_id(d, v)
        elif k == "tipo":
            p["tipo"] = _tipo(v)
        elif k == "visibile":
            p["visibile"] = _bool(v)
        elif k == "immagine":
            p["immagine"] = _img(v)
        elif k in CAMPI_TESTO:
            p[k] = v
        else:
            raise sito.Errore(f"campo '{k}' non gestito (validi: nome descrizione descrizione_completa categoria icona tipo prezzo immagine visibile)")
    for k in a.rimuovi or []:
        if k in ("id", "nome", "prezzo_centesimi"):
            raise sito.Errore(f"'{k}' e' obbligatorio: non si rimuove")
        p.pop(k, None)
    _scrivi(base, a, d, vecchio, f"prodotti: campi di {a.id}")


def cmd_testo(a):
    base = sito.prepara(a)
    d, vecchio = _carica(base)
    p = _prodotto(d, a.id)
    t = _testo_file(a)
    if t is None:
        raise sito.Errore("serve --testo-file <file con la descrizione completa>")
    if t:
        p["descrizione_completa"] = t
    else:
        p.pop("descrizione_completa", None)
    _scrivi(base, a, d, vecchio, f"prodotti: testo di {a.id}")


def cmd_visibilita(a, visibile):
    base = sito.prepara(a)
    d, vecchio = _carica(base)
    _prodotto(d, a.id)["visibile"] = visibile
    _scrivi(base, a, d, vecchio, f"prodotti: {'mostra' if visibile else 'nascondi'} {a.id}")


def cmd_elimina(a):
    base = sito.prepara(a)
    d, vecchio = _carica(base)
    p = _prodotto(d, a.id)
    if not a.si:
        print(f"ANTEPRIMA: eliminerei '{p['nome']}' [{a.id}]. Per farlo davvero aggiungi --si (per toglierlo solo dalla vendita: nascondi).")
        return
    d["prodotti"] = [x for x in d["prodotti"] if x.get("id") != a.id]
    _scrivi(base, a, d, vecchio, f"prodotti: elimina {a.id}")


def cmd_importa(a):
    base = sito.prepara(a)
    d, vecchio = _carica(base)
    testo = pathlib.Path(a.file).read_text(encoding="utf-8-sig")
    prima = testo.splitlines()[0] if testo.strip() else ""
    sep = ";" if prima.count(";") > prima.count(",") else ","
    righe = list(csv.DictReader(io.StringIO(testo), delimiter=sep))
    if not righe:
        raise sito.Errore("il CSV e' vuoto")
    nuovi = agg = 0
    for i, r in enumerate(righe, start=2):
        r = {(k or "").strip().lower(): (v or "").strip() for k, v in r.items()}
        id_ = r.get("id") or sito.slug(r.get("nome", ""))
        if not id_:
            raise sito.Errore(f"riga {i}: manca nome o id")
        _id_valido(id_)
        cat = r.get("categoria", "")
        if cat:
            try:
                cat = _cat_id(d, cat)
            except sito.Errore:  # categoria nuova: si crea (id dal nome)
                cid = _id_valido(sito.slug(cat))
                d["categorie"].append({"id": cid, "nome": cat, "icona": "🛍️"})
                cat = cid
        p = _cerca(d["prodotti"], id_)
        if p is None:
            if not r.get("nome") or not r.get("prezzo"):
                raise sito.Errore(f"riga {i} ({id_}): per un prodotto nuovo servono nome e prezzo")
            p = {"id": id_, "nome": r["nome"], "descrizione": "", "categoria": "", "icona": "📦", "tipo": "fisico", "visibile": True}
            d["prodotti"].append(p)
            nuovi += 1
        else:
            agg += 1
        for k in ("nome", "descrizione", "descrizione_completa", "icona"):
            if r.get(k):
                p[k] = r[k].replace("\\n", "\n")
        if cat:
            p["categoria"] = cat
        if r.get("tipo"):
            p["tipo"] = _tipo(r["tipo"])
        if r.get("prezzo"):
            p["prezzo_centesimi"] = _centesimi(r["prezzo"])
        if r.get("immagine"):
            p["immagine"] = _img(r["immagine"])
        if r.get("visibile"):
            p["visibile"] = _bool(r["visibile"])
    print(f"CSV: {nuovi} nuovi, {agg} aggiornati")
    _scrivi(base, a, d, vecchio, f"prodotti: importa {pathlib.Path(a.file).name} ({nuovi} nuovi, {agg} aggiornati)")


# ---------------------------------------------------------------- comandi: categorie

def cmd_cat_elenco(a):
    base = sito.trova_sito(a.sito)
    d, _ = _carica(base)
    for k in d["categorie"]:
        n = sum(1 for p in d["prodotti"] if p.get("categoria") == k["id"])
        v = sum(1 for p in d["prodotti"] if p.get("categoria") == k["id"] and p.get("visibile") is not False)
        print(f"[{k['id']}] {k.get('icona', '')} {k.get('nome', '')} | {n} prodotti ({v} visibili)" + ("" if v else " | senza pagina e fuori dal menu"))


def cmd_cat_crea(a):
    base = sito.prepara(a)
    d, vecchio = _carica(base)
    id_ = _id_valido(a.id or sito.slug(a.nome))
    if _cerca(d["categorie"], id_):
        raise sito.Errore(f"esiste gia' una categoria '{id_}'")
    d["categorie"].append({"id": id_, "nome": a.nome.strip(), "icona": a.icona or "🛍️"})
    _scrivi(base, a, d, vecchio, f"prodotti: nuova categoria {id_}")


def cmd_cat_campo(a):
    base = sito.prepara(a)
    d, vecchio = _carica(base)
    k = _cerca(d["categorie"], a.id)
    if not k:
        raise sito.Errore(f"categoria '{a.id}' non trovata")
    for c in a.coppie:
        if "=" not in c:
            raise sito.Errore(f"'{c}': usa chiave=valore")
        ch, v = c.split("=", 1)
        if ch not in ("nome", "icona"):
            raise sito.Errore("della categoria si cambiano solo nome e icona (l'id e' l'URL)")
        k[ch] = v
    _scrivi(base, a, d, vecchio, f"prodotti: campi categoria {a.id}")


def cmd_cat_sposta(a):
    base = sito.prepara(a)
    d, vecchio = _carica(base)
    arr = d["categorie"]
    k = _cerca(arr, a.id)
    if not k:
        raise sito.Errore(f"categoria '{a.id}' non trovata")
    i = arr.index(k)
    j = i - 1 if a.verso == "su" else i + 1
    if 0 <= j < len(arr):
        arr[i], arr[j] = arr[j], arr[i]
    _scrivi(base, a, d, vecchio, f"prodotti: ordine categorie ({a.id} {a.verso})")


def cmd_cat_elimina(a):
    base = sito.prepara(a)
    d, vecchio = _carica(base)
    k = _cerca(d["categorie"], a.id)
    if not k:
        raise sito.Errore(f"categoria '{a.id}' non trovata")
    n = sum(1 for p in d["prodotti"] if p.get("categoria") == a.id)
    if n:
        raise sito.Errore(f"la categoria ha ancora {n} prodotti: spostali (campo categoria=...) o eliminali prima")
    d["categorie"] = [x for x in d["categorie"] if x.get("id") != a.id]
    _scrivi(base, a, d, vecchio, f"prodotti: elimina categoria {a.id}")


# ---------------------------------------------------------------- parser

def main(argv=None):
    ap = argparse.ArgumentParser(prog="prodotti", description=__doc__.split("\n")[1], formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)

    def nuovo(nome, funzione, aiuto):
        p = sp.add_parser(nome, help=aiuto)
        sito.argomenti_comuni(p)
        p.set_defaults(f=funzione)
        return p

    p = nuovo("elenco", cmd_elenco, "elenca i prodotti")
    p.add_argument("--categoria")
    p.add_argument("--tipo", choices=["fisico", "digitale"])
    p.add_argument("--nascosti", action="store_true")
    p = nuovo("crea", cmd_crea, "nuovo prodotto")
    p.add_argument("--nome", required=True)
    p.add_argument("--prezzo", required=True, help="in euro, es. 29,90")
    p.add_argument("--categoria", default="")
    p.add_argument("--tipo", default="fisico")
    p.add_argument("--breve", help="descrizione breve")
    p.add_argument("--testo-file", help="file con la descrizione completa")
    p.add_argument("--icona")
    p.add_argument("--immagine")
    p.add_argument("--id")
    p.add_argument("--nascosto", action="store_true")
    p = nuovo("campo", cmd_campo, "cambia campi: chiave=valore")
    p.add_argument("id")
    p.add_argument("coppie", nargs="*", metavar="chiave=valore")
    p.add_argument("--rimuovi", action="append", metavar="chiave")
    p = nuovo("testo", cmd_testo, "descrizione completa da file")
    p.add_argument("id")
    p.add_argument("--testo-file", required=True)
    p = nuovo("nascondi", lambda a: cmd_visibilita(a, False), "toglie dalla vendita (resta salvato)")
    p.add_argument("id")
    p = nuovo("mostra", lambda a: cmd_visibilita(a, True), "rimette in vendita")
    p.add_argument("id")
    p = nuovo("elimina", cmd_elimina, "elimina (senza --si solo anteprima)")
    p.add_argument("id")
    p.add_argument("--si", action="store_true")
    p = nuovo("importa", cmd_importa, "crea/aggiorna da CSV")
    p.add_argument("file")
    nuovo("cat-elenco", cmd_cat_elenco, "elenca le categorie")
    p = nuovo("cat-crea", cmd_cat_crea, "nuova categoria")
    p.add_argument("--nome", required=True)
    p.add_argument("--icona")
    p.add_argument("--id")
    p = nuovo("cat-campo", cmd_cat_campo, "cambia nome/icona")
    p.add_argument("id")
    p.add_argument("coppie", nargs="+", metavar="chiave=valore")
    p = nuovo("cat-sposta", cmd_cat_sposta, "cambia l'ordine")
    p.add_argument("id")
    p.add_argument("verso", choices=["su", "giu"])
    p = nuovo("cat-elimina", cmd_cat_elimina, "elimina una categoria vuota")
    p.add_argument("id")

    a = ap.parse_args(argv)
    sito.principale(lambda: a.f(a))


if __name__ == "__main__":
    main()
