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
const dayms = 86400000;

const granica = {
  color: '#000000',
  weight: 2,
  opacity: 0.75,
  fillColor: '#b30000',
  fillOpacity: 0.04,
  dashArray: '4 4'
};

let mapref, clusterref, granicref;
let pointdata = [];
let infodata = {};
let daty = [];
let markerrecs = [];
let activecity = null;
let lowidx = 0, highidx = 0;
let lastpulse = 0;
let sliderready = false;

let lightboxref = null, lightboximg = null, lightboxcap = null;

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
  return `${date.getDate()} ${names[date.getMonth()]} ${date.getFullYear()}`;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

function nechotko(query, target) {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase();
  if (!q) return 1;
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
  points.forEach(p => {
    const d = parsedate(p.date);
    if (!d) return;
    const t = d.getTime();
    if (!(t in uniq)) uniq[t] = d;
  });
  daty = Object.keys(uniq).map(k => uniq[k]).sort((a, b) => a - b);
  console.log('[карта] уникальных дат:', daty.length,
    daty.length ? 'с ' + formatdate(daty[0]) + ' по ' + formatdate(daty[daty.length - 1]) : '');
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
  if (!d || daty.length < 2) return `rgb(${orange.join(',')})`;

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
  return `rgb(${r},${g},${b})`;
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
    html: `<div class="${cls}" style="--pin:${color}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size]
  });
}

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
window.otkrytfoto = otkrytfoto;
window.zakrytfoto = zakrytfoto;

function initlightbox() {
  lightboxref = document.getElementById('lightbox');
  lightboximg = document.getElementById('lightbox-img');
  lightboxcap = document.getElementById('lightbox-caption');
  if (!lightboxref) return;

  lightboxref.addEventListener('click', e => {
    if (e.target.closest('.lightbox-close')) {
      zakrytfoto();
      return;
    }
    if (!e.target.closest('.lightbox-inner')) {
      zakrytfoto();
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !lightboxref.hidden) zakrytfoto();
  });

  // делегирование: любой .lightbox-img открывает просмотр
  document.addEventListener('click', e => {
    const img = e.target.closest('.lightbox-img');
    if (!img) return;
    const src = img.dataset.lightbox || img.currentSrc || img.src;
    const cap = img.dataset.caption || img.alt || '';
    if (!src) return;
    e.preventDefault();
    otkrytfoto(src, cap);
  });
}

function makepopup(p) {
  const info = infodata[p.id] || {};
  const citysrc = info.photo || p.photo || '';
  const cityimg = citysrc
    ? `<img class="popup-img lightbox-img" src="${esc(citysrc)}" alt="${esc(p.title)}"
        data-lightbox="${esc(citysrc)}" data-caption="${esc(p.title)}"
        onerror="this.remove()">`
    : '';

  const mem = p.memory ? `<div class="popup-memory">${esc(p.memory)}</div>` : '';

  const srcs = Array.isArray(p.sources) ? p.sources.filter(s => s && s.url) : [];
  const srchtml = srcs.length
    ? `<div class="popup-src">${srcs.map(s => {
        const label = s.label || s.url.replace(/^https?:\/\//, '').split('/')[0];
        return `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
      }).join('')}</div>`
    : '';

  return `
    <div class="popup-title">${esc(p.title)}</div>
    <div class="popup-date">${esc(p.date)}${p.operation ? ' · ' + esc(p.operation) : ''}</div>
    ${cityimg}
    <div class="popup-desc">${esc(p.description || '')}</div>
    ${mem}
    ${srchtml}
    <button class="popup-more" onclick="otkrytgorod(${p.id})">Подробнее</button>
  `;
}

function risuemspisok(query) {
  const q = (query || '').trim();
  let items = pointdata.slice();

  if (q) {
    items = items
      .map(p => ({ p, score: nechotko(q, p.title) }))
      .filter(o => o.score > 0.25)
      .sort((a, b) => b.score - a.score)
      .map(o => o.p);
  } else {
    items.sort((a, b) => {
      const da = parsedate(a.date), db = parsedate(b.date);
      if (da && db) return da - db;
      return 0;
    });
  }

  if (!items.length) {
    listview.innerHTML = `<div class="empty-state">Город не найден.<br>Попробуйте другое название.</div>`;
    return;
  }

  listview.innerHTML = items.map(p => {
    const info = infodata[p.id] || {};
    const thsrc = info.thumb || info.photo || p.photo || '';
    const thumb = thsrc
      ? `<img src="${esc(thsrc)}" alt="" onerror="this.remove()">`
      : `<span>${esc(p.title[0] || '?')}</span>`;

    return `
      <div class="city-item" data-id="${p.id}">
        <div class="city-thumb">${thumb}</div>
        <div class="city-info">
          <div class="city-name">${esc(p.title)}</div>
          <div class="city-meta">${esc(p.operation || '')}</div>
          <div class="city-date">${esc(p.date)}</div>
        </div>
      </div>
    `;
  }).join('');
}

function risuemkartochku(id) {
  const p = pointdata.find(x => x.id === id);
  if (!p) return;
  const info = infodata[id] || {};

  // фото города (кликабельное)
  const citysrc = info.photo || p.photo || '';
  const cityimg = citysrc
    ? `<img class="detail-photo lightbox-img" src="${esc(citysrc)}"
        alt="${esc(p.title)}" data-lightbox="${esc(citysrc)}"
        data-caption="${esc(p.title)}" onerror="this.remove()">`
    : '';

  const intro = info.intro
    ? `<div class="detail-section"><h4>О городе</h4><p>${esc(info.intro)}</p></div>`
    : (p.description
        ? `<div class="detail-section"><h4>О городе</h4><p>${esc(p.description)}</p></div>`
        : '');

  const opsec = (p.operation || p.units)
    ? `<div class="detail-section"><h4>Освобождение</h4>
        ${p.date ? `<p><b>${esc(p.date)}</b></p>` : ''}
        ${p.operation ? `<p><b>Операция:</b> ${esc(p.operation)}</p>` : ''}
        ${p.units ? `<p><b>Войска:</b> ${esc(p.units)}</p>` : ''}
      </div>` : '';

  const geroi = (info.heroes && info.heroes.length)
    ? `<div class="detail-section"><h4>Герои</h4><ul>${
        info.heroes.map(h => `<li>${esc(h)}</li>`).join('')
      }</ul></div>` : '';

  let monuments = [];
  if (info.monuments && info.monuments.length) monuments = info.monuments;
  else if (p.memory) monuments = [{ name: p.memory, note: '', photo: '' }];

  const memsec = monuments.length
    ? `<div class="detail-section"><h4>Памятные места</h4>${
        monuments.map(m => {
          const name = esc(m.name || '');
          const photoBlock = m.photo
            ? `<img class="monument-photo lightbox-img" src="${esc(m.photo)}"
                alt="${name}" data-lightbox="${esc(m.photo)}"
                data-caption="${name}" loading="lazy" onerror="this.outerHTML='<div class=\\'monument-photo\\'></div>'">`
            : `<div class="monument-photo"></div>`;
          return `
            <div class="monument">
              ${photoBlock}
              <div class="monument-text">
                <b>${name}</b>
                ${m.note ? `<span class="note">${esc(m.note)}</span>` : ''}
              </div>
            </div>
          `;
        }).join('')
      }</div>` : '';

  const muzei = (info.museums && info.museums.length)
    ? `<div class="detail-section"><h4>Музеи</h4><ul>${
        info.museums.map(m => {
          if (typeof m === 'string') return `<li>${esc(m)}</li>`;
          const name = esc(m.name || '');
          return m.url
            ? `<li><a href="${esc(m.url)}" target="_blank" rel="noopener noreferrer" style="color:#0b5ed7;text-decoration:none">${name}</a></li>`
            : `<li>${name}</li>`;
        }).join('')
      }</ul></div>` : '';

  const srcs = Array.isArray(p.sources) ? p.sources.filter(s => s && s.url) : [];
  const srcsec = srcs.length
    ? `<div class="detail-section detail-src"><h4>Источники</h4>${
        srcs.map(s => {
          const label = s.label || s.url.replace(/^https?:\/\//, '').split('/')[0];
          return `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
        }).join('')
      }</div>` : '';

  detailview.innerHTML = `
    <button class="detail-back" id="back-btn">← Назад к списку</button>
    <div class="detail-body">
      <div class="detail-title">${esc(p.title)}</div>
      <div class="detail-date">${esc(p.date)}${p.operation ? ' · ' + esc(p.operation) : ''}</div>
      ${cityimg}
      ${intro}
      ${opsec}
      ${geroi}
      ${memsec}
      ${muzei}
      ${srcsec}
    </div>
  `;

  document.getElementById('back-btn').addEventListener('click', () => {
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
  setTimeout(() => pin.classList.remove('pulse'), 1000);
}

function zapuskslider() {
  if (!daty.length) {
    console.warn('[слайдер] нет дат — шкала пуста');
    return;
  }
  const last = daty.length - 1;

  rangelow.min = 0;
  rangelow.max = last;
  rangelow.value = 0;

  rangehigh.min = 0;
  rangehigh.max = last;
  rangehigh.value = last;

  lowidx = 0;
  highidx = last;
  sliderready = true;

  primenitrange();

  console.log('[слайдер] запущен, шагов:', daty.length,
    '->', formatdate(daty[0]), '..', formatdate(daty[last]));
}

function primenitrange() {
  if (!sliderready) return;

  const last = daty.length - 1;

  if (lowidx > highidx) {
    const tmp = lowidx; lowidx = highidx; highidx = tmp;
  }
  if (lowidx < 0) lowidx = 0;
  if (highidx > last) highidx = last;
  if (highidx - lowidx < 1) {
    if (lowidx === 0) highidx = 1;
    else lowidx = highidx - 1;
  }

  const total = last || 1;
  const l = (lowidx / total) * 100;
  const r = (highidx / total) * 100;
  rangefill.style.left = l + '%';
  rangefill.style.width = (r - l) + '%';

  datelow.textContent = formatdate(daty[lowidx]);
  datehigh.textContent = formatdate(daty[highidx]);

  rangelow.style.zIndex = 3;
  rangehigh.style.zIndex = 4;

  markerrecs.forEach(rec => {
    const idx = rec.dateidx;
    if (idx < 0) return;
    let op = 1;
    if (idx < lowidx) op = Math.max(minproz, 1 - (lowidx - idx) / zatuhanie);
    else if (idx > highidx) op = Math.max(minproz, 1 - (idx - highidx) / zatuhanie);
    rec.marker.setOpacity(op);
    rec.marker.options.opac = op;
  });

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
window.onrangeinput = onrangeinput;

function clustericon(cluster) {
  const children = cluster.getAllChildMarkers();
  const n = children.length;

  let r = 0, g = 0, b = 0, ops = 0;
  children.forEach(m => {
    const c = (m.options.pinclr || 'rgb(200,80,20)').match(/\d+/g);
    if (c) { r += +c[0]; g += +c[1]; b += +c[2]; }
    ops += (m.options.opac != null ? m.options.opac : 1);
  });
  r = Math.round(r / n);
  g = Math.round(g / n);
  b = Math.round(b / n);
  const op = Math.max(0.35, ops / n);

  const size = n < 10 ? 36 : n < 100 ? 44 : 52;

  return L.divIcon({
    html: `<div class="cluster-inner"
                 style="background:rgba(${r},${g},${b},0.85);
                        width:${size}px;height:${size}px;line-height:${size - 6}px;
                        opacity:${op}">${n}</div>`,
    className: 'cluster-wrap',
    iconSize: [size, size]
  });
}

