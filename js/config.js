// PWA Manifest Configuration
const manifestData = {
    "name": "DayliDo - Daily Todo List",
    "short_name": "DayliDo",
    "start_url": ".",
    "display": "standalone",
    "background_color": "#0b1329",
    "theme_color": "#0b1329",
    "description": "Aplikasi Todo List Harian Produktivitas",
    "icons": [{ "src": "https://img.icons8.com/color/512/todo-list.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }]
};
const manifestString = JSON.stringify(manifestData);
const manifestBlob = new Blob([manifestString], {type: 'application/json'});
document.getElementById('manifest-placeholder').setAttribute('href', URL.createObjectURL(manifestBlob));

const DAYS = [
    { key: 'Sen', full: 'SENIN', index: 1 },
    { key: 'Sel', full: 'SELASA', index: 2 },
    { key: 'Rab', full: 'RABU', index: 3 },
    { key: 'Kam', full: 'KAMIS', index: 4 },
    { key: 'Jum', full: 'JUMAT', index: 5 },
    { key: 'Sab', full: 'SABTU', index: 6 },
    { key: 'Min', full: 'MINGGU', index: 0 }
];

function getTodayKey() {
    const dayNum = new Date().getDay();
    const found = DAYS.find(d => d.index === dayNum);
    return found ? found.key : 'Sen';
}

function getTodayDateString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
