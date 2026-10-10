# frozen_string_literal: true

# E-COMMERCE (interruttore + pagine prodotto). Doc: CLAUDE.md > punto "E-COMMERCE".
# PUNTI CRITICI
# 1) Interruttore = chiave `ecommerce: true|false` in _config.yml (admin > Impostazioni > "Abilita e-commerce").
#    Attivo SOLO se vale true: chiave assente = spento.
# 2) Spento = spariscono dalla build (quindi dal menu, dalla sitemap e dagli URL) tutte le pagine con `ecommerce: true`
#    nel front matter (/negozio/, /grazie/), le pagine prodotto generate qui e i file statici del negozio (FILE_STATICI). Il codice resta nel repo.
# 3) Le pagine prodotto /negozio/<id>/ nascono da _data/catalogo.json (stessa fonte del Worker e dell'admin).
#    Prodotti con `visibile: false` o id non valido (solo a-z 0-9 e -) vengono saltati. L'id 'categoria' e' riservato.
# 3b) Pagine categoria /negozio/categoria/<id>/ generate qui (solo categorie con almeno un prodotto visibile); il menu Negozio (header.liquid) elenca le stesse categorie.
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
      cat_link = categoria ? " &rsaquo; <a href=\"#{e.(base)}/negozio/categoria/#{e.(categoria['id'])}/\">#{e.(categoria['nome'])}</a>" : ''
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
        </div>
        </div>
        <section class="nz-pp-desc"><h2>Descrizione</h2>
        #{corpo}
        </section>
        <p class="nz-pp-torna"><a href="#{e.(base)}/negozio/">&larr; Torna al negozio</a> &middot; <a href="#{e.(base)}/carrello/">Vai al carrello</a></p>
        </div>
      HTML
    end
  end

  # Riga prodotto (stessa struttura di _pages/negozio.md: il JS del carrello lavora su .nz-box con data-id/data-prezzo).
  def self.riga(site, p, cat)
    e = ->(v) { CGI.escapeHTML(v.to_s) }
    base = site.baseurl.to_s
    foto = url_img(site, p['immagine'])
    icona = foto.empty? ? e.(p['icona']) : "<img src=\"#{e.(foto)}\" alt=\"\" loading=\"lazy\">"
    digitale = p['tipo'] == 'digitale'
    <<~HTML
      <div class="nz-riga nz-box" data-id="#{e.(p['id'])}" data-cat="#{e.(p['categoria'])}" data-nome="#{e.(p['nome'])}" data-prezzo="#{p['prezzo_centesimi'].to_i}" data-tipo="#{digitale ? 'digitale' : 'fisico'}">
      <div class="nz-icona">#{icona}</div>
      <div class="nz-testo">
      <p class="nz-cat">#{e.(cat ? cat['nome'] : '')} &middot; #{digitale ? 'digitale' : 'fisico'}</p>
      <h3><a href="#{e.(base)}/negozio/#{e.(p['id'])}/">#{e.(p['nome'])}</a></h3>
      <p>#{e.(p['descrizione'])}</p>
      </div>
      <div class="nz-prezzo fw-bold"></div>
      <div class="nz-azioni">
      <label>Quantità<input type="number" class="form-control nz-qta" min="1" max="20" value="1"></label>
      <button type="button" class="btn btn-primary nz-add">Aggiungi</button>
      <span class="nz-ok" aria-live="polite"></span>
      </div>
      </div>
    HTML
  end

  # /negozio/categoria/<id>/ : elenco dei prodotti visibili della categoria, con le altre categorie come link (navigazione stile WooCommerce).
  class PaginaCategoria < Jekyll::PageWithoutAFile
    def initialize(site, categoria, categorie, prodotti)
      super(site, site.source, File.join('negozio', 'categoria', categoria['id']), 'index.html')
      e = ->(v) { CGI.escapeHTML(v.to_s) }
      base = site.baseurl.to_s
      tracker = ((site.config['ordini'] || {})['tracker']).to_s
      worker = ((site.data['negozio'] || {})['worker_url']).to_s
      self.data = {
        'layout' => 'page',
        'title' => "#{categoria['icona']} #{categoria['nome']}".strip,
        'description' => "Prodotti della categoria #{categoria['nome']}.",
        'ecommerce' => true,
        'nav' => false
      }
      pillole = categorie.map do |k|
        on = k['id'] == categoria['id'] ? ' on' : ''
        "<a class=\"nz-cpill#{on}\" href=\"#{e.(base)}/negozio/categoria/#{e.(k['id'])}/\">#{e.(k['icona'])} #{e.(k['nome'])}</a>"
      end.join("\n")
      righe = prodotti.map { |p| BoxEcommerce.riga(site, p, categoria) }.join
      self.content = <<~HTML
        <div id="negozio" data-tracker="#{e.(tracker)}" data-worker="#{e.(worker)}">
        <nav class="nz-brd" aria-label="Percorso"><a href="#{e.(base)}/negozio/">Negozio</a> &rsaquo; <span>#{e.(categoria['nome'])}</span></nav>
        <div class="nz-pills"><a class="nz-cpill" href="#{e.(base)}/negozio/">Tutti</a>
        #{pillole}
        </div>
        <p class="nz-cnt">#{prodotti.size} #{prodotti.size == 1 ? 'prodotto' : 'prodotti'}</p>
        <div class="nz-lista">
        #{righe}
        </div>
        <p class="nz-vai"><a class="btn btn-outline-secondary" href="#{e.(base)}/carrello/">Vai al carrello</a></p>
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
      visibili = (catalogo['prodotti'] || []).select do |p|
        p['visibile'] != false && p['id'].to_s.match?(/\A[a-z0-9-]+\z/) && p['id'] != 'categoria'
      end
      visibili.each { |p| site.pages << PaginaProdotto.new(site, p, cats[p['categoria']]) }

      # Pagine categoria: solo per le categorie con almeno un prodotto visibile (id valido).
      elenco = (catalogo['categorie'] || []).select { |k| k['id'].to_s.match?(/\A[a-z0-9-]+\z/) }
      elenco.each do |k|
        dentro = visibili.select { |p| p['categoria'] == k['id'] }
        next if dentro.empty?

        site.pages << PaginaCategoria.new(site, k, elenco.select { |x| visibili.any? { |p| p['categoria'] == x['id'] } }, dentro)
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
