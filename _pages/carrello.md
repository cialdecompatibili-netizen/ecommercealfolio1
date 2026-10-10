---
layout: page
title: Carrello
permalink: /carrello/
description: Il tuo carrello.
nav: false
ecommerce: true
---
<div id="nz-carrello-pag">
<p id="nz-vuoto">Il carrello è vuoto. <a href="{{ '/negozio/' | relative_url }}">Vai al negozio</a></p>
<div id="nz-pieno" hidden>
<table class="nz-tab">
<thead><tr><th>Prodotto</th><th>Quantità</th><th>Totale</th><th></th></tr></thead>
<tbody id="nz-righe"></tbody>
</table>
<p>Totale <span id="nz-totale" class="nz-totale"></span></p>
<p class="nz-az-passo">
<a class="btn btn-primary" id="nz-vai-ordine" href="{{ '/ordine/' | relative_url }}">Procedi all'ordine</a>
<a class="btn btn-outline-secondary" href="{{ '/negozio/' | relative_url }}">Continua lo shopping</a>
<button type="button" id="nz-svuota" class="btn btn-outline-secondary">Svuota il carrello</button>
</p>
</div>
</div>
