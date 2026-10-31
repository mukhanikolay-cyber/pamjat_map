const mapcenter = [53.7, 27.8];
const mapzoom = 6;

const majids = [2, 4, 5, 6, 8];
const capid = 3;

const orange = [255, 155, 40];
const redcolor = [170, 15, 15];

const minproz = 0.15;
const zatuhanie = 2;

const mecjacy = {
  'января': 0, 'февраля': 1, 'марта': 2, 'апреля': 3,
  'мая': 4, 'июня': 5, 'июля': 6, 'августа': 7,
  'сентября': 8, 'октября': 9, 'ноября': 10, 'декабря': 11,
  'студзеня': 0, 'лютага': 1, 'сакавіка': 2, 'красавіка': 3,
  'чэрвеня': 5, 'ліпеня': 6, 'жніўня': 7,
  'верасня': 8, 'кастрычніка': 9, 'лістапада': 10, 'снежня': 11
};

const monthnames = {
  ru: ['января','февраля','марта','апреля','мая','июня',
       'июля','августа','сентября','октября','ноября','декабря'],
  by: ['студзеня','лютага','сакавіка','красавіка','мая','чэрвеня',
       'ліпеня','жніўня','верасня','кастрычніка','лістапада','снежня']
};

const sortlabels = {
  ru: {
    'date-asc': 'По периоду: раньше - позже',
    'date-desc': 'По периоду: позже - раньше',
    'title-asc': 'По алфавиту (А - Я)',
    'title-desc': 'По алфавиту (Я - А)'
  },
  by: {
    'date-asc': 'Па перыяду: раней - пазней',
    'date-desc': 'Па перыяду: пазней - раней',
    'title-asc': 'Па алфавіце (А - Я)',
    'title-desc': 'Па алфавіце (Я - А)'
  }
};

const textfields = ['title', 'date', 'operation', 'units', 'description', 'memory'];

function dechtml(s) {
  const ta = document.createElement('textarea');
  ta.innerHTML = s;
  return ta.value;
}

const langs = {
  ru: {
    label: 'Рус',
    shortLabel: 'RU',
    over: null,
    ui: {
      search: 'Поиск города...',
      slider: 'Период освобождения',
      back: 'Назад к списку',
      notFound: 'Город не найден.<br>Попробуйте другое название.',
      about: 'О городе',
      liberation: 'Освобождение',
      operation: 'Операция:',
      troops: 'Войска:',
      heroes: 'Герои',
      places: 'Памятные места',
      museums: 'Музеи',
      sources: 'Источники',
      memory: 'Память',
      more: 'Подробнее',
      prev: 'Предыдущая',
      next: 'Следующая',
      close: 'Закрыть',
      panel: 'Панель'
    }
  },
  by: {
    label: 'Бел',
    shortLabel: 'BY',
    over: 'by',
    ui: {
      search: 'Пошук горада...',
      slider: 'Перыяд вызвалення',
      back: 'Назад да спісу',
      notFound: 'Горад не знойдзены.<br>Паспрабуйце іншую назву.',
      about: 'Пра горад',
      liberation: 'Вызваленне',
      operation: 'Аперацыя:',
      troops: 'Войскі:',
      heroes: 'Героі',
      places: 'Памятныя мясціны',
      museums: 'Музеі',
      sources: 'Крыніцы',
      memory: 'Памяць',
      more: 'Падрабязней',
      prev: 'Папярэдняя',
      next: 'Наступная',
      close: 'Зачыніць',
      panel: 'Панэль'
    }
  }
};

let mapref = null;
let clusterref = null;
let granicref = null;
let pointdata = [];
let infodata = {};
let daty = [];
let markerrecs = [];
let activecity = null;
let lowidx = 0;
let highidx = 0;
let lastpulse = 0;
let sliderready = false;

let gal = [];
let galidx = 0;

let curlang = 'ru';
let ui = langs.ru.ui;
let pointsbase = [];
let infobase = {};

let themecur = 'light';
let sortmode = 'date-asc';
let panelclosetimer = null;

const sinput = document.getElementById('search');
const sclear = document.getElementById('search-clear');
const sortsel = document.getElementById('sort-select');
const listview = document.getElementById('list-view');
const detailview = document.getElementById('detail-view');
const rangelow = document.getElementById('range-lo');
const rangehigh = document.getElementById('range-hi');
const rangefill = document.getElementById('range-fill');
const datelow = document.getElementById('date-low');
const datehigh = document.getElementById('date-high');

function ismobile() {
  return window.matchMedia('(max-width: 720px)').matches;
}

function parsedate(str) {
  const parts = String(str || '').trim().split(/\s+/);
  if (parts.length < 3) return null;
  const d = parseInt(parts[0], 10);
  const m = mecjacy[parts[1]];
  const y = parseInt(parts[2], 10);
  if (isNaN(d) || m === undefined || isNaN(y)) return null;
  return new Date(y, m, d);
}

function formatdate(date) {
  const names = (monthnames[curlang] || monthnames.ru);
  return date.getDate() + ' ' + names[date.getMonth()] + ' ' + date.getFullYear();
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fotki(v) {
  if (!v) return [];
  if (Array.isArray(v)) {
    const out = [];
    for (let i = 0; i < v.length; i++) {
      const s = v[i] == null ? '' : String(v[i]).trim();
      if (s) out.push(s);
    }
    return out;
  }
  const parts = String(v).split(/[|\r\n]+/);
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const s = parts[i].trim();
    if (s) out.push(s);
  }
  return out;
}

function ubratpovtory(arr) {
  const seen = {};
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (!v) continue;
    const k = String(v);
    if (seen[k]) continue;
    seen[k] = 1;
    out.push(v);
  }
  return out;
}

