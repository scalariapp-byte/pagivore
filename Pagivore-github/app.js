'use strict';

/* =========================================================
   Pagivore : gestion d'une collection de BD / mangas / comics / livres
   Données : localStorage du navigateur
   Recherche : AniList (mangas) et Open Library (BD, comics)
   ========================================================= */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const STORE_KEY = 'bulles.collection.v1';
const THEME_KEY = 'bulles.theme';
const PER_PAGE = 24;

const TYPES = { manga: 'Manga', bd: 'BD', comics: 'Comics', livre: 'Livre', autre: 'Autre' };
const ETATS = { '': 'Non précisé', neuf: 'Neuf', 'tres-bon': 'Très bon', bon: 'Bon', abime: 'Abîmé' };
const OLD_YEAR = 1970; // avant cette année, un livre est classé « ancien »

/* ---------- Paramètres ---------- */
const SETTINGS_KEY = 'bulles.settings';
const AMAZON = { fr: 'amazon.fr', be: 'amazon.com.be', de: 'amazon.de', ca: 'amazon.ca', com: 'amazon.com' };
const settings = Object.assign(
  { amazon: 'fr', cardSize: 'm', source: 'manga', hiddenShops: [] },
  (() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (e) { return {}; } })()
);
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {}
  document.documentElement.dataset.cards = settings.cardSize;
}
document.documentElement.dataset.cards = settings.cardSize;
const STATUSES = { possede: 'Possédé', envie: 'Envie' };
const READING = { 'a-lire': 'À lire', 'en-cours': 'En cours', lu: 'Lu' };

const GENRES = {
  Action: 'Action', Adventure: 'Aventure', Comedy: 'Comédie', Drama: 'Drame', Ecchi: 'Ecchi',
  Fantasy: 'Fantasy', Horror: 'Horreur', 'Mahou Shoujo': 'Magical girl', Mecha: 'Mecha',
  Music: 'Musique', Mystery: 'Mystère', Psychological: 'Psychologique', Romance: 'Romance',
  'Sci-Fi': 'Science-fiction', 'Slice of Life': 'Tranche de vie', Sports: 'Sport',
  Supernatural: 'Surnaturel', Thriller: 'Thriller',
};
const ANI_FORMAT = { MANGA: 'Manga', ONE_SHOT: 'One shot', NOVEL: 'Light novel' };
const ANI_STATUS = { FINISHED: 'Terminé', RELEASING: 'En cours', NOT_YET_RELEASED: 'À paraître', CANCELLED: 'Annulé', HIATUS: 'En pause' };
const ORIGIN = { JP: 'Japon', KR: 'Corée', CN: 'Chine', TW: 'Taïwan' };
const LANGS = { fre: 'Français', eng: 'Anglais', spa: 'Espagnol', ger: 'Allemand', ita: 'Italien', jpn: 'Japonais' };

const enc = encodeURIComponent;
const SHOPS = [
  { name: 'Amazon', cls: 'amazon', url: q => `https://www.${AMAZON[settings.amazon] || AMAZON.fr}/s?k=${enc(q)}&i=stripbooks` },
  { name: 'Fnac', url: q => `https://www.fnac.com/SearchResult/ResultList.aspx?Search=${enc(q)}` },
  { name: 'BDfugue', url: q => `https://www.bdfugue.com/catalogsearch/result/?q=${enc(q)}` },
  { name: 'Vinted', url: q => `https://www.vinted.fr/catalog?search_text=${enc(q)}` },
  { name: 'Leboncoin', url: q => `https://www.leboncoin.fr/recherche?text=${enc(q)}` },
];

const ICONS = {
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
  cart: '<svg viewBox="0 0 24 24"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M3 4h2.5l2.2 11h11l2-8H6.4"/></svg>',
  out: '<svg viewBox="0 0 24 24"><path d="M7 17 17 7M9 7h8v8"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/></svg>',
  books: '<svg viewBox="0 0 24 24"><path d="M4 19V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v14M9 19V7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v12M14.5 8.2l2.9-.8a1 1 0 0 1 1.2.7l2.9 10.6M3 20h18"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
};

/* ---------- Utilitaires ---------- */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function hue(str) {
  let h = 0;
  for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
function initials(title) {
  return String(title || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}
function plainText(html) {
  if (!html) return '';
  const withBreaks = String(html).replace(/<br\s*\/?>/gi, '\n');
  return new DOMParser().parseFromString(withBreaks, 'text/html').body.textContent.replace(/\n{3,}/g, '\n\n').trim();
}

/** "1-5, 7, 9-10" -> 8 tomes */
function parseVolumes(str) {
  const set = new Set();
  const parts = String(str || '').replace(/\s*-\s*/g, '-').split(/[,;\s]+/);
  for (const part of parts) {
    const m = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const a = Math.min(+m[1], +(m[2] || m[1]));
    const b = Math.max(+m[1], +(m[2] || m[1]));
    for (let i = a; i <= b && i - a < 2000; i++) set.add(i);
  }
  return set;
}
function countVolumes(str) {
  return parseVolumes(str).size;
}
/** Set {1,2,3,5} -> "1-3, 5" */
function formatVolumes(set) {
  const n = [...set].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < n.length; i++) {
    let j = i;
    while (n[j + 1] === n[j] + 1) j++;
    out.push(j > i ? `${n[i]}-${n[j]}` : `${n[i]}`);
    i = j;
  }
  return out.join(', ');
}
function isOld(it) {
  const y = +it.editionYear || +it.year;
  return y > 0 && y < OLD_YEAR;
}
function ownedCount(it) {
  if (it.status !== 'possede') return 0;
  return countVolumes(it.volumesOwned) || 1;
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

function coverHtml(it, extra = '') {
  const img = it.cover ? `<img src="${esc(it.cover)}" ${it.coverAlt ? `data-alt="${esc(it.coverAlt)}"` : ''} alt="" loading="lazy" referrerpolicy="no-referrer">` : '';
  return `<div class="cover"><div class="ph" style="--h:${hue(it.title)}">${esc(initials(it.title))}</div>${img}${extra}</div>`;
}
function starsHtml(n) {
  if (!n) return '';
  let s = '<span class="stars" aria-label="' + n + ' sur 5">';
  for (let i = 1; i <= 5; i++) s += ICONS.star.replace('<svg ', `<svg class="${i <= n ? 'on' : 'off'}" `);
  return s + '</span>';
}
function shopQuery(it) {
  return it.title;
}
function shopsHtml(it) {
  const q = shopQuery(it);
  return `<div class="shops">${SHOPS.filter(s => !settings.hiddenShops.includes(s.name)).map(s =>
    `<a class="shop ${s.cls || ''}" href="${esc(s.url(q))}" target="_blank" rel="noopener">${s.name}${ICONS.out}</a>`
  ).join('')}</div>`;
}

// Image cassée : on laisse apparaître la couverture de remplacement
// Image cassée : on essaie la couverture de secours, sinon la couverture de remplacement apparaît
function coverFailed(img) {
  if (img.dataset.alt) { img.src = img.dataset.alt; img.removeAttribute('data-alt'); } else img.remove();
}
document.addEventListener('error', e => {
  if (e.target.tagName === 'IMG' && e.target.closest('.cover')) coverFailed(e.target);
}, true);
// Amazon renvoie une image de 1 pixel quand il n'a pas la couverture
document.addEventListener('load', e => {
  if (e.target.tagName === 'IMG' && e.target.closest('.cover') && e.target.naturalWidth < 5) coverFailed(e.target);
}, true);

/* ---------- Couvertures par ISBN ---------- */
function isbn10(i13) {
  if (!/^978\d{10}$/.test(i13)) return '';
  const b = i13.slice(3, 12);
  let s = 0;
  for (let i = 0; i < 9; i++) s += (10 - i) * +b[i];
  const c = (11 - (s % 11)) % 11;
  return b + (c === 10 ? 'X' : c);
}
function coverForIsbn(i) {
  return i ? `https://covers.openlibrary.org/b/isbn/${i}-L.jpg?default=false` : '';
}
function amazonCover(i) {
  const t = isbn10(i);
  return t ? `https://images-na.ssl-images-amazon.com/images/P/${t}.01.LZZZZZZZ.jpg` : '';
}

/* ---------- Stockage ---------- */
function loadItems() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE_KEY));
    return Array.isArray(d) ? d : [];
  } catch (e) {
    return [];
  }
}
let items = loadItems();

function saveItems() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(items));
  } catch (e) {
    toast("Impossible d'enregistrer : le stockage du navigateur est bloqué ou plein");
  }
  renderCollection();
  if (search.results.length) renderResults();
  syncWidget();
  scheduleCloud();
}
function findExisting(r) {
  return items.find(it => it.source === r.source && it.sourceId && it.sourceId === r.sourceId);
}

/* ---------- Thème ---------- */
function currentTheme() {
  return document.documentElement.dataset.theme ||
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}
$('#theme-toggle').addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
});

/* ---------- Navigation ---------- */
function showView(name) {
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  if (name === 'search') setTimeout(() => $('#s-q').focus(), 50);
  if (name === 'suivi') renderSuivi();
  window.scrollTo({ top: 0 });
}
$$('.tab').forEach(t => t.addEventListener('click', () => showView(t.dataset.view)));
document.addEventListener('click', e => {
  const link = e.target.closest('[data-view-link]');
  if (link) { e.preventDefault(); showView(link.dataset.viewLink); }
});

/* =========================================================
   Collection
   ========================================================= */
const col = { q: '', type: '', status: '', reading: '', sort: 'added' };

function renderStats() {
  const owned = items.filter(it => it.status === 'possede');
  const vols = owned.reduce((n, it) => n + ownedCount(it), 0);
  const wish = items.filter(it => it.status === 'envie').length;
  const read = items.filter(it => it.reading === 'lu').length;
  $('#stats').innerHTML = `
    <div class="stat accent"><b>${vols}</b><span>tome${vols > 1 ? 's' : ''} possédé${vols > 1 ? 's' : ''}</span></div>
    <div class="stat"><b>${owned.length}</b><span>série${owned.length > 1 ? 's' : ''} / album${owned.length > 1 ? 's' : ''}</span></div>
    <div class="stat"><b>${read}</b><span>lu${read > 1 ? 's' : ''}</span></div>
    <div class="stat"><b>${wish}</b><span>dans la liste d'envies</span></div>`;
}

function collectionCard(it) {
  const owned = countVolumes(it.volumesOwned);
  const total = +it.volumesTotal || 0;
  let extra = it.status === 'envie' ? '<span class="ribbon envie">Envie</span>' : '';
  if (it.reading === 'en-cours') extra += '<span class="ribbon" style="top:auto;bottom:12px">En cours</span>';
  if (total > 1 && owned) extra += `<div class="progress"><i style="width:${Math.min(100, owned / total * 100)}%"></i></div>`;
  let vols = '';
  if (owned) vols = total ? `${owned}/${total} tomes` : `${owned} tome${owned > 1 ? 's' : ''}`;
  return `<article class="card" tabindex="0" data-id="${esc(it.id)}">
    ${coverHtml(it, extra)}
    <div class="card-body">
      <h3>${esc(it.title)}</h3>
      <p class="authors">${esc((it.authors || []).join(', ')) || '&nbsp;'}</p>
      <div class="meta"><span class="badge">${esc(TYPES[it.type] || 'Autre')}</span>${vols ? `<span>${vols}</span>` : ''}${isOld(it) ? `<span class="badge">${+it.editionYear || it.year}</span>` : ''}${it.reading === 'lu' ? '<span class="badge accent">Lu</span>' : ''}</div>
      ${starsHtml(it.rating)}
    </div>
  </article>`;
}

/* =========================================================
   Lecture : page en cours et chrono
   ========================================================= */
