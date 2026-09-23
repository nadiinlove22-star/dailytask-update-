let selectedDay = getTodayKey();
let isRegisterMode = false;

function toggleAuthMode() {
    isRegisterMode = !isRegisterMode;
    const title = document.getElementById('auth-modal-title');
    const subtitle = document.getElementById('auth-modal-subtitle');
    const btn = document.getElementById('auth-submit-btn');
    const toggleText = document.getElementById('auth-toggle-text');

    if (isRegisterMode) {
        if (title) title.innerText = "Buat Akun Baru";
        if (subtitle) subtitle.innerText = "Daftar email dan password untuk menyimpan tugas kamu.";
        if (btn) btn.innerText = "Daftar & Masuk";
        if (toggleText) toggleText.innerHTML = `Sudah punya akun? <button type="button" onclick="toggleAuthMode()" class="text-emerald-400 font-semibold hover:underline">Masuk</button>`;
    } else {
        if (title) title.innerText = "Masuk ke Akun";
        if (subtitle) subtitle.innerText = "Masukkan email dan password untuk sync data.";
        if (btn) btn.innerText = "Masuk";
        if (toggleText) toggleText.innerHTML = `Belum punya akun? <button type="button" onclick="toggleAuthMode()" class="text-emerald-400 font-semibold hover:underline">Daftar</button>`;
    }
}

async function handleAuthSubmit(event) {
    event.preventDefault();

    const emailInput = document.getElementById('auth-email');
    const passwordInput = document.getElementById('auth-password');
    const submitBtn = document.getElementById('auth-submit-btn');

    const email = emailInput ? emailInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value.trim() : '';

    if (!email || !password) {
        alert("Email dan password wajib diisi!");
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = "Memproses...";
    }

    try {
        if (isRegisterMode) {
            const { data, error } = await supabaseClient.auth.signUp({ email, password });

            if (error) throw error;

            alert("Pendaftaran berhasil! Kamu otomatis masuk.");
            currentUser = data.user;
        } else {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            currentUser = data.user;
        }

        closeLoginModal();

        await loadDataFromSupabase(() => {
            updateUserInfo();
            renderDaysBar();
            changeDay(selectedDay);
            switchTab('tasks');
        });

    } catch (err) {
        alert("Gagal autentikasi: " + err.message);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = isRegisterMode ? "Daftar & Masuk" : "Masuk";
        }
    }
}


