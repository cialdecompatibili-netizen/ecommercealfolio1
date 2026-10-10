# frozen_string_literal: true

# E-COMMERCE (interruttore + pagine prodotto). Doc: CLAUDE.md > punto "E-COMMERCE".
# PUNTI CRITICI
# 1) Interruttore = chiave `ecommerce: true|false` in _config.yml (admin > Impostazioni > "Abilita e-commerce").
#    Attivo SOLO se vale true: chiave assente = spento.
# 2) Spento = spariscono dalla build (quindi dal menu, dalla sitemap e dagli URL) tutte le pagine con `ecommerce: true`
#    nel front matter (/negozio/, /grazie/), le pagine prodotto generate qui e i file statici del negozio (FILE_STATICI). Il codice resta nel repo.
# 3) Le pagine prodotto /negozio/<id>/ nascono da _data/catalogo.json (stessa fonte del Worker e dell'admin).
#    Prodotti con `visibile: false` o id non valido (solo a-z 0-9 e -) vengono saltati.
# 4) Nuove pagine del negozio: mettere `ecommerce: true` nel front matter, altrimenti restano online a e-commerce spento.
require 'cgi'

module BoxEcommerce
  FILE_STATICI = %w[assets/js/carrello.js assets/css/negozio.css].freeze

  def self.attivo?(site)
    site.config['ecommerce'] == true
  end

  # Nessun abbonamento: i prodotti sono fisici o digitali (campo tipo; mancante = fisico). Il periodo resta vuoto.
  def self.periodo(_prodotto)
    ''
  end

  # Percorso foto -> URL: http(s) resta com'e'; il resto e' relativo al sito (assets/img/...), con baseurl davanti.
  def self.url_img(site, percorso)
    p = percorso.to_s.strip
    return '' if p.empty?
    return p if p.match?(%r{\A(https?:)?//})

    "#{site.baseurl}/#{p.sub(%r{\A/}, '')}"
  end

  class PaginaProdotto < Jekyll::PageWithoutAFile
    def initialize(site, prodotto, categoria)
      super(site, site.source, File.join('negozio', prodotto['id']), 'index.html')
      e = ->(v) { CGI.escapeHTML(v.to_s) }
      base = site.baseurl.to_s
      worker = ((site.data['negozio'] || {})['worker_url']).to_s
      self.data = {
        'layout' => 'page',
        'title' => prodotto['nome'],
        'description' => prodotto['descrizione'].to_s,
        'ecommerce' => true,
        'nav' => false
      }
      etichetta = categoria ? "#{categoria['icona']} #{categoria['nome']}" : ''
      digitale = prodotto['tipo'] == 'digitale'
      foto_url = BoxEcommerce.url_img(site, prodotto['immagine'])
      foto = if foto_url.empty?
               "<div class=\"nz-pp-foto nz-pp-ph\" aria-hidden=\"true\">#{e.(prodotto['icona'])}</div>"
             else
               "<div class=\"nz-pp-foto\"><img src=\"#{e.(foto_url)}\" alt=\"#{e.(prodotto['nome'])}\"></div>"
             end
      corpo = prodotto['descrizione_completa'].to_s.strip.split(/\n+/).map { |r| "<p>#{e.(r)}</p>" }.join("\n")
      corpo = "<p>#{e.(prodotto['descrizione'])}</p>" if corpo.empty?
      tipo_txt = digitale ? 'Prodotto digitale' : 'Prodotto fisico'
      nota = digitale ? 'Nessun indirizzo di spedizione: è un prodotto digitale.' : "All'ordine ti chiederemo l'indirizzo di spedizione."
      cat_link = categoria ? " &rsaquo; #{e.(categoria['nome'])}" : ''
      self.content = <<~HTML
        <div id="negozio" class="nz-pp" data-worker="#{e.(worker)}">
        <nav class="nz-brd" aria-label="Percorso"><a href="#{e.(base)}/negozio/">Negozio</a>#{cat_link} &rsaquo; <span>#{e.(prodotto['nome'])}</span></nav>
        <div class="nz-pp-grid">
        <div class="nz-pp-media">#{foto}</div>
        <div class="nz-box nz-scheda nz-pp-info" data-id="#{e.(prodotto['id'])}" data-nome="#{e.(prodotto['nome'])}" data-prezzo="#{prodotto['prezzo_centesimi'].to_i}" data-tipo="#{e.(prodotto['tipo'] || 'fisico')}" data-periodo="">
        <p class="nz-pp-badge">#{e.(tipo_txt)}</p>
        <p class="nz-prezzo nz-pp-prezzo fw-bold"></p>
        <p class="nz-pp-breve">#{e.(prodotto['descrizione'])}</p>
        <div class="nz-pp-acq">
        <label>Quantità<input type="number" class="form-control nz-qta" min="1" max="20" value="1"></label>
        <button type="button" class="btn btn-primary nz-add">Aggiungi al carrello</button>
        <span class="nz-ok" aria-live="polite"></span>
        </div>
        <p class="nz-pp-nota">#{e.(nota)}</p>
        </div>
        </div>
        <section class="nz-pp-desc"><h2>Descrizione</h2>
        #{corpo}
        </section>
        <section class="nz-pp-det"><h2>Dettagli prodotto</h2>
        <dl><dt>Categoria</dt><dd>#{e.(etichetta.empty? ? 'Nessuna' : etichetta)}</dd><dt>Tipo</dt><dd>#{e.(tipo_txt)}</dd><dt>Codice</dt><dd>#{e.(prodotto['id'])}</dd></dl>
        </section>
        <p class="nz-pp-torna"><a href="#{e.(base)}/negozio/">&larr; Torna al negozio</a> &middot; <a href="#{e.(base)}/carrello/">Vai al carrello</a></p>
        </div>
      HTML
    end
  end

  class Generatore < Jekyll::Generator
    safe true
    priority :low

    def generate(site)
      return unless BoxEcommerce.attivo?(site)

      catalogo = site.data['catalogo'] || {}
      cats = (catalogo['categorie'] || []).each_with_object({}) { |c, h| h[c['id']] = c }
      (catalogo['prodotti'] || []).each do |p|
        next if p['visibile'] == false
        next unless p['id'].to_s.match?(/\A[a-z0-9-]+\z/)

        site.pages << PaginaProdotto.new(site, p, cats[p['categoria']])
      end
    end
  end
end

# E-commerce spento: via dalla build le pagine marcate `ecommerce: true` (negozio, grazie) e i file statici del negozio (carrello.js, negozio.css).
# Spariscono anche dal menu, dalla sitemap e dagli URL. Nuovi file statici del negozio: aggiungili a FILE_STATICI.
Jekyll::Hooks.register :site, :post_read do |site|
  next if BoxEcommerce.attivo?(site)

  site.pages.reject! { |p| p.data['ecommerce'] }
  site.static_files.reject! { |f| BoxEcommerce::FILE_STATICI.include?(f.relative_path.sub(%r{\A/}, '')) }
end