function duree(ms) {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}
function horloge(ms) {
  const s = Math.floor(ms / 1000);
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(n => String(n).padStart(2, '0')).join(':');
}
function lectureStats(it) {
  const parts = [];
  const total = (it.readMs || 0) + (it.chronoStart ? Date.now() - it.chronoStart : 0);
  if (total > 0) parts.push('Temps de lecture : ' + duree(total));
  const lues = (it.sessions || []).reduce((n, x) => n + Math.max(0, (x.p2 || 0) - (x.p1 || 0)), 0);
  const ms = (it.sessions || []).reduce((n, x) => n + (x.p2 > x.p1 ? x.ms : 0), 0);
  if (lues > 0 && ms > 60000) {
    const parHeure = lues / (ms / 3600000);
    parts.push(`${Math.round(parHeure)} pages/h`);
    if (it.pagesTotal > it.page) parts.push('fini dans environ ' + duree((it.pagesTotal - it.page) / parHeure * 3600000));
  }
  if (it.sessions?.length) parts.push(`${it.sessions.length} séance${it.sessions.length > 1 ? 's' : ''}`);
  return parts.join(' · ');
}
function lectureHtml(it) {
  const pct = it.pagesTotal ? Math.min(100, (it.page || 0) / it.pagesTotal * 100) : 0;
  const serie = it.source === 'anilist' || it.source === 'olserie' || +it.volumesTotal > 1;
  return `<div class="section-title">Ma lecture</div>
    <div class="lecture">
      <div class="lecture-pages">
        ${serie ? `<label>Tome<input type="number" form="edit-form" name="tomeEnCours" min="1" value="${esc(it.tomeEnCours || '')}"></label>` : ''}
        <label>Page<input type="number" form="edit-form" name="page" min="0" value="${esc(it.page || '')}" placeholder="où j'en suis"></label>
        <label>sur<input type="number" form="edit-form" name="pagesTotal" min="1" value="${esc(it.pagesTotal || '')}" placeholder="total"></label>
      </div>
      <div class="lecture-barre"><i style="width:${pct}%"></i></div>
      <div class="chrono">
        <span class="chrono-temps" id="chrono-temps">${horloge(it.chronoStart ? Date.now() - it.chronoStart : 0)}</span>
        <button type="button" class="btn ${it.chronoStart ? 'ghost' : 'primary'}" id="chrono-btn">${it.chronoStart ? 'Arrêter' : 'Lancer le chrono'}</button>
      </div>
      <p class="muted lecture-stats" id="lecture-stats">${esc(lectureStats(it))}</p>
    </div>`;
}
function wireLecture(it, form) {
  const btn = $('#chrono-btn');
  const tick = setInterval(() => {
    if (!btn.isConnected) return clearInterval(tick);
    if (it.chronoStart) $('#chrono-temps').textContent = horloge(Date.now() - it.chronoStart);
  }, 1000);
  const barre = () => {
    const p = +form.page.value || 0, t = +form.pagesTotal.value || 0;
    $('.lecture-barre i').style.width = (t ? Math.min(100, p / t * 100) : 0) + '%';
  };
  form.page.addEventListener('input', barre);
  form.pagesTotal.addEventListener('input', barre);
  btn.addEventListener('click', () => {
    if (!it.chronoStart) {
      // Un seul chrono à la fois
      items.forEach(x => { if (x.chronoStart && x !== it) stopChrono(x, x.page); });
      it.chronoStart = Date.now();
      it.chronoPage = +form.page.value || it.page || 0;
      if (it.reading !== 'lu') it.reading = 'en-cours';
      btn.textContent = 'Arrêter';
      btn.className = 'btn ghost';
      toast('Chrono lancé, bonne lecture !');
    } else {
      const ms = stopChrono(it, +form.page.value || it.page || 0);
      btn.textContent = 'Lancer le chrono';
      btn.className = 'btn primary';
      $('#chrono-temps').textContent = horloge(0);
      form.page.focus();
      form.page.select();
      toast(`${duree(ms)} de lecture. À quelle page tu t'arrêtes ?`);
    }
    saveItems();
    $('#lecture-stats').textContent = lectureStats(it);
    $$('[data-seg="reading"] button').forEach(b => b.classList.toggle('active', b.dataset.v === it.reading));
  });
  // La page tapée après l'arrêt complète la dernière séance
  form.page.addEventListener('change', () => {
    const last = it.sessions?.[it.sessions.length - 1];
    it.page = +form.page.value || 0;
    it.pagesTotal = +form.pagesTotal.value || it.pagesTotal || null;
    if (last && Date.now() - last.fin < 10 * 60000) last.p2 = it.page;
    if (it.pagesTotal && it.page >= it.pagesTotal) it.reading = 'lu';
    saveItems();
    $('#lecture-stats').textContent = lectureStats(it);
  });
}
function stopChrono(it, page) {
  const ms = Date.now() - it.chronoStart;
  it.readMs = (it.readMs || 0) + ms;
  (it.sessions = it.sessions || []).push({ debut: it.chronoStart, fin: Date.now(), ms, p1: it.chronoPage || 0, p2: page || it.chronoPage || 0 });
  it.chronoStart = null;
  it.updatedAt = Date.now();
  return ms;
}

// Pastille en haut quand un chrono tourne (même si l'appli a été fermée)
function renderChronoPill() {
  const it = items.find(x => x.chronoStart);
  const pill = $('#chrono-pill');
  pill.hidden = !it;
  if (it) {
    pill.dataset.id = it.id;
    pill.textContent = horloge(Date.now() - it.chronoStart) + ' · ' + it.title;
  }
}
setInterval(renderChronoPill, 1000);
$('#chrono-pill').addEventListener('click', e => openEditor(e.currentTarget.dataset.id));

// Vue étagère : chaque titre est une tranche de livre
function spineHtml(it) {
  const h = hue(it.title);
  const n = Math.max(1, countVolumes(it.volumesOwned));
  const width = Math.min(96, 28 + (n - 1) * 5);
  const height = 150 + (h % 50);
  return `<div class="spine-slot"><button class="card spine" data-id="${esc(it.id)}" title="${esc(it.title)}"
    style="--h:${h};width:${width}px;height:${height}px">
    <span>${esc(it.title)}</span>${n > 1 ? `<small>${n}</small>` : ''}</button></div>`;
}
$('#col-view').addEventListener('click', () => {
  settings.viewMode = settings.viewMode === 'etagere' ? 'cartes' : 'etagere';
  saveSettings();
  renderCollection();
});

function renderCollection() {
  $('#tab-count').textContent = items.length;
  renderStats();
  const q = norm(col.q);
  const list = items.filter(it =>
    (!col.type || (col.type === 'ancien' ? isOld(it) : it.type === col.type)) &&
    (!col.status || it.status === col.status) &&
    (!col.reading || it.reading === col.reading) &&
    (!q || norm([it.title, it.altTitle, ...(it.authors || []), ...(it.genres || []), it.note].join(' ')).includes(q))
  );
  const by = {
    added: (a, b) => (b.addedAt || 0) - (a.addedAt || 0),
    title: (a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base', numeric: true }),
    rating: (a, b) => (b.rating || 0) - (a.rating || 0) || a.title.localeCompare(b.title, 'fr'),
    year: (a, b) => (b.year || 0) - (a.year || 0),
    old: (a, b) => (+a.editionYear || a.year || 9999) - (+b.editionYear || b.year || 9999),
  };
  list.sort(by[col.sort] || by.added);

  const shelf = settings.viewMode === 'etagere';
  $('#col-grid').classList.toggle('shelf', shelf);
  $('#col-view').textContent = shelf ? 'Vue cartes' : 'Vue étagère';
  $('#col-grid').innerHTML = shelf ? list.map(spineHtml).join('') : list.map(collectionCard).join('');
  const empty = $('#col-empty');
  if (!items.length) {
    empty.innerHTML = `${ICONS.books.replace('<svg ', '<svg class="big" ')}
      <h2>Ta collection est vide</h2>
      <p>Cherche tes séries préférées et ajoute-les en un clic.</p>
      <button class="btn primary" data-view-link="search">${ICONS.search}Rechercher un titre</button>`;
    empty.hidden = false;
  } else if (!list.length) {
    empty.innerHTML = '<h2>Rien ne correspond</h2><p>Essaie d\'enlever un filtre.</p>';
    empty.hidden = false;
  } else {
    empty.hidden = true;
  }
}

$('#col-q').addEventListener('input', e => { col.q = e.target.value; renderCollection(); });
$('#col-status').addEventListener('change', e => { col.status = e.target.value; renderCollection(); });
$('#col-reading').addEventListener('change', e => { col.reading = e.target.value; renderCollection(); });
$('#col-sort').addEventListener('change', e => { col.sort = e.target.value; renderCollection(); });
$('#col-type').addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  col.type = chip.dataset.type;
  $$('.chip', $('#col-type')).forEach(c => c.classList.toggle('active', c === chip));
  renderCollection();
});
$('#col-grid').addEventListener('click', e => {
  const card = e.target.closest('.card');
  if (card) openEditor(card.dataset.id);
});
$('#col-grid').addEventListener('keydown', e => {
  const card = e.target.closest('.card');
  if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openEditor(card.dataset.id); }
});
$('#btn-add-manual').addEventListener('click', () => openEditor(null));

/* ---------- Export / import ---------- */
$('#btn-export').addEventListener('click', () => {
  if (!items.length) return toast('Rien à exporter pour le moment');
  const name = `pagivore-collection-${new Date().toISOString().slice(0, 10)}.json`;
  if (window.BullesAndroid) return BullesAndroid.enregistrer(name, JSON.stringify(items, null, 2)); // appli Android
  const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `pagivore-collection-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Sauvegarde téléchargée');
});
$('#file-import').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data)) throw new Error();
    let added = 0;
    for (const raw of data) {
      if (!raw || typeof raw.title !== 'string') continue;
      const it = { ...raw, id: raw.id || uid() };
      const i = items.findIndex(x => x.id === it.id);
      if (i >= 0) items[i] = it; else { items.push(it); added++; }
    }
    saveItems();
    toast(`Import terminé : ${added} nouveau${added > 1 ? 'x' : ''} titre${added > 1 ? 's' : ''}`);
  } catch (err) {
    toast("Ce fichier n'est pas une sauvegarde Pagivore valide");
  }
});

/* =========================================================
   Fenêtre (modal)
   ========================================================= */
const modal = $('#modal');
function openModal(html) {
  $('#modal-body').innerHTML = `<button class="icon-btn modal-close" data-close aria-label="Fermer">${ICONS.close}</button>` + html;
  if (!modal.open) modal.showModal();
  $('#modal-body').scrollTop = 0;
}
modal.addEventListener('click', e => {
  if (e.target === modal || e.target.closest('[data-close]')) modal.close();
});

/* ---------- Éditeur d'un titre de la collection ---------- */
function openEditor(id) {
  const existing = id ? items.find(x => x.id === id) : null;
  curDetail = existing ? { obj: existing, item: true } : null;
  const it = existing || {
    title: '', authors: [], type: 'bd', status: 'possede', reading: 'a-lire',
    volumesOwned: '', volumesTotal: '', rating: 0, note: '', cover: '', year: '',
  };
  const seg = (name, map, value) => `<div class="seg" data-seg="${name}">${Object.entries(map).map(([k, v]) =>
    `<button type="button" data-v="${k}" class="${k === value ? 'active' : ''}">${v}</button>`).join('')}</div>`;

  openModal(`
    ${coverHtml(it)}
    <div class="modal-info">
      <h2>${existing ? esc(it.title) : 'Ajouter un titre'}</h2>
      ${existing && it.source !== 'manuel' ? authorsHtml(it) : ''}
      ${it.altTitle ? `<p class="alt">${esc(it.altTitle)}</p>` : ''}
      ${existing && it.genres?.length ? `<div class="meta">${it.genres.slice(0, 5).map(g => `<span class="badge">${esc(g)}</span>`).join('')}</div>` : ''}
      <form class="form" id="edit-form">
        ${existing ? '' : `
          <label class="full">Titre<input type="text" name="title" required placeholder="ex. Blacksad"></label>
          <label class="full">Auteur(s)<input type="text" name="authors" placeholder="séparés par des virgules"></label>`}
        ${existing ? '' : `<label>Type${seg('type', TYPES, it.type)}</label>`}
        <label>Statut${seg('status', STATUSES, it.status)}</label>
        <label class="full">Lecture${seg('reading', READING, it.reading)}</label>
        <label>Tomes possédés <input type="text" name="volumesOwned" value="${esc(it.volumesOwned)}" placeholder="ex. 1-12, 14">
          <span class="hint">Plages et numéros séparés par des virgules</span></label>
        <label>Nombre total de tomes <input type="number" name="volumesTotal" min="0" value="${esc(it.volumesTotal || '')}" placeholder="si connu"></label>
        <label class="full">Ma note
          <div class="rate" data-rating="${+it.rating || 0}">${[1, 2, 3, 4, 5].map(n =>
            `<button type="button" data-v="${n}" aria-label="${n} étoile${n > 1 ? 's' : ''}" class="${n <= it.rating ? 'on' : ''}">${ICONS.star}</button>`).join('')}</div>
        </label>
        <label>État<select name="etat">${Object.entries(ETATS).map(([k, v]) =>
          `<option value="${k}" ${k === (it.etat || '') ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label>Année de mon édition<input type="number" name="editionYear" min="1400" max="2100" value="${esc(it.editionYear || '')}" placeholder="utile pour les livres anciens"></label>
        <label class="full">Commentaire<textarea name="note" placeholder="Édition, prêté à..., avis...">${esc(it.note)}</textarea></label>
        ${existing ? '' : `
          <label>Année<input type="number" name="year" min="1800" max="2100" placeholder="ex. 2000"></label>
          <label>Image de couverture (lien)<input type="url" name="cover" placeholder="https://..."></label>`}
      </form>
      ${existing ? lectureHtml(it) : ''}
      ${existing ? volsHtml('Mes tomes (clique pour cocher)') : ''}
      ${existing ? `<div class="section-title">Trouver ce titre</div>${shopsHtml(it)}` : ''}
      <div class="modal-actions">
        <button class="btn primary" id="edit-save">${existing ? 'Enregistrer' : 'Ajouter à ma collection'}</button>
        ${existing ? '<button class="btn danger" id="edit-delete">Retirer de la collection</button>' : ''}
        ${existing && it.url ? `<a class="btn ghost" href="${esc(it.url)}" target="_blank" rel="noopener">Voir en ligne ${ICONS.out}</a>` : ''}
      </div>
      ${existing && it.source !== 'manuel' ? descHtml() + '<div id="sheet"></div>' : ''}
    </div>`);

  const body = $('#modal-body');
  $$('.seg', body).forEach(s => s.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    $$('button', s).forEach(x => x.classList.toggle('active', x === b));
  }));
  const rate = $('.rate', body);
  rate.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const v = +b.dataset.v === +rate.dataset.rating ? 0 : +b.dataset.v; // recliquer = enlever la note
    rate.dataset.rating = v;
    $$('button', rate).forEach(x => x.classList.toggle('on', +x.dataset.v <= v));
  });

  const form = $('#edit-form');
  form.addEventListener('submit', e => { e.preventDefault(); save(); });
  $('#edit-save').addEventListener('click', save);
  $('#edit-delete')?.addEventListener('click', () => {
    if (!confirm(`Retirer « ${it.title} » de ta collection ?`)) return;
    items = items.filter(x => x.id !== id);
    saveItems();
    modal.close();
    toast('Titre retiré');
  });

  if (existing) {
    // Cocher les tomes : la grille et le champ texte restent synchronisés
    const vols = {
      set: parseVolumes(it.volumesOwned),
      total: () => form.volumesTotal.value,
      changed() { form.volumesOwned.value = formatVolumes(vols.set); },
    };
    form.volumesOwned.addEventListener('input', () => { vols.set = parseVolumes(form.volumesOwned.value); vols.redraw?.(); });
    form.volumesTotal.addEventListener('input', () => vols.redraw?.());
    // Copie : la fiche et le résumé ne sont pas enregistrés dans la collection
    fillDetails({ ...it, badges: [], description: '' }, vols);
    wireLecture(it, form);
  }

  function save() {
    const fd = new FormData(form);
    const segVal = n => $(`[data-seg="${n}"] .active`, body)?.dataset.v;
    const values = {
      type: segVal('type') || it.type,
      status: segVal('status'),
      reading: segVal('reading'),
      volumesOwned: fd.get('volumesOwned').trim(),
      volumesTotal: +fd.get('volumesTotal') || null,
      rating: +rate.dataset.rating || 0,
      note: fd.get('note').trim(),
      etat: fd.get('etat') || '',
      editionYear: +fd.get('editionYear') || null,
      updatedAt: Date.now(),
      ...(existing ? {
        page: +fd.get('page') || 0,
        pagesTotal: +fd.get('pagesTotal') || null,
        tomeEnCours: +fd.get('tomeEnCours') || null,
      } : {}),
    };
    if (existing) {
      Object.assign(existing, values);
      toast('Modifications enregistrées');
    } else {
      const title = (fd.get('title') || '').trim();
      if (!title) { form.reportValidity(); return; }
      items.unshift({
        id: uid(), source: 'manuel', sourceId: '', title, altTitle: '',
        authors: (fd.get('authors') || '').split(',').map(s => s.trim()).filter(Boolean),
        cover: (fd.get('cover') || '').trim(), year: +fd.get('year') || null,
        genres: [], isbn: '', url: '', addedAt: Date.now(), ...values,
      });
      toast(`« ${title} » ajouté`);
    }
    saveItems();
    modal.close();
  }
}

