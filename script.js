const mapcenter = [53.7, 27.8];
const mapzoom = 6;
const minsk = 'Минск';
const voblast = ['Гомель', 'Могилев', 'Витебск', 'Брест', 'Гродно'];

const orange = [255, 155, 40];
const redcolor = [170, 15, 15];

const minproz = 0.15;
const zatuhanie = 2;

const mecjacy = {
  'января': 0, 'февраля': 1, 'марта': 2, 'апреля': 3,
  'мая': 4, 'июня': 5, 'июля': 6, 'августа': 7,
  'сентября': 8, 'октября': 9, 'ноября': 10, 'декабря': 11
};

const granica = {
  color: '#000000',
  weight: 2,
  opacity: 0.75,
  fillColor: '#b30000',
  fillOpacity: 0.04,
  dashArray: '4 4'
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

const sinput = document.getElementById('search');
const sclear = document.getElementById('search-clear');
const listview = document.getElementById('list-view');
const detailview = document.getElementById('detail-view');
const rangelow = document.getElementById('range-lo');
const rangehigh = document.getElementById('range-hi');
const rangefill = document.getElementById('range-fill');
const datelow = document.getElementById('date-low');
const datehigh = document.getElementById('date-high');

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
  const names = ['января','февраля','марта','апреля','мая','июня',
                 'июля','августа','сентября','октября','ноября','декабря'];
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

function fotkiblok(v, cls, cap) {
  const arr = fotki(v);
  if (!arr.length) return '';
  let html = '<div class="' + cls + '">';
  for (let i = 0; i < arr.length; i++) {
    const src = arr[i];
    let c = '';
    if (cap) c = arr.length > 1 ? cap + ' · ' + (i + 1) + '/' + arr.length : cap;
    html += '<img class="lightbox-img" src="' + esc(src) + '" alt="' + esc(c) +
      '" data-lightbox="' + esc(src) + '" data-caption="' + esc(c) +
      '" loading="lazy" onerror="this.remove()">';
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
  console.log('[карта] уникальных дат:', daty.length);
}

function dateindex(date) {
  if (!date) return -1;
  const t = date.getTime();
  for (let i = 0; i < daty.length; i++) {
    if (daty[i].getTime() === t) return i;
  }
  return -1;
}

function colorfordate(datestr) {
  const d = parsedate(datestr);
  if (!d || daty.length < 2) return 'rgb(' + orange.join(',') + ')';
  const t = d.getTime();
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

function pinicon(datestr, title) {
  const isminsk = title === minsk;
  const isvob = !isminsk && voblast.indexOf(title) >= 0;
  const size = isminsk ? 30 : (isvob ? 26 : 22);
  const color = colorfordate(datestr);
  let cls = 'pin';
  if (isvob) cls += ' pin-major';
  if (isminsk) cls += ' pin-capital';
  return L.divIcon({
    className: 'pin-holder',
    html: '<div class="' + cls + '" style="--pin:' + color + '"></div>',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size]
  });
}

const lightboxref = document.getElementById('lightbox');
const lightboximg = document.getElementById('lightbox-img');
const lightboxcap = document.getElementById('lightbox-caption');

function otkrytfoto(src, caption) {
  if (!src || !lightboxref) return;
  lightboximg.src = src;
  lightboximg.alt = caption || '';
  lightboxcap.textContent = caption || '';
  lightboxref.hidden = false;
  document.body.style.overflow = 'hidden';
}

function zakrytfoto() {
  if (!lightboxref) return;
  lightboxref.hidden = true;
  lightboximg.removeAttribute('src');
  lightboxcap.textContent = '';
  document.body.style.overflow = '';
}

function initprosmotr() {
  if (!lightboxref) return;
  lightboxref.addEventListener('click', function (e) {
    if (e.target.closest('.lightbox-close')) { zakrytfoto(); return; }
    if (!e.target.closest('.lightbox-inner')) zakrytfoto();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !lightboxref.hidden) zakrytfoto();
  });
  document.addEventListener('click', function (e) {
    const img = e.target.closest('.lightbox-img');
    if (!img) return;
    const src = img.dataset.lightbox || img.getAttribute('src');
    const cap = img.dataset.caption || img.alt || '';
    if (!src) return;
    e.preventDefault();
    otkrytfoto(src, cap);
  });
}

function makepopup(p) {
  const info = infodata[p.id] || {};
  const fotos = fotkiblok(info.photo || p.photo, 'popup-photos', p.title);
  const mem = p.memory ? '<div class="popup-memory">' + esc(p.memory) + '</div>' : '';
  const srcs = Array.isArray(p.sources) ? p.sources.filter(function (s) { return s && s.url; }) : [];
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
  return '<div class="popup-title">' + esc(p.title) + '</div>' +
    '<div class="popup-date">' + esc(p.date) + (p.operation ? ' · ' + esc(p.operation) : '') + '</div>' +
    fotos +
    '<div class="popup-desc">' + esc(p.description || '') + '</div>' +
    mem +
    srchtml +
    '<button class="popup-more" onclick="otkrytgorod(' + p.id + ')">Подробнее</button>';
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
    items.sort(function (a, b) {
      const da = parsedate(a.date), db = parsedate(b.date);
      if (da && db) return da - db;
      return 0;
    });
  }
  if (!items.length) {
    listview.innerHTML = '<div class="empty-state">Город не найден.<br>Попробуйте другое название.</div>';
    return;
  }
  let html = '';
  for (let i = 0; i < items.length; i++) {
    const p = items[i];
    const info = infodata[p.id] || {};
    const arr = fotki(info.thumb || info.photo || p.photo);
    const thsrc = arr[0] || '';
    const thumb = thsrc
      ? '<img src="' + esc(thsrc) + '" alt="" onerror="this.remove()">'
      : '<span>' + esc((p.title || '?').charAt(0)) + '</span>';
    html += '<div class="city-item" data-id="' + p.id + '">' +
      '<div class="city-thumb">' + thumb + '</div>' +
      '<div class="city-info">' +
        '<div class="city-name">' + esc(p.title) + '</div>' +
        '<div class="city-meta">' + esc(p.operation || '') + '</div>' +
        '<div class="city-date">' + esc(p.date) + '</div>' +
      '</div>' +
    '</div>';
  }
  listview.innerHTML = html;
}

