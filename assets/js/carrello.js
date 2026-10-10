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
// 8) PAGINE: /negozio/ (solo catalogo), /carrello/ (#nz-carrello-pag: tabella, quantita', procedi), /ordine/ (#nz-ordine-pag: passi Dati > Spedizione (solo fisici) > Conferma).
//    L'elenco prodotti per le pagine senza card viene da #nz-cart[data-catalogo] (header.liquid: id, prezzo, nome, tipo).
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
  var tipi = {}; // id -> fisico|digitale (dal header)
  if (link && link.dataset.catalogo) {
    try {
      JSON.parse("[" + link.dataset.catalogo + "null]").forEach(function (x) {
        if (x && x.id) {
          prezzi[x.id] = Number(x.p) || 0;
          nomi[x.id] = String(x.n || x.id);
          tipi[x.id] = String(x.t || "fisico");
        }
      });
    } catch (e) {}
  }
  /* prodotti noti (da header): servono anche nelle pagine /carrello/ e /ordine/, che non hanno le card del negozio */
  var box = {};
  Object.keys(prezzi).forEach(function (id) {
    box[id] = { nome: nomi[id], prezzo: prezzi[id], fisico: tipi[id] !== "digitale" };
  });
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

  var radice = document.getElementById("negozio") || document.getElementById("nz-carrello-pag") || document.getElementById("nz-ordine-pag");
  if (!radice) {
    if (/\/grazie\/?$/.test(location.pathname)) salva({});
    badge();
    window.addEventListener("storage", function (e) {
      if (e.key === KEY) badge();
    });
    return;
  }

  /* ---------- prodotti presenti nella pagina ---------- */
  radice.querySelectorAll(".nz-box").forEach(function (c) {
    var prezzo = Number(c.dataset.prezzo);
    box[c.dataset.id] = { nome: c.dataset.nome, prezzo: prezzo, fisico: c.dataset.tipo !== "digitale" }; // tipo mancante = fisico
    prezzi[c.dataset.id] = prezzo;
    c.querySelector(".nz-prezzo").textContent = euro.format(prezzo / 100);
  });

  /* ---------- carrello (/carrello/) e stato della pagina ordine (/ordine/) ---------- */
  var concluso = false; // ordine inviato: nascondo carrello e modulo
  function disegna() {
    badge();
    var righe = document.getElementById("nz-righe");
    var c = leggi();
    var ids = Object.keys(c).filter(function (id) {
      return box[id] && c[id] > 0;
    });
    var tot = 0;
    var n = 0;
    if (righe) righe.innerHTML = "";
    ids.forEach(function (id) {
      var q = c[id];
      if (righe) {
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
      }
      tot += box[id].prezzo * q;
      n += q;
    });
    var vuoto = document.getElementById("nz-vuoto");
    var pieno = document.getElementById("nz-pieno");
    var tt = document.getElementById("nz-totale");
    var cn = document.getElementById("nz-conta");
    if (vuoto) vuoto.hidden = ids.length > 0 || concluso;
    if (pieno) pieno.hidden = ids.length === 0 || concluso;
    if (tt) tt.textContent = euro.format(tot / 100);
    if (cn) cn.textContent = n ? "(" + n + ")" : "";
    if (modulo && !concluso) vai(passo, true);
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
    var b2 = el("a", "Vai al carrello", "btn btn-primary");
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

  /* ---------- quantita' con + e - (lista prodotti e scheda prodotto) ---------- */
  function limita(i) {
    var v = parseInt(i.value, 10);
    if (!(v >= 1)) v = 1;
    i.value = Math.min(MAX, v);
  }
  radice.addEventListener("click", function (ev) {
    var s = ev.target.closest(".nz-stp");
    if (!s) return;
    var i = s.parentNode.querySelector(".nz-qta");
    if (!i) return;
    i.value = (parseInt(i.value, 10) || 1) + Number(s.dataset.d);
    limita(i);
  });
  radice.addEventListener("change", function (ev) {
    if (ev.target.classList && ev.target.classList.contains("nz-qta")) limita(ev.target);
  });

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

  /* ---------- ORDINE A PASSI (/ordine/): SMOKE TEST, NESSUN PAGAMENTO, NESSUN WORKER ----------
     Passi: 1 Dati (nome, email) -> 2 Spedizione (SOLO se nel carrello c'e' un prodotto fisico) -> 3 Conferma (riepilogo + invio).
     All'invio il browser scrive UNA RIGA nel foglio Google chiamando l'Apps Script "tracker" (_config.yml > ordini.tracker, nessun indirizzo scritto qui).
     Convenzione di order-save.php di CartaCMS: sito = dominio+pagina, bottone "ordine-completato", prodotto "nome xQta [#id]", prezzo = totale in euro,
     browser = "smoke-test", device = "email | nome | indirizzo" (oppure "| digitale").
     Limiti noti: la risposta del tracker e' opaca (no-cors). Antispam leggero lato browser (campo trappola + 3 secondi minimi): ok per un test, non per un negozio vero. */
  var modulo = document.getElementById("nz-ordine");
  var passo = 1;
  var vai = function () {};
  if (modulo) {
    var tracker = radice.dataset.tracker || "";
    var esitoOrd = document.getElementById("nz-o-esito");
    var inviaOrd = document.getElementById("nz-o-invia");
    var t0Ord = Date.now(); // apertura pagina
    var sicuro = function (s) {
      s = String(s || "").trim();
      return /^[=+\-@]/.test(s) ? "'" + s : s; // niente formule iniettate nel foglio
    };
    var serve = function () {
      var c = leggi();
      return Object.keys(c).some(function (id) {
        return box[id] && c[id] > 0 && box[id].fisico;
      });
    };
    var elenco = function () {
      return serve() ? [1, 2, 3] : [1, 3];
    };
    var errore = function (n, m) {
      var p = modulo.querySelector('[data-passo="' + n + '"] .nz-err');
      if (p) p.textContent = m || "";
    };
    var riepilogoOrd = function () {
      var c = leggi();
      var ul = document.getElementById("nz-riep");
      var tot = 0;
      ul.innerHTML = "";
      Object.keys(c).forEach(function (id) {
        if (!box[id] || !(c[id] > 0)) return;
        var li = el("li");
        li.appendChild(el("span", c[id] + " \u00d7 " + box[id].nome));
        li.appendChild(el("span", euro.format((box[id].prezzo * c[id]) / 100)));
        ul.appendChild(li);
        tot += box[id].prezzo * c[id];
      });
      document.getElementById("nz-riep-tot").textContent = euro.format(tot / 100);
      document.getElementById("nz-riep-dati").textContent =
        document.getElementById("nz-o-nome").value.trim() + " \u00b7 " + document.getElementById("nz-o-email").value.trim() + (serve() ? " \u00b7 " + document.getElementById("nz-o-ind").value.trim() : "");
    };
    vai = function (n, senzaFocus) {
      var l = elenco();
      if (l.indexOf(n) < 0) n = l[l.length - 1]; // il passo 2 sparisce se il carrello diventa tutto digitale
      passo = n;
      modulo.querySelectorAll(".nz-passo").forEach(function (s) {
        s.hidden = Number(s.dataset.passo) !== n;
      });
      var num = 0;
      document.querySelectorAll(".nz-steps li").forEach(function (li) {
        var k = Number(li.dataset.step);
        li.hidden = l.indexOf(k) < 0;
        li.classList.toggle("on", k === n);
        li.classList.toggle("fatto", k < n);
        if (!li.hidden) li.querySelector(".nz-sn").textContent = String(++num);
      });
      if (n === 3) riepilogoOrd();
      if (!senzaFocus) {
        var f = modulo.querySelector('[data-passo="' + n + '"] input');
        if (f) f.focus({ preventScroll: true });
      }
    };
    var valida = function (n) {
      errore(n, "");
      if (n === 1) {
        var nome = document.getElementById("nz-o-nome");
        var em = document.getElementById("nz-o-email");
        if (!nome.value.trim()) {
          errore(1, "Scrivi il tuo nome.");
          nome.focus();
          return false;
        }
        if (!em.value.trim() || !em.checkValidity()) {
          errore(1, "Controlla l'email.");
          em.focus();
          return false;
        }
      }
      if (n === 2) {
        var ind = document.getElementById("nz-o-ind");
        if (ind.value.trim().length < 8) {
          errore(2, "Indica l'indirizzo di spedizione completo.");
          ind.focus();
          return false;
        }
      }
      return true;
    };
    var prossimo = function (dir) {
      var l = elenco();
      var i = l.indexOf(passo) + dir;
      vai(l[Math.max(0, Math.min(l.length - 1, i))]);
    };
    modulo.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-nav]");
      if (!b) return;
      if (b.dataset.nav === "indietro") return prossimo(-1);
      if (valida(passo)) prossimo(1);
    });
    modulo.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (passo !== 3) {
        if (valida(passo)) prossimo(1); // Invio nei campi = Avanti
        return;
      }
      var daVal = serve() ? [1, 2] : [1];
      for (var i = 0; i < daVal.length; i++) {
        if (!valida(daVal[i])) {
          vai(daVal[i]);
          valida(daVal[i]);
          return;
        }
      }
      var c = leggi();
      var tot = 0;
      var voci = [];
      var serveInd = serve();
      Object.keys(c).forEach(function (id) {
        if (!box[id] || !(c[id] > 0)) return;
        tot += box[id].prezzo * c[id];
        voci.push(box[id].nome + " x" + c[id]);
      });
      if (!voci.length) return;
      var ind = document.getElementById("nz-o-ind").value.trim();
      var idOrd = Array.prototype.map
        .call(crypto.getRandomValues(new Uint8Array(4)), function (x) {
          return ("0" + x.toString(16)).slice(-2);
        })
        .join("")
        .toUpperCase();
      var fatto = function () {
        salva({});
        concluso = true;
        disegna();
        badge(false);
        modulo.reset();
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
        esitoOrd.textContent = "Modulo ordini non ancora attivo.";
        return;
      }
      inviaOrd.disabled = true;
      esitoOrd.textContent = "Invio in corso...";
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
          esitoOrd.textContent = "Errore di rete. Riprova.";
          inviaOrd.disabled = false;
        });
    });
  }

  window.addEventListener("storage", function (e) {
    if (e.key === KEY) disegna();
  });

  disegna();
})();