/* =========================================================
   Recherche en ligne
   ========================================================= */
const search = { source: 'tout', page: 1, results: [], hasMore: false, total: 0, loading: false, searched: false, error: '' };

// Listes de filtres
$('#f-genre').insertAdjacentHTML('beforeend',
  Object.entries(GENRES).sort((a, b) => a[1].localeCompare(b[1], 'fr'))
    .map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join(''));
$('#f-year').insertAdjacentHTML('beforeend',
  [2025, 2020, 2015, 2010, 2000, 1990, 1980].map(y => `<option value="${y}">${y}</option>`).join(''));

/* AniList (GraphQL, sans clé) */
const ANI_QUERY = `query($page:Int,$s:String,$f:[MediaFormat],$c:CountryCode,$st:MediaStatus,$g:String,$sort:[MediaSort],$y:FuzzyDateInt){
  Page(page:$page,perPage:${PER_PAGE}){
    pageInfo{total hasNextPage}
    media(search:$s,type:MANGA,format_in:$f,countryOfOrigin:$c,status:$st,genre:$g,sort:$sort,startDate_greater:$y,isAdult:false){
      id title{romaji english} format status volumes startDate{year} genres averageScore
      coverImage{large} staff(perPage:3,sort:RELEVANCE){nodes{name{full}}}
      siteUrl countryOfOrigin description(asHtml:false)
    }
  }
}`;

function mapAni(m) {
  const en = m.title.english, ro = m.title.romaji;
  return {
    source: 'anilist', sourceId: String(m.id), type: 'manga',
    title: en || ro, altTitle: en && ro && en !== ro ? ro : '',
    authors: (m.staff?.nodes || []).map(n => n.name.full),
    cover: m.coverImage?.large || '', year: m.startDate?.year || null,
    genres: (m.genres || []).map(g => GENRES[g] || g),
    volumesTotal: m.volumes || null,
    score: m.averageScore ? Math.round(m.averageScore) / 10 : null,
    badges: [ANI_FORMAT[m.format] || m.format, ORIGIN[m.countryOfOrigin], ANI_STATUS[m.status]].filter(Boolean),
    description: plainText(m.description),
    url: m.siteUrl,
  };
}
const ANI_FIELDS = `id title{romaji english} format status volumes startDate{year} genres averageScore
  coverImage{large} staff(perPage:3,sort:RELEVANCE){nodes{name{full}}} siteUrl countryOfOrigin description(asHtml:false)`;

// Toutes les oeuvres d'un auteur (manga)
const ANI_AUTHOR = `query($s:String){Staff(search:$s){staffMedia(type:MANGA,sort:POPULARITY_DESC,perPage:50){nodes{${ANI_FIELDS}}}}}`;

async function searchAniList(q, page) {
  let sort = $('#f-sort').value;
  if (sort === 'SEARCH_MATCH' && !q) sort = 'POPULARITY_DESC';
  const v = {
    page,
    s: q || undefined,
    f: $('#f-format').value ? $('#f-format').value.split(',') : undefined,
    c: $('#f-origin').value || undefined,
    st: $('#f-status').value || undefined,
    g: $('#f-genre').value || undefined,
    y: $('#f-year').value ? +$('#f-year').value * 10000 : undefined,
    sort: [sort],
  };
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(search.author
      ? { query: ANI_AUTHOR, variables: { s: search.author } }
      : { query: ANI_QUERY, variables: v }),
  });
  if (res.status === 429) throw new Error('Trop de recherches d\'un coup : attends une minute');
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error('AniList ne répond pas correctement, réessaie');
  // Oeuvres d'un auteur : on garde aussi seulement le format choisi
  const formats = $('#f-format').value.split(',').filter(Boolean);
  const nodes = (json.data.Staff?.staffMedia?.nodes || []).filter(m => !formats.length || formats.includes(m.format));
  const p = search.author ? { pageInfo: { total: nodes.length, hasNextPage: false }, media: nodes } : json.data.Page;
  return {
    total: p.pageInfo.total,
    hasMore: p.pageInfo.hasNextPage,
    items: p.media.map(mapAni),
  };
}

/* Open Library (sans clé) */
// Pour la recherche « Livres » : reconnaître un manga, une BD ou un comic
const NOT_COMICS = '-subject:manga -subject:comics -subject:"graphic novels" -subject:"bandes dessinées" -subject:"comic books, strips, etc"';
const COMIC_PUBLISHERS = /gl[ée]nat|\bkana\b|\bpika\b|kurokawa|ki-oon|kaz[ée]|delcourt|tonkam|dargaud|dupuis|casterman|lombard|soleil|panini|urban comics|dark horse|\bviz\b|kodansha|shueisha|shogakukan|square enix|yen press|seven seas|tokyopop|marvel|dc comics|image comics|manga|comics/i;
const COMIC_SUBJECTS = /manga|comic|bandes? dessin|graphic novel/i;
function isComic(d) {
  return /[぀-ヿ一-鿿]/.test(d.title) ||
    (d.publisher || []).some(p => COMIC_PUBLISHERS.test(p)) ||
    (d.subject || []).some(x => COMIC_SUBJECTS.test(x));
}

function mapOlDoc(d, type) {
  const isbns = d.isbn || [];
  const lang = (d.language || []).includes('fre') ? 'fre' : (d.language || [])[0];
  const serie = serieOf(d.title);
  return {
    source: 'openlibrary', sourceId: d.key, type,
    title: d.title, altTitle: '',
    authors: d.author_name || [],
    cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : '',
    year: d.first_publish_year || null, genres: [],
    isbn: isbns.find(i => i.length === 13 && i.startsWith('9782')) || isbns.find(i => i.length === 13) || isbns[0] || '',
    volumesTotal: null, score: null,
    badges: [LANGS[lang], d.number_of_pages_median ? d.number_of_pages_median + ' p.' : '', (d.publisher || [])[0]].filter(Boolean),
    description: '',
    url: 'https://openlibrary.org' + d.key,
    serieName: serie?.name || '', tome: serie?.n || null, pages: d.number_of_pages_median || null,
  };
}