function risuemkartochku(id) {
  const p = pointdata.find(function (x) { return x.id === id; });
  if (!p) return;
  const info = infodata[id] || {};

  const cityfotos = fotkiblok(info.photo || p.photo, 'detail-photos', p.title);

  let intro = '';
  if (info.intro) {
    intro = '<div class="detail-section"><h4>О городе</h4><p>' + esc(info.intro) + '</p></div>';
  } else if (p.description) {
    intro = '<div class="detail-section"><h4>О городе</h4><p>' + esc(p.description) + '</p></div>';
  }

  let opsec = '';
  if (p.operation || p.units) {
    opsec = '<div class="detail-section"><h4>Освобождение</h4>' +
      (p.date ? '<p><b>' + esc(p.date) + '</b></p>' : '') +
      (p.operation ? '<p><b>Операция:</b> ' + esc(p.operation) + '</p>' : '') +
      (p.units ? '<p><b>Войска:</b> ' + esc(p.units) + '</p>' : '') +
    '</div>';
  }

  let geroi = '';
  if (info.heroes && info.heroes.length) {
    geroi = '<div class="detail-section"><h4>Герои</h4><ul>';
    for (let i = 0; i < info.heroes.length; i++) {
      geroi += '<li>' + esc(info.heroes[i]) + '</li>';
    }
    geroi += '</ul></div>';
  }

  let monuments = [];
  if (info.monuments && info.monuments.length) monuments = info.monuments;
  else if (p.memory) monuments = [{ name: p.memory, note: '', photo: '' }];

  let memsec = '';
  if (monuments.length) {
    memsec = '<div class="detail-section"><h4>Памятные места</h4>';
    for (let i = 0; i < monuments.length; i++) {
      const m = monuments[i];
      const name = esc(m.name || '');
      const photos = fotki(m.photo);
      const photoBlock = photos.length
        ? fotkiblok(m.photo, 'monument-photos', m.name || '')
        : '<div class="monument-photo"></div>';
      memsec += '<div class="monument">' + photoBlock +
        '<div class="monument-text">' +
          '<b>' + name + '</b>' +
          (m.note ? '<span class="note">' + esc(m.note) + '</span>' : '') +
        '</div>' +
      '</div>';
    }
    memsec += '</div>';
  }

  let muzei = '';
  if (info.museums && info.museums.length) {
    muzei = '<div class="detail-section"><h4>Музеи</h4><ul>';
    for (let i = 0; i < info.museums.length; i++) {
      const m = info.museums[i];
      if (typeof m === 'string') {
        muzei += '<li>' + esc(m) + '</li>';
      } else {
        const name = esc(m.name || '');
        muzei += m.url
          ? '<li><a href="' + esc(m.url) + '" target="_blank" rel="noopener noreferrer" style="color:#0b5ed7;text-decoration:none">' + name + '</a></li>'
          : '<li>' + name + '</li>';
      }
    }
    muzei += '</ul></div>';
  }

  const srcs = Array.isArray(p.sources) ? p.sources.filter(function (s) { return s && s.url; }) : [];
  let srcsec = '';
  if (srcs.length) {
    srcsec = '<div class="detail-section detail-src"><h4>Источники</h4>';
    for (let i = 0; i < srcs.length; i++) {
      const s = srcs[i];
      const label = s.label || String(s.url).replace(/^https?:\/\//, '').split('/')[0];
      srcsec += '<a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + '</a>';
    }
    srcsec += '</div>';
  }

  detailview.innerHTML =
    '<button class="detail-back" id="back-btn">← Назад к списку</button>' +
    '<div class="detail-body">' +
      '<div class="detail-title">' + esc(p.title) + '</div>' +
      '<div class="detail-date">' + esc(p.date) + (p.operation ? ' · ' + esc(p.operation) : '') + '</div>' +
      cityfotos + intro + opsec + geroi + memsec + muzei + srcsec +
    '</div>';

  document.getElementById('back-btn').addEventListener('click', function () {
    detailview.hidden = true;
    listview.hidden = false;
    activecity = null;
  });
}

function otkrytgorod(id) {
  activecity = id;
  risuemkartochku(id);
  listview.hidden = true;
  detailview.hidden = false;
  detailview.scrollTop = 0;
}

window.otkrytgorod = otkrytgorod;

function pulsmaker(marker) {
  const now = Date.now();
  if (now - lastpulse < 900) return;
  lastpulse = now;
  const el = marker.getElement && marker.getElement();
  if (!el) return;
  const pin = el.querySelector('.pin');
  if (!pin) return;
  pin.classList.remove('pulse');
  void pin.offsetWidth;
  pin.classList.add('pulse');
  setTimeout(function () { pin.classList.remove('pulse'); }, 1000);
}

function zapuskslider() {
  if (!daty.length) return;
  const last = daty.length - 1;
  rangelow.min = 0; rangelow.max = last; rangelow.value = 0;
  rangehigh.min = 0; rangehigh.max = last; rangehigh.value = last;
  lowidx = 0; highidx = last;
  sliderready = true;
  primenitrange();
  console.log('[слайдер] запущен, шагов:', daty.length);
}

function primenitrange() {
  if (!sliderready) return;
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
  datelow.textContent = formatdate(daty[lowidx]);
  datehigh.textContent = formatdate(daty[highidx]);
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

function onrangeinput(which) {
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

function initkarta() {
  mapref = L.map('map', { zoomControl: true }).setView(mapcenter, mapzoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap', maxZoom: 19
  }).addTo(mapref);
  clusterref = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 42,
    iconCreateFunction: clustericon
  });
  mapref.addLayer(clusterref);
}