function sobratistochniki() {
  const seen = {};
  const out = [];
  for (let a = 0; a < arguments.length; a++) {
    const list = arguments[a];
    if (!list) continue;
    const arr = Array.isArray(list) ? list : [list];
    for (let i = 0; i < arr.length; i++) {
      const s = arr[i];
      if (!s) continue;
      const url = typeof s === 'string' ? s : (s.url || '');
      if (!url || seen[url]) continue;
      seen[url] = 1;
      out.push(typeof s === 'string' ? { url: s, label: '' } : s);
    }
  }
  return out;
}

function sobratfoto() {
  const all = [];
  for (let a = 0; a < arguments.length; a++) {
    const f = fotki(arguments[a]);
    for (let i = 0; i < f.length; i++) all.push(f[i]);
  }
  const un = ubratpovtory(all);
  return un.length ? un : '';
}

function fotkiblok(v, cls, cap, eager) {
  const arr = fotki(v);
  if (!arr.length) return '';
  const list = [];
  for (let i = 0; i < arr.length; i++) list.push(arr[i]);
  const listattr = esc(JSON.stringify(list));
  const load = eager ? 'eager' : 'lazy';
  let html = '<div class="' + cls + '" data-list="' + listattr + '" data-cap="' + esc(cap || '') + '">';
  for (let i = 0; i < arr.length; i++) {
    const src = arr[i];
    let c = '';
    if (cap) c = arr.length > 1 ? cap + ' · ' + (i + 1) + ' / ' + arr.length : cap;
    html += '<img class="lightbox-img" src="' + esc(src) + '" alt="' + esc(c) +
      '" data-idx="' + i + '" loading="' + load + '" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">';
  }
  html += '</div>';
  return html;
}

function levenstein(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase();
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = new Array(n + 1);
  let cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    const tmp = prev; prev = cur; cur = tmp;
  }
  return prev[n];
}

function nechotko(query, target) {
  const q = String(query || '').toLowerCase().trim();
  const t = String(target || '').toLowerCase();
  if (!q) return 1;
  if (!t) return 0;
  if (t === q) return 1;
  if (t.startsWith(q)) return 0.95;
  const idx = t.indexOf(q);
  if (idx >= 0) return 0.85 - idx * 0.01;
  const dist = levenstein(q, t);
  const maxlen = Math.max(q.length, t.length);
  return Math.max(0, 1 - dist / maxlen) * 0.7;
}

async function vzjattext(url) {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return null;
    return await r.text();
  } catch (e) {
    return null;
  }
}

async function vzjatjson(url, def) {
  const t = await vzjattext(url);
  if (t == null) return def;
  try {
    return JSON.parse(t);
  } catch (e) {
    console.warn('JSON parse error:', url, '-', e.message);
    return def;
  }
}

async function vzjatbazu() {
  let pTxt = await vzjattext('langs/points_ruby.json');
  if (pTxt == null) pTxt = await vzjattext('points_ruby.json');
  if (pTxt == null) throw new Error('не найден points_ruby.json');
  try { pointsbase = JSON.parse(pTxt); } catch (e) { throw new Error('points_ruby.json: ' + e.message); }
  if (!Array.isArray(pointsbase)) throw new Error('points_ruby.json не массив');

  let iTxt = await vzjattext('langs/info.json');
  if (iTxt == null) iTxt = await vzjattext('info.json');
  infobase = {};
  if (iTxt != null) {
    try { infobase = JSON.parse(iTxt) || {}; } catch (e) { console.warn('JSON ошибка: langs/info.json -', e.message); infobase = {}; }
  }
}

function raskryt(point, idx) {
  const out = {};
  for (const k in point) {
    const v = point[k];
    if (textfields.indexOf(k) >= 0 && Array.isArray(v) && v.length === 2) {
      out[k] = v[idx] || '';
    } else {
      out[k] = v;
    }
  }
  return out;
}

function slitinfo(base, over) {
  if (!over) return base;
  const out = {};
  for (const k in base) out[k] = base[k];
  for (const k in over) {
    const b = base[k] || {};
    const o = over[k] || {};
    const m = {};
    for (const f in b) m[f] = b[f];
    for (const f in o) {
      if (f === 'sources') { m[f] = sobratistochniki(b[f], o[f]); continue; }
      if (f === 'photo') { m[f] = sobratfoto(b[f], o[f]); continue; }
      if (f === 'monuments') {
        const om = o.monuments || [];
        const bm = b.monuments || [];
        const len = Math.max(om.length, bm.length);
        const mm = [];
        for (let j = 0; j < len; j++) {
          const omm = om[j] || {};
          const bmm = bm[j] || {};
          const nm = {};
          for (const kk in bmm) nm[kk] = bmm[kk];
          for (const kk in omm) nm[kk] = omm[kk];
          if (!nm.photo && bmm.photo) nm.photo = bmm.photo;
          if (!nm.photo && omm.photo) nm.photo = omm.photo;
          mm.push(nm);
        }
        m.monuments = mm;
        continue;
      }
      m[f] = o[f];
    }
    out[k] = m;
  }
  return out;
}

function zapolnitinfo(base, other, fields) {
  if (!other) return base;
  const out = {};
  for (const k in base) out[k] = base[k];
  for (const k in other) {
    const o = other[k];
    if (!base[k]) {
      const photos = [];
      const oms = (o && o.monuments) ? o.monuments : [];
      for (let j = 0; j < oms.length; j++) {
        const fp = fotki(oms[j] && oms[j].photo);
        for (let x = 0; x < fp.length; x++) photos.push(fp[x]);
      }
      const entry = {};
      if (o && o.photo) entry.photo = o.photo;
      if (o && o.sources) entry.sources = o.sources;
      if (photos.length) entry.monumentPhotos = photos;
      out[k] = entry;
      continue;
    }
    const b = base[k];
    const m = {};
    for (const f in b) m[f] = b[f];
    for (let i = 0; i < fields.length; i++) {
      const fld = fields[i];
      if (fld === 'monuments') {
        if (b.monuments && o.monuments) {
          const mm = [];
          const len = Math.max(b.monuments.length, o.monuments.length);
          for (let j = 0; j < len; j++) {
            const bm = b.monuments[j] || {};
            const om = o.monuments[j] || {};
            const nm = {};
            for (const kk in bm) nm[kk] = bm[kk];
            if (!bm.photo && om.photo) nm.photo = om.photo;
            mm.push(nm);
          }
          m.monuments = mm;
        } else if (!b.monuments && o.monuments) {
          const mm = [];
          for (let j = 0; j < o.monuments.length; j++) {
            const om = o.monuments[j] || {};
            const nm = {};
            for (const kk in om) nm[kk] = om[kk];
            mm.push(nm);
          }
          m.monuments = mm;
        }
        continue;
      }
      const v = b[fld];
      let empty = !v;
      if (Array.isArray(v) && !v.length) empty = true;
      if (typeof v === 'string' && !v.trim()) empty = true;
      if (empty && o[fld]) m[fld] = o[fld];
    }
    out[k] = m;
  }
  return out;
}