/* ---------- Séries : regrouper les tomes (BD, comics, livres) ---------- */
// « Blacksad, tome 2 », « Astérix - T.5 », « Berserk Volume 42 »...
const TOME_RE = /^(.+?)[\s,.:;–-]*\b(?:tome|t\.|vol\.?|volume|band|n°|#)\s*(\d{1,3})\b/i;
function serieOf(title) {
  const m = String(title || '').match(TOME_RE);
  return m && m[1].trim().length > 1 ? { name: m[1].trim().replace(/[\s,.:;–-]+$/, ''), n: +m[2] } : null;
}
function groupSeries(list) {
  const out = [], byKey = new Map();
  for (const r of list) {
    if (!r.serieName) { out.push(r); continue; }
    const key = norm(r.serieName);
    let s = byKey.get(key);
    if (!s) {
      s = r.isSerie ? r : {
        ...r, source: 'olserie', sourceId: key, title: r.serieName, isSerie: true, tomes: {},
        workKey: r.sourceId, isbn: '', baseBadges: r.badges.filter(b => !/ p\.$/.test(b)),
        url: 'https://openlibrary.org/search?q=' + enc(r.serieName),
      };
      byKey.set(key, s);
      out.push(s);
    }
    if (!r.isSerie && r.tome && !s.tomes[r.tome]) {
      s.tomes[r.tome] = { cover: r.cover, key: r.sourceId };
      if (r.year && (!s.year || r.year < s.year)) s.year = r.year;
    }
  }
  for (const s of byKey.values()) {
    const nums = Object.keys(s.tomes).map(Number).sort((a, b) => a - b);
    const first = nums.find(n => s.tomes[n].cover);
    if (first) { s.cover = s.tomes[first].cover; s.workKey = s.tomes[first].key; }
    s.volumesTotal = Math.max(s.volumesTotal || 0, ...nums);
    s.badges = [`${nums.length} tome${nums.length > 1 ? 's' : ''}`, ...s.baseBadges];
  }
  return out;
}
// Couvertures de tous les tomes d'une série (recherche sur le nom de la série)
const serieCache = new Map();
function olSerieCovers(r) {
  if (!serieCache.has(r.sourceId)) {
    serieCache.set(r.sourceId, (async () => {
      const covers = {};
      for (const [n, t] of Object.entries(r.tomes || {})) if (t.cover) covers[n] = t.cover;
      const p = new URLSearchParams({ q: `title:"${r.title}"`, limit: 100, fields: 'key,title,cover_i' });
      const j = await (await fetch('https://openlibrary.org/search.json?' + p)).json();
      for (const d of j.docs || []) {
        const s = serieOf(d.title);
        if (s && norm(s.name) === r.sourceId && d.cover_i && !covers[s.n]) {
          covers[s.n] = `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg`;
        }
      }
      return covers;
    })().catch(() => ({})));
  }
  return serieCache.get(r.sourceId);
}

// Une seule recherche : mangas (AniList) + livres, BD, comics (Open Library, BnF) ; le type est deviné tout seul
async function searchTout(q, page) {
  const isbn = /^(97[89])?\d{9}[\dXx]$/.test(q.replace(/[-\s]/g, ''));
  const [a, o] = await Promise.all([
    isbn ? null : searchAniList(q, page).catch(() => null),
    q || search.author ? searchOpenLibrary(q, page).catch(() => null) : null,
  ]);
  if (!a && !o) throw new Error('Pas de réponse : vérifie ta connexion');
  const ani = a?.items || [];
  // Le même manga trouvé des deux côtés : on garde la fiche AniList
  const noms = new Set(ani.flatMap(r => [norm(r.title), norm(r.altTitle)]).filter(Boolean));
  const ol = (o?.items || []).filter(r => !(r.type === 'manga' && noms.has(norm(r.serieName || r.title))));
  return { items: [...ani, ...ol], total: (a?.total || 0) + (o?.total || 0), hasMore: !!(a?.hasMore || o?.hasMore) };
}

async function searchOpenLibrary(q, page) {
  const livres = search.source === 'livres';
  const isOnlyIsbn = /^(97[89])?\d{9}[\dXx]$/.test(q.replace(/[-\s]/g, ''));
  const cat = livres ? '' : $('#f-bd-cat').value;
  const parts = [];
  const isbn = q.replace(/[-\s]/g, '');
  if (/^(97[89])?\d{9}[\dXx]$/.test(isbn)) parts.push('isbn:' + isbn);
  else if (q) parts.push(q);
  if (cat) parts.push(`subject:"${cat}"`);
  // Livres : on écarte mangas, BD et comics
  if (livres && !parts[0]?.startsWith('isbn:')) parts.push(NOT_COMICS);
  // L'époque choisie passe avant les années tapées à la main
  const era = $('#f-bd-era').value.split('-');
  const from = +(era[0] || $('#f-bd-from').value) || 0;
  const to = +(era[1] || (era.length > 1 ? '' : $('#f-bd-to').value)) || 0;
  if (from || to) parts.push(`first_publish_year:[${from || 1000} TO ${to || 2100}]`);

  const params = new URLSearchParams({
    q: parts.join(' '), page, limit: PER_PAGE,
    fields: 'key,title,author_name,first_publish_year,cover_i,isbn,language,number_of_pages_median,publisher,subject',
  });
  if ($('#f-bd-lang').value) params.set('language', $('#f-bd-lang').value);
  if ($('#f-bd-sort').value) params.set('sort', $('#f-bd-sort').value);
  if (search.author) params.set('author', search.author);
  else if (!q) throw new Error('Tape un titre, un auteur ou un ISBN');

  const res = await fetch('https://openlibrary.org/search.json?' + params);
  if (!res.ok) throw new Error('Open Library ne répond pas, réessaie dans un instant');
  const json = await res.json();
  const type = livres ? 'livre' : cat === 'manga' ? 'manga' : cat === 'comics' ? 'comics' : 'bd';
  const out = {
    total: json.numFound - (livres && !isOnlyIsbn ? json.docs.filter(isComic).length : 0),
    hasMore: page * PER_PAGE < json.numFound,
    items: json.docs.filter(d => !livres || isOnlyIsbn || !isComic(d)).map(d => mapOlDoc(d, search.source === 'tout' ? guessType(d) : type)),
  };
  // Peu de résultats : on complète avec la BnF (presque tous les livres publiés en France)
  if (page === 1 && !search.author && q && out.items.length < 8) {
    try {
      const query = isOnlyIsbn ? `bib.isbn all "${q.replace(/[-\s]/g, '')}"` : `bib.anywhere all "${q}"`;
      const known = new Set(out.items.map(r => r.isbn).filter(Boolean));
      const extra = (await bnfRecords(query, 20)).filter(r =>
        !known.has(r.isbn) && (isOnlyIsbn || search.source === 'tout' || (livres ? r.type === 'livre' : r.type !== 'livre')));
      out.items = out.items.concat(extra);
      out.total += extra.length;
    } catch (e) { /* la BnF ne répond pas : tant pis */ }
  }
  return out;
}

/* ---------- BnF : catalogue de la Bibliothèque nationale de France ---------- */
async function bnfRecords(query, max = 10) {
  const p = new URLSearchParams({ version: '1.2', operation: 'searchRetrieve', query, recordSchema: 'dublincore', maximumRecords: max });
  const xml = new DOMParser().parseFromString(await (await fetch('https://catalogue.bnf.fr/api/SRU?' + p)).text(), 'text/xml');
  return [...xml.getElementsByTagNameNS('*', 'dc')].map(rec => {
    const g = n => [...rec.getElementsByTagNameNS('*', n)].map(e => e.textContent.trim());
    return mapBnf(g);
  }).filter(r => r.title);
}
function mapBnf(g) {
  // « Gleipnir. 5 / Sun Takeda » -> titre « Gleipnir. 5 », série « Gleipnir », tome 5
  const main = (g('title')[0] || '').split(' / ')[0].trim();
  const ids = g('identifier');
  const isbn = ((ids.find(x => /^ISBN/.test(x)) || '').replace(/^ISBN\s*/, '').replace(/[^\dXx]/g, '')).slice(0, 13);
  const ark = ids.find(x => x.includes('ark:')) || '';
  // « Takeda, Sun. Auteur du texte » -> « Sun Takeda »
  const authors = g('creator').map(c => {
    const [nom, prenom] = c.replace(/\s*\([^)]*\)/g, '').replace(/\.\s*[A-ZÉ][^.]*$/, '').trim().split(', ');
    return prenom ? `${prenom} ${nom}` : nom;
  });
  const pub = (g('publisher')[0] || '').replace(/\s*\([^)]*\)\s*$/, '');
  const pages = +((g('format')[0] || '').match(/(\d+)\s*p\./) || [])[1] || null;
  const m = main.match(/^(.+?)\.\s*(?:T(?:ome)?\.?\s*)?(\d{1,3})\b/);
  const serie = m ? { name: m[1].trim(), n: +m[2] } : serieOf(main);
  return {
    source: 'bnf', sourceId: ark || isbn, title: main, altTitle: '',
    type: guessType({ title: main, publisher: [pub], subject: g('subject') }),
    authors, cover: coverForIsbn(isbn), coverAlt: amazonCover(isbn),
    year: +((g('date')[0] || '').match(/\d{4}/) || [])[0] || null, genres: [],
    isbn, volumesTotal: null, score: null, pages,
    badges: [pub, pages ? pages + ' p.' : ''].filter(Boolean),
    description: '', url: ark, serieName: serie?.name || '', tome: serie?.n || null,
  };
}

let searchId = 0;
async function runSearch(reset = true) {
  if (!reset && search.loading) return;
  const id = ++searchId; // seule la dernière recherche lancée est affichée
  const q = $('#s-q').value.trim();
  if (reset) search.page = 1; // les anciens résultats restent affichés jusqu'aux nouveaux
  search.loading = true;
  search.error = '';
  renderResults();
  try {
    const fn = searchTout;
    const r = await fn(q, search.page);
    if (id !== searchId) return;
    search.results = groupSeries((reset ? [] : search.results).concat(r.items));
    setTimeout(() => search.results.slice(0, 8).forEach(prefetch), 300);
    search.total = r.total;
    search.hasMore = r.hasMore;
    search.searched = true;
  } catch (err) {
    if (id !== searchId) return;
    search.error = err instanceof TypeError ? 'Pas de connexion internet ?' : err.message;
  }
  search.loading = false;
  renderResults();
  setTimeout(maybeLoadMore, 50);
}
// Plus de résultats chargés tout seuls en arrivant en bas de la liste
function maybeLoadMore() {
  const more = $('#btn-more');
  if (more.hidden || search.loading || !search.hasMore || !$('#view-search').classList.contains('active')) return;
  if (more.getBoundingClientRect().top < innerHeight + 500) { search.page++; runSearch(false); }
}
addEventListener('scroll', maybeLoadMore, { passive: true });

function resultCard(r, i) {
  const inCol = findExisting(r);
  const ribbon = inCol ? `<span class="ribbon ${inCol.status === 'envie' ? 'envie' : 'in'}">${inCol.status === 'envie' ? 'Envie' : 'Dans ta collection'}</span>` : '';
  const amazon = SHOPS[0].url(shopQuery(r));
  return `<article class="card" tabindex="0" data-i="${i}">
    ${coverHtml(r, ribbon)}
    <div class="card-body">
      <h3>${esc(r.title)}</h3>
      <p class="authors">${esc(r.authors.slice(0, 2).join(', ')) || '&nbsp;'}</p>
      <div class="meta">${r.year ? `<span>${r.year}</span>` : ''}${r.badges.slice(0, 2).map(b => `<span class="badge">${esc(b)}</span>`).join('')}${r.score ? `<span class="badge accent">${r.score.toFixed(1)}/10</span>` : ''}</div>
      <div class="card-actions">
        ${inCol
          ? `<button class="btn ghost small label" data-action="edit">${ICONS.check}Modifier</button>`
          : `<button class="btn primary small label" data-action="add" title="Je l'ai">${ICONS.plus}Je l'ai</button>
             <button class="btn ghost small square" data-action="wish" title="Ajouter à ma liste d'envies" aria-label="Liste d'envies">${ICONS.heart}</button>`}
        <a class="btn ghost small square" href="${esc(amazon)}" target="_blank" rel="noopener" title="Voir sur Amazon" aria-label="Voir sur Amazon" data-action="link">${ICONS.cart}</a>
      </div>
    </div>
  </article>`;
}

function renderResults() {
  const head = $('#results-head');
  const grid = $('#results');
  const more = $('#btn-more');

  if (search.error && !search.results.length) {
    head.innerHTML = '';
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><h2>Oups</h2><p>${esc(search.error)}</p></div>`;
    more.hidden = true;
    return;
  }
  if (search.error) { toast(search.error); search.error = ''; }

  if (search.loading && !search.results.length) {
    head.innerHTML = '<h2>Recherche...</h2>';
    grid.innerHTML = Array.from({ length: 8 }, () =>
      '<div class="card skeleton"><div class="cover"></div><div class="card-body"><div class="line"></div><div class="line" style="width:60%"></div></div></div>').join('');
    more.hidden = true;
    return;
  }

  if (!search.searched) {
    head.innerHTML = '';
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1">${ICONS.search.replace('<svg ', '<svg class="big" ')}
      <h2>Trouve ta prochaine série</h2>
      <p>${search.source === 'manga'
        ? 'Tape un titre, ou laisse vide et choisis un genre pour découvrir des mangas populaires.'
        : 'Tape un titre, un auteur ou le code ISBN au dos du livre.'}</p></div>`;
    more.hidden = true;
    return;
  }

  head.innerHTML = (search.author ? `<p class="author-filter">Oeuvres de <b>${esc(search.author)}</b> <button class="link" id="author-clear">retirer</button></p>` : '') +
    `<h2>${search.total ? search.total.toLocaleString('fr-FR') : 'Aucun'} résultat${search.total > 1 ? 's' : ''}</h2>`;
  grid.innerHTML = search.results.length
    ? search.results.map(resultCard).join('')
    : `<div class="empty" style="grid-column:1/-1"><h2>Aucun résultat</h2><p>Essaie un autre titre ou enlève des filtres.</p></div>`;
  more.hidden = !search.hasMore;
  more.disabled = true;
  more.textContent = 'Chargement...';
}

function addFromResult(r, status, volumesOwned = '') {
  if (findExisting(r)) return toast('Déjà dans ta collection');
  items.unshift({
    id: uid(), source: r.source, sourceId: r.sourceId,
    title: r.title, altTitle: r.altTitle || '', authors: r.authors || [],
    cover: r.cover || '', year: r.year || null, type: r.type, genres: r.genres || [],
    status, reading: 'a-lire', volumesOwned, volumesTotal: r.volumesTotal || null,
    rating: 0, note: '', isbn: r.isbn || '', url: r.url || '', workKey: r.workKey || '', addedAt: Date.now(),
    coverAlt: r.coverAlt || '', pagesTotal: r.pages || null, editionYear: r.editionYear || null,
  });
  saveItems();
  toast(status === 'envie' ? `« ${r.title} » ajouté à ta liste d'envies` : `« ${r.title} » ajouté à ta collection`);
}

