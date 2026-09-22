function initApp() {
    selectedDay = getTodayKey();
    updateUserInfo();
    
    // Set Tanggal Lengkap di Header
    const now = new Date();
    document.getElementById('current-date-text').innerText = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
    
    // Set Hari ke berapa dalam setahun
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now - start) / (1000 * 60 * 60 * 24));
    document.getElementById('day-of-year-text').innerText = `Hari ke-${dayOfYear} dari 365`;

    renderDaysBar();
    changeDay(selectedDay);
    switchTab('tasks');
    
    const cp = document.getElementById('calendar-date-picker');
    if (cp) cp.value = getTodayDateString();
}

// Jalankan aplikasi saat halaman selesai dimuat
window.onload = initApp;