async function vzjatlang(code) {
  const cfg = langs[code];
  if (!cfg) return { points: pointsbase, info: infobase };
  const idx = code === 'by' ? 1 : 0;
  const points = pointsbase.map(function (p) { return raskryt(p, idx); });
  let info;
  if (cfg.over) {
    const iOver = await vzjatjson('langs/info_' + cfg.over + '.json', {});
    info = slitinfo(infobase, iOver || {});
  } else {
    const iBy = await vzjatjson('langs/info_by.json', {});
    info = zapolnitinfo(infobase, iBy || {}, ['photo', 'sources', 'monuments']);
  }
  console.log('[lang=' + code + '] points:', points.length, 'info:', Object.keys(info).length);
  return { points, info };
}

function pinicon(datestr, id) {
  const iscap = id === capid;
  const ismaj = !iscap && majids.indexOf(id) >= 0;
  const size = iscap ? 30 : (ismaj ? 26 : 22);
  const color = colorfordate(datestr);
  let cls = 'pin';
  if (ismaj) cls += ' pin-major';
  if (iscap) cls += ' pin-capital';
  return L.divIcon({
    className: 'pin-holder',
    html: '<div class="' + cls + '" style="--pin:' + color + '"></div>',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size]
  });
}

function sobratdaty(points) {
  const uniq = {};
  for (let i = 0; i < points.length; i++) {
    const d = parsedate(points[i].date);
    if (!d) continue;
    const t = d.getTime();
    if (!(t in uniq)) uniq[t] = d;
  }
  daty = Object.keys(uniq).map(function (k) { return uniq[k]; });
  daty.sort(function (a, b) { return a - b; });
}

function dateindex(date) {
  if (!date) return -1;
  const t = date.getTime();
  for (let i = 0; i < daty.length; i++) {
    if (daty[i].getTime() === t) return i;
  }
  return -1;
}

