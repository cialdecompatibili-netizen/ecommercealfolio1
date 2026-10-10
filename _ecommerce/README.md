# E-commerce (smoke test, senza pagamento e senza Worker)

Cartella con underscore: Jekyll NON la pubblica.

Il Worker Stripe/D1 e' stato TOLTO (10/10/2026): per ora il negozio serve a validare l'offerta, non a incassare.
`/negozio/` mostra i box (`../_data/catalogo.json`), il carrello sta in `_pages/negozio.md` + `assets/js/carrello.js`.
'Invia richiesta d'ordine' apre un modulo nome+email e il browser scrive una riga nel foglio Google chiamando l'Apps Script
`_config.yml > ordini.tracker` (nessun Worker Cloudflare). Riga come CartaCMS: bottone `ordine-completato`,
prodotto `nome xQta [#id]`, prezzo, browser `smoke-test`, device `email | nome`.

Per i pagamenti veri riprendere lo scheletro Stripe + D1 da `box-ecommerce` (cartella `_ecommerce/worker`) e renderlo dinamico (nome worker, SITO_URL e D1 dal nome della repo).
