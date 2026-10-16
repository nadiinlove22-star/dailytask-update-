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

  // Analisa Produk disimpan di progressData agar tetap kompatibel dengan skema cloud yang ada.
  function getAnalysisProducts() {
    if (!progressData || typeof progressData !== 'object') return [];
    if (!Array.isArray(progressData.__analysisProducts)) progressData.__analysisProducts = [];
    return progressData.__analysisProducts;
  }
  const metricFields = [
    { key: 'orders', label: 'Pesanan' },
    { key: 'ctr', label: 'CTR' },
    { key: 'creators', label: 'Kreator' },
    { key: 'cart', label: 'Add to cart' }
  ];
  function safeProductUrl(value) {
    try { const u = new URL(String(value || '').trim()); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch (_) { return ''; }
  }
  function hasMetric(value) { return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0; }
  function productScore(product) {
    const t = product && product.trend || {};
    const hasCtr = hasMetric(t.ctr);
    const hasOrders = hasMetric(t.orders);
    const hasCreators = hasMetric(t.creators);
    const hasCart = hasMetric(t.cart);
    if (!(hasCtr || hasOrders || hasCreators || hasCart)) return null;

    // Bobot disamakan dengan keterangan UI: pesanan 40%, CTR 25%, kreator 15%, add-to-cart 20%.
    // Metrik yang belum diisi tidak dianggap nol; bobot dinormalisasi hanya dari data yang tersedia.
    let score = 0, totalWeight = 0;
    if (hasOrders) {
      const volume = Math.min(100, Math.round(Math.log10(Number(t.orders) + 1) / 4 * 100));
      score += volume * 0.40;
      totalWeight += 0.40;
    }
    if (hasCtr) {
      const ctr = Number(t.ctr);
      score += (ctr >= 3.5 ? 100 : ctr >= 2.0 ? 70 : 40) * 0.25;
      totalWeight += 0.25;
    }
    if (hasCreators) {
      // Jumlah kreator dipakai sebagai proksi tingkat persaingan, bukan ukuran penjualan.
      score += (Number(t.creators) < 500 ? 100 : 60) * 0.15;
      totalWeight += 0.15;
    }
    if (hasCart) {
      const cartVolume = Math.min(100, Math.round(Math.log10(Number(t.cart) + 1) / 4 * 100));
      score += cartVolume * 0.20;
      totalWeight += 0.20;
    }
    return totalWeight ? Math.round(score / totalWeight) : null;
  }
  function productStatus(score) {
    if (score === null) return { label: 'Data belum diinput', color: 'text-amber-300', note: 'Masukkan metrik untuk menilai produk' };
    if (score >= 80) return { label: 'Sangat potensial', color: 'text-emerald-300', note: 'Dorong CTA checkout' };
    if (score >= 65) return { label: 'Bagus', color: 'text-yellow-300', note: 'Uji angle dan CTA' };
    return { label: 'Kurang potensial', color: 'text-rose-300', note: 'Evaluasi atau cari produk lain' };
  }
  function compactMetric(value, key) {
    if (!hasMetric(value)) return '—';
    const n = Number(value);
    if (key === 'ctr') return n.toLocaleString('id-ID', { maximumFractionDigits: 2 }) + '%';
    return n.toLocaleString('id-ID');
  }
  function productDateLabel(value) {
    if (!value) return 'Data belum diinput';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? 'Update: ' + value : 'Update ' + d.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
  }
  function openAddProductModal() {
    const modal = $('add-product-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
  function closeAddProductModal() {
    const modal = $('add-product-modal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
  }
  function openProductEditor(id) {
    closeAddProductModal();
    const modal = $('product-editor-modal'); if (!modal) return;
    const product = getAnalysisProducts().find(p => String(p.id) === String(id)) || null;
    $('product-editor-title').textContent = product ? 'Edit produk' : 'Tambah produk';
    $('product-editor-id').value = product ? product.id : '';
    $('product-editor-name').value = product ? product.name || '' : '';
    $('product-editor-url').value = product ? product.url || '' : '';
    const trend = product && product.trend || {};
    $('product-editor-orders').value = trend.orders ?? '';
    $('product-editor-ctr').value = trend.ctr ?? '';
    $('product-editor-creators').value = trend.creators ?? '';
    $('product-editor-cart').value = trend.cart ?? '';
    $('product-editor-date').textContent = productDateLabel(product && product.updatedAt);
    $('product-editor-error').classList.add('hidden');
    modal.classList.remove('hidden'); modal.classList.add('flex');
  }
  function closeProductEditor() {
    const modal = $('product-editor-modal'); if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
  }
  async function saveProductEditor(event) {
    if (event) event.preventDefault();
    const name = $('product-editor-name').value.trim();
    const url = safeProductUrl($('product-editor-url').value);
    const err = $('product-editor-error');
    if (!name || !url) { err.textContent = 'Nama dan link produk yang valid wajib diisi.'; err.classList.remove('hidden'); return; }
    const old = getAnalysisProducts().find(p => String(p.id) === String($('product-editor-id').value));
    const raw = { orders:$('product-editor-orders').value, ctr:$('product-editor-ctr').value, creators:$('product-editor-creators').value, cart:$('product-editor-cart').value };
    const hasNewMetrics = Object.values(raw).some(v => v.trim() !== '');
    const hasOldMetrics = old && old.trend && Object.values(old.trend).some(v => v !== null && v !== undefined && v !== '');
    const trend = {};
    Object.keys(raw).forEach(k => { trend[k] = raw[k].trim() === '' ? null : Number(raw[k]); });
    const item = old || { id: 'prod-' + Date.now() };
    item.name = name; item.url = url;
    if (hasNewMetrics || !hasOldMetrics) {
      item.trend = trend;
      item.updatedAt = hasNewMetrics ? new Date().toISOString() : null;
    }
    const list = getAnalysisProducts();
    if (!old) list.push(item);
    progressData.__analysisProducts = list;
    if (typeof saveData === 'function') {
      const ok = await saveData();
      if (!ok) { err.textContent = 'Gagal menyimpan ke cloud. Periksa koneksi lalu coba lagi.'; err.classList.remove('hidden'); return; }
    }
    closeProductEditor(); renderAnalysisTab();
  }
  async function deleteAnalysisProduct(id) {
    if (!confirm('Hapus produk ini?')) return;
    progressData.__analysisProducts = getAnalysisProducts().filter(p => String(p.id) !== String(id));
    if (typeof saveData === 'function') {
      const ok = await saveData();
      if (!ok) { alert('Gagal menyimpan penghapusan ke cloud.'); return; }
    }
    renderAnalysisTab();
  }
  function renderAnalysisTab() {
    const host = $('analysis-products-list'); if (!host) return;
    const all = getAnalysisProducts();
    host.innerHTML = '';
    const ranked = all.map(p => {
      const score = productScore(p), trend = p.trend || {};
      const hasAny = metricFields.some(m => hasMetric(trend[m.key]));
      return { product:p, score, hasData:!!(p.updatedAt && hasAny), hasAny };
    }).sort((a,b) => {
      if (a.hasData !== b.hasData) return a.hasData ? -1 : 1;
      if (a.score === null && b.score !== null) return 1;
      if (b.score === null && a.score !== null) return -1;
      return (b.score ?? -1) - (a.score ?? -1) || String(a.product.name).localeCompare(String(b.product.name));
    });
    const summary = $('analysis-summary');
    if (summary) summary.textContent = all.length ? ranked.filter(x=>x.hasData).length + ' ada data · ' + ranked.filter(x=>!x.hasData).length + ' belum diinput · skor tertinggi di atas' : 'Tempel link produk di atas untuk mulai.';
    if (!ranked.length) { host.innerHTML = '<div class="rounded-xl border border-dashed border-slate-700 p-4 text-center text-xs text-slate-400">Belum ada produk. Tempel link produk di atas.</div>'; return; }
    const cards = document.createElement('div'); cards.className = 'flex flex-col gap-2';
    ranked.forEach((entry, idx) => {
      const p=entry.product, t=p.trend||{}, status=productStatus(entry.score);
      const card=document.createElement('article');
      card.className='w-full min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70 p-3';
      const top=document.createElement('div'); top.className='flex min-w-0 items-start gap-2';
      const rank=document.createElement('div'); rank.className='flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-[10px] font-bold text-emerald-300'; rank.textContent=entry.hasData?'#'+(idx+1):'—';
      const info=document.createElement('div'); info.className='min-w-0 flex-1';
      const name=document.createElement('button'); name.type='button'; name.className='block w-full truncate text-left text-xs font-bold text-slate-100'; name.textContent=p.name||'Produk tanpa nama'; name.title='Buka tautan produk'; name.addEventListener('click',()=>{const link=safeProductUrl(p.url);if(link)window.open(link,'_blank','noopener,noreferrer');});
      const date=document.createElement('div'); date.className='mt-1 truncate text-[9px] text-slate-500'; date.textContent=entry.hasData?productDateLabel(p.updatedAt):'Metrik belum tersedia · '+(p.url?new URL(p.url).hostname:'link belum tersedia');
      info.append(name,date); top.append(rank,info);
      const score=document.createElement('span'); score.className='shrink-0 rounded-lg px-2 py-1 text-[11px] font-extrabold '+(entry.score===null?'bg-amber-500/10 text-amber-300':entry.score>=80?'bg-emerald-500/15 text-emerald-300':entry.score>=65?'bg-yellow-500/15 text-yellow-300':'bg-rose-500/15 text-rose-300'); score.textContent=entry.score===null?'—':entry.score+'/100'; top.append(score); card.append(top);
      const metrics=document.createElement('div'); metrics.className='mt-3 grid grid-cols-4 gap-1.5';
      [['CTR',compactMetric(t.ctr,'ctr')],['Pesanan',compactMetric(t.orders,'orders')],['ATC',compactMetric(t.cart,'cart')],['Kreator',compactMetric(t.creators,'creators')]].forEach(([label,value])=>{
        const cell=document.createElement('div'); cell.className='min-w-0 rounded-lg bg-slate-800/70 px-2 py-2 text-center';
        const l=document.createElement('div'); l.className='truncate text-[9px] text-slate-500'; l.textContent=label;
        const v=document.createElement('div'); v.className='mt-1 truncate text-[11px] font-semibold text-slate-200'; v.textContent=value;
        cell.append(l,v); metrics.appendChild(cell);
      });
      card.append(metrics);
      const foot=document.createElement('div'); foot.className='mt-3 flex min-w-0 items-center justify-between gap-2';
      const statusWrap=document.createElement('div'); statusWrap.className='min-w-0 flex-1';
      const st=document.createElement('div'); st.className='truncate text-[10px] font-semibold '+status.color; st.textContent=status.label;
      const note=document.createElement('div'); note.className='truncate text-[9px] text-slate-500'; note.textContent=status.note;
      statusWrap.append(st,note);
      const actions=document.createElement('div'); actions.className='flex shrink-0 gap-1';
      const edit=document.createElement('button'); edit.type='button'; edit.className='rounded-lg border border-slate-700 px-2.5 py-1.5 text-[10px] text-slate-300'; edit.textContent='Edit'; edit.addEventListener('click',()=>openProductEditor(p.id));
      const open=document.createElement('button'); open.type='button'; open.className='rounded-lg bg-emerald-600/20 px-2.5 py-1.5 text-[10px] text-emerald-300'; open.textContent='Buka'; open.addEventListener('click',()=>{const link=safeProductUrl(p.url);if(link)window.open(link,'_blank','noopener,noreferrer');});
      const del=document.createElement('button'); del.type='button'; del.className='rounded-lg px-2 py-1.5 text-[10px] text-rose-400'; del.textContent='×'; del.title='Hapus produk'; del.addEventListener('click',()=>deleteAnalysisProduct(p.id));
      actions.append(edit,open,del); foot.append(statusWrap,actions); card.append(foot); cards.appendChild(card);
    });
    host.appendChild(cards);
  }
  function productNameFromUrl(url) {
    try {
      const u = new URL(url);
      const parts = u.pathname.split('/').filter(Boolean);
      let candidate = decodeURIComponent(parts[parts.length-1] || '').replace(/[-_]+/g,' ').replace(/\.(html?|php)$/i,'').replace(/\?.*$/,'').trim();
      candidate = candidate.replace(/\b(?:product|item|goods)\s*\d+\b/ig, '').replace(/\b\d{8,}\b/g, '').replace(/\s+/g, ' ').trim();
      if (/^product\s*\d+$/i.test(candidate) || /^\d+$/.test(candidate) || candidate.length < 3) candidate = '';
      return candidate.slice(0,120);
    } catch (_) { return ''; }
  }
  async function addProductFromPastedLink() {
    const input = $('analysis-paste-url'), feedback = $('analysis-paste-feedback');
    const url = safeProductUrl(input && input.value);
    const say = (message, kind='text-slate-500') => { if(feedback){feedback.textContent=message;feedback.className='mt-2 text-[10px] '+kind;} };
    if (!url) { say('Tempel link produk HTTPS yang valid dulu.', 'text-rose-400'); return; }
    const existing = getAnalysisProducts().find(p => safeProductUrl(p.url) === url);
    if (existing) { say('Link ini sudah ada di daftar. Membuka edit produk.', 'text-amber-300'); openProductEditor(existing.id); return; }
    const button = document.querySelector('button[onclick="addProductFromPastedLink()"]');
    if (button) { button.disabled=true; button.textContent='Mencari…'; }
    say('Sedang mencoba membaca nama dan metadata dari halaman produk…');
    let metadata = null, metadataError = '';
    try {
      if (typeof supabaseClient !== 'undefined' && supabaseClient && supabaseClient.functions) {
        const result = await supabaseClient.functions.invoke('product-metadata', { body: { url } });
        if (!result.error && result.data && result.data.ok) metadata = result.data;
        else if (result.error) { metadataError = result.error.message || 'Permintaan metadata gagal.'; console.warn('Metadata produk:', metadataError); }
        else if (result.data && result.data.error) metadataError = result.data.error;
      }
    } catch (e) { metadataError = String(e && e.message || 'Koneksi metadata tidak tersedia.'); console.warn('Metadata produk tidak tersedia:', e); }
    const guessedName = productNameFromUrl(url);
    const cleanTitle = value => {
      const title = String(value || '').replace(/\s+/g, ' ').trim();
      if (!title || /security check|verify (that )?you are human|captcha|access denied|just a moment|checking your browser|robot or human|periksa keamanan|verifikasi keamanan/i.test(title)) return '';
      return title;
    };
    const productTitle = cleanTitle(metadata && metadata.title) || cleanTitle(guessedName);
    const item = {
      id:'prod-'+Date.now(),
      name:productTitle || 'Nama produk belum terbaca',
      url,
      trend:{orders:null,ctr:null,creators:null,cart:null},
      updatedAt:null,
      metadata: metadata ? {description:metadata.description||'',image:metadata.image||'',price:metadata.price||'',currency:metadata.currency||''} : null
    };
    getAnalysisProducts().push(item);
    if (typeof saveData === 'function') {
      const ok = await saveData();
      if (!ok) {
        progressData.__analysisProducts = getAnalysisProducts().filter(p=>String(p.id)!==String(item.id));
        say('Gagal menyimpan produk. Periksa koneksi lalu coba lagi.', 'text-rose-400');
        if (button) {button.disabled=false;button.textContent='Tambah';}
        return;
      }
    }
    input.value='';
    closeAddProductModal();
    renderAnalysisTab();
    if (productTitle) {
      say(metadata && cleanTitle(metadata.title) ? 'Nama produk berhasil dibaca dari metadata halaman. Statistik performa belum diambil otomatis.' : 'Nama diambil dari teks link, bukan diverifikasi dari halaman. Statistik performa belum diambil otomatis.', 'text-emerald-300');
    } else {
      say('TikTok menampilkan Security Check atau tidak memberikan nama produk. Link tersimpan, tetapi nama tidak ditebak. Buka Edit produk dan isi nama yang benar. '+(metadataError ? metadataError+' ' : '')+'CTR, pesanan, add-to-cart, dan kreator belum terhubung ke sumber data resmi.', 'text-amber-300');
      openProductEditor(item.id);
    }
    if (button) {button.disabled=false;button.textContent='Tambah';}
  }
  // OCR screenshot runs in the browser. It reads visible text; extracted values must be reviewed before saving.
  let analysisOcrWorkerPromise = null;
  function loadAnalysisOcr() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (analysisOcrWorkerPromise) return analysisOcrWorkerPromise;
    analysisOcrWorkerPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      script.async = true;
      script.onload = () => window.Tesseract ? resolve(window.Tesseract) : reject(new Error('Pustaka OCR tidak tersedia.'));
      script.onerror = () => reject(new Error('Gagal memuat OCR. Periksa koneksi internet lalu coba lagi.'));
      document.head.appendChild(script);
    });
    return analysisOcrWorkerPromise;
  }
  function parseAnalysisScreenshotText(text) {
    const lines = String(text || '').split(/\r?\n/)
      .map(s => s.replace(/[|]/g, ' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const labelRules = {
      orders: /\b(?:pesanan|orders?|sold|terjual|jumlah penjualan|total pesanan)\b/i,
      ctr: /\b(?:CTR|click.?through.?rate|rasio klik(?: tayang)?|rasio klik)\b/i,
      creators: /\b(?:jumlah\s*kreator|kreator|creators?|creator affiliate|affiliate creators?)\b/i,
      cart: /\b(?:pembeli(?:\s+yang)?\s+(?:memasukkan|menambahkan)\s+(?:produk\s+)?ke\s+keranjang|pembeli\s+memasukkan\s+ke\s+keranjang|add.?to.?cart|keranjang|tambah(?:kan)? ke keranjang|ditambahkan ke keranjang|cart adds?|produk ditambahkan|ditambah ke keranjang)\b/i
    };
    const metricKeys = Object.keys(labelRules);
    const parseNumber = raw => {
      const match = String(raw || '').match(/(\d[\d.,]*)(?:\s*([KMB]))?\s*(%|％)?/i);
      if (!match) return null;
      let token = match[1].replace(/\s/g, '');
      if (/^\d{1,3}(?:\.\d{3})+$/.test(token)) token = token.replace(/\./g, '');
      else if (/^\d{1,3}(?:,\d{3})+$/.test(token)) token = token.replace(/,/g, '');
      else token = token.replace(',', '.');
      let value = Number(token);
      const suffix = String(match[2] || '').toLowerCase();
      if (suffix === 'k') value *= 1e3;
      if (suffix === 'm') value *= 1e6;
      if (suffix === 'b') value *= 1e9;
      return Number.isFinite(value) && value >= 0 ? value : null;
    };
    const isNumericOnly = line => /^\s*\d[\d.,]*\s*[KMB]?\s*%?\s*$/i.test(String(line || ''));
    const findMetric = key => {
      const rule = labelRules[key];
      const readValue = raw => {
        const source = String(raw || '');
        if (key === 'ctr') {
          const match = source.match(/(\d[\d.,]*)\s*(?:%|％)/);
          return match ? parseNumber(match[1]) : null;
        }
        return parseNumber(source);
      };
      // Prefer a value on the same line as its own label; stop before another metric label.
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const label = rule.exec(line);
        if (!label) continue;
        let tail = line.slice(label.index + label[0].length);
        const otherLabels = metricKeys.filter(k => k !== key)
          .map(k => labelRules[k].exec(tail)).filter(Boolean).sort((a,b) => a.index-b.index);
        if (otherLabels.length) tail = tail.slice(0, otherLabels[0].index);
        const inline = readValue(tail);
        if (inline !== null) return inline;
        const before = readValue(line.slice(0, label.index));
        if (before !== null) return before;
        // A value below a label is valid only before the next metric label.
        // This avoids borrowing the neighboring card's value in a 2x2 layout.
        for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
          const next = lines[j];
          if (metricKeys.some(k => labelRules[k].test(next))) break;
          if (key === 'ctr') {
            const pct = readValue(next);
            if (pct !== null) return pct;
          } else if (isNumericOnly(next)) {
            const value = readValue(next);
            if (value !== null) return value;
          }
          if (next.length > 55 || /[A-Za-zÀ-ÿ]{3,}/.test(next)) break;
        }
      }
      return null;
    };

    const shopBadge = /\b(?:mall|power\s*shop|powershop|beli\s*lokal|belilokal|official\s*store|star\s*shop)\b/i;
    const ignored = /^(?:analisa|analisis|tren|trend|statistik|produk|product|tiktok shop|data|7 hari|7 days|overview|ringkasan|performa produk|product performance|produk terlaris|mall|power\s*shop|powershop|beli\s*lokal|belilokal|official\s*store|star\s*shop)$/i;
    const metricLine = line => metricKeys.some(key => labelRules[key].test(line)) ||
      /\b(?:revenue|pendapatan|klik|views|tayangan|komisi|gmv|conversion|konversi|stok|harga|rp\s?\d|terjual)\b/i.test(line);
    const plausibleTitle = line => {
      const clean = String(line || '').replace(/^[•·|\-–—]+\s*/, '').trim();
      return clean.length >= 4 && clean.length <= 180 &&
        !ignored.test(clean) && !metricLine(clean) &&
        !/^https?:/i.test(clean) &&
        !/^\d[\d.,]*\s*(?:%|K|M|B)?$/i.test(clean) &&
        !/^(?:Rp\s*)?[\d.,]+(?:\s*(?:rb|ribu|jt|juta))?$/i.test(clean);
    };

    // Judul produk berada pada bagian setelah "Ringkasan" dan menempel pada label toko.
    // Jangan mengambil label toko/judul yang muncul di bagian lain screenshot.
    let name = '';
    const summaryIndex = lines.findIndex(line => /\bringkasan\b/i.test(line));
    if (summaryIndex >= 0) {
      for (let i = summaryIndex; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(shopBadge);
        if (!match) continue;
        const remainder = line.slice(match.index + match[0].length)
          .replace(/^[\s:|·•\-–—]+/, '').trim();
        if (plausibleTitle(remainder)) { name = remainder; break; }
        // Some OCR engines split the shop badge and product title into adjacent lines.
        for (let j = i + 1; j <= Math.min(i + 2, lines.length - 1); j++) {
          const next = lines[j];
          if (shopBadge.test(next) || metricLine(next) || /\bringkasan\b/i.test(next)) break;
          if (plausibleTitle(next)) { name = next; break; }
          if (next.length > 180) break;
        }
        if (name) break;
      }
    }
    name = name.replace(/^[•·|\-–—]+\s*/, '').trim();
    if (name && name === name.toLocaleUpperCase('id-ID') && /[A-ZÀ-Þ]/.test(name)) {
      name = name.toLocaleLowerCase('id-ID').replace(/(^|[\s/\-(])([a-zà-ÿ])/g, (m, lead, letter) => lead + letter.toLocaleUpperCase('id-ID'));
    }
    return { name, orders: findMetric('orders'), ctr: findMetric('ctr'), creators: findMetric('creators'), cart: findMetric('cart') };
  }
  async function readAnalysisScreenshot() {
    const fileInput = $('analysis-screenshot');
    const file = fileInput && fileInput.files && fileInput.files[0];
    const urlInput = $('analysis-paste-url');
    const feedback = $('analysis-paste-feedback');
    const preview = $('analysis-screenshot-preview');
    const img = $('analysis-screenshot-image');
    const status = $('analysis-screenshot-status');
    const button = $('analysis-read-screenshot');
    const say = (message, kind='text-slate-400') => { if(feedback){feedback.textContent=message;feedback.className='mt-2 text-[10px] '+kind;} };
    if (!file || !/^image\//i.test(file.type)) { say('Pilih screenshot berupa gambar terlebih dahulu.', 'text-rose-400'); return; }
    if (file.size > 12 * 1024 * 1024) { say('Ukuran gambar terlalu besar. Gunakan screenshot di bawah 12 MB.', 'text-rose-400'); return; }
    // Screenshot tetap boleh dibaca meskipun link belum ditempel. Link bisa diisi
    // setelah hasil OCR masuk ke formulir; jangan hentikan proses OCR di tahap ini.
    const productUrl = safeProductUrl(urlInput && urlInput.value);
    if (preview) preview.classList.remove('hidden');
    if (img) img.src = URL.createObjectURL(file);
    if (status) status.textContent = 'Memuat OCR…';
    if (button) { button.disabled = true; button.textContent = 'Membaca gambar…'; }
    say('Sedang membaca teks screenshot di perangkat ini. Proses pertama bisa memerlukan waktu.');
    try {
      const Tesseract = await loadAnalysisOcr();
      // Gunakan file asli terlebih dahulu. Pemrosesan grayscale/upscale sebelumnya
      // berisiko merusak teks kecil pada screenshot berwarna; pertahankan fallback bahasa.
      let result = await Tesseract.recognize(file, 'ind+eng', {
        logger: m => { if(status && m.status) status.textContent = m.status + (m.progress != null ? ' ' + Math.round(m.progress*100) + '%' : ''); }
      });
      let rawOcrText = result && result.data && result.data.text || '';
      if (rawOcrText.trim().length < 8) {
        if (status) status.textContent = 'Mencoba pembacaan alternatif…';
        result = await Tesseract.recognize(file, 'eng', {
          logger: m => { if(status && m.status) status.textContent = 'Mode alternatif: ' + m.status + (m.progress != null ? ' ' + Math.round(m.progress*100) + '%' : ''); }
        });
        const fallbackText = result && result.data && result.data.text || '';
        if (fallbackText.trim().length > rawOcrText.trim().length) rawOcrText = fallbackText;
      }
      const parsed = parseAnalysisScreenshotText(rawOcrText);
      closeAddProductModal();
      const existing = productUrl ? getAnalysisProducts().find(p => safeProductUrl(p.url) === productUrl) : null;
      if (existing) openProductEditor(existing.id);
      else {
        openProductEditor();
        $('product-editor-id').value = '';
        $('product-editor-url').value = productUrl || '';
        $('product-editor-name').value = parsed.name || (productUrl ? productNameFromUrl(productUrl) : '') || '';
      }
      if (parsed.name && !$('product-editor-name').value.trim()) $('product-editor-name').value = parsed.name;
      if (parsed.orders !== null) $('product-editor-orders').value = parsed.orders;
      if (parsed.ctr !== null) $('product-editor-ctr').value = parsed.ctr;
      if (parsed.creators !== null) $('product-editor-creators').value = parsed.creators;
      if (parsed.cart !== null) $('product-editor-cart').value = parsed.cart;
      const found = [parsed.name ? 'nama' : '', parsed.orders !== null ? 'pesanan' : '', parsed.ctr !== null ? 'CTR' : '', parsed.creators !== null ? 'kreator' : '', parsed.cart !== null ? 'add to cart' : ''].filter(Boolean);
      const message = (found.length ? 'Terbaca: ' + found.join(', ') + '. Periksa hasilnya lalu tekan Simpan.' : 'Gambar berhasil dibaca, tetapi nama/metrik belum dikenali. Isi atau koreksi formulir secara manual sebelum menyimpan.') + (productUrl ? '' : ' Link produk belum diisi; tempel link di formulir sebelum menyimpan.');
      if (status) status.textContent = message;
      say(message, found.length ? 'text-emerald-300' : 'text-amber-300');
      const metricCount = [parsed.orders, parsed.ctr, parsed.creators, parsed.cart].filter(v => v !== null).length;
      if (metricCount < 4 || !parsed.name) {
        const sample = rawOcrText.trim().replace(/\s+/g, ' ').slice(0, 500);
        const missing = [
          parsed.name ? '' : 'nama',
          parsed.orders === null ? 'pesanan' : '',
          parsed.ctr === null ? 'CTR' : '',
          parsed.creators === null ? 'kreator' : '',
          parsed.cart === null ? 'add-to-cart' : ''
        ].filter(Boolean).join(', ');
        const diagnostic = sample ? ' Teks OCR mentah: "' + sample + '".' : ' OCR tidak menghasilkan teks.';
        $('product-editor-error').textContent = 'Data belum lengkap (' + missing + '). Koreksi manual sebelum menyimpan.' + diagnostic;
        $('product-editor-error').classList.remove('hidden');
        if (status) status.textContent = 'OCR selesai. Data yang belum dikenali dan teks pembacaan ditampilkan di formulir.';
      }
    } catch (e) {
      console.error('OCR screenshot gagal:', e);
      const message = String(e && e.message || 'OCR gagal membaca gambar.');
      if (status) status.textContent = message;
      say(message + ' Kamu masih bisa mengisi data secara manual.', 'text-rose-400');
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Baca Screenshot & Isi Data'; }
    }
  }
  window.openAddProductModal = openAddProductModal;
  window.closeAddProductModal = closeAddProductModal;
  window.readAnalysisScreenshot = readAnalysisScreenshot;
  window.addProductFromPastedLink = addProductFromPastedLink;
  window.openProductEditor = openProductEditor;
  window.closeProductEditor = closeProductEditor;
  window.saveProductEditor = saveProductEditor;
  window.renderAnalysisTab = renderAnalysisTab;

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
    renderAnalysisTab();
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