function colorcompute(t) {
  if (daty.length < 2) return 'rgb(' + orange.join(',') + ')';
  let seqidx = 0;
  for (let i = 0; i < daty.length; i++) {
    if (daty[i].getTime() === t) { seqidx = i; break; }
  }
  const seqpos = seqidx / (daty.length - 1);
  const first = daty[0].getTime();
  const last = daty[daty.length - 1].getTime();
  const intpos = last > first ? (t - first) / (last - first) : 0;
  const mix = 0.75 * seqpos + 0.25 * intpos;
  const r = Math.round(orange[0] + (redcolor[0] - orange[0]) * mix);
  const g = Math.round(orange[1] + (redcolor[1] - orange[1]) * mix);
  const b = Math.round(orange[2] + (redcolor[2] - orange[2]) * mix);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

function colorfordate(datestr) {
  const d = parsedate(datestr);
  if (!d) return 'rgb(' + orange.join(',') + ')';
  return colorcompute(d.getTime());
}

function parsergb(s) {
  const m = String(s).match(/\d+/g);
  if (!m || m.length < 3) return [170, 15, 15];
  return [+m[0], +m[1], +m[2]];
}

function obvodka(rgb, isDark) {
  const lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  const bgLum = isDark ? 0.06 : 0.98;
  const contrast = Math.abs(lum - bgLum);
  const needed = Math.max(0, Math.min(1, (0.65 - contrast) / 0.65));
  const alpha = 0.10 + 0.50 * needed;
  const v = isDark ? 235 : 45;
  return 'rgba(' + v + ',' + v + ',' + v + ',' + alpha.toFixed(2) + ')';
}

function stildaty(el, color, outline) {
  if (!el) return;
  el.style.color = color;
  if (outline) {
    el.style.textShadow = '0 0 3px ' + outline + ', 0 0 5px ' + outline;
  } else {
    el.style.textShadow = 'none';
  }
}

function lb() { return document.getElementById('lightbox'); }
function lbimg() { return document.getElementById('lightbox-img'); }
function lbcap() { return document.getElementById('lightbox-caption'); }
function lbnum() { return document.getElementById('lightbox-num'); }
function lbprev() { return document.getElementById('lightbox-prev'); }
function lbnext() { return document.getElementById('lightbox-next'); }

function sborkalightbox() {
  const box = lb();
  if (!box) return;
  box.innerHTML =
    '<button type="button" class="lightbox-nav lightbox-prev" id="lightbox-prev" aria-label="prev" hidden>' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 6 9 12 15 18"></polyline></svg>' +
    '</button>' +
    '<button type="button" class="lightbox-nav lightbox-next" id="lightbox-next" aria-label="next" hidden>' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"></polyline></svg>' +
    '</button>' +
    '<div class="lightbox-num" id="lightbox-num" hidden></div>' +
    '<button type="button" class="lightbox-close" aria-label="close">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"></line><line x1="18" y1="6" x2="6" y2="18"></line></svg>' +
    '</button>' +
    '<div class="lightbox-inner">' +
      '<img id="lightbox-img" src="" alt="" referrerpolicy="no-referrer">' +
      '<div id="lightbox-caption" class="lightbox-caption"></div>' +
    '</div>';
}

function obnovgal() {
  const box = lb();
  if (!box) return;
  const img = lbimg();
  const cap = lbcap();
  const num = lbnum();
  const pv = lbprev();
  const nx = lbnext();
  const n = gal.length;
  if (!n) {
    if (img) img.removeAttribute('src');
    if (cap) cap.textContent = '';
    if (num) { num.textContent = ''; num.hidden = true; }
    if (pv) pv.hidden = true;
    if (nx) nx.hidden = true;
    return;
  }
  const src = gal[galidx];
  const gc = box.dataset.cap || '';
  let text = gc;
  if (n > 1) text = gc ? gc + ' · ' + (galidx + 1) + ' / ' + n : (galidx + 1) + ' / ' + n;
  if (img) { img.src = src; img.alt = text; }
  if (cap) cap.textContent = text;
  if (num) {
    num.textContent = n > 1 ? (galidx + 1) + ' / ' + n : '';
    num.hidden = n < 2;
  }
  if (pv) pv.hidden = n < 2;
  if (nx) nx.hidden = n < 2;
}

function galshift(step) {
  if (gal.length < 2) return;
  galidx = (galidx + step + gal.length) % gal.length;
  obnovgal();
}

function otkrytfoto(list, idx, cap) {
  const box = lb();
  if (!box || !list || !list.length) return;
  gal = list.slice();
  galidx = Math.max(0, Math.min(idx | 0, gal.length - 1));
  box.dataset.cap = cap || '';
  obnovgal();
  box.hidden = false;
  document.body.style.overflow = 'hidden';
}

function zakrytfoto() {
  const box = lb();
  if (!box) return;
  box.hidden = true;
  const img = lbimg();
  const cap = lbcap();
  const num = lbnum();
  if (img) img.removeAttribute('src');
  if (cap) cap.textContent = '';
  if (num) num.textContent = '';
  gal = [];
  galidx = 0;
  delete box.dataset.cap;
  document.body.style.overflow = '';
}

function initprosmotr() {
  sborkalightbox();
  const box = lb();
  if (!box) return;

  box.addEventListener('click', function (e) {
    if (e.target.closest('.lightbox-close')) { zakrytfoto(); return; }
    if (e.target.closest('.lightbox-prev')) { galshift(-1); return; }
    if (e.target.closest('.lightbox-next')) { galshift(1); return; }
    if (e.target.closest('.lightbox-nav')) return;
    if (!e.target.closest('.lightbox-inner')) zakrytfoto();
  });

  document.addEventListener('keydown', function (e) {
    if (box.hidden) return;
    if (e.key === 'Escape') { zakrytfoto(); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); galshift(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); galshift(1); }
  });

  let tx = 0, ty = 0, moved = false;
  box.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    tx = e.touches[0].clientX;
    ty = e.touches[0].clientY;
    moved = false;
  }, { passive: true });
  box.addEventListener('touchmove', function (e) {
    if (e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - tx;
    const dy = e.touches[0].clientY - ty;
    if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) moved = true;
  }, { passive: true });
  box.addEventListener('touchend', function (e) {
    if (!moved) return;
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - tx;
    if (dx <= -40) galshift(1);
    else if (dx >= 40) galshift(-1);
    moved = false;
  });

  document.addEventListener('click', function (e) {
    const img = e.target.closest('.lightbox-img');
    if (!img) return;
    const holder = img.parentElement;
    let list = [img.getAttribute('src')];
    let cap = img.dataset.caption || img.alt || '';
    if (holder && holder.dataset && holder.dataset.list) {
      try {
        const parsed = JSON.parse(holder.dataset.list);
        if (Array.isArray(parsed) && parsed.length) list = parsed;
      } catch (err) {}
      if (holder.dataset.cap) cap = holder.dataset.cap;
    }
    const idx = +img.dataset.idx || 0;
    if (!list[0]) return;
    e.preventDefault();
    otkrytfoto(list, idx, cap);
  });
}

function initfab() {
  let fb = document.getElementById('fab');
  if (!fb) {
    fb = document.createElement('button');
    fb.id = 'fab';
    fb.type = 'button';
    fb.setAttribute('aria-label', 'Меню');
    fb.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 6 9 12 15 18"></polyline></svg>';
    document.body.appendChild(fb);
  }
  fb.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    togglepanel();
  });
}

function togglepanel(force) {
  const panel = document.getElementById('panel');
  if (!panel) return;
  if (panelclosetimer) {
    clearTimeout(panelclosetimer);
    panelclosetimer = null;
  }
  const closed = panel.classList.contains('closed');
  const willopen = force === true ? true : (force === false ? false : closed);

  if (willopen) {
    const wasfully = panel.classList.contains('fully-closed');
    panel.classList.remove('fully-closed');
    if (wasfully) {
      void panel.offsetWidth;
    }
    panel.classList.remove('closed');
  } else {
    if (!panel.classList.contains('closed')) {
      panel.classList.add('closed');
      panelclosetimer = setTimeout(function () {
        if (panel.classList.contains('closed')) {
          panel.classList.add('fully-closed');
        }
        panelclosetimer = null;
      }, 320);
    } else {
      panel.classList.add('fully-closed');
    }
  }

  document.body.classList.toggle('panel-open', willopen);
}

function obnovlangbtn() {
  const target = curlang === 'ru' ? 'by' : 'ru';
  const label = target === 'by' ? 'BY' : 'RU';
  const btns = document.querySelectorAll('.lang-switch');
  for (let i = 0; i < btns.length; i++) {
    btns[i].textContent = label;
    btns[i].dataset.lang = target;
  }
}

function obnovsortui() {
  if (!sortsel) return;
  const modes = ['date-asc', 'date-desc', 'title-asc', 'title-desc'];
  const labels = sortlabels[curlang] || sortlabels.ru;
  sortsel.innerHTML = '';
  for (let i = 0; i < modes.length; i++) {
    const opt = document.createElement('option');
    opt.value = modes[i];
    opt.textContent = labels[modes[i]];
    sortsel.appendChild(opt);
  }
  sortsel.value = sortmode;
}