async function openResult(r, tome, banner, found) {
  curDetail = { obj: r };
  const inCol = findExisting(r);
  const vols = (r.source === 'anilist' || r.source === 'olserie') && !inCol
    ? { set: new Set(tome ? [tome] : []), total: () => r.volumesTotal, changed() {} } : null;
  openModal(`
    ${coverHtml(r)}
    <div class="modal-info">
      ${banner ? `<div class="banner ${banner.ok ? 'ok' : 'ko'}">${esc(banner.text)}
        ${banner.ok ? `<button class="btn primary small" id="r-add-tome">Ajouter le tome ${banner.tome}</button>` : ''}</div>` : ''}
      <h2>${esc(r.title)}</h2>
      ${r.altTitle ? `<p class="alt">${esc(r.altTitle)}</p>` : ''}
      ${authorsHtml(r)}
      <div class="meta">
        ${r.year ? `<span class="badge">${r.year}</span>` : ''}
        ${r.badges.map(b => `<span class="badge">${esc(b)}</span>`).join('')}
        ${r.volumesTotal ? `<span class="badge">${r.volumesTotal} tomes</span>` : ''}
        ${r.score ? `<span class="badge accent">${r.score.toFixed(1)}/10</span>` : ''}
        ${r.isbn ? `<span class="badge">ISBN ${esc(r.isbn)}</span>` : ''}
      </div>
      ${r.genres.length ? `<div class="meta">${r.genres.map(g => `<span>${esc(g)}</span>`).join(' · ')}</div>` : ''}
      ${descHtml()}
      ${vols ? volsHtml('Tomes que tu as (coche avant d\'ajouter)') : ''}
      <div class="section-title">Acheter ou chercher d'occasion</div>
      ${shopsHtml(r)}
      <div class="modal-actions">
        ${inCol
          ? `<button class="btn primary" id="r-edit">${ICONS.check}Modifier dans ma collection</button>`
          : `<button class="btn primary" id="r-add">${ICONS.plus}Je l'ai</button>
             <button class="btn ghost" id="r-wish">${ICONS.heart}Liste d'envies</button>`}
        <a class="btn ghost" href="${esc(r.url)}" target="_blank" rel="noopener">Voir sur ${r.source === 'anilist' ? 'AniList' : 'Open Library'} ${ICONS.out}</a>
      </div>
      <div id="sheet"></div>
    </div>`);

  $('#r-add')?.addEventListener('click', () => { addFromResult(r, 'possede', vols ? formatVolumes(vols.set) : ''); modal.close(); });
  $('#r-wish')?.addEventListener('click', () => { addFromResult(r, 'envie'); modal.close(); });
  $('#r-add-tome')?.addEventListener('click', () => { addScanned(found); modal.close(); toast(`Tome ${tome} ajouté`); });
  $('#r-edit')?.addEventListener('click', () => openEditor(inCol.id));
  fillDetails(r, vols);
}

/* ---------- Fiche complète, tomes et couvertures ---------- */
function descHtml() {
  return `<label class="lang-pick">Résumé en <select class="r-lang">${Object.entries(DESC_LANGS).map(([k, v]) =>
    `<option value="${k}" ${k === descLang ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <div class="desc" id="r-desc"><span class="muted">Chargement du résumé...</span></div>`;
}
function volsHtml(title) {
  return `<div class="section-title vols-head"><span>${title}</span>
    <span><button type="button" class="link" id="vols-all">Tout cocher</button> · <button type="button" class="link" id="vols-none">Aucun</button></span></div>
    <div class="vols" id="vols"></div>`;
}

async function fillDetails(r, vols) {
  $('.r-lang')?.addEventListener('change', e => {
    descLang = e.target.value;
    try { localStorage.setItem(LANG_KEY, descLang); } catch (err) {}
    showDesc(r);
  });
  if (vols) renderVols(r, vols);
  if (!['anilist', 'openlibrary', 'olserie'].includes(r.source)) return;
  const sheet = await loadSheet(r);
  if ($('#sheet')) $('#sheet').innerHTML = sheet;
  if (vols) vols.redraw?.();
  showDesc(r);
}

async function renderVols(r, vols) {
  const box = $('#vols');
  let covers = {};
  const draw = () => {
    if (!box.isConnected) return;
    const nums = Object.keys(covers).map(Number);
    const total = Math.min(300, Math.max(+vols.total() || 0, 0, ...nums, ...vols.set));
    if (!total) {
      box.innerHTML = '<span class="muted">Indique le nombre total de tomes pour pouvoir les cocher ici.</span>';
      return;
    }
    box.innerHTML = Array.from({ length: total }, (_, i) => i + 1).map(n =>
      `<button type="button" class="vol ${vols.set.has(n) ? 'on' : ''}" data-v="${n}" title="Tome ${n}">
        ${covers[n] ? `<img src="${esc(covers[n])}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}<span>${n}</span></button>`).join('');
  };
  box.onclick = e => {
    const b = e.target.closest('.vol');
    if (!b) return;
    const n = +b.dataset.v;
    if (vols.set.has(n)) vols.set.delete(n); else vols.set.add(n);
    b.classList.toggle('on');
    vols.changed();
  };
  $('#vols-all').onclick = () => {
    $$('.vol', box).forEach(b => vols.set.add(+b.dataset.v));
    draw(); vols.changed();
  };
  $('#vols-none').onclick = () => { vols.set.clear(); draw(); vols.changed(); };
  vols.redraw = draw;
  draw();
  if (r.source === 'anilist' || r.source === 'olserie') {
    covers = await volumeCovers(r);
    draw();
  }
}

// MangaDex : identifiant, résumés en plusieurs langues et couvertures de chaque tome
const mdCache = new Map();
function mangadexInfo(r) {
  if (r.source !== 'anilist') return Promise.resolve({});
  if (!mdCache.has(r.sourceId)) {
    mdCache.set(r.sourceId, (async () => {
      for (const t of [...new Set([r.altTitle, r.title].filter(Boolean))]) {
        const j = await (await fetch(`https://api.mangadex.org/manga?title=${enc(t)}&limit=10`)).json();
        const m = (j.data || []).find(x => String(x.attributes.links?.al) === r.sourceId);
        if (m) return { id: m.id, desc: m.attributes.description || {} };
      }
      return {};
    })().catch(() => ({})));
  }
  return mdCache.get(r.sourceId);
}
const coverCache = new Map();
async function volumeCovers(r) {
  if (r.source === 'olserie') return olSerieCovers(r);
  const md = await mangadexInfo(r);
  if (!md.id) return {};
  if (!coverCache.has(md.id)) {
    coverCache.set(md.id, (async () => {
      const all = [];
      for (let off = 0; off < 500; off += 100) {
        const j = await (await fetch(`https://api.mangadex.org/cover?manga[]=${md.id}&limit=100&offset=${off}`)).json();
        all.push(...(j.data || []));
        if (all.length >= (j.total || 0)) break;
      }
      // Couverture française en priorité, sinon japonaise, sinon anglaise
      const rank = l => { const i = ['fr', 'ja', 'en'].indexOf(l); return i < 0 ? 9 : i; };
      const best = {};
      for (const c of all) {
        const v = +c.attributes.volume;
        if (!Number.isInteger(v) || v < 1) continue;
        if (!best[v] || rank(c.attributes.locale) < rank(best[v].attributes.locale)) best[v] = c;
      }
      return Object.fromEntries(Object.entries(best).map(([v, c]) =>
        [v, `https://uploads.mangadex.org/covers/${md.id}/${c.attributes.fileName}.256.jpg`]));
    })().catch(() => ({})));
  }
  return coverCache.get(md.id);
}

const sheetCache = new Map();
async function loadSheet(r) {
  const key = r.source + r.sourceId;
  if (!sheetCache.has(key)) {
    const tmp = { ...r, description: '' };
    sheetCache.set(key, (r.source === 'anilist' ? aniSheet(tmp) : olSheet(tmp))
      .then(html => ({ html, desc: tmp.description, vols: tmp.volumesTotal }))
      .catch(() => ({ html: '' })));
  }
  const s = await sheetCache.get(key);
  if (!r.description) r.description = s.desc || '';
  if (!r.volumesTotal && s.vols) r.volumesTotal = s.vols;
  return s.html;
}
function rowsHtml(rows) {
  rows = rows.filter(x => x[1]);
  return rows.length
    ? `<div class="section-title">Fiche complète</div><dl class="sheet">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`
    : '';
}
function stripHtml(title, list) {
  return `<div class="section-title">${title}</div><div class="strip">${list.map(x =>
    `<figure${x.ed ? ` class="edition" title="Choisir cette édition" data-ed="${esc(JSON.stringify(x.ed))}"` : ''}>${x.img ? `<img src="${esc(x.img)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<div class="noimg"></div>'}
      <figcaption>${esc(x.cap)}</figcaption></figure>`).join('')}</div>`;
}

const ANI_SHEET = `query($id:Int){Media(id:$id){
  description(asHtml:false) synonyms chapters volumes status startDate{year} endDate{year} popularity
  tags{name rank isMediaSpoiler} staff(perPage:8,sort:RELEVANCE){edges{role node{name{full}}}}
  characters(perPage:12,sort:[ROLE,RELEVANCE]){nodes{name{full} image{medium}}} externalLinks{site url}
}}`;
async function aniSheet(r) {
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: ANI_SHEET, variables: { id: +r.sourceId } }),
  });
  const m = (await res.json()).data.Media;
  if (!r.description) r.description = plainText(m.description);
  if (!r.volumesTotal && m.volumes) r.volumesTotal = m.volumes;
  const end = m.endDate?.year || (m.status === 'RELEASING' ? 'en cours' : '');
  return rowsHtml([
    ['Auteurs', m.staff.edges.map(e => `${esc(e.node.name.full)} <span class="muted">(${esc(e.role)})</span>`).join('<br>')],
    ['Parution', m.startDate?.year ? `${m.startDate.year}${end ? ' - ' + end : ''}` : ''],
    ['Statut', ANI_STATUS[m.status]],
    ['Tomes', m.volumes],
    ['Chapitres', m.chapters],
    ['Autres titres', m.synonyms.slice(0, 6).map(esc).join('<br>')],
    ['Thèmes', m.tags.filter(t => !t.isMediaSpoiler && t.rank >= 60).slice(0, 10).map(t => esc(t.name)).join(', ')],
    ['Popularité', m.popularity ? m.popularity.toLocaleString('fr-FR') + ' lecteurs sur AniList' : ''],
    ['Liens', m.externalLinks.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.site)}</a>`).join(', ')],
  ]) + (m.characters.nodes.length
    ? stripHtml('Personnages', m.characters.nodes.map(c => ({ img: c.image?.medium, cap: c.name.full })))
    : '');
}
async function olSheet(r) {
  const [w, ed] = await Promise.all([
    fetch(`https://openlibrary.org${r.workKey || r.sourceId}.json`).then(x => x.json()),
    fetch(`https://openlibrary.org${r.workKey || r.sourceId}/editions.json?limit=40`).then(x => x.json()).catch(() => ({})),
  ]);
  if (!r.description) {
    const d = typeof w.description === 'string' ? w.description : w.description?.value;
    r.description = (d || '').replace(/\r/g, '').trim();
  }
  const eds = ed.entries || [];
  return rowsHtml([
    ['Première parution', esc(w.first_publish_date || r.year || '')],
    ['Sujets', (w.subjects || []).slice(0, 12).map(esc).join(', ')],
    ['Lieux', (w.subject_places || []).slice(0, 6).map(esc).join(', ')],
    ['Époques', (w.subject_times || []).slice(0, 6).map(esc).join(', ')],
    ['Éditions', ed.size ? `${ed.size} édition${ed.size > 1 ? 's' : ''} connue${ed.size > 1 ? 's' : ''}` : ''],
  ]) + (eds.length
    ? stripHtml('Toutes les éditions', eds.map(e => ({
      img: e.covers?.[0] > 0 ? `https://covers.openlibrary.org/b/id/${e.covers[0]}-M.jpg` : '',
      cap: [e.publish_date, (e.publishers || [])[0]].filter(Boolean).join(' · ') || e.title,
      ed: {
        cover: e.covers?.[0] > 0 ? `https://covers.openlibrary.org/b/id/${e.covers[0]}-L.jpg` : '',
        isbn: (e.isbn_13 || e.isbn_10 || [])[0] || '',
        year: +(String(e.publish_date || '').match(/\d{4}/) || [])[0] || null,
        pages: e.number_of_pages || null,
        label: [e.publish_date, (e.publishers || [])[0]].filter(Boolean).join(' · ') || e.title,
      },
    })))
    : '');
}

/* ---------- Traduction des résumés ---------- */
const LANG_KEY = 'bulles.lang';
const DESC_LANGS = { fr: 'Français', en: 'English', es: 'Español', zh: '中文', ar: 'العربية', hi: 'हिन्दी' };
let descLang = 'fr';
try { descLang = localStorage.getItem(LANG_KEY) || 'fr'; } catch (e) {}
const translations = new Map();

// Résumés écrits par des humains sur MangaDex (relié à AniList par son identifiant)
const MD_LANGS = { fr: ['fr'], en: ['en'], es: ['es', 'es-la'], zh: ['zh', 'zh-hk'], ar: ['ar'], hi: ['hi'] };
function cleanMarkdown(s) {
  return s.split(/\n-{3,}|\n_{3,}/)[0]
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*_]{2}/g, '').replace(/\r/g, '').trim();
}

async function translate(text, tl) {
  // "the Black Swordsman" : Google le prend pour un nom propre et ne le traduit pas.
  // En minuscules, il le traduit comme un surnom.
  text = text.replace(/\b([Tt]he) ((?:[A-Z][a-z]+ )+[A-Z][a-z]+)\b/g, (m, a, p) => `${a} ${p.toLowerCase()}`);
  // 1) Google Traduction (gratuit, sans clé)
  try {
    const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&q=${enc(text)}`);
    if (res.ok) return (await res.json())[0].map(s => s[0]).join('');
  } catch (e) {}
  // 2) Secours : MyMemory, limité à 500 caractères par requête
  const chunks = text.match(/[^]{1,450}(?:[.!?\n]\s*|$)|[^]{1,450}/g) || [];
  const out = [];
  for (const c of chunks) {
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${enc(c)}&langpair=en|${tl === 'zh' ? 'zh-CN' : tl}`);
    const j = await res.json();
    if (j.responseStatus !== 200) throw new Error();
    out.push(j.responseData.translatedText);
  }
  return out.join(' ');
}

