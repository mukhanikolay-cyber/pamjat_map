const map = L.map('map').setView([53.9, 27.5], 6);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const points = [
    {
        lat: 51.4333,
        lng: 30.5833,
        title: "Комарин",
        date: "23 сентября 1943",
        description: "Первый освобождённый районный центр Беларуси.",
        link: "#" // ссылку на видео или фото
    },
    {
        lat: 52.4414,
        lng: 30.9971,
        title: "Гомель",
        date: "26 ноября 1943",
        description: "Освобождён в ходе Гомельско-Речицкой операции.",
        link: "#"
    },
    {
        lat: 53.9022,
        lng: 27.5618,
        title: "Минск",
        date: "3 июля 1944",
        description: "Освобождён в ходе операции «Багратион».",
        link: "#"
    }
];

// маркеры
points.forEach(point => {
    const marker = L.marker([point.lat, point.lng]).addTo(map);

    marker.bindPopup(`
        <strong>${point.title}</strong><br>
        <em>${point.date}</em><br>
        ${point.description}<br>
        <a href="${point.link}" target="_blank">Подробнее</a>
    `);
});