function obnovui() {
  if (sinput) sinput.placeholder = ui.search;
  const sl = document.querySelector('.slider-label');
  if (sl) sl.textContent = ui.slider;
  const pv = lbprev(); if (pv) pv.setAttribute('aria-label', ui.prev);
  const nx = lbnext(); if (nx) nx.setAttribute('aria-label', ui.next);
  const cl = document.querySelector('.lightbox-close');
  if (cl) cl.setAttribute('aria-label', ui.close);
  const fb = document.getElementById('fab');
  if (fb) fb.setAttribute('aria-label', ui.panel);
  obnovlangbtn();
  obnovsortui();
}

function makepopup(p) {
  const info = infodata[p.id] || {};
  const pcol = colorfordate(p.date);
  const fotos = fotkiblok(sobratfoto(info.photo, p.photo), 'popup-photos', p.title, true);
  const mem = p.memory
    ? '<div class="popup-memory" style="border-left-color:' + pcol + ';--mem-color:' + pcol + '" data-label="' + esc(ui.memory) + '">' + esc(p.memory) + '</div>'
    : '';
  const srcs = sobratistochniki(p.sources, info.sources);
  let srchtml = '';
  if (srcs.length) {
    srchtml = '<div class="popup-src">';
    for (let i = 0; i < srcs.length; i++) {
      const s = srcs[i];
      const label = s.label || String(s.url).replace(/^https?:\/\//, '').split('/')[0];
      srchtml += '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + '</a>';
    }
    srchtml += '</div>';
  }
  const d = parsedate(p.date);
  const dtext = d ? formatdate(d) : p.date;
  return '<div class="popup-title" style="color:' + pcol + '">' + esc(p.title) + '</div>' +
    '<div class="popup-date">' + esc(dtext || '') + (p.operation ? ' · ' + esc(p.operation) : '') + '</div>' +
    fotos +
    '<div class="popup-desc">' + esc(p.description || '') + '</div>' +
    mem +
    srchtml +
    '<button class="popup-more" style="--more-color:' + pcol + '" onclick="otkrytgorod(' + p.id + ')">' + esc(ui.more) + '</button>';
}

function noimgsvg() {
  return '<svg class="noimg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"></circle><polyline points="21 15 16 10 5 21"></polyline><line x1="3" y1="3" x2="21" y2="21" stroke-width="1.8"></line></svg>';
}

function sortitems(items) {
  const cmpDate = function (a, b) {
    const da = parsedate(a.date), db = parsedate(b.date);
    if (da && db) return da - db;
    return 0;
  };
  const cmpTitle = function (a, b) {
    return String(a.title || '').localeCompare(String(b.title || ''), curlang === 'by' ? 'be' : 'ru');
  };
  if (sortmode === 'date-asc') items.sort(cmpDate);
  else if (sortmode === 'date-desc') items.sort(function (a, b) { return cmpDate(b, a); });
  else if (sortmode === 'title-asc') items.sort(cmpTitle);
  else if (sortmode === 'title-desc') items.sort(function (a, b) { return cmpTitle(b, a); });
  return items;
}

function risuemspisok(query) {
  const q = String(query || '').trim();
  let items = pointdata.slice();
  if (q) {
    items = items
      .map(function (p) { return { p: p, score: nechotko(q, p.title) }; })
      .filter(function (o) { return o.score > 0.25; })
      .sort(function (a, b) { return b.score - a.score; })
      .map(function (o) { return o.p; });
  } else {
    items = sortitems(items);
  }
  if (!items.length) {
    listview.innerHTML = '<div class="empty-state">' + ui.notFound + '</div>';
    return;
  }
  let html = '';
  for (let i = 0; i < items.length; i++) {
    const p = items[i];
    const info = infodata[p.id] || {};
    const arr = fotki(sobratfoto(info.thumb, info.photo, p.photo));
    const thsrc = arr[0] || '';
    const thumb = thsrc
      ? '<img src="' + esc(thsrc) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">'
      : noimgsvg();
    const d = parsedate(p.date);
    const dtext = d ? formatdate(d) : p.date;
    html += '<div class="city-item" data-id="' + p.id + '">' +
      '<div class="city-thumb">' + thumb + '</div>' +
      '<div class="city-info">' +
        '<div class="city-name">' + esc(p.title) + '</div>' +
        '<div class="city-meta">' + esc(p.operation || '') + '</div>' +
        '<div class="city-date">' + esc(dtext || '') + '</div>' +
      '</div>' +
    '</div>';
  }
  listview.innerHTML = html;
}

function risuemkartochku(id) {
  const p = pointdata.find(function (x) { return x.id === id; });
  if (!p) return;
  const info = infodata[id] || {};
  const pcol = colorfordate(p.date);

  const cityfotos = fotkiblok(sobratfoto(info.photo, p.photo), 'detail-photos', p.title);

  let intro = '';
  if (info.intro) {
    intro = '<div class="detail-section"><h4>' + esc(ui.about) + '</h4><p>' + esc(info.intro) + '</p></div>';
  } else if (p.description) {
    intro = '<div class="detail-section"><h4>' + esc(ui.about) + '</h4><p>' + esc(p.description) + '</p></div>';
  }

  const d0 = parsedate(p.date);
  const dtext0 = d0 ? formatdate(d0) : p.date;

  let opsec = '';
  if (p.operation || p.units) {
    opsec = '<div class="detail-section"><h4>' + esc(ui.liberation) + '</h4>' +
      (dtext0 ? '<p><b>' + esc(dtext0) + '</b></p>' : '') +
      (p.operation ? '<p><b>' + esc(ui.operation) + '</b> ' + esc(p.operation) + '</p>' : '') +
      (p.units ? '<p><b>' + esc(ui.troops) + '</b> ' + esc(p.units) + '</p>' : '') +
    '</div>';
  }

  let geroi = '';
  if (info.heroes && info.heroes.length) {
    geroi = '<div class="detail-section"><h4>' + esc(ui.heroes) + '</h4><ul class="heroes-list">';
    for (let i = 0; i < info.heroes.length; i++) {
      const h = info.heroes[i];
      if (h && typeof h === 'object') {
        const hname = esc(h.name || h.title || h.url || '');
        const hurl = h.url || h.href || h.link || '';
        geroi += hurl
          ? '<li><a href="' + esc(hurl) + '" target="_blank" rel="noopener noreferrer">' + hname + '</a></li>'
          : '<li>' + hname + '</li>';
      } else if (h != null) {
        geroi += '<li>' + esc(String(h)) + '</li>';
      }
    }
    geroi += '</ul></div>';
  }

  let monuments = [];
  if (info.monuments && info.monuments.length) monuments = info.monuments;
  else if (p.memory) monuments = [{ name: p.memory, note: '', photo: info.monumentPhotos || p.memoryPhoto || '' }];

  let memsec = '';
  if (monuments.length) {
    memsec = '<div class="detail-section"><h4>' + esc(ui.places) + '</h4>';
    for (let i = 0; i < monuments.length; i++) {
      const m = monuments[i];
      const name = esc(m.name || '');
      const photos = fotki(m.photo);
      const photoBlock = photos.length
        ? fotkiblok(m.photo, 'monument-photos', m.name || '')
        : '<div class="monument-photo">' + noimgsvg() + '</div>';
      memsec += '<div class="monument">' + photoBlock +
        '<div class="monument-text">' +
          (name ? '<b>' + name + '</b>' : '') +
          (m.note ? '<span class="note">' + esc(m.note) + '</span>' : '') +
        '</div>' +
      '</div>';
    }
    memsec += '</div>';
  }

  let muzei = '';
  if (info.museums && info.museums.length) {
    muzei = '<div class="detail-section"><h4>' + esc(ui.museums) + '</h4><ul>';
    for (let i = 0; i < info.museums.length; i++) {
      const m = info.museums[i];
      if (typeof m === 'string') {
        muzei += '<li>' + esc(m) + '</li>';
      } else {
        const name = esc(m.name || '');
        muzei += m.url
          ? '<li><a href="' + esc(m.url) + '" target="_blank" rel="noopener noreferrer" style="color:var(--src);text-decoration:none">' + name + '</a></li>'
          : '<li>' + name + '</li>';
      }
    }
    muzei += '</ul></div>';
  }

  const srcs = sobratistochniki(p.sources, info.sources);
  let srcsec = '';
  if (srcs.length) {
    srcsec = '<div class="detail-section detail-src"><h4>' + esc(ui.sources) + '</h4>';
    for (let i = 0; i < srcs.length; i++) {
      const s = srcs[i];
      const label = s.label || String(s.url).replace(/^https?:\/\//, '').split('/')[0];
      srcsec += '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + '</a>';
    }
    srcsec += '</div>';
  }

  const otherLang = curlang === 'ru' ? 'by' : 'ru';
  const otherLabel = otherLang === 'by' ? 'BY' : 'RU';

  detailview.innerHTML =
    '<div class="detail-head">' +
      '<button class="detail-back" id="back-btn" type="button" style="background:' + pcol + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="back-arrow"><polyline points="15 6 9 12 15 18"></polyline></svg>' +
        esc(ui.back) +
      '</button>' +
      '<button class="detail-lang lang-switch" type="button" data-lang="' + otherLang + '">' + otherLabel + '</button>' +
    '</div>' +
    '<div class="detail-body" style="--sec-color:' + pcol + '">' +
      '<div class="detail-title" style="color:' + pcol + '">' + esc(p.title) + '</div>' +
      '<div class="detail-date">' + esc(dtext0 || '') + (p.operation ? ' · ' + esc(p.operation) : '') + '</div>' +
      cityfotos + intro + opsec + geroi + memsec + muzei + srcsec +
    '</div>';

  document.getElementById('back-btn').addEventListener('click', function () {
    detailview.hidden = true;
    listview.hidden = false;
    activecity = null;
    if (ismobile()) togglepanel(false);
  });
}

function otkrytgorod(id, ostavitpanel) {
  activecity = id;
  risuemkartochku(id);
  listview.hidden = true;
  detailview.hidden = false;
  detailview.scrollTop = 0;
  if (ostavitpanel !== false) togglepanel(true);
}

window.otkrytgorod = otkrytgorod;

function pulsmaker(marker) {
  const now = Date.now();
  if (now - lastpulse < 400) return;
  lastpulse = now;
  const el = marker.getElement && marker.getElement();
  if (!el) return;
  const pin = el.querySelector('.pin');
  if (!pin) return;
  pin.classList.remove('pulse');
  void pin.offsetWidth;
  pin.classList.add('pulse');
  clearTimeout(pin._pulsetimer);
  pin._pulsetimer = setTimeout(function () {
    pin.classList.remove('pulse');
  }, 2400);
}

function zapuskslider() {
  if (!daty.length) return;
  const last = daty.length - 1;
  const keepLo = sliderready ? Math.min(lowidx, last) : 0;
  const keepHi = sliderready ? Math.min(highidx, last) : last;
  rangelow.min = 0; rangelow.max = last;
  rangehigh.min = 0; rangehigh.max = last;
  if (sliderready && keepHi > keepLo) {
    rangelow.value = keepLo;
    rangehigh.value = keepHi;
    lowidx = keepLo;
    highidx = keepHi;
  } else {
    rangelow.value = 0;
    rangehigh.value = last;
    lowidx = 0;
    highidx = last;
  }
  sliderready = true;
  primenitrange();
}

function primenitrange() {
  if (!sliderready || !daty.length) return;
  const last = daty.length - 1;
  if (lowidx > highidx) { const tmp = lowidx; lowidx = highidx; highidx = tmp; }
  if (lowidx < 0) lowidx = 0;
  if (highidx > last) highidx = last;
  if (highidx <= lowidx) {
    if (lowidx === 0) highidx = 1;
    else lowidx = highidx - 1;
  }
  if (highidx > last) highidx = last;
  if (lowidx < 0) lowidx = 0;
  const total = last || 1;
  const l = (lowidx / total) * 100;
  const r = (highidx / total) * 100;
  rangefill.style.left = l + '%';
  rangefill.style.width = (r - l) + '%';

  const colLow = colorcompute(daty[lowidx].getTime());
  const colHigh = colorcompute(daty[highidx].getTime());
  rangefill.style.background = 'linear-gradient(90deg, ' + colLow + ', ' + colHigh + ')';
  rangelow.style.setProperty('--thumb-color', colLow);
  rangehigh.style.setProperty('--thumb-color', colHigh);

  const isDark = themecur === 'dark';
  const outLow = obvodka(parsergb(colLow), isDark);
  const outHigh = obvodka(parsergb(colHigh), isDark);
  datelow.textContent = formatdate(daty[lowidx]);
  datehigh.textContent = formatdate(daty[highidx]);
  stildaty(datelow, colLow, outLow);
  stildaty(datehigh, colHigh, outHigh);

  rangelow.style.zIndex = 3;
  rangehigh.style.zIndex = 4;
  for (let i = 0; i < markerrecs.length; i++) {
    const rec = markerrecs[i];
    const idx = rec.dateidx;
    if (idx < 0) continue;
    let op = 1;
    if (idx < lowidx) op = Math.max(minproz, 1 - (lowidx - idx) / zatuhanie);
    else if (idx > highidx) op = Math.max(minproz, 1 - (idx - highidx) / zatuhanie);
    rec.marker.setOpacity(op);
    rec.marker.options.opac = op;
  }
  if (clusterref) clusterref.refreshClusters();
}

function dvizhenie(which) {
  if (!sliderready) return;
  const last = daty.length - 1;
  let lo = +rangelow.value;
  let hi = +rangehigh.value;
  if (which === 'lo') {
    if (lo >= hi) {
      lo = hi - 1;
      if (lo < 0) { lo = 0; hi = 1; }
      rangelow.value = lo;
    }
  } else {
    if (hi <= lo) {
      hi = lo + 1;
      if (hi > last) { hi = last; lo = last - 1; }
      rangehigh.value = hi;
    }
  }
  lowidx = lo;
  highidx = hi;
  primenitrange();
}

function clustericon(cluster) {
  const children = cluster.getAllChildMarkers();
  const n = children.length;
  let r = 0, g = 0, b = 0, ops = 0;
  for (let i = 0; i < children.length; i++) {
    const m = children[i];
    const c = (m.options.pinclr || 'rgb(200,80,20)').match(/\d+/g);
    if (c) { r += +c[0]; g += +c[1]; b += +c[2]; }
    ops += (m.options.opac != null ? m.options.opac : 1);
  }
  r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);
  const op = Math.max(0.35, ops / n);
  const size = n < 10 ? 36 : n < 100 ? 44 : 52;
  return L.divIcon({
    html: '<div class="cluster-inner" style="background:rgba(' + r + ',' + g + ',' + b + ',0.85);' +
          'width:' + size + 'px;height:' + size + 'px;line-height:' + (size - 6) + 'px;' +
          'opacity:' + op + '">' + n + '</div>',
    className: 'cluster-wrap',
    iconSize: [size, size]
  });
}

function stilgranicy() {
  return {
    color: themecur === 'dark' ? '#ffffff' : '#000000',
    weight: 2,
    opacity: 0.85,
    fillColor: themecur === 'dark' ? '#ff5555' : '#b30000',
    fillOpacity: 0.05,
    dashArray: '4 4'
  };
}

function initkarta() {
  mapref = L.map('map', { zoomControl: false, attributionControl: false }).setView(mapcenter, mapzoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(mapref);
  L.control.attribution({ prefix: false, position: 'bottomleft' }).addTo(mapref);
  L.control.zoom({ position: 'bottomright' }).addTo(mapref);
  clusterref = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 42,
    iconCreateFunction: clustericon
  });
  mapref.addLayer(clusterref);
  mapref.on('click', function () {
    if (ismobile() && !document.getElementById('panel').classList.contains('closed')) {
      togglepanel(false);
    }
  });
}

