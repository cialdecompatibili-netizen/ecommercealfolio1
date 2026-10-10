---
layout: page
title: Negozio
permalink: /negozio/
description: Scegli i prodotti, indica la quantità e aggiungili al carrello.
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
{% for b in site.data.catalogo.prodotti %}
{% if b.visibile == false %}{% continue %}{% endif %}
{% assign cat = site.data.catalogo.categorie | where: 'id', b.categoria | first %}
<div class="nz-riga nz-box" data-id="{{ b.id }}" data-cat="{{ b.categoria }}" data-nome="{{ b.nome | escape }}" data-prezzo="{{ b.prezzo_centesimi }}" data-tipo="{{ b.tipo | default: 'fisico' }}">
<div class="nz-icona">{% if b.immagine %}<img src="{% if b.immagine contains '://' %}{{ b.immagine }}{% else %}{{ '/' | append: b.immagine | relative_url }}{% endif %}" alt="" loading="lazy">{% else %}{{ b.icona }}{% endif %}</div>
<div class="nz-testo">
<p class="nz-cat">{{ cat.nome }} · {% if b.tipo == 'digitale' %}digitale{% else %}fisico{% endif %}</p>
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
<p class="nz-vai"><a class="btn btn-outline-secondary" href="{{ '/carrello/' | relative_url }}">Vai al carrello <span id="nz-conta" class="text-muted"></span></a></p>
</div>
