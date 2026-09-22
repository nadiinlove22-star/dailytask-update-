let userName = localStorage.getItem('daylido_username') || 'DK';
let tasks = [];
let progressData = {};

function getUserId() {
    return userName.toLowerCase().trim().replace(/\s+/g, '_');
}

// AUTO-SAVE KE SUPABASE DATABASE
async function saveData() {
    localStorage.setItem('daylido_username', userName);
    const userId = getUserId();
    
    try {
        const { error } = await supabaseClient
            .from('user_data')
            .upsert({ 
                user_id: userId, 
                user_name: userName, 
                tasks: tasks, 
                progress_data: progressData,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

        if (error) console.error('Gagal simpan ke Supabase:', error.message);
    } catch (err) {
        console.error('Error koneksi Supabase:', err);
    }
}

// AMBIL DATA DARI SUPABASE DATABASE
async function loadDataFromSupabase(callback) {
    const userId = getUserId();
    
    try {
        let { data, error } = await supabaseClient
            .from('user_data')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (data) {
            tasks = data.tasks || [];
            progressData = data.progress_data || {};
            if (data.user_name) userName = data.user_name;
        } else {
            await saveData();
        }
    } catch (err) {
        console.log('Pengguna baru / menggunakan data awal');
    }

    if (callback) callback();
}

function backupToInternalStorage() {
    const backupData = { user: userName, tasks: tasks, progress: progressData, backupTime: new Date().toISOString() };
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
                if (content.user) userName = content.user;
                await saveData();
                updateUserInfo();
                renderTodoList();
                alert("Data berhasil dipulihkan & sinkron ke Supabase!");
            } else { alert("Format file JSON tidak valid."); }
        } catch (err) { alert("Gagal membaca file."); }
        event.target.value = '';
    };
    reader.readAsText(file);
}

async function resetAllData() {
    if (confirm("PERINGATAN: Semua data di Supabase dan lokal akan dihapus total!")) {
        if (confirm("Yakin ingin menghapus seluruh data?")) {
            const userId = getUserId();
            await supabaseClient.from('user_data').delete().eq('user_id', userId);
            localStorage.clear();
            location.reload();
        }
    }
}