function initgranica() {
  fetch('belarus.json', { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error('belarus.json'); return r.json(); })
    .then(function (geo) {
      granicref = L.geoJSON(geo, { style: function () { return stilgranicy(); }, interactive: false });
      granicref.addTo(mapref);
      if (granicref.bringToBack) granicref.bringToBack();
    })
    .catch(function (err) { console.warn('граница не загрузилась:', err); });
}

function obnovgranicu() {
  if (!granicref) return;
  try { granicref.setStyle(stilgranicy()); } catch (e) {}
}

function sobratmarkers() {
  if (clusterref) clusterref.clearLayers();
  markerrecs = [];
  const markers = [];
  for (let i = 0; i < pointdata.length; i++) {
    const p = pointdata[i];
    if (typeof p.lat !== 'number' || typeof p.lng !== 'number') continue;
    const d = parsedate(p.date);
    const dateidx = dateindex(d);
    let mk;
    try {
      mk = L.marker([p.lat, p.lng], {
        icon: pinicon(p.date, p.id),
        title: p.title,
        riseOnHover: true,
        pinclr: colorfordate(p.date),
        opac: 1
      });
      mk.bindPopup(makepopup(p), {
        maxWidth: 360, minWidth: 320, closeButton: true, autoPanPadding: [40, 40]
      });
    } catch (e) {
      continue;
    }
    markerrecs.push({ marker: mk, point: p, dateidx: dateidx });
    markers.push(mk);
  }
  clusterref.addLayers(markers);
}

