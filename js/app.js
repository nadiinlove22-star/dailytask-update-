async function initApp() {
    selectedDay = getTodayKey();
    
    const now = new Date();
    const dateTextEl = document.getElementById('current-date-text');
    if (dateTextEl) {
        dateTextEl.innerText = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });
    }

    try {
        if (supabaseClient) {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (session && session.user) {
                currentUser = session.user;
                await loadDataFromSupabase(() => {
                    updateUserInfo();
                    renderDaysBar();
                    changeDay(selectedDay);
                    switchTab('tasks');
                });
            } else {
                updateUserInfo();
                renderDaysBar();
                openLoginModal();
            }
        } else {
            updateUserInfo();
            renderDaysBar();
            openLoginModal();
        }
    } catch (err) {
        console.error("Gagal inisialisasi sesi:", err);
        updateUserInfo();
        renderDaysBar();
        openLoginModal();
    }

    const calendarPicker = document.getElementById('calendar-date-picker');
    if (calendarPicker) calendarPicker.value = getTodayDateString();
}

window.onload = initApp;