function initkarta() {
  mapref = L.map('map', { zoomControl: true }).setView(mapcenter, mapzoom);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19
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
    .then(r => {
      if (!r.ok) throw new Error('belarus.json: ' + r.status);
      return r.json();
    })
    .then(geo => {
      granicref = L.geoJSON(geo, {
        style: () => granica,
        interactive: false
      });
      granicref.addTo(mapref);
      if (granicref.bringToBack) granicref.bringToBack();
      console.log('граница беларуси добавлена');
    })
    .catch(err => console.warn('граница не загрузилась:', err));
}

initlightbox();

Promise.all([
  fetch('points.json', { cache: 'no-store' }).then(r => {
    if (!r.ok) throw new Error('points.json: ' + r.status);
    return r.json();
  }),
  fetch('info.json', { cache: 'no-store' })
    .then(r => r.ok ? r.json() : {})
    .catch(() => ({}))
]).then(([points, info]) => {
  pointdata = points;
  infodata = info || {};

  sobratdaty(points);
  initkarta();
  initgranica();

  const markers = [];
  points.forEach(p => {
    if (typeof p.lat !== 'number' || typeof p.lng !== 'number') return;
    const d = parsedate(p.date);
    const dateidx = dateindex(d);

    const mk = L.marker([p.lat, p.lng], {
      icon: pinicon(p.date, p.title),
      title: p.title,
      riseOnHover: true,
      pinclr: colorfordate(p.date),
      opac: 1
    });

    mk.bindPopup(makepopup(p), {
      maxWidth: 360,
      minWidth: 320,
      closeButton: true,
      autoPanPadding: [40, 40]
    });

    markerrecs.push({ marker: mk, point: p, dateidx });
    markers.push(mk);
  });

  clusterref.addLayers(markers);

  zapuskslider();

  rangelow.addEventListener('input', () => onrangeinput('lo'));
  rangehigh.addEventListener('input', () => onrangeinput('hi'));

  risuemspisok('');
}).catch(err => {
  console.error(err);
  mapref = L.map('map').setView(mapcenter, mapzoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }).addTo(mapref);
});