async function showDesc(r) {
  const box = $('#r-desc');
  if (!box) return;
  box.dir = descLang === 'ar' ? 'rtl' : 'auto';
  if (!r.description) { box.innerHTML = '<span class="muted">Pas de résumé disponible.</span>'; return; }
  const lang = descLang;
  const key = lang + '|' + r.source + r.sourceId;
  if (!translations.has(key)) {
    box.innerHTML = '<span class="muted">Traduction...</span>';
    try {
      let human = '';
      if (r.source === 'anilist') {
        const d = (await mangadexInfo(r)).desc || {};
        human = MD_LANGS[lang].map(l => d[l]).find(Boolean) || '';
      }
      translations.set(key, human ? cleanMarkdown(human)
        : lang === 'en' && r.source === 'anilist' ? r.description
        : await translate(r.description, lang));
    } catch (e) {
      box.innerHTML = esc(r.description) + '<br><span class="muted">(traduction indisponible pour le moment)</span>';
      return;
    }
  }
  if ($('#r-desc') === box && descLang === lang) box.textContent = translations.get(key);
}

$('#results').addEventListener('click', e => {
  const card = e.target.closest('.card[data-i]');
  if (!card) return;
  const r = search.results[+card.dataset.i];
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (action === 'link') return;
  if (action === 'add') return addFromResult(r, 'possede');
  if (action === 'wish') return addFromResult(r, 'envie');
  if (action === 'edit') return openEditor(findExisting(r).id);
  openResult(r);
});
$('#results').addEventListener('keydown', e => {
  const card = e.target.closest('.card[data-i]');
  if (card && e.target === card && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    openResult(search.results[+card.dataset.i]);
  }
});

/* ---------- Scanner un code-barres (ISBN) ---------- */
function loadScript(src) {
  return new Promise((ok, ko) => {
    const el = document.createElement('script');
    el.src = src; el.onload = ok; el.onerror = ko;
    document.head.appendChild(el);
  });
}
async function scanBarcode() {
  if (!navigator.mediaDevices?.getUserMedia) return toast("La caméra n'est pas disponible ici");
  openModal(`<div class="modal-info scan">
    <h2>Scanner un code-barres</h2>
    <p class="muted">Vise le code-barres au dos du livre, de la BD ou du manga, bien à plat et éclairé.</p>
    <video id="scan-video" playsinline muted autoplay></video>
    <p class="muted" id="scan-etat">Ouverture de la caméra...</p>
    <button type="button" class="btn ghost" id="scan-photo">Pas de code-barres ? Photographier la couverture</button>
    <label class="check rafale"><input type="checkbox" id="scan-rafale" ${settings.scanRafale ? 'checked' : ''}>
      Ajout en rafale : chaque livre scanné va directement dans ma collection</label>
    <ul class="scan-liste" id="scan-liste"></ul>
    <form class="scan-manuel" id="scan-manuel">
      <input type="text" inputmode="numeric" id="scan-isbn" placeholder="ou tape l'ISBN (13 chiffres)">
      <button class="btn primary" type="submit">Chercher</button>
    </form></div>`);
  let fini = false, reader = null, stream = null;
  const etat = t => { const e = $('#scan-etat'); if (e) e.textContent = t; };
  const done = code => {
    if (fini) return;
    fini = true;
    try { reader?.reset(); } catch (e) {}
    stream?.getTracks().forEach(t => t.stop());
    if (code) { modal.close(); searchIsbn(code); }
  };
  modal.addEventListener('close', () => done(null), { once: true });
  $('#scan-manuel').addEventListener('submit', e => {
    e.preventDefault();
    const v = $('#scan-isbn').value.replace(/[^\dXx]/g, '');
    if (v.length >= 10) { ok(v); $('#scan-isbn').value = ''; } else toast('Un ISBN fait 10 ou 13 chiffres');
  });
  // BD sans code-barres : on lit le titre sur la couverture
  $('#scan-photo').addEventListener('click', async () => {
    const video = $('#scan-video');
    if (!video?.videoWidth) return toast('La caméra n\'est pas encore prête');
    const c = document.createElement('canvas');
    c.width = video.videoWidth; c.height = video.videoHeight;
    c.getContext('2d').drawImage(video, 0, 0);
    etat('Lecture du titre sur la couverture...');
    const q = await lireCouverture(c).catch(() => '');
    if (!q) return etat('Je n\'arrive pas à lire le titre : rapproche-toi, bien éclairé, ou tape-le.');
    done(null);
    modal.close();
    showView('search');
    search.author = '';
    $('#s-q').value = q;
    updateAmazonLink();
    runSearch(true);
  });
  $('#scan-rafale').addEventListener('change', e => { settings.scanRafale = e.target.checked; saveSettings(); });
  // Rafale : on ajoute chaque livre et on continue à scanner
  const vus = new Set();
  const rafale = async code => {
    if (vus.has(code)) return;
    vus.add(code);
    navigator.vibrate?.(60);
    const li = document.createElement('li');
    li.textContent = code + ' : recherche...';
    $('#scan-liste')?.prepend(li);
    const f = await lookupIsbn(code).catch(() => null);
    if (!f) { li.textContent = code + ' : introuvable'; li.className = 'ko'; return; }
    li.textContent = addScanned(f) + ' : ajouté';
  };
  const ok = code => {
    if (!/^\d{8,13}$|^\d{9}[\dXx]$/.test(code)) return;
    if ($('#scan-rafale')?.checked) rafale(code); else done(code);
  };

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
    });
  } catch (e) {
    etat("Accès à la caméra refusé : autorise-le dans les réglages, ou tape l'ISBN.");
    return;
  }
  if (fini) return done(null);
  const video = $('#scan-video');
  video.srcObject = stream;
  try { await video.play(); } catch (e) {}
  // Mise au point automatique en continu, si la caméra le permet
  try { await stream.getVideoTracks()[0].applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch (e) {}
  etat('Recherche du code-barres...');


  // 1) Lecteur intégré du navigateur, seulement s'il sait lire les codes de livres
  try {
    if ('BarcodeDetector' in window && (await BarcodeDetector.getSupportedFormats()).includes('ean_13')) {
      const det = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a'] });
      const loop = async () => {
        if (fini) return;
        try { const r = await det.detect(video); if (r[0]) ok(r[0].rawValue); } catch (e) {}
        setTimeout(loop, 150);
      };
      loop();
    }
  } catch (e) {}

  // 2) Toujours en parallèle : la bibliothèque ZXing (marche partout)
  try {
    await chargerZXing();
  } catch (e) {
    etat("Lecteur de code-barres indisponible (pas d'internet ?) : tape l'ISBN.");
    return;
  }
  if (fini) return;
  const hints = new Map();
  hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8, ZXing.BarcodeFormat.UPC_A]);
  hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
  reader = new ZXing.BrowserMultiFormatReader(hints, 200);
  reader.decodeFromVideoElementContinuously(video, res => { if (res) ok(res.getText()); });
}
// Trouve le livre d'un ISBN ; si c'est un tome d'une série, renvoie la série et le numéro du tome
const MANGA_HINT = /manga|\bkana\b|\bpika\b|kurokawa|ki-oon|kaz[ée]|tonkam|\bviz\b|kodansha|shueisha|shogakukan|yen press|seven seas|tokyopop/i;
function guessType(d) {
  if (!isComic(d)) return 'livre';
  if ([...(d.publisher || []), ...(d.subject || [])].some(x => MANGA_HINT.test(x)) || /[぀-ヿ]/.test(d.title)) return 'manga';
  // Comics = éditeurs américains (ou leurs éditions françaises)
  return (d.publisher || []).some(x => /marvel|dc comics|image comics|dark horse|\bidw\b|boom|urban comics|panini comics/i.test(x)) ? 'comics' : 'bd';
}
async function lookupIsbn(code) {
  const p = new URLSearchParams({
    q: 'isbn:' + code, limit: 1,
    fields: 'key,title,author_name,first_publish_year,cover_i,isbn,language,number_of_pages_median,publisher,subject',
  });
  let d = ((await (await fetch('https://openlibrary.org/search.json?' + p)).json()).docs || [])[0];
  if (!d) {
    // Sinon la fiche de l'édition elle-même
    try {
      const e = await (await fetch(`https://openlibrary.org/isbn/${code}.json`)).json();
      d = {
        key: e.works?.[0]?.key, title: e.title, cover_i: e.covers?.[0], publisher: e.publishers,
        first_publish_year: +(String(e.publish_date || '').match(/\d{4}/) || [])[0] || null,
      };
    } catch (err) {}
  }
  if (!d?.key) {
    // Toujours rien : la BnF
    const b = (await bnfRecords(`bib.isbn all "${code}"`, 1).catch(() => []))[0];
    if (!b) return null;
    return { r: b.serieName ? groupSeries([b])[0] : b, tome: b.tome };
  }
  const r = mapOlDoc(d, guessType(d));
  if (!r.cover) { r.cover = coverForIsbn(code); r.coverAlt = amazonCover(code); }
  r.isbn = code;
  return { r: r.serieName ? groupSeries([r])[0] : r, tome: r.tome };
}
// Ajoute (ou complète) la collection avec un livre scanné ; renvoie son nom
function addScanned({ r, tome }) {
  const it = findExisting(r);
  if (it) {
    if (tome) it.volumesOwned = formatVolumes(parseVolumes(it.volumesOwned).add(tome));
    it.status = 'possede';
    saveItems();
  } else {
    addFromResult(r, 'possede', tome ? String(tome) : '');
  }
  return r.title + (tome ? ' tome ' + tome : '');
}
async function searchIsbn(code) {
  showView('search');
  search.author = '';
  toast('Recherche du livre...');
  const f = await lookupIsbn(code).catch(() => null);
  if (f) {
    // Anti-doublon : on dit tout de suite si on l'a déjà
    const it = findExisting(f.r);
    let banner = null;
    if (it) {
      const owned = parseVolumes(it.volumesOwned);
      banner = !f.tome || owned.has(f.tome)
        ? { ok: false, text: `Tu l'as déjà${f.tome ? ` (tome ${f.tome})` : ''} !` }
        : { ok: true, tome: f.tome, text: `Tu as ${it.title}${owned.size ? ` (tomes ${it.volumesOwned})` : ''} mais pas le tome ${f.tome}.` };
      navigator.vibrate?.(banner.ok ? 60 : [80, 60, 80]);
    }
    return openResult(f.r, f.tome, banner, f);
  }
  // Pas trouvé : recherche classique avec le code
  toast('Livre introuvable pour ce code, recherche élargie');
  $('#s-q').value = code;
  if (search.source === 'manga') $('.source[data-source="bd"]').click();
  else runSearch(true);
  updateAmazonLink();
}
$('#btn-scan').addEventListener('click', scanBarcode);

$('#search-form').addEventListener('submit', e => { e.preventDefault(); clearTimeout(frappe); search.author = ''; runSearch(true); });
// Recherche instantanée pendant qu'on tape
let frappe;
$('#s-q').addEventListener('input', () => {
  clearTimeout(frappe);
  frappe = setTimeout(() => {
    const q = $('#s-q').value.trim();
    search.author = '';
    if (q.length >= 2 || (!q && search.source === 'manga')) runSearch(true);
  }, 350);
});

/* ---------- Toutes les oeuvres d'un auteur ---------- */
function authorsHtml(r) {
  return `<p class="authors">${(r.authors || []).map(a =>
    `<button type="button" class="link author-link" data-author="${esc(a)}" data-src="${r.source}" data-type="${r.type}" title="Voir tout ce qu'a fait cet auteur">${esc(a)}</button>`).join(', ')}</p>`;
}
document.addEventListener('click', e => {
  if (e.target.id === 'author-clear') { search.author = ''; Object.assign(search, { results: [], searched: false }); renderResults(); return; }
  const b = e.target.closest('.author-link');
  if (!b) return;
  modal.close();
  const src = b.dataset.src === 'anilist' ? 'manga' : search.source !== 'manga' ? search.source : b.dataset.type === 'livre' ? 'livres' : 'bd';
  $('#s-q').value = '';
  search.author = b.dataset.author;
  showView('search');

  search.author = b.dataset.author;
  runSearch(true);
});


// Changer un filtre relance la recherche si on en a déjà fait une
$$('#filters-manga select, #filters-bd select').forEach(s =>
  s.addEventListener('change', () => { if (search.searched || search.source === 'manga') runSearch(true); }));
$$('#filters-bd input').forEach(s =>
  s.addEventListener('change', () => { if (search.searched) runSearch(true); }));

// Choix de la source
$$('.source').forEach(b => b.addEventListener('click', () => {
  if (search.source === b.dataset.source) return;
  search.source = b.dataset.source;
  $$('.source').forEach(x => {
    x.classList.toggle('active', x === b);
    x.setAttribute('aria-checked', x === b);
  });
  const manga = search.source === 'manga';
  $('#filters-manga').hidden = !manga;
  $('#filters-bd').hidden = manga;
  $('#f-bd-cat').closest('label').hidden = search.source === 'livres';
  $('#s-q').placeholder = manga ? 'One Piece, Naruto, Frieren...'
    : search.source === 'livres' ? 'Le Petit Prince, Victor Hugo, ISBN...' : 'Astérix, Blacksad, Batman, ISBN...';
  $('#source-note').textContent = manga ? "Fiches issues d'AniList." : "Fiches issues d'Open Library.";
  searchId++; // ignore une recherche encore en cours sur l'autre source
  Object.assign(search, { results: [], searched: false, error: '', total: 0, loading: false });
  updateAmazonLink();
  if ($('#s-q').value.trim()) runSearch(true); else renderResults();
  $('#s-q').focus();
}));

