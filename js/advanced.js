/* Daily Task — progressive enhancement module.
 * Add this script after js/ui.js and before js/app.js.
 * Uses the existing global tasks/progressData/saveData/Supabase client.
 */
(() => {
  'use strict';

  const XP_PER_TASK = 10;
  const PRIORITIES = [
    { value: 'low', label: 'Rendah' },
    { value: 'medium', label: 'Sedang' },
    { value: 'high', label: 'Tinggi' }
  ];
  let pomo = { timer: null, remaining: 25 * 60, running: false, mode: 'focus' };
  let lastReminderMinute = '';
  let initialized = false;

  const $ = (id) => document.getElementById(id);
  const todayKey = () => {
    if (typeof getTodayDateString === 'function') return getTodayDateString();
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const safeText = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[ch]);
  const activeTasks = (date = todayKey()) => {
    if (typeof tasks === 'undefined' || !Array.isArray(tasks)) return [];
    return tasks.filter(task => {
      if (!task || (task.createdDate && task.createdDate > date)) return false;
      if (Array.isArray(task.deletedDates) && task.deletedDates.includes(date)) return false;
      if (typeof isTaskActiveForDate === 'function') return isTaskActiveForDate(task, date);
      return true;
    });
  };
  const dayProgress = (date = todayKey()) => (typeof progressData !== 'undefined' && progressData[date]) || {};
  const isDone = (task, date = todayKey()) => Number(dayProgress(date)[task.id] || 0) >= Math.max(1, Number(task.target || 1));
  const allCompletionCount = () => {
    let count = 0;
    for (const date of Object.keys(typeof progressData !== 'undefined' ? progressData : {})) {
      const p = progressData[date] || {};
      for (const task of (typeof tasks !== 'undefined' ? tasks : [])) {
        if (Number(p[task.id] || 0) >= Math.max(1, Number(task.target || 1))) count++;
      }
    }
    return count;
  };
  const currentStreak = () => {
    let streak = 0;
    const d = new Date();
    for (let i = 0; i < 366; i++) {
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const list = activeTasks(key);
      if (!list.length || !list.every(t => isDone(t, key))) {
        if (i === 0) { d.setDate(d.getDate() - 1); continue; }
        break;
      }
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  };
  const persist = async () => {
    if (typeof saveData === 'function') await saveData();
    renderDashboard();
  };

  function ensureDashboard() {
    const statsTab = $('tab-stats');
    if (!statsTab || $('advanced-dashboard')) return;
    const panel = document.createElement('section');
    panel.id = 'advanced-dashboard';
    panel.className = 'rounded-2xl border border-indigo-400/20 bg-gradient-to-br from-slate-900 to-indigo-950/60 p-4 shadow-lg';
    panel.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div><p class="text-[10px] uppercase tracking-[.2em] text-indigo-300">Ringkasan produktivitas</p>
        <h2 class="mt-1 text-sm font-bold text-white">Progres kamu</h2></div>
        <div class="rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-right">
          <p class="text-[10px] text-amber-200">Total XP</p><p id="adv-xp" class="text-lg font-extrabold text-amber-100">0</p>
        </div>
      </div>
      <div class="mt-3 grid grid-cols-3 gap-2">
        <div class="rounded-xl bg-slate-950/50 p-3"><p class="text-[10px] text-slate-400">Selesai hari ini</p><p id="adv-done" class="mt-1 text-lg font-bold text-emerald-300">0/0</p></div>
        <div class="rounded-xl bg-slate-950/50 p-3"><p class="text-[10px] text-slate-400">Level</p><p id="adv-level" class="mt-1 text-lg font-bold text-indigo-200">1</p></div>
        <div class="rounded-xl bg-slate-950/50 p-3"><p class="text-[10px] text-slate-400">Streak</p><p id="adv-streak" class="mt-1 text-lg font-bold text-orange-200">0 hari</p></div>
      </div>
      <div class="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"><div id="adv-level-progress" class="h-full rounded-full bg-gradient-to-r from-indigo-400 to-cyan-300" style="width:0%"></div></div>
      <p id="adv-level-caption" class="mt-1 text-[10px] text-slate-400">0 / 100 XP menuju level berikutnya</p>
    `;
    // Keep the productivity dashboard in Analytics, not above the task list.
    statsTab.insertBefore(panel, statsTab.firstElementChild);
  }

  function renderDashboard() {
    if (!$('advanced-dashboard')) return;
    const list = activeTasks(todayKey());
    const done = list.filter(t => isDone(t)).length;
    const xp = allCompletionCount() * XP_PER_TASK;
    const level = Math.floor(xp / 100) + 1;
    const inLevel = xp % 100;
    $('adv-xp').textContent = String(xp);
    $('adv-done').textContent = `${done}/${list.length}`;
    $('adv-level').textContent = String(level);
    $('adv-streak').textContent = `${currentStreak()} hari`;
    $('adv-level-progress').style.width = `${inLevel}%`;
    $('adv-level-caption').textContent = `${inLevel} / 100 XP menuju level ${level + 1}`;
  }

  function addTaskFields(modalPrefix) {
    const modal = $(`${modalPrefix}-modal`);
    if (!modal || $(`${modalPrefix}-advanced-fields`)) return;
    const targetInput = $(`${modalPrefix}-task-target`);
    if (!targetInput) return;
    const host = targetInput.parentElement.parentElement;
    const fields = document.createElement('div');
    fields.id = `${modalPrefix}-advanced-fields`;
    fields.className = 'grid grid-cols-2 gap-2';
    fields.innerHTML = `
      <label class="flex flex-col gap-1 text-[11px] text-slate-400">Prioritas
        <select id="${modalPrefix}-task-priority" class="rounded-lg border border-slate-700 bg-slate-800 px-2 py-2 text-xs text-white">
          ${PRIORITIES.map(p => `<option value="${p.value}">${p.label}</option>`).join('')}
        </select>
      </label>
      <label class="flex flex-col gap-1 text-[11px] text-slate-400">Kategori
        <input id="${modalPrefix}-task-category" maxlength="40" placeholder="Pribadi, kerja..." class="rounded-lg border border-slate-700 bg-slate-800 px-2 py-2 text-xs text-white">
      </label>
      <label class="col-span-2 flex items-center gap-2 text-[11px] text-slate-300">
        <input id="${modalPrefix}-task-reminder-enabled" type="checkbox" class="accent-emerald-500"> Pengingat browser untuk tugas ini
      </label>
      <label class="col-span-2 flex flex-col gap-1 text-[11px] text-slate-400">Jam pengingat (opsional)
        <input id="${modalPrefix}-task-reminder-time" type="time" class="rounded-lg border border-slate-700 bg-slate-800 px-2 py-2 text-xs text-white">
      </label>`;
    host.appendChild(fields);
  }

  function readTaskFields(prefix) {
    return {
      priority: $(`${prefix}-task-priority`)?.value || 'medium',
      category: ($(`${prefix}-task-category`)?.value || '').trim().slice(0, 40),
      reminderEnabled: Boolean($(`${prefix}-task-reminder-enabled`)?.checked),
      reminderTime: $(`${prefix}-task-reminder-time`)?.value || ''
    };
  }
  function fillTaskFields(prefix, task) {
    if ($(`${prefix}-task-priority`)) $(`${prefix}-task-priority`).value = task.priority || 'medium';
    if ($(`${prefix}-task-category`)) $(`${prefix}-task-category`).value = task.category || '';
    if ($(`${prefix}-task-reminder-enabled`)) $(`${prefix}-task-reminder-enabled`).checked = Boolean(task.reminderEnabled);
    if ($(`${prefix}-task-reminder-time`)) $(`${prefix}-task-reminder-time`).value = task.reminderTime || '';
  }

  function enhanceSaveFunctions() {
    if (typeof window.saveNewTask === 'function' && !window.saveNewTask.__advancedWrapped) {
      const original = window.saveNewTask;
      const wrapped = function() {
        const extra = readTaskFields('new');
        const before = (typeof tasks !== 'undefined' ? tasks : []).length;
        const result = original.apply(this, arguments);
        const created = (typeof tasks !== 'undefined' ? tasks : []).slice(before);
        const task = created[created.length - 1];
        if (task) Object.assign(task, extra);
        if (task) { persist(); }
        return result;
      };
      wrapped.__advancedWrapped = true;
      window.saveNewTask = wrapped;
    }
    if (typeof window.saveEditTask === 'function' && !window.saveEditTask.__advancedWrapped) {
      const original = window.saveEditTask;
      const wrapped = function() {
        const id = Number($('edit-task-id')?.value);
        const extra = readTaskFields('edit');
        const result = original.apply(this, arguments);
        const task = (typeof tasks !== 'undefined' ? tasks : []).find(t => Number(t.id) === id);
        if (task) { Object.assign(task, extra); persist(); }
        return result;
      };
      wrapped.__advancedWrapped = true;
      window.saveEditTask = wrapped;
    }
    if (typeof window.openAddModal === 'function' && !window.openAddModal.__advancedWrapped) {
      const original = window.openAddModal;
      const wrapped = function() {
        const result = original.apply(this, arguments);
        addTaskFields('new');
        fillTaskFields('new', {});
        return result;
      };
      wrapped.__advancedWrapped = true;
      window.openAddModal = wrapped;
    }
    if (typeof window.openEditModal === 'function' && !window.openEditModal.__advancedWrapped) {
      const original = window.openEditModal;
      const wrapped = function() {
        const result = original.apply(this, arguments);
        addTaskFields('edit');
        const id = Number($('edit-task-id')?.value);
        const task = (typeof tasks !== 'undefined' ? tasks : []).find(t => Number(t.id) === id);
        fillTaskFields('edit', task || {});
        return result;
      };
      wrapped.__advancedWrapped = true;
      window.openEditModal = wrapped;
    }
  }

  function ensurePomodoro() {
    if ($('advanced-pomodoro')) return;
    const settings = $('tab-settings');
    if (!settings) return;
    const panel = document.createElement('section');
    panel.id = 'advanced-pomodoro';
    panel.className = 'rounded-2xl border border-cyan-400/20 bg-slate-900/80 p-4';
    panel.innerHTML = `
      <div class="flex items-center justify-between"><div><p class="text-[10px] uppercase tracking-widest text-cyan-300">Mode fokus</p><h2 class="mt-1 text-sm font-bold text-white">Pomodoro</h2></div><span id="pomo-mode" class="text-[10px] text-slate-400">Fokus</span></div>
      <p id="pomo-time" class="my-4 text-center font-mono text-4xl font-bold text-cyan-200">25:00</p>
      <div class="grid grid-cols-3 gap-2">
        <button id="pomo-start" type="button" class="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-bold text-slate-950">Mulai</button>
        <button id="pomo-reset" type="button" class="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs">Reset</button>
        <button id="pomo-break" type="button" class="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs">Istirahat</button>
      </div>
      <p class="mt-2 text-[10px] text-slate-500">Timer berjalan selama halaman tetap terbuka.</p>`;
    settings.insertBefore(panel, settings.firstChild);
    $('pomo-start').addEventListener('click', togglePomodoro);
    $('pomo-reset').addEventListener('click', () => resetPomodoro(pomo.mode));
    $('pomo-break').addEventListener('click', () => resetPomodoro(pomo.mode === 'focus' ? 'break' : 'focus'));
    renderPomodoro();
  }
  function renderPomodoro() {
    const time = $('pomo-time');
    if (!time) return;
    const m = Math.floor(pomo.remaining / 60).toString().padStart(2, '0');
    const s = (pomo.remaining % 60).toString().padStart(2, '0');
    time.textContent = `${m}:${s}`;
    $('pomo-mode').textContent = pomo.mode === 'focus' ? 'Fokus' : 'Istirahat';
    $('pomo-start').textContent = pomo.running ? 'Jeda' : 'Mulai';
    $('pomo-break').textContent = pomo.mode === 'focus' ? 'Istirahat' : 'Kembali fokus';
  }
  function resetPomodoro(mode = 'focus') {
    if (pomo.timer) clearInterval(pomo.timer);
    pomo.timer = null;
    pomo.running = false;
    pomo.mode = mode;
    pomo.remaining = mode === 'focus' ? 25 * 60 : 5 * 60;
    renderPomodoro();
  }
  function togglePomodoro() {
    if (pomo.running) {
      clearInterval(pomo.timer); pomo.timer = null; pomo.running = false; renderPomodoro(); return;
    }
    pomo.running = true;
    pomo.timer = setInterval(() => {
      pomo.remaining = Math.max(0, pomo.remaining - 1);
      if (pomo.remaining === 0) {
        clearInterval(pomo.timer); pomo.timer = null; pomo.running = false;
        if ('Notification' in window && Notification.permission === 'granted') new Notification('Daily Task', { body: pomo.mode === 'focus' ? 'Sesi fokus selesai. Saatnya istirahat.' : 'Istirahat selesai. Siap fokus lagi?' });
        alert(pomo.mode === 'focus' ? 'Sesi fokus selesai. Saatnya istirahat!' : 'Istirahat selesai. Siap fokus lagi?');
      }
      renderPomodoro();
    }, 1000);
    renderPomodoro();
  }

  function ensureAiAssistant() {
    if ($('advanced-ai')) return;
    const settings = $('tab-settings');
    if (!settings) return;
    const panel = document.createElement('section');
    panel.id = 'advanced-ai';
    panel.className = 'rounded-2xl border border-violet-400/20 bg-slate-900/80 p-4';
    panel.innerHTML = `
      <p class="text-[10px] uppercase tracking-widest text-violet-300">Asisten perencanaan</p>
      <h2 class="mt-1 text-sm font-bold text-white">AI Task Assistant</h2>
      <p class="mt-1 text-[11px] leading-relaxed text-slate-400">Bantu pecah tujuan menjadi langkah kecil. Perlu Edge Function Supabase <code>daily-task-assistant</code> yang dikonfigurasi dengan kunci API di server.</p>
      <textarea id="ai-task-prompt" rows="3" maxlength="2000" placeholder="Contoh: bantu susun jadwal belajar 2 jam..." class="mt-3 w-full rounded-lg border border-slate-700 bg-slate-800 p-3 text-xs text-white"></textarea>
      <button id="ai-task-submit" type="button" class="mt-2 w-full rounded-lg bg-violet-500 px-3 py-2 text-xs font-bold text-white">Buat rencana</button>
      <pre id="ai-task-result" class="mt-3 hidden whitespace-pre-wrap break-words rounded-lg bg-slate-950/70 p-3 text-xs text-slate-200"></pre>`;
    settings.appendChild(panel);
    $('ai-task-submit').addEventListener('click', requestAiPlan);
  }
  async function requestAiPlan() {
    const prompt = ($('ai-task-prompt')?.value || '').trim();
    const output = $('ai-task-result');
    const button = $('ai-task-submit');
    if (!prompt) { alert('Tulis tujuan atau kendala terlebih dahulu.'); return; }
    if (typeof supabaseClient === 'undefined' || !supabaseClient || typeof currentUser === 'undefined' || !currentUser) { alert('Login diperlukan untuk menggunakan asisten AI.'); return; }
    button.disabled = true; button.textContent = 'Menyusun...';
    output.classList.remove('hidden'); output.textContent = 'Menghubungi asisten...';
    try {
      const { data, error } = await supabaseClient.functions.invoke('daily-task-assistant', {
        body: { prompt: prompt.slice(0, 2000), tasks: (typeof tasks !== 'undefined' ? tasks : []).map(t => ({ title: String(t.title || '').slice(0, 120), priority: t.priority || 'medium', category: t.category || '' })).slice(0, 100) }
      });
      if (error) throw new Error('Edge Function belum tersedia atau gagal dihubungi.');
      const answer = data && (data.answer || data.plan || data.message);
      if (typeof answer !== 'string' || !answer.trim()) throw new Error('Respons AI tidak memiliki field answer/plan/message.');
      output.textContent = answer;
    } catch (err) {
      const reason = String(err && err.message ? err.message : 'layanan AI belum tersedia');
      output.textContent = 'AI online belum terhubung (' + reason + ').\\n\\nRencana sementara:\\n1. Tulis hasil akhir yang ingin dicapai.\\n2. Pecah menjadi tiga langkah kecil.\\n3. Kerjakan langkah pertama selama 25 menit.\\n4. Istirahat 5 menit, lalu lanjutkan langkah berikutnya.\\n5. Evaluasi hasil dan tentukan langkah selanjutnya.\\n\\nUntuk jawaban AI penuh, Edge Function daily-task-assistant harus aktif dan secret OPENAI_API_KEY disetel di Supabase.';
    } finally {
      button.disabled = false; button.textContent = 'Buat rencana';
    }
  }

  async function requestNotificationPermission() {
    const status = $('advanced-notification-status');
    const button = $('advanced-enable-notifications');
    try {
      if (!('Notification' in window)) {
        if (status) status.textContent = 'Notifikasi tidak didukung oleh lingkungan aplikasi ini. Coba buka melalui Chrome.';
        else alert('Browser ini tidak mendukung notifikasi.');
        return;
      }
      const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
      if (permission === 'granted') {
        if (status) status.textContent = 'Izin aktif. Pengingat hanya dicek saat aplikasi terbuka.';
        if (button) button.textContent = 'Notifikasi aktif ✓';
        checkReminders();
      } else {
        if (status) status.textContent = 'Izin belum diberikan. Periksa izin notifikasi di Pengaturan Android.';
        else alert('Izin notifikasi belum diberikan.');
      }
    } catch (_) {
      if (status) status.textContent = 'Permintaan izin tidak didukung di WebView ini. Coba gunakan Chrome atau periksa Pengaturan Android.';
      else alert('Tidak dapat meminta izin notifikasi di aplikasi ini.');
    }
  }
  function ensureReminderSettings() {
    const settings = $('tab-settings');
    if (!settings || $('advanced-reminder-settings')) return;
    const panel = document.createElement('section');
    panel.id = 'advanced-reminder-settings';
    panel.className = 'rounded-2xl border border-emerald-400/20 bg-slate-900/80 p-4';
    panel.innerHTML = `<h2 class="text-sm font-bold text-white">Pengingat browser</h2><p class="mt-1 text-[11px] text-slate-400">Pengingat dicek saat Daily Task terbuka. Notifikasi mungkin tidak muncul jika aplikasi ditutup atau dibatasi Android.</p><p id="advanced-notification-status" class="mt-2 text-xs text-slate-300"></p><button id="advanced-enable-notifications" type="button" class="mt-3 w-full rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200">Aktifkan notifikasi</button>`;
    settings.appendChild(panel);
    const status = $('advanced-notification-status');
    const button = $('advanced-enable-notifications');
    if (status && 'Notification' in window) {
      status.textContent = Notification.permission === 'granted' ? 'Izin notifikasi sudah aktif.' : Notification.permission === 'denied' ? 'Izin diblokir. Aktifkan dari Pengaturan Android/browser.' : 'Izin notifikasi belum diminta.';
      if (Notification.permission === 'granted' && button) button.textContent = 'Notifikasi aktif ✓';
    } else if (status) {
      status.textContent = 'API notifikasi tidak tersedia di lingkungan aplikasi ini.';
    }
    $('advanced-enable-notifications').addEventListener('click', requestNotificationPermission);
  }
  function checkReminders() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const now = new Date();
    const date = todayKey();
    const minute = `${date} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    if (minute === lastReminderMinute) return;
    lastReminderMinute = minute;
    for (const task of activeTasks(date)) {
      if (task.reminderEnabled && task.reminderTime === minute.slice(11) && !isDone(task, date)) {
        new Notification('Daily Task — Pengingat', { body: task.title || 'Ada tugas yang menunggu.', tag: `task-${task.id}-${date}` });
      }
    }
  }

  function decorateTaskList() {
    const container = $('todo-list');
    if (!container || typeof tasks === 'undefined' || !Array.isArray(tasks)) return;
    // Add priority chips without rebuilding the existing task renderer.
    container.querySelectorAll('[data-task-id], [data-id]').forEach(node => {
      const id = Number(node.getAttribute('data-task-id') || node.getAttribute('data-id'));
      const task = (typeof tasks !== 'undefined' ? tasks : []).find(t => Number(t.id) === id);
      if (!task || node.querySelector('.advanced-priority-chip')) return;
      const titleNode = node.querySelector('.font-medium, .task-title');
      if (!titleNode) return;
      const chip = document.createElement('span');
      chip.className = 'advanced-priority-chip ml-2 rounded px-1.5 py-0.5 text-[9px]';
      const styles = { high: 'bg-rose-500/15 text-rose-300', medium: 'bg-amber-500/15 text-amber-200', low: 'bg-sky-500/15 text-sky-200' };
      chip.className += ` ${styles[task.priority] || styles.medium}`;
      chip.textContent = `${task.priority === 'high' ? 'Prioritas tinggi' : task.priority === 'low' ? 'Prioritas rendah' : 'Prioritas sedang'}${task.category ? ` · ${task.category}` : ''}`;
      titleNode.appendChild(chip);
    });
  }


  // Notes are stored alongside progress data so they sync through the existing cloud save and backup.
  function getNotes() {
    if (typeof progressData === 'undefined' || !progressData) return [];
    if (!Array.isArray(progressData.__notes)) progressData.__notes = [];
    return progressData.__notes;
  }
  async function saveNotes() {
    if (typeof progressData !== 'undefined' && progressData) {
      progressData.__notes = getNotes();
      if (typeof saveData === 'function') await saveData();
    }
    renderNotes();
  }
  function renderNotes() {
    const host = $('notes-list');
    if (!host) return;
    host.innerHTML = '';
    const notes = getNotes();
    if (!notes.length) {
      const empty = document.createElement('div');
      empty.className = 'rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-6 text-center';
      empty.innerHTML = '<div class="text-2xl mb-2">📝</div><p class="text-sm font-semibold text-slate-200">Belum ada catatan</p><p class="mt-1 text-xs text-slate-500">Simpan teks dan kumpulan link favoritmu di sini.</p>';
      host.appendChild(empty);
      return;
    }
    notes.forEach((note, index) => {
      const card = document.createElement('section');
      card.className = 'rounded-2xl border border-slate-800 bg-slate-900/80 p-3 flex items-center gap-3 shadow-sm';
      const icon = document.createElement('div');
      icon.className = 'shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-300';
      icon.textContent = '🗒️';
      const main = document.createElement('div');
      main.className = 'flex-1 min-w-0';
      const name = document.createElement('p');
      name.className = 'text-sm font-semibold text-slate-100 break-words';
      name.textContent = note.name || 'Catatan tanpa nama';
      const meta = document.createElement('p');
      meta.className = 'mt-1 text-[11px] text-slate-500';
      const chars = (note.content || '').length;
      const links = Math.max(0, ((note.content || '').split('http://').length - 1) + ((note.content || '').split('https://').length - 1));
      meta.textContent = (chars ? chars.toLocaleString('id-ID') + ' karakter' : 'Belum ada isi') + (links ? ' · ' + links + '+ tautan' : '');
      main.append(name, meta);
      const actions = document.createElement('div');
      actions.className = 'flex shrink-0 items-center gap-1.5';
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'rounded-xl bg-emerald-500/15 border border-emerald-500/25 px-3 py-2 text-xs font-semibold text-emerald-300 active:scale-95';
      copy.textContent = 'Salin';
      copy.title = 'Salin seluruh isi catatan';
      copy.addEventListener('click', () => copyNote(note.id));
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'rounded-xl bg-slate-800 px-2.5 py-2 text-xs text-slate-200 active:scale-95';
      edit.textContent = '✏️';
      edit.title = 'Edit catatan';
      edit.addEventListener('click', () => editNote(note.id));
      const more = document.createElement('details');
      more.className = 'relative';
      const summary = document.createElement('summary');
      summary.className = 'list-none cursor-pointer rounded-xl bg-slate-800 px-3 py-2 text-sm text-slate-300 active:scale-95';
      summary.textContent = '⋮';
      const menu = document.createElement('div');
      menu.className = 'absolute right-0 top-10 z-20 flex min-w-32 flex-col gap-1 rounded-xl border border-slate-700 bg-slate-950 p-1.5 shadow-xl';
      const makeMenuButton = (label, title, action, disabled) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'rounded-lg px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-30';
        b.textContent = label;
        b.title = title;
        b.disabled = !!disabled;
        b.addEventListener('click', () => { more.open = false; action(); });
        return b;
      };
      menu.append(
        makeMenuButton('↑ Pindah ke atas', 'Pindah ke atas', () => moveNote(note.id, -1), index === 0),
        makeMenuButton('↓ Pindah ke bawah', 'Pindah ke bawah', () => moveNote(note.id, 1), index === notes.length - 1),
        makeMenuButton('🗑 Hapus', 'Hapus catatan', () => deleteNote(note.id), false)
      );
      more.append(summary, menu);
      actions.append(copy, edit, more);
      card.append(icon, main, actions);
      host.appendChild(card);
    });
  }
  let editingNoteId = null;
  function openNoteEditor(note) {
    const modal = $('note-editor-modal');
    const nameInput = $('note-editor-name');
    const contentInput = $('note-editor-content');
    const title = $('note-editor-title');
    const error = $('note-editor-error');
    if (!modal || !nameInput || !contentInput) return;
    editingNoteId = note ? note.id : null;
    if (title) title.textContent = note ? 'Edit Catatan' : 'Tambah Catatan';
    nameInput.value = note ? (note.name || '') : '';
    contentInput.value = note ? (note.content || '') : '';
    if (error) { error.textContent = ''; error.classList.add('hidden'); }
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => nameInput.focus(), 50);
  }
  function closeNoteEditor() {
    const modal = $('note-editor-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    editingNoteId = null;
  }
  async function saveNoteEditor() {
    const nameInput = $('note-editor-name');
    const contentInput = $('note-editor-content');
    const error = $('note-editor-error');
    const name = nameInput ? nameInput.value.trim() : '';
    const content = contentInput ? contentInput.value : '';
    if (!name) {
      if (error) { error.textContent = 'Nama catatan wajib diisi.'; error.classList.remove('hidden'); }
      return;
    }
    const notes = getNotes();
    if (editingNoteId !== null) {
      const note = notes.find(n => String(n.id) === String(editingNoteId));
      if (note) { note.name = name; note.content = content; }
    } else {
      notes.push({ id: Date.now(), name, content });
    }
    closeNoteEditor();
    await saveNotes();
    showNotesFeedback('Catatan berhasil disimpan.');
  }
  function showNotesFeedback(message) {
    const el = $('notes-feedback');
    if (!el) return;
    el.textContent = message;
    el.classList.remove('hidden');
  }
  function addNote() { openNoteEditor(null); }
  function editNote(id) {
    const note = getNotes().find(n => String(n.id) === String(id));
    if (note) openNoteEditor(note);
  }
  window.addNote = addNote;
  window.renderNotes = renderNotes;
  window.closeNoteEditor = closeNoteEditor;
  window.saveNoteEditor = saveNoteEditor;

  async function copyNote(id) {
    const index = getNotes().findIndex(n => String(n.id) === String(id));
    if (index < 0) return;
    const note = getNotes()[index];
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(note.content || '');
      } else {
        const area = document.createElement('textarea');
        area.value = note.content || '';
        area.style.position = 'fixed';
        area.style.opacity = '0';
        area.setAttribute('readonly', '');
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand('copy');
        area.remove();
        if (!ok) throw new Error('copy failed');
      }

      // Reorder only after the clipboard operation succeeds.
      const currentIndex = getNotes().findIndex(n => String(n.id) === String(id));
      if (currentIndex >= 0 && currentIndex < getNotes().length - 1) {
        const [copiedNote] = getNotes().splice(currentIndex, 1);
        getNotes().push(copiedNote);
        await saveNotes();
        showNotesFeedback('"' + note.name + '" berhasil disalin dan dipindahkan ke paling bawah.');
      } else {
        showNotesFeedback('Isi catatan "' + note.name + '" berhasil disalin.');
      }
    } catch (_) {
      showNotesFeedback('Gagal menyalin. Catatan tidak dipindahkan. Periksa izin clipboard atau coba buka lewat browser.');
    }
  }
  function moveNote(id, direction) {
    const notes = getNotes();
    const i = notes.findIndex(n => String(n.id) === String(id));
    const j = i + direction;
    if (i < 0 || j < 0 || j >= notes.length) return;
    [notes[i], notes[j]] = [notes[j], notes[i]];
    saveNotes();
  }
  function deleteNote(id) {
    const note = getNotes().find(n => String(n.id) === String(id));
    if (!note) return;
    const ok = window.confirm ? window.confirm('Hapus catatan "' + note.name + '"?') : false;
    if (!ok) { showNotesFeedback('Penghapusan dibatalkan.'); return; }
    progressData.__notes = getNotes().filter(n => String(n.id) !== String(id));
    saveNotes();
  }
  window.addNote = addNote;
  window.renderNotes = renderNotes;

  function init() {
    if (initialized) return;
    initialized = true;
    ensureDashboard();
    addTaskFields('new');
    addTaskFields('edit');
    enhanceSaveFunctions();
    ensurePomodoro();
    ensureAiAssistant();
    ensureReminderSettings();
    renderDashboard();
    decorateTaskList();
    // Refresh stats after existing UI actions re-render task DOM.
    const list = $('todo-list');
    if (list && 'MutationObserver' in window) new MutationObserver(decorateTaskList).observe(list, { childList: true, subtree: true });
    checkReminders();
    setInterval(checkReminders, 15000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checkReminders(); });
    window.addEventListener('focus', checkReminders);
    // Keep dashboard XP derived from progress, so cloud restores don't duplicate reward points.
    setInterval(renderDashboard, 30000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  window.addEventListener('load', () => { init(); renderDashboard(); decorateTaskList(); });
})();
