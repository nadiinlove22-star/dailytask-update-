let currentUser = null;
let userName = '';
let tasks = [];
let progressData = {};

function getTodayDateString() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function getTodayKey() {
    const days = ['MIN', 'SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB'];
    return days[new Date().getDay()];
}

const DAYS = [
    { key: 'SEN', full: 'Senin', index: 1 },
    { key: 'SEL', full: 'Selasa', index: 2 },
    { key: 'RAB', full: 'Rabu', index: 3 },
    { key: 'KAM', full: 'Kamis', index: 4 },
    { key: 'JUM', full: 'Jumat', index: 5 },
    { key: 'SAB', full: 'Sabtu', index: 6 },
    { key: 'MIN', full: 'Minggu', index: 0 }
];

// SINKRONISASI KE SUPABASE CLOUD
async function saveData() {
    const syncBadge = document.getElementById('sync-status');
    if (!currentUser) return;

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
            console.error('Gagal sync ke Supabase:', error.message);
            if (syncBadge) syncBadge.innerText = "● Sync Error";
        } else {
            if (syncBadge) syncBadge.innerText = "● Cloud Synced";
        }
    } catch (err) {
        console.error('Error koneksi Supabase:', err);
        if (syncBadge) syncBadge.innerText = "● Offline";
    }
}

// MEMUAT DATA DARI SUPABASE CLOUD
async function loadDataFromSupabase(callback) {
    const syncBadge = document.getElementById('sync-status');
    
    if (!currentUser) {
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
        console.error('Error memuat data:', err);
        if (syncBadge) syncBadge.innerText = "● Offline";
    }

    if (callback) callback();
}

async function handleLogout() {
    if (confirm("Apakah Anda yakin ingin keluar dari akun?")) {
        await supabaseClient.auth.signOut();
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

function restoreFromInternalStorage(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const content = JSON.parse(e.target.result);
            if (content.tasks && content.progress) {
                tasks = content.tasks;
                progressData = content.progress;
                await saveData();
                updateUserInfo();
                renderTodoList();
                alert("Data berhasil dipulihkan!");
            } else { alert("Format file JSON tidak valid."); }
        } catch (err) { alert("Gagal membaca file."); }
        event.target.value = '';
    };
    reader.readAsText(file);
}

async function resetAllData() {
    if (confirm("PERINGATAN: Semua data akun ini di Supabase dan lokal akan dihapus!")) {
        if (confirm("Yakin ingin melanjutkan?")) {
            if (currentUser) {
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
