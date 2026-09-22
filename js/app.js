function initApp() {
    selectedDay = getTodayKey();
    
    // Set Tanggal di Header
    const now = new Date();
    const dateTextEl = document.getElementById('current-date-text');
    if (dateTextEl) {
        dateTextEl.innerText = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
    }
    
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now - start) / (1000 * 60 * 60 * 24));
    const doyEl = document.getElementById('day-of-year-text');
    if (doyEl) {
        doyEl.innerText = `Hari ke-${dayOfYear} dari 365`;
    }

    // Inisialisasi Tampilan & Data
    updateUserInfo();
    renderDaysBar();

    if (!userName) {
        openLoginModal();
    } else {
        loadDataFromSupabase(() => {
            updateUserInfo();
            changeDay(selectedDay);
            switchTab('tasks');
            
            const cp = document.getElementById('calendar-date-picker');
            if (cp) cp.value = getTodayDateString();
        });
    }
}

window.onload = initApp;
