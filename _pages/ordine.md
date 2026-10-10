---
layout: page
title: Ordine
permalink: /ordine/
description: Completa il tuo ordine.
nav: false
ecommerce: true
---
<div id="nz-ordine-pag" data-tracker="{{ site.ordini.tracker }}">
<p id="nz-vuoto">Il carrello è vuoto. <a href="{{ '/negozio/' | relative_url }}">Vai al negozio</a></p>
<p id="nz-grazie" class="nz-grazie fw-bold" role="status" tabindex="-1" hidden></p>
<div id="nz-pieno" hidden>
<ol class="nz-steps">
<li data-step="1" class="on"><span class="nz-sn">1</span> Dati</li>
<li data-step="2"><span class="nz-sn">2</span> Spedizione</li>
<li data-step="3"><span class="nz-sn">3</span> Conferma</li>
</ol>
<form id="nz-ordine" novalidate>
<section class="nz-passo" data-passo="1">
<h2 class="h4">I tuoi dati</h2>
<label class="d-block mb-3">Nome<input type="text" class="form-control" id="nz-o-nome" maxlength="100" required autocomplete="name"></label>
<label class="d-block mb-3">Email<input type="email" class="form-control" id="nz-o-email" maxlength="150" required autocomplete="email"></label>
<p class="nz-err" role="alert"></p>
<p class="nz-az-passo"><a class="btn btn-outline-secondary" href="{{ '/carrello/' | relative_url }}">Torna al carrello</a> <button type="button" class="btn btn-primary" data-nav="avanti">Avanti</button></p>
</section>
<section class="nz-passo" data-passo="2" hidden>
<h2 class="h4">Spedizione</h2>
<label class="d-block mb-3">Indirizzo di spedizione<input type="text" class="form-control" id="nz-o-ind" maxlength="200" autocomplete="street-address" placeholder="Via, numero, CAP, città"></label>
<p class="nz-err" role="alert"></p>
<p class="nz-az-passo"><button type="button" class="btn btn-outline-secondary" data-nav="indietro">Indietro</button> <button type="button" class="btn btn-primary" data-nav="avanti">Avanti</button></p>
</section>
<section class="nz-passo" data-passo="3" hidden>
<h2 class="h4">Conferma</h2>
<ul id="nz-riep" class="nz-riep"></ul>
<p>Totale <span id="nz-riep-tot" class="nz-totale"></span></p>
<p id="nz-riep-dati" class="text-muted"></p>
<p class="text-muted">Nessun pagamento adesso: ti scriviamo noi per confermare l'ordine.</p>
<div style="position:absolute;left:-9999px;height:0;overflow:hidden" aria-hidden="true"><label for="nz-o-web">Non compilare</label><input type="text" id="nz-o-web" tabindex="-1" autocomplete="off"></div>
<p id="nz-o-esito" role="status" aria-live="polite"></p>
<p class="nz-az-passo"><button type="button" class="btn btn-outline-secondary" data-nav="indietro">Indietro</button> <button type="submit" class="btn btn-primary" id="nz-o-invia">Conferma ordine</button></p>
</section>
</form>
</div>
</div>