sinput.addEventListener('input', () => {
  const v = sinput.value;
  sclear.hidden = !v;
  risuemspisok(v);
});

sclear.addEventListener('click', () => {
  sinput.value = '';
  sclear.hidden = true;
  risuemspisok('');
  sinput.focus();
});

listview.addEventListener('click', e => {
  const item = e.target.closest('.city-item');
  if (!item) return;
  const id = +item.dataset.id;
  const rec = markerrecs.find(r => r.point.id === id);
  if (!rec) return;

  otkrytgorod(id);

  if (mapref) {
    mapref.flyTo([rec.point.lat, rec.point.lng], Math.max(mapref.getZoom(), 9), { duration: 0.6 });
    setTimeout(() => pulsmaker(rec.marker), 650);
  }
});
const zatuhanie = 2;

const mecjacy = {
  'января': 0, 'февраля': 1, 'марта': 2, 'апреля': 3,
  'мая': 4, 'июня': 5, 'июля': 6, 'августа': 7,
  'сентября': 8, 'октября': 9, 'ноября': 10, 'декабря': 11
};
const dayms = 86400000;

const granica = {
  color: '#000000',
  weight: 2,
  opacity: 0.75,
  fillColor: '#b30000',
  fillOpacity: 0.04,
  dashArray: '4 4'
};

