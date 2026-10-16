let currentUser = null;
let userName = '';
let tasks = [];
let progressData = {};

async function saveData() {
    const syncBadge = document.getElementById('sync-status');
    if (!currentUser || !supabaseClient) return false;

    if (syncBadge) syncBadge.innerText = "● Syncing...";

    try {
        const { error } = await supabaseClient
            .from('user_data')
            .upsert({ 
                user_id: currentUser.id, 
                user_name: userName || currentUser.email.split('@')[0], 
                tasks: tasks, 
                progress_data: progressData,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

        if (error) {
            console.error('Gagal sync:', error.message);
            if (syncBadge) syncBadge.innerText = "● Sync Error";
            return false;
        } else {
            if (syncBadge) syncBadge.innerText = "● Cloud Synced";
            return true;
        }
    } catch (err) {
        if (syncBadge) syncBadge.innerText = "● Offline";
        return false;
    }
}

async function loadDataFromSupabase(callback) {
    const syncBadge = document.getElementById('sync-status');
    
    if (!currentUser || !supabaseClient) {
        tasks = [];
        progressData = {};
        if (syncBadge) syncBadge.innerText = "● Belum Login";
        if (callback) callback();
        return;
    }

    if (syncBadge) syncBadge.innerText = "● Loading...";

    try {
        let { data, error } = await supabaseClient
            .from('user_data')
            .select('*')
            .eq('user_id', currentUser.id)
            .maybeSingle();

        if (data) {
            tasks = data.tasks || [];
            progressData = data.progress_data || {};
            userName = data.user_name || currentUser.email.split('@')[0];
            if (syncBadge) syncBadge.innerText = "● Cloud Synced";
        } else {
            tasks = [];
            progressData = {};
            userName = currentUser.email.split('@')[0];
            await saveData();
        }
    } catch (err) {
        if (syncBadge) syncBadge.innerText = "● Offline";
    }

    if (callback) callback();
}

async function handleLogout() {
    if (confirm("Apakah Anda yakin ingin keluar dari akun?")) {
        if (supabaseClient) {
            await supabaseClient.auth.signOut();
        }
        currentUser = null;
        userName = '';
        tasks = [];
        progressData = {};
        location.reload();
    }
}

function backupToInternalStorage() {
    const backupData = { user: currentUser ? currentUser.email : 'Guest', tasks: tasks, progress: progressData, backupTime: new Date().toISOString() };
    try {
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `DayliDo_Backup_${getTodayDateString()}.json`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    } catch (err) {
        alert("Gagal backup: " + err.message);
    }
}

async function restoreFromInternalStorage(event) {
    const file = event && event.target && event.target.files && event.target.files[0];
    if (!file) return;
    const input = event.target;
    try {
        if (!currentUser || !supabaseClient) throw new Error('Login terlebih dahulu agar pemulihan dapat disimpan ke akun cloud.');
        const content = JSON.parse(await file.text());
        if (!content || !Array.isArray(content.tasks) || !content.progress || typeof content.progress !== 'object' || Array.isArray(content.progress)) {
            throw new Error('Format backup tidak cocok. Gunakan file JSON dari fitur Backup Daily Task.');
        }
        if (!confirm('Pulihkan ' + content.tasks.length + ' tugas dan riwayat progres dari backup? Data saat ini akan diganti.')) return;
        const previous = { tasks, progressData };
        tasks = content.tasks;
        progressData = content.progress;
        const saved = await saveData();
        if (currentUser && supabaseClient && saved !== true) {
            tasks = previous.tasks;
            progressData = previous.progressData;
            throw new Error('Backup gagal disimpan ke cloud. Data sebelumnya dikembalikan; periksa koneksi dan coba lagi.');
        }
        updateUserInfo();
        renderDaysBar();
        changeDay(selectedDay);
        if (typeof renderNotes === 'function') renderNotes();
        if (typeof renderStatsTab === 'function') renderStatsTab();
        if (typeof renderDashboard === 'function') renderDashboard();
        if (typeof renderFocusTab === 'function') renderFocusTab();
        alert('Pemulihan selesai: ' + tasks.length + ' tugas dan riwayat progres berhasil dimuat.');
    } catch (err) {
        alert('Pemulihan gagal: ' + (err && err.message ? err.message : 'File tidak bisa dibaca.'));
    } finally {
        if (input) input.value = '';
    }
}

async function resetAllData() {
    if (confirm("PERINGATAN: Semua data akun ini di Supabase dan lokal akan dihapus!")) {
        if (confirm("Yakin ingin melanjutkan?")) {
            if (currentUser && supabaseClient) {
                await supabaseClient.from('user_data').delete().eq('user_id', currentUser.id);
            }
            localStorage.clear();
            location.reload();
        }
    }
}

function isTaskActiveForDate(task, dateStr) {
    if (!task) return false;
    const targetDate = new Date(dateStr);
    const dayIndex = targetDate.getDay();
    const freq = task.freq || 'daily';

    if (freq === 'daily') return true;
    if (freq === 'weekly') return parseInt(task.freqVal) === dayIndex;
    if (freq === 'monthly') return parseInt(task.freqVal) === targetDate.getDate();
    if (freq === 'specific_date') return task.freqVal === dateStr;
    if (freq === 'custom_day') {
        const activeDays = task.freqVal ? task.freqVal.toString().split(',').map(Number) : [];
        return activeDays.includes(dayIndex);
    }
    return true;
}

function isTaskActiveForSelectedDay(task) {
    const dateStr = getSelectedDateString();
    return isTaskActiveForDate(task, dateStr);
}
