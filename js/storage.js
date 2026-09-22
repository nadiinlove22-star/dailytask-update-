let userName = localStorage.getItem('daylido_username') || 'DK';
let tasks = JSON.parse(localStorage.getItem('daylido_tasks')) || [];
let progressData = JSON.parse(localStorage.getItem('daylido_progress')) || {};

function saveData() {
    localStorage.setItem('daylido_tasks', JSON.stringify(tasks));
    localStorage.setItem('daylido_progress', JSON.stringify(progressData));
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
        alert("Backup berhasil diunduh!");
    } catch (err) {
        alert("Gagal backup: " + err.message);
    }
}

function restoreFromInternalStorage(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const content = JSON.parse(e.target.result);
            if (content.tasks && content.progress) {
                tasks = content.tasks;
                progressData = content.progress;
                if (content.user) { userName = content.user; localStorage.setItem('daylido_username', userName); }
                saveData();
                updateUserInfo();
                renderTodoList();
                alert("Data berhasil dipulihkan!");
            } else { alert("Format file salah."); }
        } catch (err) { alert("Gagal membaca file."); }
        event.target.value = '';
    };
    reader.readAsText(file);
}

function resetAllData() {
    if (confirm("PERINGATAN: Semua data dan tugas akan dihapus total!")) {
        if (confirm("Yakin ingin mengembalikan ke pengaturan awal?")) {
            localStorage.clear();
            location.reload();
        }
    }
}