function initgranica() {
  fetch('belarus.json', { cache: 'no-store' })
    .then(function (r) { if (!r.ok) throw new Error('belarus.json'); return r.json(); })
    .then(function (geo) {
      granicref = L.geoJSON(geo, { style: function () { return granica; }, interactive: false });
      granicref.addTo(mapref);
      if (granicref.bringToBack) granicref.bringToBack();
    })
    .catch(function (err) { console.warn('граница не загрузилась:', err); });
}

rangelow.addEventListener('input', function () { onrangeinput('lo'); });
rangehigh.addEventListener('input', function () { onrangeinput('hi'); });

initprosmotr();

Promise.all([
  fetch('points.json', { cache: 'no-store' }).then(function (r) {
    if (!r.ok) throw new Error('points.json: ' + r.status);
    return r.json();
  }),
  fetch('info.json', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : {}; })
    .catch(function () { return {}; })
]).then(function (res) {
  const points = res[0];
  const info = res[1];
  if (!Array.isArray(points)) throw new Error('points.json не массив');
  pointdata = points;
  infodata = info || {};
  sobratdaty(points);
  initkarta();
  initgranica();

  const markers = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (typeof p.lat !== 'number' || typeof p.lng !== 'number') continue;
    const d = parsedate(p.date);
    const dateidx = dateindex(d);
    let mk;
    try {
      mk = L.marker([p.lat, p.lng], {
        icon: pinicon(p.date, p.title),
        title: p.title,
        riseOnHover: true,
        pinclr: colorfordate(p.date),
        opac: 1
      });
      mk.bindPopup(makepopup(p), {
        maxWidth: 360, minWidth: 320, closeButton: true, autoPanPadding: [40, 40]
      });
    } catch (e) {
      console.error('точка не построилась:', p && p.id, e);
      continue;
    }
    markerrecs.push({ marker: mk, point: p, dateidx: dateidx });
    markers.push(mk);
  }
  clusterref.addLayers(markers);
  zapuskslider();
  risuemspisok('');
}).catch(function (err) {
  console.error('инициализация упала:', err);
  if (!mapref) {
    mapref = L.map('map').setView(mapcenter, mapzoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(mapref);
  }
});

sinput.addEventListener('input', function () {
  const v = sinput.value;
  sclear.hidden = !v;
  risuemspisok(v);
});

sclear.addEventListener('click', function () {
  sinput.value = '';
  sclear.hidden = true;
  risuemspisok('');
  sinput.focus();
});

listview.addEventListener('click', function (e) {
  const item = e.target.closest('.city-item');
  if (!item) return;
  const id = +item.dataset.id;
  const rec = markerrecs.find(function (r) { return r.point.id === id; });
  if (!rec) return;
  otkrytgorod(id);
  if (mapref) {
    mapref.flyTo([rec.point.lat, rec.point.lng], Math.max(mapref.getZoom(), 9), { duration: 0.6 });
    setTimeout(function () { pulsmaker(rec.marker); }, 650);
  }
});
