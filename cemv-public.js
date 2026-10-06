/* CEMV — pages publiques : bibliothèque scientifique + fiches chercheurs
   Lit les tables Supabase `publications` et `team` (lecture publique). */
(function () {
  var SB_URL = 'https://ermnggfazzdzcjstjytz.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVybW5nZ2ZhenpkemNqc3RqeXR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4MTQ0NjMsImV4cCI6MjEwNTM5MDQ2M30.RWRfHftIRHoh9Z6KRrQxW98qbg_mP14hxYfruc5d61Q';
  var sb = window.supabase.createClient(SB_URL, SB_KEY);

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var norm = function (s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  };
  // Refuse les liens dangereux (javascript:, etc.). Les PDF en base64 restent acceptés.
  var safeUrl = function (u) {
    u = String(u || '').trim();
    if (!u) return '';
    if (/^data:application\/pdf/i.test(u)) return u;
    if (/^(javascript|vbscript|data):/i.test(u)) return '';
    return u;
  };
  var doiUrl = function (d) {
    d = String(d || '').trim();
    if (!d) return '';
    return /^https?:\/\//i.test(d) ? d : 'https://doi.org/' + d.replace(/^doi:\s*/i, '');
  };
  var FALLBACK_IMG = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#E7F5EC"/>' +
    '<circle cx="50" cy="38" r="16" fill="#9FC4AE"/><path d="M18 90c4-22 20-32 32-32s28 10 32 32z" fill="#9FC4AE"/></svg>');

  /* ---------- Une publication (liste) ---------- */
  function pubItem(p) {
    var links = [];
    var pdf = safeUrl(p.file_url), online = safeUrl(p.online_url), doi = doiUrl(p.doi);
    if (pdf) links.push('<a class="pub-link primary" href="' + esc(pdf) + '" target="_blank" rel="noopener">PDF</a>');
    if (doi) links.push('<a class="pub-link" href="' + esc(doi) + '" target="_blank" rel="noopener">DOI</a>');
    if (online) links.push('<a class="pub-link" href="' + esc(online) + '" target="_blank" rel="noopener">Lien en ligne</a>');
    var meta = [p.source, p.year].filter(Boolean).map(esc).join(' · ');
    return '<article class="pub-item">' +
      '<div class="pub-main">' +
        (p.domain ? '<span class="pub-tag">' + esc(p.domain) + '</span>' : '') +
        '<h4>' + esc(p.title) + '</h4>' +
        (p.authors ? '<p class="pub-authors">' + esc(p.authors) + '</p>' : '') +
        (meta ? '<p class="pub-meta">' + meta + '</p>' : '') +
        (p.abstract ? '<details class="pub-abs"><summary>Résumé</summary><p>' + esc(p.abstract) + '</p></details>' : '') +
      '</div>' +
      '<div class="pub-links">' + (links.join('') || '<span class="pub-none">Texte à venir</span>') + '</div>' +
    '</article>';
  }

  var byYearDesc = function (a, b) {
    var ya = parseInt(a.year, 10) || 0, yb = parseInt(b.year, 10) || 0;
    return yb - ya || (a.sort_order || 0) - (b.sort_order || 0);
  };

  /* ---------- Bibliothèque scientifique ---------- */
  window.CEMV_initLibrary = async function () {
    var root = document.getElementById('lib');
    if (!root) return;
    root.innerHTML = '<p class="lib-state">Chargement des publications…</p>';
    var res = await sb.from('publications').select('*');
    if (res.error) { root.innerHTML = '<p class="lib-state">Impossible de charger les publications pour le moment.</p>'; return; }
    var all = (res.data || []).sort(byYearDesc);
    if (!all.length) { root.innerHTML = '<p class="lib-state">Aucune publication n\'est encore en ligne.</p>'; return; }

    var years = Array.from(new Set(all.map(function (p) { return (p.year || '').trim(); }).filter(Boolean)))
      .sort(function (a, b) { return (parseInt(b, 10) || 0) - (parseInt(a, 10) || 0); });
    var domains = Array.from(new Set(all.map(function (p) { return (p.domain || '').trim(); }).filter(Boolean)))
      .sort(function (a, b) { return a.localeCompare(b, 'fr'); });
    var opt = function (v) { return '<option value="' + esc(v) + '">' + esc(v) + '</option>'; };

    root.innerHTML =
      '<div class="lib-bar">' +
        '<input type="search" id="lib-q" placeholder="Rechercher un titre, un auteur, une revue, un mot-clé…" aria-label="Recherche">' +
        '<select id="lib-year" aria-label="Année"><option value="">Toutes les années</option>' + years.map(opt).join('') + '</select>' +
        (domains.length ? '<select id="lib-domain" aria-label="Domaine"><option value="">Tous les domaines</option>' + domains.map(opt).join('') + '</select>' : '') +
        '<button type="button" id="lib-reset" class="lib-reset">Réinitialiser</button>' +
      '</div>' +
      '<p class="lib-count" id="lib-count" aria-live="polite"></p>' +
      '<div id="lib-list"></div>';

    var q = document.getElementById('lib-q'), ys = document.getElementById('lib-year'),
        ds = document.getElementById('lib-domain'), list = document.getElementById('lib-list'),
        count = document.getElementById('lib-count');

    // Les filtres peuvent venir de l'adresse (?q=...&year=...&domain=...) pour partager une recherche
    var params = new URLSearchParams(location.search);
    q.value = params.get('q') || '';
    if (years.indexOf(params.get('year')) > -1) ys.value = params.get('year');
    if (ds && domains.indexOf(params.get('domain')) > -1) ds.value = params.get('domain');

    function apply() {
      var terms = norm(q.value).split(/\s+/).filter(Boolean);
      var out = all.filter(function (p) {
        if (ys.value && (p.year || '').trim() !== ys.value) return false;
        if (ds && ds.value && (p.domain || '').trim() !== ds.value) return false;
        if (!terms.length) return true;
        var hay = norm([p.title, p.authors, p.source, p.year, p.domain, p.abstract, p.doi].join(' '));
        return terms.every(function (t) { return hay.indexOf(t) > -1; });
      });
      count.textContent = out.length + (out.length > 1 ? ' publications' : ' publication') +
        (out.length !== all.length ? ' sur ' + all.length : '');
      list.innerHTML = out.length ? out.map(pubItem).join('') :
        '<p class="lib-state">Aucun résultat. Essayez d\'autres mots-clés ou réinitialisez les filtres.</p>';
      var np = new URLSearchParams();
      if (q.value.trim()) np.set('q', q.value.trim());
      if (ys.value) np.set('year', ys.value);
      if (ds && ds.value) np.set('domain', ds.value);
      var qs = np.toString();
      history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
    }
    q.addEventListener('input', apply);
    ys.addEventListener('change', apply);
    if (ds) ds.addEventListener('change', apply);
    document.getElementById('lib-reset').addEventListener('click', function () {
      q.value = ''; ys.value = ''; if (ds) ds.value = ''; apply();
    });
    apply();
  };

  /* ---------- Carte chercheur ---------- */
  function memberCard(m) {
    var px = m.photo_x == null ? 50 : m.photo_x, py = m.photo_y == null ? 50 : m.photo_y;
    return '<a class="team-card-link" href="chercheur.html?id=' + encodeURIComponent(m.id) + '">' +
      '<img src="' + esc(m.photo || FALLBACK_IMG) + '" alt="' + esc(m.name) + '" style="object-position:' + px + '% ' + py + '%;">' +
      '<h4>' + esc(m.name) + '</h4>' +
      '<p class="role">' + esc(m.role) + '</p>' +
      (m.speciality ? '<p class="spec">' + esc(m.speciality) + '</p>' : '') +
      '<span class="see">Voir la fiche →</span></a>';
  }

  /* ---------- Équipe (grille) ---------- */
  window.CEMV_initTeam = async function () {
    var grid = document.getElementById('team-grid-public');
    if (!grid) return;
    var res = await sb.from('team').select('*').order('sort_order', { ascending: true });
    var members = res.data || [];
    if (res.error || !members.length) { var s = document.getElementById('team-public-section'); if (s) s.style.display = 'none'; return; }
    grid.innerHTML = members.map(memberCard).join('');
  };

  /* ---------- Fiche chercheur ---------- */
  var TITLES = ['prof', 'pr', 'dr', 'docteur', 'professeur', 'mme', 'mlle', 'mr', 'monsieur', 'madame'];
  window.CEMV_initProfile = async function () {
    var root = document.getElementById('profile');
    if (!root) return;
    var id = new URLSearchParams(location.search).get('id');
    var res = id ? await sb.from('team').select('*').eq('id', id).maybeSingle() : { data: null };
    var m = res.data;
    if (!m) {
      root.innerHTML = '<p class="lib-state">Cette fiche est introuvable. <a href="le-cemv.html#equipe" style="color:var(--green-700);font-weight:600;">Voir toute l\'équipe</a></p>';
      return;
    }
    document.title = m.name + ' — CEMV';
    var px = m.photo_x == null ? 50 : m.photo_x, py = m.photo_y == null ? 50 : m.photo_y;
    var contacts = [];
    if (m.email) contacts.push('<a class="pub-link primary" href="mailto:' + esc(m.email) + '">E-mail</a>');
    if (m.orcid) {
      var o = /^https?:/i.test(m.orcid) ? m.orcid : 'https://orcid.org/' + m.orcid.trim();
      contacts.push('<a class="pub-link" href="' + esc(safeUrl(o)) + '" target="_blank" rel="noopener">ORCID</a>');
    }
    if (m.scholar) contacts.push('<a class="pub-link" href="' + esc(safeUrl(m.scholar)) + '" target="_blank" rel="noopener">Google Scholar</a>');

    root.innerHTML =
      '<a href="le-cemv.html#equipe" class="back-link">← Toute l\'équipe</a>' +
      '<div class="profile-head">' +
        '<img src="' + esc(m.photo || FALLBACK_IMG) + '" alt="' + esc(m.name) + '" style="object-position:' + px + '% ' + py + '%;">' +
        '<div>' +
          '<h1>' + esc(m.name) + '</h1>' +
          '<p class="role">' + esc(m.role) + '</p>' +
          (m.speciality ? '<p class="spec">Spécialité : ' + esc(m.speciality) + '</p>' : '') +
          (contacts.length ? '<div class="pub-links" style="margin-top:14px;justify-content:flex-start;">' + contacts.join('') + '</div>' : '') +
        '</div>' +
      '</div>' +
      (m.bio ? '<h3 class="profile-h">Biographie</h3><p class="profile-bio">' + esc(m.bio) + '</p>' : '') +
      '<h3 class="profile-h">Publications</h3><div id="profile-pubs"><p class="lib-state">Chargement…</p></div>';

    var box = document.getElementById('profile-pubs');
    var pubs = [], auto = false;
    if (m.publication_ids && m.publication_ids.length) {
      var r1 = await sb.from('publications').select('*').in('id', m.publication_ids);
      pubs = r1.data || [];
    } else {
      // Pas de liste saisie : on cherche le nom du chercheur dans le champ « Auteurs »
      var r2 = await sb.from('publications').select('*');
      var tokens = norm(m.name).split(/[^a-z0-9]+/).filter(function (t) { return t.length >= 4 && TITLES.indexOf(t) < 0; });
      pubs = (r2.data || []).filter(function (p) {
        var words = norm(p.authors).split(/[^a-z0-9]+/);
        return tokens.some(function (t) { return words.indexOf(t) > -1; });
      });
      auto = pubs.length > 0;
    }
    pubs.sort(byYearDesc);
    box.innerHTML = pubs.length
      ? (auto ? '<p class="lib-count">Correspondance automatique d\'après le nom dans la liste des auteurs.</p>' : '') + pubs.map(pubItem).join('')
      : '<p class="lib-state">Aucune publication associée pour le moment.</p>';
  };
})();
