const map = L.map('map').setView([53.9, 27.5], 6);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
}).addTo(map);

function getColor(dateStr) {
    const parts = dateStr.split(' ');
    const d = new Date(parts[2] + '-' + parts[1] + '-' + parts[0]);
    const start = new Date('1943-09-23');
    const end = new Date('1944-07-28');
    const ratio = Math.min(1, Math.max(0, (d - start) / (end - start)));
    const r = 255;
    const g = Math.round(120 * (1 - ratio));
    const b = 0;
    return `rgb(${r}, ${g}, ${b})`;
}

function createIcon(date) {
    const color = getColor(date);
    return L.divIcon({
        className: 'custom-marker',
        html: `<div style="background: ${color}; width: 22px; height: 22px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2px solid #fff; box-shadow: 0 0 6px rgba(0,0,0,.4); position: relative;"><div style="content: ''; position: absolute; inset: 5px; background: #fff; border-radius: 50%;"></div></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 22],
        popupAnchor: [0, -22]
    });
}

fetch('points.json')
    .then(r => r.json())
    .then(points => {
        points.forEach(p => {
            const icon = createIcon(p.date);
            const marker = L.marker([p.lat, p.lng], { icon, title: p.title }).addTo(map);

            const imgCity = p.photo ? `<img class="popup-img" src="${p.photo}" alt="${p.title}">` : '';
            const imgMem = p.memoryPhoto ? `<img class="popup-img" src="${p.memoryPhoto}" alt="Мемориал ${p.title}">` : '';

            let sourcesHtml = '';
            if (p.sources && p.sources.length) {
                sourcesHtml = '<div class="popup-sources"><strong>Источники:</strong>';
                p.sources.forEach(s => {
                    sourcesHtml += `<a href="${s}" target="_blank">${s}</a>`;
                });
                sourcesHtml += '</div>';
            }

            const popupContent = `
                <div class="popup-title">${p.title}</div>
                <div class="popup-date">${p.date}</div>
                ${imgCity}
                <div class="popup-desc">${p.description}</div>
                ${imgMem}
                <div class="popup-memory">${p.memory}</div>
                ${sourcesHtml}
            `;

            marker.bindPopup(popupContent, { maxWidth: 360 });

            marker.on('mouseover', function () {
                this.openPopup();
            });
            marker.on('mouseout', function () {
                this.closePopup();
            });
        });
    })
    .catch(err => console.error('Ошибка загрузки данных:', err));
