---
layout: page
title: Negozio
permalink: /negozio/
description: Scegli le tue box, indica la quantità e aggiungile al carrello.
nav: true
nav_order: 1
ecommerce: true
---
<div id="negozio" data-tracker="{{ site.ordini.tracker }}">
<div class="nz-pills">
<button type="button" class="nz-pill on" data-cat="">Tutti</button>
{% for c in site.data.catalogo.categorie %}
<button type="button" class="nz-pill" data-cat="{{ c.id }}">{{ c.icona }} {{ c.nome }}</button>
{% endfor %}
</div>
<div class="nz-lista">
{% for b in site.data.catalogo.box %}
{% if b.visibile == false %}{% continue %}{% endif %}
{% assign cat = site.data.catalogo.categorie | where: 'id', b.categoria | first %}
<div class="nz-riga nz-box" data-id="{{ b.id }}" data-cat="{{ b.categoria }}" data-nome="{{ b.nome | escape }}" data-prezzo="{{ b.prezzo_centesimi }}" data-tipo="{{ b.tipo }}" data-periodo="{% if b.tipo == 'abbonamento' %}{% if b.ogni > 1 %}ogni {{ b.ogni }} {% case b.intervallo %}{% when 'week' %}settimane{% when 'year' %}anni{% else %}mesi{% endcase %}{% else %}/ {% case b.intervallo %}{% when 'week' %}settimana{% when 'year' %}anno{% else %}mese{% endcase %}{% endif %}{% endif %}">
<div class="nz-icona">{{ b.icona }}</div>
<div class="nz-testo">
<p class="nz-cat">{{ cat.nome }}{% if b.tipo == 'abbonamento' %} · abbonamento{% else %} · acquisto singolo{% endif %}</p>
<h3><a href="{{ '/negozio/' | append: b.id | append: '/' | relative_url }}">{{ b.nome }}</a></h3>
<p>{{ b.descrizione }}</p>
</div>
<div class="nz-prezzo fw-bold"></div>
<div class="nz-azioni">
<label>Quantità<input type="number" class="form-control nz-qta" min="1" max="20" value="1"></label>
<button type="button" class="btn btn-primary nz-add">Aggiungi</button>
<span class="nz-ok" aria-live="polite"></span>
</div>
</div>
{% endfor %}
</div>
<h2 id="carrello">Carrello <small id="nz-conta" class="text-muted"></small></h2>
<p id="nz-vuoto">Il carrello è vuoto.</p>
<p id="nz-grazie" class="nz-grazie fw-bold" role="status" tabindex="-1" hidden></p>
<div id="nz-pieno" hidden>
<table class="nz-tab">
<thead><tr><th>Box</th><th>Quantità</th><th>Totale</th><th></th></tr></thead>
<tbody id="nz-righe"></tbody>
</table>
<p>Totale <span id="nz-totale" class="nz-totale"></span></p>
<button type="button" id="nz-paga" class="btn btn-primary">Invia richiesta d'ordine</button>
<button type="button" id="nz-svuota" class="btn btn-outline-secondary">Svuota il carrello</button>
<p id="nz-nota" class="text-muted mt-2"></p>
<form id="nz-ordine" class="nz-ordine" style="max-width:480px;margin-top:1.5rem" hidden novalidate>
<h3>I tuoi dati</h3>
<p class="text-muted">Nessun pagamento adesso: ti scriviamo noi per confermare l'ordine.</p>
<label class="d-block mb-3">Nome<input type="text" class="form-control" id="nz-o-nome" maxlength="100" required autocomplete="name"></label>
<label class="d-block mb-3">Email<input type="email" class="form-control" id="nz-o-email" maxlength="150" required autocomplete="email"></label>
<div style="position:absolute;left:-9999px;height:0;overflow:hidden" aria-hidden="true"><label for="nz-o-web">Non compilare</label><input type="text" id="nz-o-web" tabindex="-1" autocomplete="off"></div>
<button type="submit" class="btn btn-primary" id="nz-o-invia">Conferma richiesta</button>
<p id="nz-o-esito" class="mt-2" role="status" aria-live="polite"></p>
</form>
</div>
</div>