function getSelectedDateString() {
    const today = new Date();
    const currentDayIndex = today.getDay();

    const selectedObj = DAYS.find(d => d.key === selectedDay);
    const targetIndex = selectedObj ? selectedObj.index : currentDayIndex;

    let diff = targetIndex - currentDayIndex;

    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + diff);

    return `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
}


function updateUserInfo() {
    const nameDisplay = currentUser
        ? `Hey, ${userName || currentUser.email.split('@')[0]}!`
        : 'Belum Login';

    const initial = currentUser
        ? (userName || currentUser.email).charAt(0).toUpperCase()
        : '?';

    const userDisplayEl = document.getElementById('user-name-display');

    if (userDisplayEl) {
        userDisplayEl.innerText = nameDisplay;
    }

    const avatarEl = document.getElementById('user-avatar');

    if (avatarEl) {
        avatarEl.innerText = initial;
    }

    const settingsDisplay = document.getElementById('settings-user-name-display');

    if (settingsDisplay) {
        settingsDisplay.innerText = currentUser
            ? `Akun: ${currentUser.email}`
            : 'Belum Terhubung Akun';
    }
}


function openLoginModal() {
    const modal = document.getElementById('login-modal');

    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}


function closeLoginModal() {
    const modal = document.getElementById('login-modal');

    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}


function renderDaysBar() {
    const container = document.getElementById('days-bar');

    if (!container) return;

    container.innerHTML = '';

    const todayKey = getTodayKey();

    DAYS.forEach(day => {
        const isActive = day.key === selectedDay;
        const isToday = day.key === todayKey;

        const btn = document.createElement('button');

        btn.onclick = () => changeDay(day.key);

        btn.className = `flex flex-col items-center justify-center py-1.5 rounded-lg text-[10px] font-semibold transition ${
            isActive
                ? 'bg-emerald-500/20 border border-emerald-500/60 text-emerald-400 shadow'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
        }`;

        btn.innerHTML = `
            <div class="w-2 h-2 rounded-full mb-1 ${
                isActive
                    ? 'bg-emerald-400'
                    : (isToday ? 'bg-blue-400' : 'bg-slate-700')
            }"></div>
            <span>${day.key}</span>
        `;

        container.appendChild(btn);
    });
}


function changeDay(dayKey) {
    selectedDay = dayKey;

    const dayObj = DAYS.find(d => d.key === dayKey);

    const titleEl = document.getElementById('day-title');

    if (dayObj && titleEl) {
        titleEl.innerText = `PRODUKTIVITAS ${dayObj.full}`;
    }

    renderDaysBar();
    renderTodoList();
}


function renderTodoList() {
    const container = document.getElementById('todo-list');

    if (!container) return;

    container.innerHTML = '';

    if (!currentUser) {
        container.innerHTML = `
            <div class="text-center py-8 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                Silakan login atau daftar di tombol kanan atas untuk melihat & menyimpan tugas.
            </div>
        `;

        return;
    }

    const dateStr = getSelectedDateString();
    const dayProgress = progressData[dateStr] || {};

    let visibleTasks = tasks.filter(t => isTaskActiveForSelectedDay(t));

    let completedCount = 0;

    if (visibleTasks.length === 0) {
        container.innerHTML = `
            <div class="text-center py-6 text-xs text-slate-500">
                Belum ada tugas di hari ini. Klik tombol Tambah Tugas Baru.
            </div>
        `;
    }

    visibleTasks.forEach((task, index) => {
        const currentVal = dayProgress[task.id] || 0;

        const isCompleted = currentVal >= task.target;

        if (isCompleted) {
            completedCount++;
        }

        const card = document.createElement('div');

        card.className = `
            bg-slate-800/60
            border border-slate-700/50
            rounded-xl
            p-2
            flex
            items-center
            justify-between
            gap-1.5
            shadow-sm
            transition
            hover:border-slate-600
            ${isCompleted ? 'bg-slate-800/30' : ''}
        `;

        card.innerHTML = `
            <div class="flex items-center gap-1.5 flex-1 min-w-0">

                <div class="flex flex-col gap-0.5">

                    <button
                        onclick="moveTaskUp(${task.id})"
                        class="w-4 h-3 bg-slate-700/85 hover:bg-slate-600 text-slate-200 rounded-[3px] text-[8px] flex items-center justify-center font-bold transition"
                    >
                        ▲
                    </button>

                    <button
                        onclick="moveTaskDown(${task.id})"
                        class="w-4 h-3 bg-slate-700/85 hover:bg-slate-600 text-slate-200 rounded-[3px] text-[8px] flex items-center justify-center font-bold transition"
                    >
                        ▼
                    </button>

                </div>

                <button
                    onclick="toggleCheck(${task.id})"
                    class="flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                        isCompleted
                            ? 'bg-emerald-500 border-emerald-500 text-slate-950 font-bold text-xs'
                            : 'border-slate-600 hover:border-emerald-400'
                    }"
                >
                    ${isCompleted ? '✓' : ''}
                </button>

                <div class="flex-1 min-w-0">
                    <p class="text-xs font-medium text-slate-200 truncate ${
                        isCompleted ? 'line-through text-slate-500' : ''
                    }">
                        ${task.title}
                    </p>
                </div>

            </div>

            <div class="flex items-center gap-1 flex-shrink-0">

                <button
                    onclick="decrementTask(${task.id})"
                    class="w-6 h-6 rounded bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-xs hover:bg-slate-600"
                >
                    -
                </button>

                <button
                    onclick="manualSetCount(${task.id}, ${currentVal}, ${task.target})"
                    class="bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-300 hover:border-emerald-500"
                >
                    ${task.target === 1
                        ? (isCompleted ? 'Selesai' : '0/1')
                        : `${currentVal}/${task.target}`}
                </button>

                <button
                    onclick="incrementTask(${task.id}, ${task.target})"
                    class="w-6 h-6 rounded bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold text-xs hover:bg-emerald-500 hover:text-white"
                >
                    +
                </button>

                <button
                    onclick="openEditModal(${task.id})"
                    class="p-1 text-slate-500 hover:text-slate-300 text-xs"
                >
                    ✏️
                </button>

                <button
                    onclick="deleteTask(${task.id}, '${task.title.replace(/'/g, "\\'")}')"
                    class="p-1 text-slate-500 hover:text-rose-400 text-xs"
                >
                    🗑️
                </button>

            </div>
        `;

        container.appendChild(card);
    });

    const totalTasks = visibleTasks.length;

    const percent = totalTasks === 0
        ? 0
        : Math.round((completedCount / totalTasks) * 100);

    const pctEl = document.getElementById('percent-text');

    if (pctEl) {
        pctEl.innerText = `${percent}%`;
    }

    const barEl = document.getElementById('progress-bar');

    if (barEl) {
        barEl.style.width = `${percent}%`;
    }

    const countEl = document.getElementById('tasks-count-text');

    if (countEl) {
        countEl.innerText = `${completedCount} dari ${totalTasks} tugas selesai`;
    }
}


/* =========================================================
   REORDER TASK
   ========================================================= */

function getVisibleTasksForReorder() {
    // Daftar ini SAMA dengan daftar yang tampil di renderTodoList()
    return tasks.filter(t => isTaskActiveForSelectedDay(t));
}


function moveTaskUp(taskId) {
    const visibleTasks = getVisibleTasksForReorder();

    // Cari tugas berdasarkan ID
    const currentIndex = visibleTasks.findIndex(
        task => task.id === taskId
    );

    // Tidak ditemukan atau sudah paling atas
    if (currentIndex <= 0) {
        return;
    }

    const currentTask = visibleTasks[currentIndex];
    const targetTask = visibleTasks[currentIndex - 1];

    // Cari posisi asli di array tasks
    const currentMainIndex = tasks.findIndex(
        task => task.id === currentTask.id
    );

    const targetMainIndex = tasks.findIndex(
        task => task.id === targetTask.id
    );

    if (currentMainIndex === -1 || targetMainIndex === -1) {
        return;
    }

    // Tukar posisi kedua tugas
    const temp = tasks[currentMainIndex];

    tasks[currentMainIndex] = tasks[targetMainIndex];
    tasks[targetMainIndex] = temp;

    // Simpan perubahan
    saveData();

    // Render ulang
    renderTodoList();
}


function moveTaskDown(taskId) {
    const visibleTasks = getVisibleTasksForReorder();

    // Cari tugas berdasarkan ID
    const currentIndex = visibleTasks.findIndex(
        task => task.id === taskId
    );

    // Tidak ditemukan atau sudah paling bawah
    if (
        currentIndex === -1 ||
        currentIndex >= visibleTasks.length - 1
    ) {
        return;
    }

    const currentTask = visibleTasks[currentIndex];
    const targetTask = visibleTasks[currentIndex + 1];

    // Cari posisi asli di array tasks
    const currentMainIndex = tasks.findIndex(
        task => task.id === currentTask.id
    );

    const targetMainIndex = tasks.findIndex(
        task => task.id === targetTask.id
    );

    if (currentMainIndex === -1 || targetMainIndex === -1) {
        return;
    }

    // Tukar posisi kedua tugas
    const temp = tasks[currentMainIndex];

    tasks[currentMainIndex] = tasks[targetMainIndex];
    tasks[targetMainIndex] = temp;

    // Simpan perubahan
    saveData();

    // Render ulang
    renderTodoList();
}


/* =========================================================
   TASK PROGRESS
   ========================================================= */

function toggleCheck(taskId) {
    const dateStr = getSelectedDateString();

    const task = tasks.find(t => t.id === taskId);

    if (!task) return;

    if (!progressData[dateStr]) {
        progressData[dateStr] = {};
    }

    const current = progressData[dateStr][taskId] || 0;

    progressData[dateStr][taskId] =
        (current >= task.target)
            ? 0
            : task.target;

    saveData();
    renderTodoList();
}


function incrementTask(taskId, target) {
    const dateStr = getSelectedDateString();

    if (!progressData[dateStr]) {
        progressData[dateStr] = {};
    }

    const current = progressData[dateStr][taskId] || 0;

    if (current < target) {
        progressData[dateStr][taskId] = current + 1;
    }

    saveData();
    renderTodoList();
}


function decrementTask(taskId) {
    const dateStr = getSelectedDateString();

    if (!progressData[dateStr]) {
        progressData[dateStr] = {};
    }

    const current = progressData[dateStr][taskId] || 0;

    if (current > 0) {
        progressData[dateStr][taskId] = current - 1;
    }

    saveData();
    renderTodoList();
}


function manualSetCount(taskId, currentVal, target) {
    const dateStr = getSelectedDateString();

    const val = prompt(
        `Masukkan progres (0 - ${target}):`,
        currentVal
    );

    if (val !== null && !isNaN(val)) {
        let num = parseInt(val);

        if (num < 0) {
            num = 0;
        }

        if (!progressData[dateStr]) {
            progressData[dateStr] = {};
        }

        progressData[dateStr][taskId] = num;

        saveData();
        renderTodoList();
    }
}


/* =========================================================
   DELETE TASK
   ========================================================= */

function deleteTask(id, title) {
    if (confirm(`Hapus tugas "${title}"?`)) {

        tasks = tasks.filter(t => t.id !== id);

        saveData();
        renderTodoList();
    }
}


/* =========================================================
   RESET CURRENT DAY
   ========================================================= */

function resetCurrentDay() {
    const dateStr = getSelectedDateString();

    if (confirm("Reset progres hari ini saja? (Tugas tidak akan terhapus)")) {

        delete progressData[dateStr];

        saveData();
        renderTodoList();
    }
}


/* =========================================================
   ADD TASK
   ========================================================= */

function openAddModal() {
    if (!currentUser) {
        openLoginModal();
        return;
    }

    const inputTitle = document.getElementById('new-task-title');
    const inputTarget = document.getElementById('new-task-target');
    const inputFreq = document.getElementById('new-task-freq');
    const extraFreq = document.getElementById('new-freq-extra');

    if (inputTitle) {
        inputTitle.value = '';
    }

    if (inputTarget) {
        inputTarget.value = '1';
    }

    if (inputFreq) {
        inputFreq.value = 'daily';
    }

    if (extraFreq) {
        extraFreq.innerHTML = '';
        extraFreq.classList.add('hidden');
    }

    const modal = document.getElementById('add-modal');

    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}


function closeAddModal() {
    const modal = document.getElementById('add-modal');

    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}


function saveNewTask() {
    const titleEl = document.getElementById('new-task-title');
    const targetEl = document.getElementById('new-task-target');
    const freqEl = document.getElementById('new-task-freq');

    const title = titleEl
        ? titleEl.value.trim()
        : '';

    const target = targetEl
        ? (parseInt(targetEl.value) || 1)
        : 1;

    const freq = freqEl
        ? freqEl.value
        : 'daily';

    let freqVal = null;

    if (!title) {
        alert('Nama tugas tidak boleh kosong.');
        return;
    }

    if (
        freq === 'weekly' ||
        freq === 'monthly' ||
        freq === 'specific_date'
    ) {

        const el = document.getElementById('new-freq-val');

        if (el) {
            freqVal = el.value;
        }

    } else if (freq === 'custom_day') {

        let selectedDays = [];

        document
            .querySelectorAll('#new-custom-days-container input:checked')
            .forEach(cb => selectedDays.push(cb.value));

        if (selectedDays.length === 0) {
            alert('Pilih minimal satu hari.');
            return;
        }

        freqVal = selectedDays.join(',');
    }

    const newTask = {
        id: Date.now(),
        title,
        target,
        freq,
        freqVal
    };

    tasks.push(newTask);

    saveData();
    closeAddModal();
    renderTodoList();
}


/* =========================================================
   EDIT TASK
   ========================================================= */

function openEditModal(id) {
    const task = tasks.find(t => t.id === id);

    if (!task) return;

    const idEl = document.getElementById('edit-task-id');
    const titleEl = document.getElementById('edit-task-title');
    const targetEl = document.getElementById('edit-task-target');
    const freqEl = document.getElementById('edit-task-freq');

    if (idEl) {
        idEl.value = task.id;
    }

    if (titleEl) {
        titleEl.value = task.title;
    }

    if (targetEl) {
        targetEl.value = task.target;
    }

    if (freqEl) {
        freqEl.value = task.freq || 'daily';
    }

    handleFreqChange('edit');

    if (
        task.freq === 'weekly' ||
        task.freq === 'monthly' ||
        task.freq === 'specific_date'
    ) {

        const el = document.getElementById('edit-freq-val');

        if (el) {
            el.value = task.freqVal;
        }

    } else if (task.freq === 'custom_day') {

        let activeDays = task.freqVal
            ? task.freqVal.toString().split(',')
            : [];

        document
            .querySelectorAll('#edit-custom-days-container input')
            .forEach(cb => {
                cb.checked = activeDays.includes(cb.value);
            });
    }

    const modal = document.getElementById('edit-modal');

    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}


function closeEditModal() {
    const modal = document.getElementById('edit-modal');

    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}


function saveEditTask() {
    const idEl = document.getElementById('edit-task-id');
    const titleEl = document.getElementById('edit-task-title');
    const targetEl = document.getElementById('edit-task-target');
    const freqEl = document.getElementById('edit-task-freq');

    const id = idEl
        ? parseInt(idEl.value)
        : 0;

    const title = titleEl
        ? titleEl.value.trim()
        : '';

    const target = targetEl
        ? (parseInt(targetEl.value) || 1)
        : 1;

    const freq = freqEl
        ? freqEl.value
        : 'daily';

    let freqVal = null;

    if (!title) {
        alert('Nama tugas tidak boleh kosong.');
        return;
    }

    if (
        freq === 'weekly' ||
        freq === 'monthly' ||
        freq === 'specific_date'
    ) {

        const el = document.getElementById('edit-freq-val');

        if (el) {
            freqVal = el.value;
        }

    } else if (freq === 'custom_day') {

        let selectedDays = [];

        document
            .querySelectorAll('#edit-custom-days-container input:checked')
            .forEach(cb => selectedDays.push(cb.value));

        if (selectedDays.length === 0) {
            alert('Pilih minimal satu hari.');
            return;
        }

        freqVal = selectedDays.join(',');
    }

    const index = tasks.findIndex(t => t.id === id);

    if (index !== -1) {

        tasks[index] = {
            ...tasks[index],
            title,
            target,
            freq,
            freqVal
        };

        saveData();
        closeEditModal();
        renderTodoList();
    }
}

/* =========================================================
   FREQUENCY
   ========================================================= */

function handleFreqChange(type) {
    const selectEl = document.getElementById(`${type}-task-freq`);
    const extraEl = document.getElementById(`${type}-freq-extra`);

    if (!selectEl || !extraEl) return;

    const val = selectEl.value;

    extraEl.innerHTML = '';
    extraEl.classList.add('hidden');

    if (val === 'weekly') {

        extraEl.classList.remove('hidden');

        extraEl.innerHTML = `
            <label class="text-[11px] text-slate-400 block mb-1">
                Pilih Hari
            </label>

            <select
                id="${type}-freq-val"
                class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
            >
                <option value="1">Senin</option>
                <option value="2">Selasa</option>
                <option value="3">Rabu</option>
                <option value="4">Kamis</option>
                <option value="5">Jumat</option>
                <option value="6">Sabtu</option>
                <option value="0">Minggu</option>
            </select>
        `;

    } else if (val === 'monthly') {

        extraEl.classList.remove('hidden');

        extraEl.innerHTML = `
            <label class="text-[11px] text-slate-400 block mb-1">
                Tanggal (1-31)
            </label>

            <input
                type="number"
                id="${type}-freq-val"
                min="1"
                max="31"
                value="1"
                class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
            >
        `;

    } else if (val === 'specific_date') {

        extraEl.classList.remove('hidden');

        extraEl.innerHTML = `
            <label class="text-[11px] text-slate-400 block mb-1">
                Tanggal
            </label>

            <input
                type="date"
                id="${type}-freq-val"
                value="${getTodayDateString()}"
                class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
            >
        `;

    } else if (val === 'custom_day') {

        extraEl.classList.remove('hidden');

        extraEl.innerHTML = `
            <label class="text-[11px] text-slate-400 block mb-1">
                Hari Aktif
            </label>

            <div
                class="grid grid-cols-4 gap-1 text-[10px]"
                id="${type}-custom-days-container"
            >
                <label>
                    <input type="checkbox" value="1" checked>
                    Sen
                </label>

                <label>
                    <input type="checkbox" value="2">
                    Sel
                </label>

                <label>
                    <input type="checkbox" value="3">
                    Rab
                </label>

                <label>
                    <input type="checkbox" value="4">
                    Kam
                </label>

                <label>
                    <input type="checkbox" value="5">
                    Jum
                </label>

                <label>
                    <input type="checkbox" value="6">
                    Sab
                </label>

                <label>
                    <input type="checkbox" value="0">
                    Min
                </label>
            </div>
        `;
    }
}

/* =========================================================
   TAB
   ========================================================= */

function switchTab(tabName) {

    if (!currentUser && tabName !== 'settings') {
        openLoginModal();
        return;
    }

    document
        .querySelectorAll('.tab-page')
        .forEach(el => el.classList.add('hidden'));

    const targetTab = document.getElementById(`tab-${tabName}`);

    if (targetTab) {
        targetTab.classList.remove('hidden');
    }

    ['tasks', 'calendar', 'stats', 'settings'].forEach(n => {

        const btn = document.getElementById(`nav-${n}`);

        if (btn) {

            btn.className =
                (n === tabName)
                    ? 'flex flex-col items-center justify-center text-emerald-400 font-medium w-1/4 py-1 transition'
                    : 'flex flex-col items-center justify-center text-slate-400 hover:text-slate-200 font-medium w-1/4 py-1 transition';
        }
    });

    if (tabName === 'tasks') {
        renderTodoList();
    }

    if (tabName === 'calendar') {
        onCalendarDateChange();
    }

    if (tabName === 'stats') {
        renderStatsTab();
    }
}


/* =========================================================
   CALENDAR
   ========================================================= */

function onCalendarDateChange() {

    const datePicker = document.getElementById('calendar-date-picker');

    const startDateVal = datePicker
        ? datePicker.value
        : getTodayDateString();

    const listContainer =
        document.getElementById('calendar-tasks-list');

    const labelEl =
        document.getElementById('calendar-selected-label');

    const countEl =
        document.getElementById('calendar-task-count');

    if (!startDateVal || !listContainer) {
        return;
    }

    const startDate = new Date(startDateVal);

    if (labelEl) {
        labelEl.innerText = `Agenda 30 Hari Ke Depan`;
    }

    listContainer.innerHTML = '';

    let totalAllTasks = 0;

    // Looping 30 hari ke depan
    for (let i = 0; i < 30; i++) {

        const currentDate = new Date(startDate);

        currentDate.setDate(startDate.getDate() + i);

        const dateStr =
            `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;

        const formattedDate =
            currentDate.toLocaleDateString(
                'id-ID',
                {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                }
            );

        // Cek tugas yang aktif di tanggal ini
        let matchingTasks =
            tasks.filter(t => isTaskActiveForDate(t, dateStr));

        if (matchingTasks.length > 0) {

            totalAllTasks += matchingTasks.length;

            const dayGroup = document.createElement('div');

            dayGroup.className =
                'flex flex-col gap-1.5 mb-3 bg-slate-900/60 border border-slate-800 rounded-xl p-2.5';

            let tasksHtml = matchingTasks
                .map((task, idx) => `
                    <div class="bg-slate-800/60 border border-slate-700/50 rounded-lg p-2 flex items-center justify-between text-xs text-slate-200">

                        <div class="flex items-center gap-2">

                            <span class="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[9px]">
                                ${idx + 1}
                            </span>

                            <span class="font-medium">
                                ${task.title}
                            </span>

                        </div>

                        <span class="text-[9px] bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                            Target: ${task.target}
                        </span>

                    </div>
                `)
                .join('');

            dayGroup.innerHTML = `
                <div class="flex items-center justify-between text-[11px] font-bold text-emerald-400 border-b border-slate-800 pb-1 mb-1">

                    <span>
                        📅 ${formattedDate}
                    </span>

                    <span class="text-[9px] text-slate-400 font-normal">
                        ${matchingTasks.length} Tugas
                    </span>

                </div>

                ${tasksHtml}
            `;

            listContainer.appendChild(dayGroup);
        }
    }

    if (countEl) {
        countEl.innerText =
            `${totalAllTasks} Total Kegiatan`;
    }

    if (totalAllTasks === 0) {

        listContainer.innerHTML = `
            <div class="text-center py-6 text-xs text-slate-500">
                Tidak ada agenda kegiatan dalam 30 hari ke depan.
            </div>
        `;
    }
}

