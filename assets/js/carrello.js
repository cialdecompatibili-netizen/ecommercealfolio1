// Carrello del negozio: icona nel menu con contatore (su TUTTE le pagine), finestra "aggiunto al carrello" (stile PrestaShop)
// e carrello completo in /negozio/. Salvato nel browser (localStorage).
// PUNTI CRITICI
// 1) Questo file e' caricato UNA volta da _includes/header.liquid (solo se ecommerce: true). NON rimettere <script src=carrello.js> nelle pagine:
//    il guard window.__nzCarrello evita il doppio avvio, ma il tag in piu' non serve.
// 2) Il contatore e i totali usano la JSON id/prezzo/nome scritto dal header in #nz-cart[data-catalogo] (stessa fonte: _data/catalogo.json). Gli id non piu'
//    in catalogo (prodotto nascosto/eliminato) NON si contano. I prezzi mostrati sono solo indicativi: smoke test: nessun pagamento, l'ordine finisce nel foglio.
// 3) Su /grazie/ il carrello viene svuotato (pagamento completato).
// 4) SMOKE TEST: niente pagamento e niente Worker. 'Invia richiesta d'ordine' scrive una riga nel foglio Google (ordini.tracker in _config.yml).
// 5) La finestra "aggiunto" e' un <dialog> nativo creato qui (testi con textContent, mai innerHTML: i nomi arrivano da data-*). Gli stili sono in negozio.css.
// 7) PRODOTTI FISICI/DIGITALI: data-tipo (fisico|digitale, mancante = fisico). Il campo indirizzo (#nz-o-ind) compare e viene richiesto solo se nel carrello c'e'
//    almeno un prodotto fisico; finisce nella colonna device del foglio ("email | nome | indirizzo", oppure "| digitale"). Nessun abbonamento.
// 6) Le pagine prodotto non hanno la tabella carrello (#nz-righe): disegna() esce subito, il contatore e la finestra funzionano lo stesso.
(function () {
  if (window.__nzCarrello) return;
  window.__nzCarrello = true;

  var KEY = "nz_carrello";
  var MAX = 20;
  var euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

  function leggi() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || {};
    } catch (e) {
      return {};
    }
  }
  function salva(c) {
    try {
      localStorage.setItem(KEY, JSON.stringify(c));
    } catch (e) {}
  }
  function el(tag, testo, classe) {
    var x = document.createElement(tag);
    if (testo !== undefined) x.textContent = testo;
    if (classe) x.className = classe;
    return x;
  }
  function tasto(testo, act, id, classe) {
    var b = el("button", testo, classe || "btn btn-sm btn-outline-secondary");
    b.type = "button";
    b.dataset.act = act;
    b.dataset.id = id;
    return b;
  }

  /* ---------- icona nel menu + contatore ---------- */
  var link = document.getElementById("nz-cart");
  var prezzi = {}; // id -> centesimi (dal header)
  var nomi = {}; // id -> nome (dal header, per l'anteprima)
  if (link && link.dataset.catalogo) {
    try {
      JSON.parse("[" + link.dataset.catalogo + "null]").forEach(function (x) {
        if (x && x.id) {
          prezzi[x.id] = Number(x.p) || 0;
          nomi[x.id] = String(x.n || x.id);
        }
      });
    } catch (e) {}
  }
  function riepilogo(c) {
    var n = 0;
    var tot = 0;
    Object.keys(c).forEach(function (id) {
      if (prezzi[id] !== undefined && c[id] > 0) {
        n += c[id];
        tot += prezzi[id] * c[id];
      }
    });
    return { n: n, tot: tot };
  }
  /* Anteprima al passaggio del mouse (come .blockcart .body di PrestaShop): righe "q x nome", totale, pulsante. Solo CSS la mostra (desktop con mouse). */
  function anteprima(r) {
    var p = document.getElementById("nz-prev");
    if (!p) return;
    p.innerHTML = "";
    if (!r.n) return; // carrello vuoto: nessuna anteprima (resta nascosta anche da CSS)
    var c = leggi();
    var ul = el("ul");
    Object.keys(c).forEach(function (id) {
      if (prezzi[id] === undefined || !(c[id] > 0)) return;
      var li = el("li");
      li.appendChild(el("span", c[id] + " \u00d7 " + nomi[id]));
      li.appendChild(el("span", euro.format((prezzi[id] * c[id]) / 100)));
      ul.appendChild(li);
    });
    var tot = el("p", undefined, "nz-prev-tot");
    tot.appendChild(el("span", "Totale"));
    tot.appendChild(el("strong", euro.format(r.tot / 100)));
    var vai = el("a", "Vai al carrello", "btn btn-primary btn-sm");
    vai.href = link.getAttribute("href");
    [ul, tot, vai].forEach(function (n) {
      p.appendChild(n);
    });
  }
  function badge(salto) {
    if (!link) return;
    var r = riepilogo(leggi());
    link.querySelector(".nz-n").textContent = "(" + r.n + ")";
    link.classList.toggle("nz-pieno", r.n > 0);
    link.setAttribute("aria-label", "Carrello: " + r.n + (r.n === 1 ? " prodotto" : " prodotti"));
    anteprima(r);
    if (salto) {
      link.classList.remove("nz-bump");
      void link.offsetWidth; // riavvia l'animazione
      link.classList.add("nz-bump");
    }
  }

  var radice = document.getElementById("negozio");
  if (!radice) {
    if (/\/grazie\/?$/.test(location.pathname)) salva({});
    badge();
    window.addEventListener("storage", function (e) {
      if (e.key === KEY) badge();
    });
    return;
  }

  /* ---------- prodotti presenti nella pagina ---------- */
  var box = {};
  radice.querySelectorAll(".nz-box").forEach(function (c) {
    var prezzo = Number(c.dataset.prezzo);
    box[c.dataset.id] = { nome: c.dataset.nome, prezzo: prezzo, fisico: c.dataset.tipo !== "digitale" }; // tipo mancante = fisico
    prezzi[c.dataset.id] = prezzo;
    c.querySelector(".nz-prezzo").textContent = euro.format(prezzo / 100);
  });

  /* ---------- carrello completo (solo /negozio/) ---------- */
  function disegna() {
    badge();
    var righe = document.getElementById("nz-righe");
    if (!righe) return;
    var c = leggi();
    var ids = Object.keys(c).filter(function (id) {
      return box[id] && c[id] > 0;
    });
    var tot = 0;
    var n = 0;
    righe.innerHTML = "";
    ids.forEach(function (id) {
      var q = c[id];
      var tr = el("tr");
      var q_td = el("td");
      var q_box = el("span", undefined, "nz-q");
      q_box.appendChild(tasto("-", "meno", id));
      q_box.appendChild(el("span", String(q)));
      q_box.appendChild(tasto("+", "piu", id));
      q_td.appendChild(q_box);
      var x_td = el("td");
      x_td.appendChild(tasto("Togli", "togli", id));
      tr.appendChild(el("td", box[id].nome));
      tr.appendChild(q_td);
      tr.appendChild(el("td", euro.format((box[id].prezzo * q) / 100)));
      tr.appendChild(x_td);
      righe.appendChild(tr);
      tot += box[id].prezzo * q;
      n += q;
    });
    document.getElementById("nz-vuoto").hidden = ids.length > 0;
    document.getElementById("nz-pieno").hidden = ids.length === 0;
    document.getElementById("nz-totale").textContent = euro.format(tot / 100);
    document.getElementById("nz-conta").textContent = n ? "(" + n + ")" : "";
    // indirizzo di spedizione SOLO se nel carrello c'e' almeno un prodotto fisico (filosofia meno click, CLAUDE.md punto 38)
    var indW = document.getElementById("nz-o-ind-w");
    if (indW) indW.style.display = ids.some(function (id) { return box[id].fisico; }) ? "" : "none";
    var paga = document.getElementById("nz-paga");
    var tr = radice.dataset.tracker;
    paga.disabled = !tr;
    document.getElementById("nz-nota").textContent = tr ? "" : "Modulo ordini non ancora attivo.";
  }

  /* ---------- finestra "prodotto aggiunto" (come PrestaShop) ---------- */
  function apri(id, aggiunta) {
    var d = document.getElementById("nz-dialog");
    if (!d) {
      d = document.createElement("dialog");
      d.id = "nz-dialog";
      d.className = "nz-dialog";
      d.setAttribute("aria-labelledby", "nz-dlg-tit");
      document.body.appendChild(d);
      d.addEventListener("click", function (ev) {
        // click sullo sfondo (il <dialog> stesso) o su un elemento con data-chiudi
        if (ev.target === d || ev.target.closest("[data-chiudi]")) d.close();
      });
    }
    var p = box[id];
    var r = riepilogo(leggi());
    d.innerHTML = "";
    var w = el("div", undefined, "nz-dlg");
    var x = el("button", "\u00d7", "nz-x");
    x.type = "button";
    x.dataset.chiudi = "1";
    x.setAttribute("aria-label", "Chiudi");
    var h = el("h2", "\u2713 Prodotto aggiunto al carrello");
    h.id = "nz-dlg-tit";
    var pr = el("div", undefined, "nz-dlg-prod");
    pr.appendChild(el("strong", p.nome));
    pr.appendChild(el("span", euro.format(p.prezzo / 100)));
    pr.appendChild(el("span", aggiunta ? "Quantità aggiunta: " + aggiunta : "Quantità massima raggiunta (" + MAX + ")"));
    var tt = el("div", undefined, "nz-dlg-tot");
    tt.appendChild(el("p", r.n === 1 ? "Nel carrello c\u2019è 1 prodotto" : "Nel carrello ci sono " + r.n + " prodotti"));
    tt.appendChild(el("p", "Totale: " + euro.format(r.tot / 100), "nz-totale"));
    var az = el("div", undefined, "nz-dlg-az");
    var b1 = el("button", "Continua lo shopping", "btn btn-outline-secondary");
    b1.type = "button";
    b1.dataset.chiudi = "1";
    var b2 = el("a", "Procedi con l\u2019ordine", "btn btn-primary");
    b2.href = link ? link.getAttribute("href") : "#carrello";
    b2.dataset.chiudi = "1";
    az.appendChild(b1);
    az.appendChild(b2);
    [x, h, pr, tt, az].forEach(function (n) {
      w.appendChild(n);
    });
    d.appendChild(w);
    if (typeof d.showModal === "function") {
      if (!d.open) d.showModal();
    } else {
      d.setAttribute("open", ""); // browser vecchi senza <dialog> modale
    }
    b2.focus();
  }

  /* ---------- azioni ---------- */
  radice.addEventListener("click", function (ev) {
    var pill = ev.target.closest(".nz-pill");
    if (pill) {
      radice.querySelectorAll(".nz-pill").forEach(function (b) {
        b.classList.toggle("on", b === pill);
      });
      radice.querySelectorAll(".nz-lista .nz-box").forEach(function (r) {
        r.hidden = !!pill.dataset.cat && r.dataset.cat !== pill.dataset.cat;
      });
      return;
    }
    var b = ev.target.closest("button");
    if (!b) return;
    var c = leggi();
    var aggId = "";
    var aggiunta = 0;
    if (b.classList.contains("nz-add")) {
      var card = b.closest(".nz-box");
      var q = parseInt(card.querySelector(".nz-qta").value, 10) || 1;
      q = Math.max(1, Math.min(MAX, q));
      aggId = card.dataset.id;
      var prima = c[aggId] || 0;
      c[aggId] = Math.min(MAX, prima + q);
      aggiunta = c[aggId] - prima;
      card.querySelector(".nz-qta").value = 1;
    } else if (b.dataset.act === "piu") {
      c[b.dataset.id] = Math.min(MAX, (c[b.dataset.id] || 0) + 1);
    } else if (b.dataset.act === "meno") {
      c[b.dataset.id] = (c[b.dataset.id] || 0) - 1;
      if (c[b.dataset.id] <= 0) delete c[b.dataset.id];
    } else if (b.dataset.act === "togli") {
      delete c[b.dataset.id];
    } else if (b.id === "nz-svuota") {
      c = {};
    } else {
      return;
    }
    salva(c);
    disegna();
    if (aggId) {
      badge(true);
      apri(aggId, aggiunta);
    }
  });

  /* ---------- richiesta d'ordine: SMOKE TEST, NESSUN PAGAMENTO, NESSUN WORKER ----------
     Scopo: validare l'offerta. Il pulsante apre un modulo (nome + email); all'invio il browser scrive UNA RIGA nel foglio Google chiamando
     l'Apps Script "tracker" (_config.yml > ordini.tracker, lo stesso di CartaCMS: nessun indirizzo scritto qui). Stessa convenzione di
     order-save.php di CartaCMS: sito = dominio+pagina, bottone "ordine-completato", prodotto "nome xQta [#id]", prezzo = totale in euro,
     browser = "smoke-test", device = "email | nome".
     Limiti noti: la risposta del tracker e' opaca (no-cors), quindi "ricevuto" vuol dire solo "inviato senza errori di rete".
     Antispam leggero lato browser (campo trappola + 3 secondi minimi): basta per un test, NON per un negozio vero. */
  var paga = document.getElementById("nz-paga");
  var modulo = document.getElementById("nz-ordine");
  if (paga && modulo) {
    var tracker = radice.dataset.tracker || "";
    var esitoOrd = document.getElementById("nz-o-esito");
    var inviaOrd = document.getElementById("nz-o-invia");
    var t0Ord = Date.now(); // apertura pagina
    var mostraOrd = function (m, ok) {
      esitoOrd.textContent = m;
      esitoOrd.style.color = ok ? "" : "#b00020";
    };
    var sicuro = function (s) {
      s = String(s || "").trim();
      return /^[=+\-@]/.test(s) ? "'" + s : s; // niente formule iniettate nel foglio
    };
    paga.addEventListener("click", function () {
      modulo.hidden = false;
      modulo.scrollIntoView({ behavior: "smooth", block: "center" });
      document.getElementById("nz-o-nome").focus({ preventScroll: true });
    });
    modulo.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (!modulo.checkValidity()) {
        mostraOrd("Compila nome ed email.", false);
        return;
      }
      var c = leggi();
      var tot = 0;
      var voci = [];
      var serveInd = false;
      Object.keys(c).forEach(function (id) {
        if (!box[id] || !(c[id] > 0)) return;
        tot += box[id].prezzo * c[id];
        voci.push(box[id].nome + " x" + c[id]);
        if (box[id].fisico) serveInd = true;
      });
      if (!voci.length) return;
      var ind = document.getElementById("nz-o-ind").value.trim();
      if (serveInd && ind.length < 8) {
        mostraOrd("Indica l'indirizzo di spedizione.", false);
        document.getElementById("nz-o-ind").focus();
        return;
      }
      var idOrd = Array.prototype.map
        .call(crypto.getRandomValues(new Uint8Array(4)), function (x) {
          return ("0" + x.toString(16)).slice(-2);
        })
        .join("")
        .toUpperCase();
      var fatto = function () {
        salva({});
        disegna();
        badge(false);
        modulo.reset();
        modulo.hidden = true;
        mostraOrd("", true);
        var g = document.getElementById("nz-grazie");
        g.textContent = "Richiesta ricevuta (n. " + idOrd + "). Nessun pagamento è stato effettuato: ti scriviamo noi all'email indicata per confermare l'ordine.";
        g.hidden = false;
        g.focus();
        inviaOrd.disabled = false;
      };
      // bot: campo trappola compilato o invio troppo veloce -> finto "ok", niente riga nel foglio
      if (document.getElementById("nz-o-web").value || Date.now() - t0Ord < 3000) {
        fatto();
        return;
      }
      if (!tracker) {
        mostraOrd("Modulo ordini non ancora attivo.", false);
        return;
      }
      inviaOrd.disabled = true;
      mostraOrd("Invio in corso...", true);
      var q = new URLSearchParams({
        sito: location.hostname + location.pathname,
        bottone: "ordine-completato",
        prodotto: sicuro(voci.join(", ") + " [#" + idOrd + "]").slice(0, 500),
        prezzo: String(tot / 100),
        browser: "smoke-test",
        device: sicuro(document.getElementById("nz-o-email").value.slice(0, 150) + " | " + document.getElementById("nz-o-nome").value.slice(0, 100) + (serveInd ? " | " + ind.slice(0, 200) : " | digitale")),
      });
      fetch(tracker + (tracker.indexOf("?") < 0 ? "?" : "&") + q.toString(), { mode: "no-cors" })
        .then(fatto)
        .catch(function () {
          mostraOrd("Errore di rete. Riprova.", false);
          inviaOrd.disabled = false;
        });
    });
  }

  window.addEventListener("storage", function (e) {
    if (e.key === KEY) disegna();
  });

  disegna();
})();