function updateAmazonLink() {
  const q = $('#s-q').value.trim();
  const extra = search.source === 'manga' ? 'manga' : search.source === 'livres' ? 'livre' : ($('#f-bd-cat').selectedOptions[0]?.text || '');
  const terms = [q, q && extra !== 'Tout' ? extra : ''].filter(Boolean).join(' ');
  $('#amazon-direct').href = terms ? SHOPS[0].url(terms) : 'https://www.amazon.fr/';
}
$('#s-q').addEventListener('input', updateAmazonLink);
$('#f-bd-cat').addEventListener('change', updateAmazonLink);

/* =========================================================
   Sauvegarde Google Drive (dossier caché de l'appli)
   ========================================================= */
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
let gToken = null, gTokenExp = 0;
function googleToken(interactive) {
  if (gToken && Date.now() < gTokenExp) return Promise.resolve(gToken);
  const garder = (t, sec) => { gToken = t; gTokenExp = Date.now() + (sec - 60) * 1000; return t; };
  if (window.BullesAndroid?.googleToken) {
    // Appli Android : connexion avec le compte Google du téléphone
    return new Promise((ok, ko) => {
      window.__gcb = (t, err) => t ? ok(garder(t, 3600)) : ko(new Error(err ? 'Connexion Google impossible : ' + err : 'Connexion Google refusée'));
      BullesAndroid.googleToken(!!interactive);
    });
  }
  if (!interactive) return Promise.reject(new Error('non connecté'));
  if (!settings.googleClientId) return Promise.reject(new Error("Ajoute d'abord l'identifiant client Google ci-dessus"));
  return (window.google?.accounts ? Promise.resolve() : loadScript('https://accounts.google.com/gsi/client')).then(() => new Promise((ok, ko) => {
    google.accounts.oauth2.initTokenClient({
      client_id: settings.googleClientId, scope: DRIVE_SCOPE,
      callback: r => r.access_token ? ok(garder(r.access_token, r.expires_in)) : ko(new Error('Connexion Google refusée')),
      error_callback: () => ko(new Error('Connexion Google annulée')),
    }).requestAccessToken();
  }));
}
async function drive(path, opts = {}) {
  const t = await googleToken(opts.interactive);
  const r = await fetch('https://www.googleapis.com/' + path, { ...opts, headers: { Authorization: 'Bearer ' + t, ...(opts.headers || {}) } });
  if (r.status === 401) { gToken = null; throw new Error('Session Google expirée, réessaie'); }
  if (!r.ok) throw new Error('Google Drive a répondu ' + r.status);
  return r;
}
async function driveFileId(interactive) {
  const q = enc("name='pagivore.json'");
  const j = await (await drive(`drive/v3/files?spaces=appDataFolder&fields=files(id)&q=${q}`, { interactive })).json();
  return j.files?.[0]?.id || null;
}
async function cloudSave(interactive) {
  const id = await driveFileId(interactive);
  const body = JSON.stringify({ app: 'pagivore', savedAt: Date.now(), items });
  if (id) {
    await drive(`upload/drive/v3/files/${id}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
  } else {
    const fd = new FormData();
    fd.append('metadata', new Blob([JSON.stringify({ name: 'pagivore.json', parents: ['appDataFolder'] })], { type: 'application/json' }));
    fd.append('file', new Blob([body], { type: 'application/json' }));
    await drive('upload/drive/v3/files?uploadType=multipart', { method: 'POST', body: fd });
  }
  settings.cloudAt = Date.now();
  saveSettings();
}
/** Fusionne la sauvegarde Google avec la collection ; renvoie le nombre de titres ajoutés (null = pas de sauvegarde) */
async function cloudLoad(interactive) {
  const id = await driveFileId(interactive);
  if (!id) return null;
  const data = await (await drive(`drive/v3/files/${id}?alt=media`)).json();
  let added = 0;
  for (const it of data.items || []) {
    const i = items.findIndex(x => x.id === it.id);
    if (i < 0) { items.push(it); added++; }
    else if ((it.updatedAt || it.addedAt || 0) > (items[i].updatedAt || items[i].addedAt || 0)) items[i] = it;
  }
  saveItems();
  return added;
}
let cloudTimer;
function scheduleCloud() {
  if (!settings.cloud) return;
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(() => cloudSave(false).catch(() => {}), 4000);
}

/* ---------- Widget Android : livre en cours ---------- */
function syncWidget() {
  if (!window.BullesAndroid?.widget) return;
  const it = items.find(x => x.chronoStart) ||
    items.filter(x => x.reading === 'en-cours').sort((a, b) => (b.updatedAt || b.addedAt || 0) - (a.updatedAt || a.addedAt || 0))[0];
  BullesAndroid.widget(JSON.stringify(it
    ? { id: it.id, title: it.title, page: it.page || 0, total: it.pagesTotal || 0, chrono: it.chronoStart || 0 }
    : {}));
}
// Bouton du widget : ouvre le livre et lance (ou arrête) le chrono
window.widgetChrono = id => {
  if (!items.some(x => x.id === id)) return;
  showView('collection');
  openEditor(id);
  setTimeout(() => $('#chrono-btn')?.click(), 300);
};

/* =========================================================
   Mon suivi : statistiques, tomes manquants, nouveautés, recommandations
   ========================================================= */
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
let nouveautes = null, recos = null;

function manquants() {
  return items.filter(it => it.status === 'possede' && +it.volumesTotal > 1).map(it => {
    const owned = parseVolumes(it.volumesOwned);
    const miss = new Set();
    for (let i = 1; i <= Math.min(+it.volumesTotal, 300); i++) if (!owned.has(i)) miss.add(i);
    return { it, miss };
  }).filter(x => x.miss.size);
}
function barres(rows, unite) {
  const max = Math.max(1, ...rows.map(r => r[1]));
  return `<div class="barres">${rows.map(([k, v]) => `<div class="barre-ligne"><span>${esc(k)}</span>
    <div class="barre"><i style="width:${v / max * 100}%"></i></div><b>${v}${unite}</b></div>`).join('')}</div>`;
}
function renderSuivi() {
  const sessions = items.flatMap(it => (it.sessions || []).map(s => ({ ...s, it })));
  const totalMs = items.reduce((n, it) => n + (it.readMs || 0), 0);
  const pages = items.reduce((n, it) => n + (it.reading === 'lu' ? (+it.pagesTotal || +it.page || 0) : (+it.page || 0)), 0);
  const lus = items.filter(it => it.reading === 'lu');
  // 6 derniers mois : minutes de lecture
  const now = new Date();
  const mois = Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 5 + i, 1));
  const parMois = mois.map(d => [MOIS[d.getMonth()], Math.round(sessions
    .filter(s => { const x = new Date(s.debut); return x.getMonth() === d.getMonth() && x.getFullYear() === d.getFullYear(); })
    .reduce((n, s) => n + s.ms, 0) / 60000)]);
  const types = Object.entries(TYPES).map(([k, v]) => [v, items.filter(it => it.type === k).length]).filter(x => x[1]);
  const genres = {};
  items.forEach(it => (it.genres || []).forEach(g => { genres[g] = (genres[g] || 0) + 1; }));
  const topGenres = Object.entries(genres).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const rapide = lus.filter(it => it.readMs > 0).sort((a, b) => a.readMs - b.readMs)[0];
  const miss = manquants();

  $('#suivi').innerHTML = `
    <div class="stats">
      <div class="stat accent"><b>${lus.length}</b><span>lu${lus.length > 1 ? 's' : ''}</span></div>
      <div class="stat"><b>${pages.toLocaleString('fr-FR')}</b><span>pages lues</span></div>
      <div class="stat"><b>${totalMs ? duree(totalMs) : '0 min'}</b><span>de lecture</span></div>
      <div class="stat"><b>${sessions.length}</b><span>séance${sessions.length > 1 ? 's' : ''}</span></div>
    </div>

    <div class="suivi-grille">
      <section class="panneau"><h2>Temps de lecture</h2>${barres(parMois, ' min')}
        ${rapide ? `<p class="muted">Lu le plus vite : <b>${esc(rapide.title)}</b> en ${duree(rapide.readMs)}</p>` : '<p class="muted">Lance le chrono dans « Ma lecture » d\'un livre pour remplir ce graphique.</p>'}</section>
      <section class="panneau"><h2>Ma collection</h2>${types.length ? barres(types, '') : '<p class="muted">Rien pour le moment.</p>'}
        ${topGenres.length ? `<h3>Genres préférés</h3>${barres(topGenres, '')}` : ''}</section>
    </div>

    <section class="panneau"><div class="panneau-tete"><h2>Il me manque</h2>
      ${miss.length ? '<button class="btn ghost small" id="miss-copy">Copier la liste</button>' : ''}</div>
      ${miss.length ? `<ul class="liste-manque">${miss.map(({ it, miss: m }) =>
        `<li data-id="${esc(it.id)}"><b>${esc(it.title)}</b><span>tome${m.size > 1 ? 's' : ''} ${formatVolumes(m)}</span></li>`).join('')}</ul>`
        : '<p class="muted">Aucun tome manquant (indique le nombre total de tomes de tes séries pour le savoir).</p>'}</section>

    <section class="panneau"><div class="panneau-tete"><h2>Nouveautés de mes séries</h2>
      <button class="btn ghost small" id="nouv-btn">Vérifier</button></div>
      <div id="nouv">${nouveautes ?? '<p class="muted">Cherche les tomes sortis après ceux que tu as (catalogue de la BnF).</p>'}</div></section>

    <section class="panneau"><div class="panneau-tete"><h2>À découvrir</h2>
      <button class="btn ghost small" id="reco-btn">Me recommander</button></div>
      <div id="reco">${recos ? recosHtml() : '<p class="muted">Des mangas proches de ceux que tu as et que tu as bien notés.</p>'}</div></section>`;

  $('#miss-copy')?.addEventListener('click', () => {
    const txt = miss.map(({ it, miss: m }) => `${it.title} : tome${m.size > 1 ? 's' : ''} ${formatVolumes(m)}`).join('\n');
    if (navigator.share) navigator.share({ title: 'Il me manque', text: txt }).catch(() => {});
    else navigator.clipboard?.writeText(txt).then(() => toast('Liste copiée'));
  });
  $$('.liste-manque li').forEach(li => li.addEventListener('click', () => openEditor(li.dataset.id)));
  $('#nouv-btn').addEventListener('click', chercherNouveautes);
  $('#reco-btn').addEventListener('click', chercherRecos);
  $$('#reco .card').forEach(c => c.addEventListener('click', () => openResult(recos[+c.dataset.r])));
}

async function chercherNouveautes() {
  const series = items.filter(it => it.status === 'possede' && (it.source === 'anilist' || it.source === 'olserie' || +it.volumesTotal > 1));
  if (!series.length) { $('#nouv').innerHTML = '<p class="muted">Ajoute d\'abord des séries à ta collection.</p>'; return; }
  const lignes = [];
  for (const [i, it] of series.entries()) {
    $('#nouv').innerHTML = `<p class="muted">Vérification ${i + 1} / ${series.length} : ${esc(it.title)}...</p>`;
    const noms = [...new Set([it.title, it.altTitle].filter(Boolean))];
    const owned = parseVolumes(it.volumesOwned);
    const maxOwned = Math.max(0, ...owned);
    const trouves = new Map();
    for (const nom of noms) {
      const recs = await bnfRecords(`bib.title all "${nom}"`, 50).catch(() => []);
      for (const r of recs) if (r.tome && norm(r.serieName) === norm(nom) && !trouves.has(r.tome)) trouves.set(r.tome, r);
    }
    const neufs = [...trouves.keys()].filter(n => n > maxOwned).sort((a, b) => a - b);
    if (neufs.length) {
      const dernier = trouves.get(neufs[neufs.length - 1]);
      lignes.push(`<li data-id="${esc(it.id)}"><b>${esc(it.title)}</b>
        <span>tome${neufs.length > 1 ? 's' : ''} ${formatVolumes(new Set(neufs))} sorti${neufs.length > 1 ? 's' : ''}${dernier.year ? ` (${dernier.year})` : ''}</span>
        <a href="${esc(SHOPS[0].url(`${it.title} tome ${neufs[0]}`))}" target="_blank" rel="noopener">Amazon</a></li>`);
    }
  }
  nouveautes = lignes.length
    ? `<ul class="liste-manque">${lignes.join('')}</ul><p class="muted">Les tomes à paraître ne sont pas encore au catalogue : pense aux précommandes Amazon.</p>`
    : '<p class="muted">Pas de nouveau tome trouvé pour tes séries.</p>';
  $('#nouv').innerHTML = nouveautes;
  $$('#nouv li').forEach(li => li.addEventListener('click', e => { if (e.target.tagName !== 'A') openEditor(li.dataset.id); }));
}

async function chercherRecos() {
  const mangas = items.filter(it => it.source === 'anilist').sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 10);
  if (!mangas.length) { $('#reco').innerHTML = '<p class="muted">Ajoute des mangas (et note-les) pour avoir des recommandations.</p>'; return; }
  $('#reco').innerHTML = '<p class="muted">Recherche...</p>';
  try {
    const query = `query($ids:[Int]){Page(perPage:10){media(id_in:$ids){id recommendations(sort:RATING_DESC,perPage:8){nodes{rating mediaRecommendation{${ANI_FIELDS}}}}}}}`;
    const res = await fetch('https://graphql.anilist.co', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables: { ids: mangas.map(it => +it.sourceId) } }),
    });
    const owned = new Set(items.filter(it => it.source === 'anilist').map(it => it.sourceId));
    const score = new Map();
    for (const m of (await res.json()).data.Page.media) {
      const poids = (mangas.find(it => it.sourceId === String(m.id))?.rating || 3);
      for (const n of m.recommendations.nodes) {
        const r = n.mediaRecommendation;
        if (!r || owned.has(String(r.id)) || r.format === 'NOVEL') continue;
        const s = score.get(r.id) || { m: r, s: 0 };
        s.s += poids * Math.max(1, n.rating);
        score.set(r.id, s);
      }
    }
    recos = [...score.values()].sort((a, b) => b.s - a.s).slice(0, 12).map(x => mapAni(x.m));
    $('#reco').innerHTML = recos.length ? recosHtml() : '<p class="muted">Pas de recommandation trouvée.</p>';
    $$('#reco .card').forEach(c => c.addEventListener('click', () => openResult(recos[+c.dataset.r])));
  } catch (e) {
    $('#reco').innerHTML = '<p class="muted">AniList ne répond pas, réessaie dans un instant.</p>';
  }
}
function recosHtml() {
  return `<div class="grid">${recos.map((r, i) => `<article class="card" data-r="${i}">${coverHtml(r)}
    <div class="card-body"><h3>${esc(r.title)}</h3><p class="authors">${esc(r.authors.slice(0, 2).join(', '))}</p>
    <div class="meta">${r.score ? `<span class="badge accent">${r.score.toFixed(1)}/10</span>` : ''}</div></div></article>`).join('')}</div>`;
}

/* ---------- Lecture du titre sur une couverture (Tesseract) ---------- */
let ocrWorker = null;
async function lireCouverture(canvas) {
  if (!window.Tesseract) await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js');
  ocrWorker ||= await Tesseract.createWorker('fra');
  const { data } = await ocrWorker.recognize(canvas, {}, { blocks: true, text: true });
  // Le titre = les lignes écrites le plus gros
  const lignes = (data.blocks || []).flatMap(b => b.paragraphs || []).flatMap(p => p.lines || [])
    .map(l => ({ t: l.text.replace(/[^\p{L}\p{N}' -]/gu, ' ').replace(/\s+/g, ' ').trim(), h: l.bbox.y1 - l.bbox.y0 }))
    .filter(l => (l.t.match(/\p{L}/gu) || []).length >= 3);
  if (lignes.length) return lignes.sort((a, b) => b.h - a.h).slice(0, 2).map(l => l.t).join(' ').slice(0, 60);
  return (data.text || '').split('\n').map(s => s.trim()).filter(s => s.length > 2).slice(0, 2).join(' ').slice(0, 60);
}

/* ---------- Tout instantané : cache des réponses et préchargement ---------- */
// Les réponses des sites (AniList, Open Library, BnF, MangaDex, traduction) sont gardées dans le téléphone :
// une recherche ou une fiche déjà vue s'affiche tout de suite, puis se met à jour en douce.
const API_HOSTS = /graphql\.anilist\.co|openlibrary\.org\/(search|works|isbn|books)|catalogue\.bnf\.fr|api\.mangadex\.org|translate\.googleapis\.com|api\.mymemory/;
const fetchReseau = window.fetch.bind(window);
const memo = new Map();
let idbP = null;
function idb() {
  return idbP ||= new Promise((ok, ko) => {
    const r = indexedDB.open('pagivore-cache', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('r');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}
async function idbGet(k) {
  try {
    const db = await idb();
    return await new Promise(ok => { const q = db.transaction('r').objectStore('r').get(k); q.onsuccess = () => ok(q.result); q.onerror = () => ok(null); });
  } catch (e) { return null; }
}
async function idbSet(k, v) {
  try { (await idb()).transaction('r', 'readwrite').objectStore('r').put(v, k); } catch (e) {}
}
window.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (!API_HOSTS.test(u)) return fetchReseau(url, opts);
  const key = u + '|' + (typeof opts.body === 'string' ? opts.body : '');
  const reseau = () => fetchReseau(url, opts).then(async r => {
    if (r.ok) {
      const v = { t: await r.clone().text(), at: Date.now(), type: r.headers.get('content-type') || 'application/json' };
      memo.set(key, v);
      idbSet(key, v);
    }
    return r;
  });
  const c = memo.get(key) || await idbGet(key);
  if (!c) return reseau();
  memo.set(key, c);
  if (Date.now() - c.at > 86400000) reseau().catch(() => {}); // plus d'un jour : mise à jour en arrière-plan
  return new Response(c.t, { status: 200, headers: { 'Content-Type': c.type } });
};

// Précharge la fiche, le résumé traduit et les couvertures des tomes des premiers résultats
function prefetch(r) {
  if (!r || r._pf || !['anilist', 'openlibrary', 'olserie'].includes(r.source)) return;
  r._pf = true;
  loadSheet(r).then(() => {
    if (r.source === 'anilist') mangadexInfo(r);
    if (r.description && descLang !== 'en') translate(r.description, descLang).catch(() => {});
  });
  if (r.source === 'anilist' || r.source === 'olserie') volumeCovers(r);
}
// Au premier contact du doigt sur une carte, on commence déjà à charger
$('#results').addEventListener('pointerdown', e => {
  const card = e.target.closest('.card[data-i]');
  if (card) prefetch(search.results[+card.dataset.i]);
}, { passive: true });

// Lecteur de code-barres : copie locale (instantané), sinon internet
function chargerZXing() {
  if (window.ZXing) return Promise.resolve();
  return loadScript('vendor/zxing.min.js').catch(() => loadScript('https://unpkg.com/@zxing/library@0.23.0/umd/index.min.js'));
}
(window.requestIdleCallback || setTimeout)(() => chargerZXing().catch(() => {}), 1500);

/* ---------- Choisir une édition dans « Toutes les éditions » ---------- */
let curDetail = null;
document.addEventListener('click', e => {
  const f = e.target.closest('figure.edition');
  if (!f || !curDetail) return;
  const ed = JSON.parse(f.dataset.ed);
  const o = curDetail.obj;
  Object.assign(o, {
    cover: ed.cover || o.cover, coverAlt: ed.isbn ? amazonCover(ed.isbn) : o.coverAlt,
    isbn: ed.isbn || o.isbn, editionYear: ed.year || o.editionYear,
    pages: ed.pages || o.pages, pagesTotal: ed.pages || o.pagesTotal, edition: ed.label,
  });
  if (curDetail.item) { o.updatedAt = Date.now(); saveItems(); openEditor(o.id); } else openResult(o);
  toast('Édition choisie : ' + ed.label);
});

/* ---------- Démarrage ---------- */
renderCollection();
renderResults();


/* ---------- Fenêtre des paramètres ---------- */
function openSettings() {
  const theme = document.documentElement.dataset.theme || 'auto';
  const seg = (name, map, value) => `<div class="seg" data-set="${name}">${Object.entries(map).map(([k, v]) =>
    `<button type="button" data-v="${k}" class="${k === value ? 'active' : ''}">${v}</button>`).join('')}</div>`;
  openModal(`
    <div class="modal-info settings">
      <h2>Paramètres</h2>
      <div class="form">
        <label class="full">Thème${seg('theme', { auto: 'Automatique', light: 'Clair', dark: 'Sombre' }, theme)}</label>
        <label class="full">Taille des couvertures${seg('cardSize', { s: 'Petites', m: 'Moyennes', l: 'Grandes' }, settings.cardSize)}</label>

        <label>Langue des résumés<select id="set-lang">${Object.entries(DESC_LANGS).map(([k, v]) =>
          `<option value="${k}" ${k === descLang ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label>Site Amazon<select id="set-amazon">${Object.entries(AMAZON).map(([k, v]) =>
          `<option value="${k}" ${k === settings.amazon ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <div class="full"><div class="section-title">Boutiques affichées</div>
          <div class="checks">${SHOPS.map(sh => `<label class="check"><input type="checkbox" value="${sh.name}" ${settings.hiddenShops.includes(sh.name) ? '' : 'checked'}> ${sh.name}</label>`).join('')}</div></div>
        <div class="full"><div class="section-title">Sauvegarde sur mon compte Google</div>
          <p class="muted" style="margin:0 0 8px" id="g-etat">${settings.cloud
            ? 'Activée' + (settings.cloudAt ? ' : dernière sauvegarde le ' + new Date(settings.cloudAt).toLocaleString('fr-FR') : '')
            : 'Ta collection est copiée dans ton Google Drive (dossier caché de l\'appli) et te suit sur tous tes appareils.'}</p>
          ${window.BullesAndroid ? '' : `<label>Identifiant client Google (version web)<input type="text" id="set-gclient" value="${esc(settings.googleClientId || '')}" placeholder="xxxx.apps.googleusercontent.com"></label>`}
          <div class="modal-actions" style="margin:8px 0 0">
            <button type="button" class="btn primary" id="g-save">${settings.cloud ? 'Sauvegarder maintenant' : 'Activer avec mon compte Google'}</button>
            <button type="button" class="btn ghost" id="g-load">Récupérer depuis Google</button>
            ${settings.cloud ? '<button type="button" class="btn danger" id="g-off">Désactiver</button>' : ''}
          </div></div>
        <div class="full"><div class="section-title">Mes données</div>
          <p class="muted" style="margin:0 0 8px">${items.length} titre${items.length > 1 ? 's' : ''}, enregistrés dans ce navigateur uniquement.</p>
          <div class="modal-actions" style="margin:0">
            <button type="button" class="btn ghost" id="set-export">Exporter</button>
            <button type="button" class="btn ghost" id="set-import">Importer</button>
            <button type="button" class="btn danger" id="set-clear">Tout effacer</button>
          </div></div>
      </div>
    </div>`);
  const body = $('#modal-body');
  $$('[data-set]', body).forEach(sg => sg.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    $$('button', sg).forEach(x => x.classList.toggle('active', x === b));
    const v = b.dataset.v;
    if (sg.dataset.set === 'theme') {
      if (v === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = v;
      try { if (v === 'auto') localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, v); } catch (err) {}
    } else {
      settings[sg.dataset.set] = v;
      saveSettings();
    }
  }));
  $('#set-lang').addEventListener('change', e => {
    descLang = e.target.value;
    try { localStorage.setItem(LANG_KEY, descLang); } catch (err) {}
  });
  $('#set-amazon').addEventListener('change', e => { settings.amazon = e.target.value; saveSettings(); updateAmazonLink(); renderResults(); });
  $$('.checks input', body).forEach(c => c.addEventListener('change', () => {
    settings.hiddenShops = $$('.checks input', body).filter(x => !x.checked).map(x => x.value);
    saveSettings();
  }));
  $('#set-export').addEventListener('click', () => $('#btn-export').click());
  $('#set-gclient')?.addEventListener('change', e => { settings.googleClientId = e.target.value.trim(); saveSettings(); });
  $('#g-save').addEventListener('click', async () => {
    $('#g-etat').textContent = 'Sauvegarde en cours...';
    try {
      await cloudSave(true);
      settings.cloud = true;
      saveSettings();
      $('#g-etat').textContent = 'Sauvegardé sur Google à ' + new Date().toLocaleTimeString('fr-FR');
      toast('Collection sauvegardée sur ton compte Google');
    } catch (e) { $('#g-etat').textContent = e.message; }
  });
  $('#g-load').addEventListener('click', async () => {
    $('#g-etat').textContent = 'Récupération...';
    try {
      const n = await cloudLoad(true);
      settings.cloud = true;
      saveSettings();
      $('#g-etat').textContent = n === null ? 'Aucune sauvegarde sur ce compte pour le moment' : `${n} titre${n > 1 ? 's' : ''} récupéré${n > 1 ? 's' : ''}`;
    } catch (e) { $('#g-etat').textContent = e.message; }
  });
  $('#g-off')?.addEventListener('click', () => { settings.cloud = false; saveSettings(); modal.close(); toast('Sauvegarde Google désactivée'); });
  $('#set-import').addEventListener('click', () => $('#file-import').click());
  $('#set-clear').addEventListener('click', () => {
    if (!items.length || !confirm('Effacer toute ta collection ? Pense à exporter avant.')) return;
    if (!confirm('Vraiment tout effacer ? Ce ne sera pas récupérable.')) return;
    items = [];
    saveItems();
    modal.close();
    toast('Collection effacée');
  });
}
$('#settings-btn').addEventListener('click', openSettings);

// Au démarrage : widget à jour et récupération de la sauvegarde Google (appli Android)
syncWidget();
if (settings.cloud && window.BullesAndroid) cloudLoad(false).catch(() => {});
