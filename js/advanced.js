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
    const hasCtr = hasMetric(t.ctr), hasOrders = hasMetric(t.orders), hasCreators = hasMetric(t.creators), hasCart = hasMetric(t.cart);
    if (!(hasCtr || hasOrders || hasCreators || hasCart)) return null;
    let score = 0, totalWeight = 0;
    if (hasCtr) {
      const ctr = Number(t.ctr);
      score += (ctr >= 3.5 ? 100 : ctr >= 2.0 ? 70 : 40) * 0.35;
      totalWeight += 0.35;
    }
    if (hasCart && hasOrders) {
      const ratio = Number(t.orders) > 0 ? Number(t.cart) / Number(t.orders) : (Number(t.cart) > 0 ? Infinity : 0);
      score += (ratio >= 1.5 ? 100 : ratio >= 1.0 ? 70 : 40) * 0.30;
      totalWeight += 0.30;
    }
    if (hasOrders) {
      // Base volume score: capped logarithmic scale, plus 30 bonus points when the product records rising orders.
      const volume = Math.min(100, Math.round(Math.log10(Number(t.orders) + 1) / 4 * 100));
      const rising = Number(t.orderChange ?? t.ordersTrend ?? t.orderGrowth ?? 0) > 0 || t.trendDirection === 'up' || t.trendDirection === 'naik';
      score += Math.min(100, volume + (rising ? 30 : 0)) * 0.20;
      totalWeight += 0.20;
    }
    if (hasCreators) {
      score += (Number(t.creators) < 500 ? 100 : 60) * 0.15;
      totalWeight += 0.15;
    }
    // Only metrics actually supplied count toward the denominator; missing metrics are not silently treated as poor performance.
    return totalWeight ? Math.round(score / totalWeight * 100) / 1 : null;
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
  function openProductEditor(id) {
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
    const item = {
      id:'prod-'+Date.now(),
      name:(metadata && metadata.title) || guessedName || 'Produk baru · '+new URL(url).hostname,
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
    renderAnalysisTab();
    if (metadata && metadata.title) {
      say('Nama produk berhasil diambil otomatis. Statistik performa tidak disediakan oleh halaman publik; perlu API/data resmi platform.', 'text-emerald-300');
    } else {
      say('Link tersimpan, tetapi nama otomatis gagal dibaca. '+(metadataError ? metadataError+' ' : '')+'TikTok mungkin membatasi akses; ubah nama lewat Edit. Statistik perlu akses API resmi.', 'text-amber-300');
    }
    if (button) {button.disabled=false;button.textContent='Tambah';}
  }
  window.addProductFromPastedLink = addProductFromPastedLink;
  window.openProductEditor = openProductEditor;
  window.closeProductEditor = closeProductEditor;
  window.saveProductEditor = saveProductEditor;
  window.renderAnalysisTab = renderAnalysisTab;

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
