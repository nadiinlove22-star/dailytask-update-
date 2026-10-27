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
    if (!statsTab || $('advanced-dashboard') || $('affiliate-schedule-list')) return;
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

    // Skor deterministik agar konsisten: CTR 35%, pesanan 30%, peluang persaingan 25%, rasio add-to-cart/pesanan 10%.
    // Data yang tidak tersedia tidak ditebak; bobot hanya dinormalisasi dari metrik yang tersedia.
    let score = 0, totalWeight = 0;
    if (hasCtr) {
      const ctr = Number(t.ctr);
      const points = ctr >= 3.5 ? 100 : ctr >= 2.0 ? 70 : 40;
      score += points * 0.35;
      totalWeight += 0.35;
    }
    if (hasOrders) {
      const orders = Number(t.orders);
      const points = orders >= 1000 ? 100 : orders >= 500 ? 90 : orders >= 100 ? 80 : orders >= 50 ? 70 : orders >= 10 ? 55 : orders > 0 ? 40 : 0;
      score += points * 0.30;
      totalWeight += 0.30;
    }
    if (hasCreators) {
      const creators = Number(t.creators);
      const points = creators <= 10 ? 100 : creators <= 50 ? 85 : creators <= 100 ? 70 : creators <= 500 ? 45 : 15;
      score += points * 0.25;
      totalWeight += 0.25;
    }
    if (hasCart && hasOrders && Number(t.orders) > 0) {
      const ratio = Number(t.cart) / Number(t.orders);
      const points = ratio >= 1.5 ? 100 : ratio >= 1 ? 80 : ratio >= 0.5 ? 60 : ratio > 0 ? 40 : 20;
      score += points * 0.10;
      totalWeight += 0.10;
    } else if (hasCart && !hasOrders) {
      // Jika pesanan tidak tersedia, jangan menganggap jumlah keranjang sebagai rasio.
      // Bobot 10% dikeluarkan sampai data pesanan tersedia.
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
    $('product-editor-price').value = product && product.priceRupiah != null ? product.priceRupiah : '';
    const trend = product && product.trend || {};
    $('product-editor-orders').value = trend.orders ?? '';
    $('product-editor-ctr').value = trend.ctr ?? '';
    $('product-editor-creators').value = trend.creators ?? '';
    $('product-editor-cart').value = trend.cart ?? '';
    $('product-editor-commission-percent').value = product && product.commission && product.commission.percent != null ? product.commission.percent : '';
    $('product-editor-commission-amount').value = product && product.commission && product.commission.amountRupiah != null ? product.commission.amountRupiah : '';
    $('product-editor-commission-total').value = product && product.commission && product.commission.totalRupiah != null ? product.commission.totalRupiah : '';
    $('product-editor-period-start').value = product && product.trendPeriod && product.trendPeriod.start || '';
    $('product-editor-period-end').value = product && product.trendPeriod && product.trendPeriod.end || '';
    $('product-editor-trend-changes').value = JSON.stringify(product && product.trendChanges || {});
    $('product-editor-price').value = product && product.priceRupiah != null ? product.priceRupiah : '';
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
    const priceRaw = $('product-editor-price')?.value.trim() || '';
    const hasNewMetrics = Object.values(raw).some(v => v.trim() !== '');
    const hasOldMetrics = old && old.trend && Object.values(old.trend).some(v => v !== null && v !== undefined && v !== '');
    const trend = {};
    Object.keys(raw).forEach(k => { trend[k] = raw[k].trim() === '' ? null : Number(raw[k]); });
    const list = getAnalysisProducts();
    const duplicateByUrl = !old ? list.find(p => safeProductUrl(p.url) === url) : null;
    const item = old || duplicateByUrl || { id: 'prod-' + Date.now() };
    item.name = name; item.url = url;
    item.priceRupiah = priceRaw === '' ? (item.priceRupiah ?? null) : Number(priceRaw);
    if (window.__pendingProductAiAnalysis) { item.aiAnalysis = window.__pendingProductAiAnalysis; window.__pendingProductAiAnalysis = null; }
    else if (old && old.trend && JSON.stringify(old.trend) !== JSON.stringify(trend)) item.aiAnalysis = null;
    if (hasNewMetrics || !hasOldMetrics) {
      item.trend = trend;
      item.updatedAt = hasNewMetrics ? new Date().toISOString() : null;
    }
    const periodStart = $('product-editor-period-start')?.value || '';
    const periodEnd = $('product-editor-period-end')?.value || '';
    item.trendPeriod = periodStart || periodEnd ? { start: periodStart || null, end: periodEnd || null } : (item.trendPeriod || null);
    const commission = { percent:$('product-editor-commission-percent')?.value.trim() || null, amountRupiah:$('product-editor-commission-amount')?.value.trim() || null, totalRupiah:$('product-editor-commission-total')?.value.trim() || null };
    let priceForMath = item.priceRupiah != null && Number.isFinite(Number(item.priceRupiah)) && Number(item.priceRupiah) > 0 ? Number(item.priceRupiah) : null;
    let commissionPercent = commission.percent === null ? null : Number(commission.percent);
    let commissionAmount = commission.amountRupiah === null ? null : Number(commission.amountRupiah);
    let priceCalculated = false;
    // Hitung hanya jika dua nilai pendukung tersedia dan valid; jangan memakai total komisi sebagai komisi per penjualan.
    if (commissionPercent === null && priceForMath !== null && commissionAmount !== null && commissionAmount >= 0) {
      commissionPercent = commissionAmount / priceForMath * 100;
    }
    if (commissionAmount === null && priceForMath !== null && commissionPercent !== null && commissionPercent >= 0 && commissionPercent <= 100) {
      commissionAmount = priceForMath * commissionPercent / 100;
    }
    // Jika harga tidak terbaca, turunkan dari komisi per penjualan dan persentase komisi.
    if (priceForMath === null && commissionAmount !== null && commissionAmount >= 0 && commissionPercent !== null && commissionPercent > 0 && commissionPercent <= 100) {
      priceForMath = commissionAmount / (commissionPercent / 100);
      if (Number.isFinite(priceForMath) && priceForMath > 0) {
        item.priceRupiah = Math.round(priceForMath);
        priceForMath = item.priceRupiah;
        priceCalculated = true;
      } else {
        priceForMath = null;
      }
    }
    item.commission = {
      percent: commissionPercent === null || !Number.isFinite(commissionPercent) ? null : Math.round(commissionPercent * 100) / 100,
      amountRupiah: commissionAmount === null || !Number.isFinite(commissionAmount) ? null : Math.round(commissionAmount),
      totalRupiah: commission.totalRupiah === null ? (old && old.commission ? old.commission.totalRupiah ?? null : null) : Number(commission.totalRupiah)
    };
    item.commission.calculatedPercent = commission.percent === null && item.commission.percent !== null;
    item.commission.calculatedAmount = commission.amountRupiah === null && item.commission.amountRupiah !== null;
    item.priceCalculated = priceCalculated || Boolean(old && old.priceCalculated);
    try {
      const changes = JSON.parse($('product-editor-trend-changes')?.value || '{}');
      if (changes && typeof changes === 'object') item.trendChanges = changes;
    } catch (_) {}
    if (!old && !duplicateByUrl) list.push(item);
    const snapshot = { at: new Date().toISOString(), trend: { ...item.trend }, priceRupiah: item.priceRupiah ?? null, commission: item.commission ? { ...item.commission } : null };
    if (!Array.isArray(item.history)) item.history = [];
    const lastSnapshot = item.history[item.history.length - 1];
    if (!lastSnapshot || JSON.stringify(lastSnapshot.trend) !== JSON.stringify(snapshot.trend) || lastSnapshot.priceRupiah !== snapshot.priceRupiah || JSON.stringify(lastSnapshot.commission) !== JSON.stringify(snapshot.commission)) item.history.push(snapshot);
    item.history = item.history.slice(-30);
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
      card.className='w-full min-w-0 rounded-xl border border-slate-800 bg-slate-900/70 p-2.5';
      const top=document.createElement('div'); top.className='flex min-w-0 items-start gap-2';
      const rank=document.createElement('div'); rank.className='flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-800 text-[9px] font-bold text-emerald-300'; rank.textContent=entry.hasData?'#'+(idx+1):'—';
      const info=document.createElement('div'); info.className='min-w-0 flex-1';
      const titleRow=document.createElement('div'); titleRow.className='flex min-w-0 items-start gap-1.5';
      const name=document.createElement('button'); name.type='button'; name.className='min-w-0 flex-1 whitespace-normal break-words text-left text-[11px] leading-snug font-bold text-slate-100'; name.textContent=p.name||'Produk tanpa nama'; name.title='Klik judul untuk membuka tautan produk'; name.addEventListener('click',()=>{const link=safeProductUrl(p.url);if(link)window.open(link,'_blank','noopener,noreferrer');});
      const actions=document.createElement('div'); actions.className='flex shrink-0 items-center gap-1';
      const edit=document.createElement('button'); edit.type='button'; edit.className='flex h-7 w-7 items-center justify-center rounded-md border border-slate-700 text-slate-300'; edit.textContent='✏️'; edit.title='Edit produk'; edit.setAttribute('aria-label','Edit produk'); edit.addEventListener('click',()=>openProductEditor(p.id));
      const del=document.createElement('button'); del.type='button'; del.className='flex h-7 w-7 items-center justify-center rounded-md border border-rose-500/20 text-rose-400'; del.textContent='🗑️'; del.title='Hapus produk'; del.setAttribute('aria-label','Hapus produk'); del.addEventListener('click',()=>deleteAnalysisProduct(p.id));
      actions.append(edit,del);
      titleRow.append(name,actions);
      const date=document.createElement('div'); date.className='mt-0.5 whitespace-normal break-words text-[9px] leading-snug text-slate-500'; date.textContent=entry.hasData?productDateLabel(p.updatedAt):'Metrik belum tersedia · '+(p.url?new URL(p.url).hostname:'link belum tersedia');
      info.append(titleRow,date); top.append(rank,info);
      const right=document.createElement('div'); right.className='flex max-w-[44%] shrink-0 flex-col items-end gap-1 text-right';
      const score=document.createElement('span'); score.className='shrink-0 rounded-md px-1.5 py-1 text-[10px] font-extrabold '+(entry.score===null?'bg-amber-500/10 text-amber-300':entry.score>=80?'bg-emerald-500/15 text-emerald-300':entry.score>=65?'bg-yellow-500/15 text-yellow-300':'bg-rose-500/15 text-rose-300'); score.textContent=entry.score===null?'—':entry.score+'/100';
      const analysis=document.createElement('div'); analysis.className='whitespace-normal break-words text-[9px] leading-tight font-semibold '+status.color; analysis.textContent=status.label;
      const note=document.createElement('div'); note.className='whitespace-normal break-words text-[8px] leading-tight text-slate-500'; note.textContent=status.note;
      right.append(score,analysis,note); top.append(right); card.append(top);
      const detailToggle=document.createElement('button'); detailToggle.type='button'; detailToggle.className='flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-sm text-sky-300'; detailToggle.textContent='📈'; detailToggle.title='Lihat grafik dan detail data'; detailToggle.setAttribute('aria-label','Lihat grafik dan detail data');
      const metrics=document.createElement('div'); metrics.className='mt-2 min-w-0 hidden border-t border-slate-800 pt-2';
      detailToggle.addEventListener('click',()=>{const isHidden=metrics.classList.toggle('hidden');detailToggle.title=isHidden?'Lihat grafik dan detail data':'Tutup detail data';});
      const scoreLine=document.createElement('div'); scoreLine.className='flex items-center justify-end gap-1'; scoreLine.append(score,detailToggle); right.prepend(scoreLine);
      const history=Array.isArray(p.history)?p.history:[];
      const chartTitle=document.createElement('div'); chartTitle.className='mb-1 text-[10px] font-semibold text-slate-300'; chartTitle.textContent='Grafik pesanan per input';
      metrics.appendChild(chartTitle);
      const chart=document.createElementNS('http://www.w3.org/2000/svg','svg'); chart.setAttribute('viewBox','0 0 300 76'); chart.setAttribute('width','100%'); chart.setAttribute('height','76'); chart.setAttribute('role','img'); chart.setAttribute('aria-label','Grafik perubahan pesanan');
      const points=history.filter(s=>s&&s.trend&&hasMetric(s.trend.orders)).slice(-10);
      if(points.length){
        const max=Math.max(1,...points.map(s=>Number(s.trend.orders))), min=Math.min(...points.map(s=>Number(s.trend.orders)));
        const coords=points.map((s,i)=>({x:points.length===1?150:10+i*280/(points.length-1),y:62-(Number(s.trend.orders)-min)/(max-min||1)*46,v:Number(s.trend.orders)}));
        const axis=document.createElementNS(chart.namespaceURI,'path'); axis.setAttribute('d','M10 62 H290'); axis.setAttribute('stroke','#334155'); axis.setAttribute('stroke-width','1'); chart.appendChild(axis);
        if(coords.length>1){const line=document.createElementNS(chart.namespaceURI,'polyline');line.setAttribute('points',coords.map(c=>c.x+','+c.y).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke','#38bdf8');line.setAttribute('stroke-width','2.5');line.setAttribute('stroke-linecap','round');line.setAttribute('stroke-linejoin','round');chart.appendChild(line);}
        coords.forEach(c=>{const dot=document.createElementNS(chart.namespaceURI,'circle');dot.setAttribute('cx',c.x);dot.setAttribute('cy',c.y);dot.setAttribute('r','3');dot.setAttribute('fill','#38bdf8');chart.appendChild(dot);});
        const label=document.createElementNS(chart.namespaceURI,'text');label.setAttribute('x','10');label.setAttribute('y','11');label.setAttribute('fill','#cbd5e1');label.setAttribute('font-size','9');label.textContent='Pesanan: '+coords[coords.length-1].v.toLocaleString('id-ID');chart.appendChild(label);
      } else { const empty=document.createElementNS(chart.namespaceURI,'text');empty.setAttribute('x','150');empty.setAttribute('y','42');empty.setAttribute('text-anchor','middle');empty.setAttribute('fill','#64748b');empty.setAttribute('font-size','10');empty.textContent='Grafik muncul setelah data disimpan';chart.appendChild(empty); }
      metrics.appendChild(chart);
      const metricRow=document.createElement('div'); metricRow.className='grid grid-cols-4 gap-1 border-y border-slate-800 py-2';
      [['CTR',compactMetric(t.ctr,'ctr')],['Pesanan',compactMetric(t.orders,'orders')],['Kreator',compactMetric(t.creators,'creators')],['Keranjang',compactMetric(t.cart,'cart')]].forEach(([label,value])=>{
        const cell=document.createElement('div'); cell.className='min-w-0 text-center';
        const l=document.createElement('div'); l.className='whitespace-normal break-words text-[8px] leading-tight text-slate-500'; l.textContent=label;
        const v=document.createElement('div'); v.className='mt-1 whitespace-normal break-words text-[10px] leading-tight font-semibold text-slate-200'; v.textContent=value;
        cell.append(l,v); metricRow.appendChild(cell);
      });
      metrics.appendChild(metricRow);
      const detail=document.createElement('div'); detail.className='mt-2 grid grid-cols-1 gap-1 text-[9px] leading-snug text-slate-400';
      const price=document.createElement('div'); price.textContent='Harga produk: '+(p.priceRupiah!=null?'Rp '+Number(p.priceRupiah).toLocaleString('id-ID'):'belum terbaca'); detail.appendChild(price);
      const ps=p.trendPeriod&&p.trendPeriod.start, pe=p.trendPeriod&&p.trendPeriod.end;
      const period=document.createElement('div'); period.textContent='Periode 7 hari: '+(ps||pe ? (ps||'?')+' sampai '+(pe||'?') : 'belum terbaca dari screenshot'); detail.appendChild(period);
      const changes=p.trendChanges||{};
      const changeLabel=(key,label,suffix='')=>{const v=changes[key]; if(v===null||v===undefined||v==='')return label+': perubahan belum terbaca'; const n=Number(v); return label+': '+(n>0?'↑ +':n<0?'↓ ':'')+n.toLocaleString('id-ID')+suffix;};
      ['orders','ctr','creators','cart'].forEach(key=>{if(changes[key]!==undefined&&changes[key]!==null) {const row=document.createElement('div');row.textContent=changeLabel(key,{orders:'Perubahan pesanan',ctr:'Perubahan CTR',creators:'Perubahan kreator',cart:'Perubahan Add to Cart'}[key],key==='ctr'?' poin %':'');detail.appendChild(row);}});
      const commission=p.commission||{};
      if(commission.percent!=null||commission.amountRupiah!=null||commission.totalRupiah!=null){
        const c=document.createElement('div'); c.className='mt-1 border-t border-slate-800 pt-1 text-slate-300';
        c.textContent='Komisi: '+(commission.percent!=null?commission.percent+'%':'—')+' · per penjualan '+(commission.amountRupiah!=null?'Rp '+Number(commission.amountRupiah).toLocaleString('id-ID'):'—')+' · total '+(commission.totalRupiah!=null?'Rp '+Number(commission.totalRupiah).toLocaleString('id-ID'):'—'); detail.appendChild(c);
      }
      const ai=p.aiAnalysis||{};
      if(ai.summary){const s=document.createElement('div');s.className='mt-1 rounded-lg bg-slate-800/70 p-2 text-slate-300';s.textContent='Analisa AI: '+ai.summary;detail.appendChild(s);}
      if(ai.recommendation){const r=document.createElement('div');r.className='text-sky-300';r.textContent='Saran: '+ai.recommendation;detail.appendChild(r);}
      metrics.appendChild(detail); card.append(metrics);
      cards.appendChild(card);
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
    const pastedText = String(input && input.value || '').replace(/\s+/g, ' ').trim();
    // Clipboard text can contain both a product title and URL; separate them before validating.
    const urlMatch = pastedText.match(/https?:\/\/[^\s<>"']+/i);
    const extractedUrl = urlMatch ? urlMatch[0].replace(/[),.;]+$/, '') : pastedText;
    const url = safeProductUrl(extractedUrl);
    const titleBeforeUrl = urlMatch ? pastedText.slice(0, pastedText.indexOf(urlMatch[0])).trim() : '';
    const pastedName = titleBeforeUrl
      .replace(/^[\s|—–:-]+|[\s|—–:-]+$/g, '')
      .split(/\s+/).filter(Boolean).slice(0, 4).join(' ');
    const say = (message, kind='text-slate-500') => { if(feedback){feedback.textContent=message;feedback.className='mt-2 text-[10px] '+kind;} };
    if (!url) { say('Tempel teks nama produk beserta link HTTPS, atau link produk HTTPS yang valid.', 'text-rose-400'); return; }
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
    const productTitle = cleanTitle(pastedName) || cleanTitle(metadata && metadata.title) || cleanTitle(guessedName);
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
      say(pastedName ? 'Nama dan link berhasil dipisahkan otomatis. Nama diambil maksimal 4 kata dari teks sebelum link.' : (metadata && cleanTitle(metadata.title) ? 'Nama produk berhasil dibaca dari metadata halaman. Statistik performa belum diambil otomatis.' : 'Nama diambil dari metadata atau link, bukan diverifikasi dari halaman. Statistik performa belum diambil otomatis.'), 'text-emerald-300');
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
      // Match metric labels, not any mention of these words elsewhere in the screenshot.
      orders: /\b(?:pesanan|orders?|jumlah\s+penjualan|total\s+pesanan)\b/i,
      ctr: /\b(?:CTR|click.?through.?rate|rasio klik(?: tayang)?|rasio klik)\b/i,
      creators: /\b(?:jumlah\s+kreator|jumlah\s+creator(?:s)?|affiliate\s+creator(?:s)?|creator\s+affiliate)\b/i,
      cart: /\b(?:pembeli|memasukkan|menambahkan|masuk\s+ke|add.?to.?cart|cart\s+adds?|keranjang|tambah(?:kan)?|ditambahkan|produk\s+ditambahkan)\b/i
    };
    const metricKeys = Object.keys(labelRules);
    const unrelatedMetric = /\b(?:views?|tayangan|ditonton|penayangan|video|likes?|suka|komentar|comments?|shares?|dibagikan|impressions?|jangkauan|kreator\s+challenge|tren\s+produk|7\s+hari\s+terakhir)\b/i;
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
          if (unrelatedMetric.test(next)) break;
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
  // Prefer OCR word coordinates over flattened text: metric cards are arranged in a 2x2 grid,
  // so their values must be matched to labels in the same horizontal card.
  function parseAnalysisScreenshotLayout(data) {
    const words=(data&&data.words||[]).filter(w=>w&&String(w.text||'').trim()&&w.bbox&&
      Number.isFinite(w.bbox.x0)&&Number.isFinite(w.bbox.x1)&&Number.isFinite(w.bbox.y0)&&Number.isFinite(w.bbox.y1))
      .map(w=>({...w,text:String(w.text).trim(),cx:(w.bbox.x0+w.bbox.x1)/2,cy:(w.bbox.y0+w.bbox.y1)/2}));
    if(words.length<4) return null;
    const sorted=[...words].sort((a,b)=>a.cy-b.cy||a.bbox.x0-b.bbox.x0);
    const rows=[];
    for(const w of sorted){
      const tolerance=Math.max(7,(w.bbox.y1-w.bbox.y0)*0.55);
      let row=rows.find(r=>Math.abs(r.cy-w.cy)<=tolerance);
      if(!row){row={cy:w.cy,words:[]};rows.push(row);}
      row.words.push(w); row.cy=row.words.reduce((sum,x)=>sum+x.cy,0)/row.words.length;
    }
    rows.sort((a,b)=>a.cy-b.cy);
    rows.forEach(r=>{r.words.sort((a,b)=>a.bbox.x0-b.bbox.x0);r.text=r.words.map(w=>w.text).join(' ').replace(/\s+/g,' ').trim();});
    const rules={
      orders:/\b(?:pesanan|orders?|jumlah\s+penjualan|total\s+pesanan)\b/i,
      ctr:/\b(?:CTR|click.?through.?rate|rasio\s+klik(?:\s+tayang)?)\b/i,
      creators:/\b(?:(?:jumlah\s+)?kreator(?:\s+aktif)?|(?:jumlah\s+)?creators?|affiliate\s+creator(?:s)?|creator\s+affiliate)\b/i,
      // TikTok Shop labels can wrap: "Pembeli yang menambahkan ke" / "keranjang".
      // Match each distinctive fragment so the bottom-right card still gets an anchor.
      cart:/\b(?:pembeli|menambahkan|memasukkan|masuk\s+ke|add.?to.?cart|cart\s+adds?|keranjang|tambah(?:kan)?|ditambahkan|produk\s+ditambahkan)\b/i
    };
    // Keep this filter local to the layout parser; it runs independently from the text parser.
    const unrelatedMetric = /\b(?:views?|tayangan|ditonton|penayangan|video|likes?|suka|komentar|comments?|shares?|dibagikan|impressions?|jangkauan|kreator\s+challenge|tren\s+produk|7\s+hari\s+terakhir)\b/i;
    const parseNum=(text,key)=>{
      const src=String(text||'');
      const m=key==='ctr'?src.match(/(\d[\d.,]*)\s*(?:%|％)/):src.match(/(\d[\d.,]*)(?:\s*([KMB]))?/i);
      if(!m)return null;
      let t=m[1];
      if(/^\d{1,3}(?:\.\d{3})+$/.test(t))t=t.replace(/\./g,'');
      else if(/^\d{1,3}(?:,\d{3})+$/.test(t))t=t.replace(/,/g,'');
      else t=t.replace(',','.');
      let n=Number(t);const suf=String(m[2]||'').toLowerCase();
      if(suf==='k')n*=1e3;if(suf==='m')n*=1e6;if(suf==='b')n*=1e9;
      return Number.isFinite(n)&&n>=0?n:null;
    };
    const findPhraseCenter=(row,match)=>{
      // Map the matched phrase's character span back to OCR words, retaining their real x coordinates.
      let cursor=0;const spans=[];
      row.words.forEach(w=>{const start=cursor;const end=start+w.text.length;spans.push({w,start,end});cursor=end+1;});
      const hitStart=match.index,hitEnd=hitStart+match[0].length;
      const hit=spans.filter(s=>s.end>hitStart&&s.start<hitEnd).map(s=>s.w);
      if(hit.length)return (Math.min(...hit.map(w=>w.bbox.x0))+Math.max(...hit.map(w=>w.bbox.x1)))/2;
      return row.words[0]?.cx||0;
    };
    const out={name:'',orders:null,ctr:null,creators:null,cart:null};
    const found=[];
    rows.forEach((row,ri)=>{
      for(const key of Object.keys(rules)){
        const re=new RegExp(rules[key].source,rules[key].flags);const match=re.exec(row.text);
        if(!match)continue;
        // Add-to-cart label is long and often fragmented by OCR. Use the whole row
        // as its anchor so the count below the bottom-right card stays in the same column.
        const x=key==='cart' ? row.words.reduce((sum,w)=>sum+w.cx,0)/row.words.length : findPhraseCenter(row,match);
        const tail=row.text.slice(match.index+match[0].length);
        // Only accept an inline metric value when it is the first token after the label.
        // OCR rows often flatten the delta below the value (e.g. "Jumlah kreator 6,4K ▲ 459");
        // searching the whole tail can accidentally select the delta instead of the total.
        const inlineMatch=tail.match(/^\s*[:：]?\s*(\d[\d.,]*(?:\s*[KMB])?\s*(?:%|％)?)(?=\s|$)/i);
        const inline=inlineMatch?parseNum(inlineMatch[1],key):null;
        if(inline!==null&&(key!=='ctr'||/%|％/.test(inlineMatch[1])))out[key]=inline;
        found.push({key,ri,x});
      }
    });
    // Associate values spatially. OCR commonly breaks a long label such as
    // "Pembeli yang memasukkan ke keranjang" into several adjacent rows.
    // A repeated fragment of the SAME label is not a boundary; only a different
    // metric label can stop a search. This prevents the cart value being lost
    // when its label is split, and prevents values leaking between cards.
    for(const label of found){
      if(out[label.key]!==null)continue;
      const sameKeyRows=found.filter(x=>x.key===label.key && Math.abs(x.ri-label.ri)<=2);
      const anchorX=sameKeyRows.length
        ? sameKeyRows.reduce((sum,x)=>sum+x.x,0)/sameKeyRows.length
        : label.x;
      const lastLabelRow=Math.max(label.ri,...sameKeyRows.map(x=>x.ri));
      for(let ri=lastLabelRow+1;ri<Math.min(rows.length,lastLabelRow+8);ri++){
        const row=rows[ri];
        const otherMetric=found.some(x=>x.key!==label.key && x.ri===ri);
        if(otherMetric)break;
        // Ignore further fragments of the same label, but do not treat them as data.
        if(rules[label.key].test(row.text))continue;
        if(unrelatedMetric.test(row.text))break;
        // Change indicators (▲/▼ and their values) are a separate row beneath the
        // main metric. Never treat that row as the metric value itself.
        if(/[▲▼▴▾↑↓]/.test(row.text) || /\b(?:naik|turun|perubahan|change)\b/i.test(row.text)) continue;
        const candidates=row.words.map(w=>({w,n:parseNum(w.text,label.key)}))
          .filter(x=>x.n!==null&&(label.key!=='ctr'||/%|％/.test(x.w.text))
            &&(label.key==='ctr'||!['orders','creators','cart'].includes(label.key)||Number.isInteger(x.n))
            // The value belongs directly below its label in the same card column.
            &&Math.abs(x.w.cx-anchorX)<=Math.max(90,(row.words.reduce((m,w)=>Math.max(m,w.bbox.x1),0)-row.words.reduce((m,w)=>Math.min(m,w.bbox.x0),Infinity))*0.38));
        if(!candidates.length)continue;
        candidates.sort((a,b)=>{
          const dy=a.w.bbox.y0-b.w.bbox.y0;
          if(Math.abs(dy)>1)return dy;
          return Math.abs(a.w.cx-anchorX)-Math.abs(b.w.cx-anchorX);
        });
        const pick=candidates[0];
        // Reject a number clearly closer to a neighboring metric card's label.
        const peers=found.filter(x=>x.key!==label.key && Math.abs(x.ri-label.ri)<=2);
        const peer=peers.sort((a,b)=>Math.abs(a.x-pick.w.cx)-Math.abs(b.x-pick.w.cx))[0];
        if(peer && Math.abs(pick.w.cx-peer.x)+8 < Math.abs(pick.w.cx-anchorX)) break;
        out[label.key]=pick.n;break;
      }
    }
    const badge=/\b(?:mall|power\s*shop|powershop|beli\s*lokal|belilokal|official\s*store|star\s*shop)\b/i;
    const summary=rows.findIndex(r=>/\bringkasan\b/i.test(r.text));
    if(summary>=0){
      for(let i=summary;i<rows.length;i++){
        const row=rows[i],m=badge.exec(row.text);if(!m)continue;
        const before=row.text.slice(0,m.index).replace(/^[\s:|·•\-–—]+|[\s:|·•\-–—]+$/g,'').trim();
        const after=row.text.slice(m.index+m[0].length).replace(/^[\s:|·•\-–—]+/,'').trim();
        const plausibleName=t=>t.length>=4&&t.length<=180&&
          !/\bringkasan\b/i.test(t)&&!Object.values(rules).some(re=>re.test(t))&&
          !/\b(?:statistik|analisis|tren|pesanan|produk terlaris)\b/i.test(t)&&
          !/^\d[\d.,]*\s*(?:%|K|M|B)?$/i.test(t);
        // In some seller dashboards the product title is BEFORE the Mall/PowerShop badge;
        // in others OCR places it after the badge. Test both sides, never the badge itself.
        if(plausibleName(before)){out.name=before;break;}
        if(plausibleName(after)){out.name=after;break;}
        const badgeX=findPhraseCenter(row,m);
        const right=row.words.filter(w=>w.cx>badgeX+2).map(w=>w.text).join(' ').trim();
        if(right.length>=4&&!Object.values(rules).some(re=>re.test(right))){out.name=right;break;}
        for(let j=i+1;j<=Math.min(i+2,rows.length-1);j++){
          const t=rows[j].text;
          if(badge.test(t)||Object.values(rules).some(re=>re.test(t))||/\bringkasan\b/i.test(t))break;
          if(t.length>=4&&t.length<=180&&!/^\d[\d.,]*$/.test(t)){out.name=t;break;}
        }
        if(out.name)break;
      }
    }
    out.name=out.name.replace(/^[•·|\-–—]+/,'').trim();
    return out;
  }

  async function readAnalysisScreenshot() {
    const fileInput = $('analysis-screenshot'), file = fileInput && fileInput.files && fileInput.files[0];
    const urlInput = $('analysis-paste-url'), feedback = $('analysis-paste-feedback');
    const preview = $('analysis-screenshot-preview'), img = $('analysis-screenshot-image');
    const status = $('analysis-screenshot-status'), button = $('analysis-read-screenshot');
    const say = (message, kind='text-slate-400') => {
      if (feedback) { feedback.textContent = message; feedback.className = 'mt-2 text-[10px] ' + kind; }
    };
    if (!file || !/^image\//i.test(file.type)) { say('Pilih screenshot berupa gambar terlebih dahulu.', 'text-rose-400'); return; }
    if (file.size > 12 * 1024 * 1024) { say('Ukuran gambar terlalu besar. Gunakan screenshot di bawah 12 MB.', 'text-rose-400'); return; }
    const pasted = String(urlInput && urlInput.value || '').replace(/\s+/g, ' ').trim();
    const urlMatch = pasted.match(/https?:\/\/[^\s<>"']+/i);
    const productUrl = safeProductUrl(urlMatch ? urlMatch[0].replace(/[),.;]+$/, '') : pasted);
    const pastedTitle = urlMatch ? pasted.slice(0, pasted.indexOf(urlMatch[0])).trim().replace(/^[\s|—–:-]+|[\s|—–:-]+$/g, '').split(/\s+/).filter(Boolean).slice(0,4).join(' ') : '';
    if (preview) preview.classList.remove('hidden');
    if (img) img.src = URL.createObjectURL(file);
    if (button) { button.disabled = true; button.textContent = 'Membaca dengan AI…'; }
    if (status) status.textContent = 'Mengirim screenshot ke Gemini AI…';
    say('Hanya Gemini AI yang digunakan. OCR dinonaktifkan.', 'text-sky-300');
    try {
      if (typeof supabaseClient === 'undefined' || !supabaseClient || !supabaseClient.functions) throw new Error('Koneksi Supabase belum tersedia.');
      const imageDataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Gagal memuat gambar.'));
        reader.readAsDataURL(file);
      });
      const response = await supabaseClient.functions.invoke('analyze-product-screenshot', { body: { image: imageDataUrl, productUrl: productUrl || '' } });
      const data = response && response.data && response.data.data;
      if (response.error || !response.data || !response.data.ok || !data) {
        const payload = response && response.data || {};
        const code = payload.errorCode || (response && response.error ? 'SUPABASE_FUNCTION_INVOKE_ERROR' : 'GEMINI_EMPTY_RESULT');
        const stage = payload.stage ? ' tahap=' + payload.stage : '';
        const http = payload.providerStatus ? ' HTTP_GEMINI=' + payload.providerStatus : '';
        const detail = payload.providerDetail || payload.detail || '';
        const message = payload.error || (response && response.error ? response.error.message : 'Gemini tidak mengembalikan hasil.');
        throw new Error('KODE=' + code + stage + http + ': ' + message + (detail ? ' | Detail: ' + detail : ''));
      }
      const existing = productUrl ? getAnalysisProducts().find(p => safeProductUrl(p.url) === productUrl) : null;
      closeAddProductModal();
      if (existing) openProductEditor(existing.id);
      else { openProductEditor(); $('product-editor-id').value = ''; }
      $('product-editor-name').value = pastedTitle || String(data.name || data.fullName || '').trim();
      $('product-editor-price').value = data.priceRupiah ?? '';
      $('product-editor-url').value = productUrl || '';
      $('product-editor-orders').value = data.orders ?? '';
      $('product-editor-ctr').value = data.ctr ?? '';
      $('product-editor-creators').value = data.creators ?? '';
      $('product-editor-cart').value = data.cart ?? '';
      $('product-editor-period-start').value = data.periodStart || '';
      $('product-editor-period-end').value = data.periodEnd || '';
      $('product-editor-trend-changes').value = JSON.stringify(data.changes || {});
      // Isi persentase komisi secara deterministik bila screenshot menampilkan harga dan komisi per penjualan tetapi persentasenya tidak terbaca.
      const detectedPrice = Number(data.priceRupiah);
      const detectedCommissionAmount = Number(data.commissionAmountRupiah);
      let detectedCommissionPercent = data.commissionPercent;
      if ((detectedCommissionPercent === null || detectedCommissionPercent === undefined || detectedCommissionPercent === '') &&
          Number.isFinite(detectedPrice) && detectedPrice > 0 &&
          Number.isFinite(detectedCommissionAmount) && detectedCommissionAmount >= 0) {
        detectedCommissionPercent = Math.round((detectedCommissionAmount / detectedPrice * 100) * 100) / 100;
      }
      $('product-editor-commission-percent').value = detectedCommissionPercent ?? '';
      $('product-editor-commission-amount').value = data.commissionAmountRupiah ?? '';
      $('product-editor-commission-total').value = data.commissionTotalRupiah ?? '';
      window.__pendingProductAiAnalysis = data.aiAnalysis || null;
      const missing = [
        (data.name || data.fullName || pastedTitle) ? '' : 'nama produk',
        data.orders == null ? 'Pesanan' : '',
        data.ctr == null ? 'CTR' : '',
        data.creators == null ? 'Jumlah Kreator' : '',
        data.cart == null ? 'Add to Cart' : ''
      ].filter(Boolean);
      const message = 'Hasil Gemini AI diterima. ' + (missing.length ? 'Periksa: ' + missing.join(', ') + '.' : 'Empat metrik terisi; periksa sebelum menyimpan.');
      const error = $('product-editor-error');
      if (error) { error.textContent = missing.length ? 'Gemini belum membaca dengan yakin: ' + missing.join(', ') + '.' : ''; error.classList.toggle('hidden', !missing.length); }
      if (status) status.textContent = message;
      say(message, missing.length ? 'text-amber-300' : 'text-emerald-300');
    } catch (e) {
      console.error('Gemini AI screenshot gagal:', e);
      const message = 'Gemini AI gagal: ' + String(e && e.message || 'Kesalahan tidak diketahui') + '. OCR tidak dijalankan. Periksa konfigurasi/koneksi lalu coba lagi.';
      if (status) status.textContent = message;
      say(message, 'text-rose-400');
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Baca Screenshot dengan AI'; }
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


  // Interactive affiliate schedule: 30 days including today, with sticky date column.
  let affiliateGridTimes = ['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00'];
  let affiliateGridBase = ['A','B','C','D','E','A','B','C','D'];
  function affiliateScheduleSettings() {
    if(typeof progressData==='undefined'||!progressData||typeof progressData!=='object') return {productsPerDay:3,videosPerDay:9};
    const raw=progressData.__affiliateScheduleSettings||{};
    return {
      productsPerDay:Math.max(1,Math.min(5,Number(raw.productsPerDay)||3)),
      videosPerDay:Math.max(1,Math.min(15,Number(raw.videosPerDay)||9))
    };
  }
  function configureAffiliateSchedule() {
    const settings=affiliateScheduleSettings();
    affiliateGridTimes=Array.from({length:settings.videosPerDay},(_,i)=>{
      const minutes=7*60+i*60;
      return String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
    });
    const products=['A','B','C','D','E'].slice(0,settings.productsPerDay);
    affiliateGridBase=Array.from({length:settings.videosPerDay},(_,i)=>products[i%products.length]);
  }
  async function saveAffiliateScheduleSettings() {
    const productsInput=$('affiliate-settings-products'), videosInput=$('affiliate-settings-videos');
    if(!productsInput||!videosInput) return;
    const productsPerDay=Math.max(1,Math.min(5,Number(productsInput.value)||1));
    const videosPerDay=Math.max(1,Math.min(15,Number(videosInput.value)||1));
    if(typeof progressData==='undefined'||!progressData||typeof progressData!=='object') return;
    progressData.__affiliateScheduleSettings={productsPerDay,videosPerDay};
    configureAffiliateSchedule();
    if(typeof saveData==='function') await saveData();
    renderAffiliateSchedule();
  }
  function ensureAffiliateScheduleSettingsUI() {
    const range=$('affiliate-grid-range');
    const section=range&&range.closest('section');
    if(!section||$('affiliate-schedule-settings')) return;
    const panel=document.createElement('div');
    panel.id='affiliate-schedule-settings';
    panel.className='mb-3 rounded-xl border border-slate-700 bg-slate-950/50 p-3';
    panel.innerHTML='<div class="mb-2 flex items-center justify-between gap-2"><p class="text-xs font-bold text-slate-100">Pengaturan jadwal 30 hari</p><span class="text-[10px] text-emerald-300">Mulai 07.00</span></div><div class="grid grid-cols-2 gap-2"><label class="text-[11px] text-slate-300">Produk per hari<select id="affiliate-settings-products" class="mt-1 w-full rounded-lg border border-slate-700 px-2 py-2 text-sm"><option value="1">1 produk</option><option value="2">2 produk</option><option value="3">3 produk</option><option value="4">4 produk</option><option value="5">5 produk</option></select></label><label class="text-[11px] text-slate-300">Video per hari<select id="affiliate-settings-videos" class="mt-1 w-full rounded-lg border border-slate-700 px-2 py-2 text-sm"><option value="1">1 video</option><option value="2">2 video</option><option value="3">3 video</option><option value="4">4 video</option><option value="5">5 video</option><option value="6">6 video</option><option value="7">7 video</option><option value="8">8 video</option><option value="9">9 video</option><option value="10">10 video</option><option value="11">11 video</option><option value="12">12 video</option><option value="13">13 video</option><option value="14">14 video</option><option value="15">15 video</option></select></label></div><p class="mt-2 text-[10px] leading-relaxed text-slate-400">Jadwal membagi video per jam mulai pukul 07.00. Ini mengatur pengingat/rencana di aplikasi, bukan menjeda atau mengunggah otomatis ke TikTok/Shopee.</p><button id="affiliate-settings-save" type="button" class="mt-2 w-full rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Simpan pengaturan</button>';
    const legend=section.querySelector('.mb-2.flex.flex-wrap');
    if(legend) section.insertBefore(panel,legend); else section.insertBefore(panel,section.children[1]||null);
    const settings=affiliateScheduleSettings();
    $('affiliate-settings-products').value=String(settings.productsPerDay);
    $('affiliate-settings-videos').value=String(settings.videosPerDay);
    $('affiliate-settings-save').addEventListener('click',saveAffiliateScheduleSettings);
  }
  function affiliateGridStartDate() {
    const d = new Date();
    d.setHours(12,0,0,0);
    return d;
  }
  function affiliateGridDateKey(d) {
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function affiliateGridDateLabel(d) {
    return d.toLocaleDateString('id-ID',{day:'2-digit',month:'2-digit',year:'numeric'});
  }
  function affiliateGridDoneData() {
    if(typeof progressData==='undefined'||!progressData||typeof progressData!=='object') return {};
    if(!progressData.__affiliateGridDone||typeof progressData.__affiliateGridDone!=='object') progressData.__affiliateGridDone={};
    return progressData.__affiliateGridDone;
  }
  async function toggleAffiliateSlotDone(dateKey, time) {
    const itemKey=dateKey+'_'+time;
    const state=affiliateGridDoneData();
    if(state[itemKey]===true) delete state[itemKey]; else state[itemKey]=true;
    if(typeof saveData==='function') await saveData();
    renderAffiliateSchedule();
  }

  function showAffiliateProductTimes(dateKey, productCode) {
    const title=$('affiliate-product-detail-title'), timesHost=$('affiliate-product-detail-times');
    if(!title||!timesHost) return;
    const parts=dateKey.split('-').map(Number);
    const d=new Date(parts[0],parts[1]-1,parts[2],12,0,0,0);
    const dayNames=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
    title.textContent='Produk '+productCode+' · '+dayNames[d.getDay()]+', '+affiliateGridDateLabel(d)+' — ketuk jam untuk menandai selesai';
    timesHost.innerHTML='';
    // Keep the selected product/date highlighted green until another cell is selected.
    window.__affiliateGridSelected={dateKey,productCode};
    const shift=Math.floor((d.getTime()-affiliateGridStartDate().getTime())/86400000)%5;
    const done=affiliateGridDoneData();
    const matching=[];
    affiliateGridBase.forEach((baseCode,slot)=>{
      const code=String.fromCharCode((baseCode.charCodeAt(0)-65+shift)%5+65);
      if(code===productCode) matching.push({time:affiliateGridTimes[slot],done:done[dateKey+'_'+affiliateGridTimes[slot]]===true});
    });
    if(!matching.length){
      const empty=document.createElement('span');empty.className='text-xs text-slate-400';empty.textContent='Tidak ada slot untuk produk ini.';timesHost.appendChild(empty);return;
    }
    matching.forEach(item=>{
      const chip=document.createElement('button');
      chip.type='button';
      chip.className='rounded-md border px-3 py-2 text-sm font-bold transition-colors';
      chip.style.borderColor=item.done?'#2563eb':'#0f766e';
      chip.style.background=item.done?'#2563eb':'#064e3b';
      chip.style.color='#ffffff';
      chip.textContent=(item.done?'✓ ':'')+item.time;
      chip.title=item.done?'Tandai belum selesai':'Tandai jam ini selesai';
      chip.setAttribute('aria-pressed',item.done?'true':'false');
      chip.addEventListener('click',async()=>{
        await toggleAffiliateSlotDone(dateKey,item.time);
        showAffiliateProductTimes(dateKey,productCode);
      });
      timesHost.appendChild(chip);
    });
  }

  function renderAffiliateSchedule() {
    const head=$('affiliate-grid-head'), body=$('affiliate-grid-body');
    if(!head||!body) return;
    configureAffiliateSchedule();
    ensureAffiliateScheduleSettingsUI();
    head.innerHTML=''; body.innerHTML='';
    const hr=document.createElement('tr');
    ['Tanggal',...affiliateGridTimes].forEach((label,index)=>{
      const th=document.createElement('th');
      th.textContent=label;
      th.className='border border-slate-700 px-2 py-3 font-bold text-white';
      th.style.background='#244d35';
      th.style.minWidth=index===0?'118px':'58px';
      th.style.height='42px';
      if(index===0){th.style.position='sticky';th.style.left='0';th.style.zIndex='5';th.style.boxShadow='2px 0 3px rgba(0,0,0,.25)';}
      hr.appendChild(th);
    });
    head.appendChild(hr);
    const start=affiliateGridStartDate();
    const end=new Date(start); end.setDate(end.getDate()+29);
    const range=$('affiliate-grid-range');
    if(range) range.textContent=affiliateGridDateLabel(start)+' – '+affiliateGridDateLabel(end);
    const todayKey=affiliateGridDateKey(new Date());
    const dayNames=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
    const done=affiliateGridDoneData();
    for(let day=0;day<30;day++){
      const d=new Date(start); d.setDate(start.getDate()+day);
      const key=affiliateGridDateKey(d), isToday=key===todayKey;
      const tr=document.createElement('tr');
      if(isToday) tr.style.outline='2px solid #34d399';
      const dateCell=document.createElement('th');
      dateCell.className='border border-slate-800 px-2 py-2 text-left font-semibold';
      dateCell.style.position='sticky';dateCell.style.left='0';dateCell.style.zIndex='3';dateCell.style.minWidth='118px';dateCell.style.boxShadow='2px 0 3px rgba(0,0,0,.25)';
      dateCell.style.background=isToday?'#14532d':(day%2?'#202722':'#191f1b');
      dateCell.style.color=isToday?'#ffffff':'#e2e8f0';
      const dayLabel=document.createElement('div');
      dayLabel.textContent=dayNames[d.getDay()]+(isToday?' · HARI INI':'');
      const dateLabel=document.createElement('div');dateLabel.className='mt-1 text-[10px]';dateLabel.textContent=affiliateGridDateLabel(d);
      dateCell.append(dayLabel,dateLabel);tr.appendChild(dateCell);
      const shift=day%5;
      affiliateGridBase.forEach((code,slot)=>{
        const product=String.fromCharCode((code.charCodeAt(0)-65+shift)%5+65);
        const itemKey=key+'_'+affiliateGridTimes[slot], isDone=done[itemKey]===true;
        const td=document.createElement('td');td.className='border border-slate-800 p-0';
        td.style.background=isToday?'#173526':(day%2?'#18231c':'#111713');
        const button=document.createElement('button');button.type='button';
        button.textContent=isDone?'✓ '+product:product;
        button.title=(isDone?'Sudah selesai':'Belum selesai')+' · '+affiliateGridTimes[slot]+' · Produk '+product+' · ketuk untuk memilih produk';
        button.setAttribute('aria-pressed',isDone?'true':'false');
        button.className='flex min-h-[42px] w-full min-w-[58px] items-center justify-center px-2 font-bold transition-colors';
        // Blue means the upload slot is completed; green means the cell is currently selected.
        const selected=!!(window.__affiliateGridSelected&&window.__affiliateGridSelected.dateKey===key&&window.__affiliateGridSelected.productCode===product);
        button.style.color=isDone?'#ffffff':(selected?'#ffffff':'#b7d8c1');
        button.style.background=isDone?'#2563eb':(selected?'#059669':'transparent');
        button.style.boxShadow=selected&&!isDone?'inset 0 0 0 2px #34d399':'none';
        button.addEventListener('click',()=>{
          showAffiliateProductTimes(key,product);
          renderAffiliateSchedule();
          showAffiliateProductTimes(key,product);
        });
        td.appendChild(button);tr.appendChild(td);
      });
      body.appendChild(tr);
    }
    // Separate sticky header from the vertically scrolling rows, then mirror horizontal scroll.
    const headerScroller=$('affiliate-grid-sticky-head'), bodyScroller=$('affiliate-grid-scroll');
    if(headerScroller && bodyScroller && !headerScroller.dataset.syncReady){
      let syncing=false;
      headerScroller.addEventListener('scroll',()=>{
        if(syncing) return; syncing=true; bodyScroller.scrollLeft=headerScroller.scrollLeft; syncing=false;
      },{passive:true});
      bodyScroller.addEventListener('scroll',()=>{
        if(syncing) return; syncing=true; headerScroller.scrollLeft=bodyScroller.scrollLeft; syncing=false;
      },{passive:true});
      headerScroller.dataset.syncReady='1';
    }
  }
  window.renderAffiliateSchedule=renderAffiliateSchedule;

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
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'rounded-xl border border-rose-500/25 bg-rose-500/10 px-2.5 py-2 text-sm text-rose-300 active:scale-95';
      deleteButton.textContent = '🗑';
      deleteButton.title = 'Hapus catatan';
      deleteButton.setAttribute('aria-label', 'Hapus catatan ' + (note.name || 'tanpa nama'));
      deleteButton.addEventListener('click', () => deleteNote(note.id));
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
      actions.append(copy, edit, deleteButton, more);
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
    // The old productivity dashboard is intentionally disabled; Analitik is now the Affiliate upload planner.
    addTaskFields('new');
    addTaskFields('edit');
    enhanceSaveFunctions();
    renderAnalysisTab();
    renderAffiliateSchedule();
    const scheduleDate = $('affiliate-schedule-date');
    if (scheduleDate) scheduleDate.addEventListener('change', renderAffiliateSchedule);
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