let mapref, clusterref, granicref;
let pointdata = [];
let infodata = {};
let daty = [];
let markerrecs = [];
let activecity = null;
let lowidx = 0, highidx = 0;
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
  return `${date.getDate()} ${names[date.getMonth()]} ${date.getFullYear()}`;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

function nechotko(query, target) {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase();
  if (!q) return 1;
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
  points.forEach(p => {
    const d = parsedate(p.date);
    if (!d) return;
    const t = d.getTime();
    if (!(t in uniq)) uniq[t] = d;
  });
  daty = Object.keys(uniq).map(k => uniq[k]).sort((a, b) => a - b);
  console.log('[карта] уникальных дат:', daty.length,
    daty.length ? 'с ' + formatdate(daty[0]) + ' по ' + formatdate(daty[daty.length - 1]) : '');
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
  if (!d || daty.length < 2) return `rgb(${orange.join(',')})`;

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
  return `rgb(${r},${g},${b})`;
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
    html: `<div class="${cls}" style="--pin:${color}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size]
  });
}

function makepopup(p) {
  const cityimg = p.photo && p.photo !== '#'
    ? `<img class="popup-img" src="${esc(p.photo)}" alt="${esc(p.title)}" onerror="this.remove()">` : '';
  const memimg = p.memoryPhoto && p.memoryPhoto !== '#'
    ? `<img class="popup-img" src="${esc(p.memoryPhoto)}" alt="Памятник — ${esc(p.title)}" onerror="this.remove()">` : '';
  const mem = p.memory ? `<div class="popup-memory">${esc(p.memory)}</div>` : '';

  const srcs = Array.isArray(p.sources) ? p.sources.filter(s => s && s.url) : [];
  const srchtml = srcs.length
    ? `<div class="popup-src">${srcs.map(s => {
        const label = s.label || s.url.replace(/^https?:\/\//, '').split('/')[0];
        return `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
      }).join('')}</div>`
    : '';

  return `
    <div class="popup-title">${esc(p.title)}</div>
    <div class="popup-date">${esc(p.date)}${p.operation ? ' · ' + esc(p.operation) : ''}</div>
    ${cityimg}
    <div class="popup-desc">${esc(p.description || '')}</div>
    ${memimg}
    ${mem}
    ${srchtml}
    <button class="popup-more" onclick="otkrytgorod(${p.id})">Подробнее</button>
  `;
}

function risuemspisok(query) {
  const q = (query || '').trim();
  let items = pointdata.slice();

  if (q) {
    items = items
      .map(p => ({ p, score: nechotko(q, p.title) }))
      .filter(o => o.score > 0.25)
      .sort((a, b) => b.score - a.score)
      .map(o => o.p);
  } else {
    items.sort((a, b) => {
      const da = parsedate(a.date), db = parsedate(b.date);
      if (da && db) return da - db;
      return 0;
    });
  }

  if (!items.length) {
    listview.innerHTML = `<div class="empty-state">Город не найден.<br>Попробуйте другое название.</div>`;
    return;
  }

  listview.innerHTML = items.map(p => {
    const info = infodata[p.id] || {};
    const thsrc = info.thumb || p.photo || '';
    const thumb = thsrc
      ? `<img src="${esc(thsrc)}" alt="" onerror="this.remove()">`
      : `<span>${esc(p.title[0] || '?')}</span>`;

    return `
      <div class="city-item" data-id="${p.id}">
        <div class="city-thumb">${thumb}</div>
        <div class="city-info">
          <div class="city-name">${esc(p.title)}</div>
          <div class="city-meta">${esc(p.operation || '')}</div>
          <div class="city-date">${esc(p.date)}</div>
        </div>
      </div>
    `;
  }).join('');
}

function risuemkartochku(id) {
  const p = pointdata.find(x => x.id === id);
  if (!p) return;
  const info = infodata[id] || {};

  const citysrc = info.photo || p.photo || '';
  const cityimg = citysrc
    ? `<img class="detail-photo" src="${esc(citysrc)}" alt="${esc(p.title)}" onerror="this.remove()">` : '';

  const intro = info.intro
    ? `<div class="detail-section"><h4>О городе</h4><p>${esc(info.intro)}</p></div>`
    : (p.description
        ? `<div class="detail-section"><h4>О городе</h4><p>${esc(p.description)}</p></div>`
        : '');

  const opsec = (p.operation || p.units)
    ? `<div class="detail-section"><h4>Освобождение</h4>
        ${p.date ? `<p><b>${esc(p.date)}</b></p>` : ''}
        ${p.operation ? `<p><b>Операция:</b> ${esc(p.operation)}</p>` : ''}
        ${p.units ? `<p><b>Войска:</b> ${esc(p.units)}</p>` : ''}
      </div>` : '';

  const geroi = (info.heroes && info.heroes.length)
    ? `<div class="detail-section"><h4>Герои</h4><ul>${
        info.heroes.map(h => `<li>${esc(h)}</li>`).join('')
      }</ul></div>` : '';

  let monuments = [];
  if (info.monuments && info.monuments.length) monuments = info.monuments;
  else if (p.memory) monuments = [{ name: p.memory, note: '' }];

  const memsec = monuments.length
    ? `<div class="detail-section"><h4>Памятные места</h4>${
        monuments.map(m => `
          <div class="monument">
            <div class="monument-photo" style="${m.photo ? `background-image:url('${esc(m.photo)}')` : ''}"></div>
            <div class="monument-text">
              <b>${esc(m.name || '')}</b>
              ${m.note ? `<span class="note">${esc(m.note)}</span>` : ''}
            </div>
          </div>
        `).join('')
      }</div>` : '';

  const muzei = (info.museums && info.museums.length)
    ? `<div class="detail-section"><h4>Музеи</h4><ul>${
        info.museums.map(m => {
          if (typeof m === 'string') return `<li>${esc(m)}</li>`;
          const name = esc(m.name || '');
          return m.url
            ? `<li><a href="${esc(m.url)}" target="_blank" rel="noopener noreferrer" style="color:#0b5ed7;text-decoration:none">${name}</a></li>`
            : `<li>${name}</li>`;
        }).join('')
      }</ul></div>` : '';

  const srcs = Array.isArray(p.sources) ? p.sources.filter(s => s && s.url) : [];
  const srcsec = srcs.length
    ? `<div class="detail-section detail-src"><h4>Источники</h4>${
        srcs.map(s => {
          const label = s.label || s.url.replace(/^https?:\/\//, '').split('/')[0];
          return `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
        }).join('')
      }</div>` : '';

  detailview.innerHTML = `
    <button class="detail-back" id="back-btn">← Назад к списку</button>
    <div class="detail-body">
      <div class="detail-title">${esc(p.title)}</div>
      <div class="detail-date">${esc(p.date)}${p.operation ? ' · ' + esc(p.operation) : ''}</div>
      ${cityimg}
      ${intro}
      ${opsec}
      ${geroi}
      ${memsec}
      ${muzei}
      ${srcsec}
    </div>
  `;

  document.getElementById('back-btn').addEventListener('click', () => {
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
  setTimeout(() => pin.classList.remove('pulse'), 1000);
}

function zapuskslider() {
  if (!daty.length) {
    console.warn('[слайдер] нет дат — шкала пуста');
    return;
  }
  const last = daty.length - 1;

  rangelow.min = 0;
  rangelow.max = last;
  rangelow.value = 0;

  rangehigh.min = 0;
  rangehigh.max = last;
  rangehigh.value = last;

  lowidx = 0;
  highidx = last;
  sliderready = true;

  primenitrange();

  console.log('[слайдер] запущен, шагов:', daty.length,
    '->', formatdate(daty[0]), '..', formatdate(daty[last]));
}

function primenitrange() {
  if (!sliderready) return;

  const last = daty.length - 1;

  if (lowidx > highidx) {
    const tmp = lowidx; lowidx = highidx; highidx = tmp;
  }
  if (lowidx < 0) lowidx = 0;
  if (highidx > last) highidx = last;
  if (highidx - lowidx < 1) {
    if (lowidx === 0) highidx = 1;
    else lowidx = highidx - 1;
  }

  const total = last || 1;
  const l = (lowidx / total) * 100;
  const r = (highidx / total) * 100;
  rangefill.style.left = l + '%';
  rangefill.style.width = (r - l) + '%';

  datelow.textContent = formatdate(daty[lowidx]);
  datehigh.textContent = formatdate(daty[highidx]);

  rangelow.style.zIndex = 3;
  rangehigh.style.zIndex = 4;

  markerrecs.forEach(rec => {
    const idx = rec.dateidx;
    if (idx < 0) return;
    let op = 1;
    if (idx < lowidx) op = Math.max(minproz, 1 - (lowidx - idx) / zatuhanie);
    else if (idx > highidx) op = Math.max(minproz, 1 - (idx - highidx) / zatuhanie);
    rec.marker.setOpacity(op);
    rec.marker.options.opac = op;
  });

  if (clusterref) clusterref.refreshClusters();
}

// обработчик движения ползунков
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
window.onrangeinput = onrangeinput;

function clustericon(cluster) {
  const children = cluster.getAllChildMarkers();
  const n = children.length;

  let r = 0, g = 0, b = 0, ops = 0;
  children.forEach(m => {
    const c = (m.options.pinclr || 'rgb(200,80,20)').match(/\d+/g);
    if (c) { r += +c[0]; g += +c[1]; b += +c[2]; }
    ops += (m.options.opac != null ? m.options.opac : 1);
  });
  r = Math.round(r / n);
  g = Math.round(g / n);
  b = Math.round(b / n);
  const op = Math.max(0.35, ops / n);

  const size = n < 10 ? 36 : n < 100 ? 44 : 52;

  return L.divIcon({
    html: `<div class="cluster-inner"
                 style="background:rgba(${r},${g},${b},0.85);
                        width:${size}px;height:${size}px;line-height:${size - 6}px;
                        opacity:${op}">${n}</div>`,
    className: 'cluster-wrap',
    iconSize: [size, size]
  });
}

