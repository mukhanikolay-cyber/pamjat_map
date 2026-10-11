const map = L.map('map', {
    zoomControl: true,
    attributionControl: true
}).setView([53.9, 27.5], 6);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
}).addTo(map);

const defaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

fetch('points.json')
    .then(response => {
        if (!response.ok) throw new Error('Не удалось загрузить points.json');
        return response.json();
    })
    .then(points => {
        points.forEach(point => {
            const marker = L.marker([point.lat, point.lng], {
                icon: defaultIcon,
                title: point.title,
                riseOnHover: true 
            }).addTo(map);

            const linkHtml = point.link
                ? `<br><a href="${point.link}" target="_blank" rel="noopener">Подробнее →</a>`
                : '';

            marker.bindPopup(`
                <div style="min-width: 180px; max-width: 260px; font-family: system-ui, sans-serif;">
                    <strong style="font-size: 15px;">${point.title}</strong><br>
                    <em style="color: #666;">${point.date}</em>
                    <hr style="margin: 6px 0; border: none; border-top: 1px solid #eee;">
                    <div>${point.description || ''}</div>
                    ${point.memory ? `<small style="color: #777;">${point.memory}</small>` : ''}
                    ${linkHtml}
                </div>
            `);
        });
    })
    .catch(error => console.error('Ошибка загрузки данных:', error));