async function perekluchit(code, initial) {
  if (!langs[code]) return;
  curlang = code;
  ui = langs[code].ui;
  try { localStorage.setItem('lang', code); } catch (e) {}
  document.documentElement.lang = code === 'by' ? 'be' : 'ru';
  obnovui();

  let data;
  try {
    data = await vzjatlang(code);
  } catch (e) {
    console.error('перевод не загрузился:', e);
    const idx = code === 'by' ? 1 : 0;
    data = { points: pointsbase.map(function (p) { return raskryt(p, idx); }), info: infobase };
  }

  pointdata = data.points;
  infodata = data.info;
  sobratdaty(pointdata);

  if (!mapref) {
    initkarta();
    initgranica();
  }
  sobratmarkers();
  zapuskslider();

  if (activecity) {
    risuemkartochku(activecity);
  } else {
    risuemspisok(sinput.value || '');
    listview.hidden = false;
    detailview.hidden = true;
  }
}

function primenittemu(t) {
  themecur = t;
  document.documentElement.setAttribute('data-theme', t);
  setTimeout(function () {
    obnovgranicu();
    primenitrange();
    if (mapref) mapref.invalidateSize();
  }, 40);
}

function inittheme() {
  let saved = null;
  try { saved = localStorage.getItem('theme'); } catch (e) {}
  let t;
  if (saved === 'dark' || saved === 'light') t = saved;
  else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) t = 'dark';
  else t = 'light';
  primenittemu(t);
}