function initkarta() {
  mapref = L.map('map', { zoomControl: true }).setView(mapcenter, mapzoom);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19
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
    .then(r => {
      if (!r.ok) throw new Error('belarus.json: ' + r.status);
      return r.json();
    })
    .then(geo => {
      granicref = L.geoJSON(geo, {
        style: () => granica,
        interactive: false
      });
      granicref.addTo(mapref);
      if (granicref.bringToBack) granicref.bringToBack();
      console.log('граница беларуси добавлена');
    })
    .catch(err => console.warn('граница не загрузилась:', err));
}

Promise.all([
  fetch('points.json', { cache: 'no-store' }).then(r => {
    if (!r.ok) throw new Error('points.json: ' + r.status);
    return r.json();
  }),
  fetch('info.json', { cache: 'no-store' })
    .then(r => r.ok ? r.json() : {})
    .catch(() => ({}))
]).then(([points, info]) => {
  pointdata = points;
  infodata = info || {};

  sobratdaty(points);
  initkarta();
  initgranica();

  const markers = [];
  points.forEach(p => {
    if (typeof p.lat !== 'number' || typeof p.lng !== 'number') return;
    const d = parsedate(p.date);
    const dateidx = dateindex(d);

    const mk = L.marker([p.lat, p.lng], {
      icon: pinicon(p.date, p.title),
      title: p.title,
      riseOnHover: true,
      pinclr: colorfordate(p.date),
      opac: 1
    });

    mk.bindPopup(makepopup(p), {
      maxWidth: 360,
      minWidth: 320,
      closeButton: true,
      autoPanPadding: [40, 40]
    });

    markerrecs.push({ marker: mk, point: p, dateidx });
    markers.push(mk);
  });

  clusterref.addLayers(markers);

  zapuskslider();

  rangelow.addEventListener('input', () => onrangeinput('lo'));
  rangehigh.addEventListener('input', () => onrangeinput('hi'));

  risuemspisok('');
}).catch(err => {
  console.error(err);
  mapref = L.map('map').setView(mapcenter, mapzoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }).addTo(mapref);
});

sinput.addEventListener('input', () => {
  const v = sinput.value;
  sclear.hidden = !v;
  risuemspisok(v);
});

sclear.addEventListener('click', () => {
  sinput.value = '';
  sclear.hidden = true;
  risuemspisok('');
  sinput.focus();
});

listview.addEventListener('click', e => {
  const item = e.target.closest('.city-item');
  if (!item) return;
  const id = +item.dataset.id;
  const rec = markerrecs.find(r => r.point.id === id);
  if (!rec) return;

  otkrytgorod(id);

  if (mapref) {
    mapref.flyTo([rec.point.lat, rec.point.lng], Math.max(mapref.getZoom(), 9), { duration: 0.6 });
    setTimeout(() => pulsmaker(rec.marker), 650);
  }
});