/* =========================================================
   STATISTICS
   ========================================================= */

function renderStatsTab() {

    const filterEl =
        document.getElementById('analytics-filter');

    const filter =
        filterEl ? filterEl.value : 'daily';

    const container =
        document.getElementById('stats-detail-list');

    if (!container) return;

    container.innerHTML = '';

    let totalDoneAll = 0;
    let totalPossibleAll = 0;

    let periods =
        filter === 'daily'
            ? DAYS.map(d => ({
                label: d.full,
                key: d.key
            }))
            : [{
                label: 'Periode Ini',
                key: selectedDay
            }];

    periods.forEach(p => {

        const today = new Date();

        const dayObj =
            DAYS.find(d => d.key === p.key);

        let targetDate =
            new Date(today);

        if (dayObj) {

            let diff =
                dayObj.index - today.getDay();

            targetDate.setDate(
                today.getDate() + diff
            );
        }

        const dateStr =
            `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

        const dayProg =
            progressData[dateStr] || {};

        let activeTasks =
            tasks.filter(t => isTaskActiveForDate(t, dateStr));

        let done = 0;

        activeTasks.forEach(t => {

            if ((dayProg[t.id] || 0) >= t.target) {
                done++;
            }
        });

        totalDoneAll += done;
        totalPossibleAll += activeTasks.length;

        const pct =
            activeTasks.length === 0
                ? 0
                : Math.round(
                    (done / activeTasks.length) * 100
                );

        const row =
            document.createElement('div');

        row.className =
            'flex items-center justify-between text-xs py-1 border-b border-slate-700/40 last:border-0';

        row.innerHTML = `
            <span class="text-slate-300 font-medium">
                ${p.label}
            </span>

            <div class="flex items-center gap-2">

                <div class="w-24 bg-slate-900 rounded-full h-1.5 overflow-hidden">

                    <div
                        class="bg-emerald-500 h-1.5 rounded-full"
                        style="width: ${pct}%"
                    ></div>

                </div>

                <span class="text-emerald-400 font-mono text-[11px] font-bold">
                    ${pct}%
                </span>

            </div>
        `;

        container.appendChild(row);
    });

    const overallPct =
        totalPossibleAll === 0
            ? 0
            : Math.round(
                (totalDoneAll / Math.max(totalPossibleAll, 1)) * 100
            );

    const avgEl =
        document.getElementById('stat-avg-completion');

    const doneEl =
        document.getElementById('stat-total-done');

    if (avgEl) {
        avgEl.innerText = `${overallPct}%`;
    }

    if (doneEl) {
        doneEl.innerText = totalDoneAll;
    }
}