function initleft() {
  const lp = document.getElementById('left-panel');
  const lt = document.getElementById('left-toggle');
  const tb = document.getElementById('theme-btn');
  if (lt && lp) {
    lt.addEventListener('click', function (e) {
      e.preventDefault();
      lp.classList.toggle('open');
    });
  }
  if (tb) {
    tb.addEventListener('click', function (e) {
      e.preventDefault();
      const next = themecur === 'dark' ? 'light' : 'dark';
      if (document.startViewTransition) {
        document.startViewTransition(function () { primenittemu(next); });
      } else {
        primenittemu(next);
      }
      try { localStorage.setItem('theme', next); } catch (e) {}
    });
  }
}

function initzoomblock() {
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturechange', function (e) { e.preventDefault(); }, { passive: false });
  document.addEventListener('gestureend', function (e) { e.preventDefault(); }, { passive: false });
  let lasttouch = 0;
  document.addEventListener('touchend', function (e) {
    if (e.target.closest('input, textarea, select, .leaflet-container')) return;
    const now = Date.now();
    if (now - lasttouch < 320) {
      if (e.cancelable) e.preventDefault();
      lasttouch = 0;
    } else {
      lasttouch = now;
    }
  }, { passive: false });
}

rangelow.addEventListener('input', function () { dvizhenie('lo'); });
rangehigh.addEventListener('input', function () { dvizhenie('hi'); });

sinput.addEventListener('input', function () {
  const v = sinput.value;
  sclear.hidden = !v;
  if (!detailview.hidden) {
    detailview.hidden = true;
    listview.hidden = false;
    activecity = null;
  }
  risuemspisok(v);
});

sinput.addEventListener('focus', function () {
  if (!detailview.hidden) {
    detailview.hidden = true;
    listview.hidden = false;
    activecity = null;
    risuemspisok(sinput.value || '');
  }
});

sclear.addEventListener('click', function () {
  sinput.value = '';
  sclear.hidden = true;
  if (!detailview.hidden) {
    detailview.hidden = true;
    listview.hidden = false;
    activecity = null;
  }
  risuemspisok('');
  sinput.focus();
});

if (sortsel) {
  sortsel.addEventListener('change', function () {
    sortmode = sortsel.value;
    try { localStorage.setItem('sortmode', sortmode); } catch (e) {}
    if (detailview.hidden) risuemspisok(sinput.value || '');
  });
}

listview.addEventListener('click', function (e) {
  const item = e.target.closest('.city-item');
  if (!item) return;
  const id = +item.dataset.id;
  const rec = markerrecs.find(function (r) { return r.point.id === id; });
  if (!rec) return;
  otkrytgorod(id, false);
  if (mapref) {
    if (ismobile()) togglepanel(false);
    const z = ismobile() ? 10 : Math.max(mapref.getZoom(), 9);
    mapref.flyTo([rec.point.lat, rec.point.lng], z, { duration: 0.6 });
    setTimeout(function () { pulsmaker(rec.marker); }, 700);
  }
});

document.addEventListener('click', function (e) {
  const b = e.target.closest('.lang-switch');
  if (!b) return;
  const code = b.dataset.lang;
  if (code && code !== curlang) perekluchit(code, false);
});

let lastmobile = ismobile();
window.addEventListener('resize', function () {
  const m = ismobile();
  if (m !== lastmobile) {
    lastmobile = m;
    togglepanel(!m);
  }
  if (mapref) setTimeout(function () { mapref.invalidateSize(); }, 120);
});

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', function () {
    if (mapref) setTimeout(function () { mapref.invalidateSize(); }, 120);
  });
}

async function start() {
  initprosmotr();
  inittheme();
  initleft();
  initzoomblock();
  initfab();
  try { sortmode = localStorage.getItem('sortmode') || 'date-asc'; } catch (e) {}
  obnovui();
  try {
    await vzjatbazu();
  } catch (e) {
    console.error(e);
    return;
  }
  let saved = null;
  try { saved = localStorage.getItem('lang'); } catch (e) {}
  const code = (saved && langs[saved]) ? saved : 'ru';
  await perekluchit(code, true);
  togglepanel(!ismobile());
}

start().catch(function (err) {
  console.error('инициализация упала:', err);
  if (!mapref) {
    mapref = L.map('map', { zoomControl: false, attributionControl: false }).setView(mapcenter, mapzoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(mapref);
    L.control.attribution({ prefix: false, position: 'bottomleft' }).addTo(mapref);
  }
});
