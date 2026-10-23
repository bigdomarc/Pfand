const TYPES = [
  { id: 'dose', name: 'Dose', icon: '◉', defaultCents: 25 },
  { id: 'einweg', name: 'Einwegflasche', icon: '♧', defaultCents: 25 },
  { id: 'mehrweg', name: 'Mehrweg-Glasflasche', icon: '◇', defaultCents: 15 },
  { id: 'bier', name: 'Bierflasche', icon: '▯', defaultCents: 8 },
];
const STORAGE_KEY = 'pfandapp.v1';
const state = loadState();
let currentPage = 'collection';
let syncBusy = false;
let toastTimer;

function emptyCounts() { return Object.fromEntries(TYPES.map((type) => [type.id, 0])); }
function defaultValues() { return Object.fromEntries(TYPES.map((type) => [type.id, type.defaultCents])); }
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      draft: { ...emptyCounts(), ...(saved.draft || {}) },
      values: { ...defaultValues(), ...(saved.values || {}) },
      records: Array.isArray(saved.records) ? saved.records : [],
      endpoint: typeof saved.endpoint === 'string' ? saved.endpoint : '',
      syncMessage: saved.syncMessage || '',
    };
  } catch {
    return { draft: emptyCounts(), values: defaultValues(), records: [], endpoint: '', syncMessage: '' };
  }
}
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { showToast('Der Gerätespeicher ist voll. Bitte schaffe Speicherplatz.'); }
}
function fmtMoney(cents) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format((cents || 0) / 100);
}
function quantity(counts = state.draft) { return TYPES.reduce((sum, type) => sum + (Number(counts[type.id]) || 0), 0); }
function amount(counts = state.draft, values = state.values) {
  return TYPES.reduce((sum, type) => sum + (Number(counts[type.id]) || 0) * (Number(values[type.id]) || 0), 0);
}
function recordAmount(record) { return amount(record.counts, record.unitValues); }
function dateFormat(timestamp, includeTime = true) {
  return new Intl.DateTimeFormat('de-DE', includeTime
    ? { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(timestamp));
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

function render() {
  document.querySelectorAll('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.page === currentPage));
  const page = document.querySelector('#page');
  if (currentPage === 'collection') page.innerHTML = collectionView();
  else if (currentPage === 'history') page.innerHTML = historyView();
  else page.innerHTML = statsView();
}

function collectionView() {
  const qty = quantity();
  const cents = amount();
  const percent = Math.min(100, qty * 2.5);
  const types = TYPES.map((type) => `
    <article class="count-card">
      <div class="type-symbol" aria-hidden="true">${type.icon}</div>
      <div class="type-copy"><strong>${type.name}</strong><small>${fmtMoney(state.values[type.id])} pro Stück</small></div>
      <div class="counter">
        <button class="step-button" data-action="decrease" data-id="${type.id}" aria-label="${type.name} verringern" ${state.draft[type.id] <= 0 ? 'disabled' : ''}>−</button>
        <input class="count-input" data-count="${type.id}" aria-label="Anzahl ${type.name}" inputmode="numeric" pattern="[0-9]*" value="${state.draft[type.id]}" />
        <button class="step-button" data-action="increase" data-id="${type.id}" aria-label="${type.name} erhöhen">+</button>
      </div>
    </article>`).join('');
  const pending = state.records.filter((record) => !record.synced).length;
  let syncText;
  if (!state.endpoint) syncText = 'Google Sheets noch nicht eingerichtet';
  else if (!navigator.onLine && pending) syncText = `${pending} ${pending === 1 ? 'Sammlung wartet' : 'Sammlungen warten'} auf Verbindung`;
  else if (state.syncMessage) syncText = state.syncMessage;
  else if (pending) syncText = `${pending} ${pending === 1 ? 'Sammlung wartet' : 'Sammlungen warten'} auf Synchronisierung`;
  else syncText = 'Alles synchronisiert';
  const syncClass = pending > 0 ? 'waiting' : '';
  const allTime = state.records.reduce((sum, record) => sum + recordAmount(record), 0);
  return `<div class="stack">
    <section class="hero">
      <div><span class="eyebrow">AKTUELLE SAMMLUNG</span><strong class="hero-value">${fmtMoney(cents)}</strong></div>
      <div class="hero-foot"><span>${qty} ${qty === 1 ? 'Stück' : 'Stücke'} gesammelt</span><span class="progress-track"><i style="--progress:${percent}%"></i></span></div>
    </section>
    <div class="section-heading"><h2>Pfandarten</h2><span>Tippen oder Zahl eingeben</span></div>
    ${types}
    <button class="primary-button full-width" id="start-close" ${qty === 0 ? 'disabled' : ''}>✓ &nbsp; Sammlung abschließen</button>
    <section class="sync-card"><div class="sync-icon">↻</div><div class="sync-copy"><strong>Google Sheets</strong><span>${escapeHtml(syncText)}</span></div><i class="sync-dot ${syncClass}"></i></section>
    <section class="summary-card"><span>Bisher gesammelt</span><strong>${fmtMoney(allTime)}</strong><small>${state.records.length} ${state.records.length === 1 ? 'abgeschlossene Sammlung' : 'abgeschlossene Sammlungen'}</small></section>
  </div>`;
}

function historyView() {
  const records = [...state.records].sort((a, b) => b.closedAt - a.closedAt);
  const list = records.map((record) => {
    const pills = TYPES.map((type) => `<span class="count-pill">${Number(record.counts[type.id]) || 0} ${type.name.toLowerCase()}</span>`).join('');
    const synced = record.synced;
    const syncLabel = !state.endpoint ? 'Nur auf diesem Gerät' : synced ? 'Mit Google Sheets synchronisiert' : 'Wartet auf Synchronisierung';
    return `<article class="record-card"><div class="record-top"><div><strong>${dateFormat(record.closedAt)}</strong><small>${quantity(record.counts)} ${quantity(record.counts) === 1 ? 'Stück' : 'Stücke'}</small></div><strong class="record-amount">${fmtMoney(recordAmount(record))}</strong></div><div class="record-counts">${pills}</div><span class="record-sync ${synced || !state.endpoint ? '' : 'pending'}">${synced ? '✓' : '↻'} ${syncLabel}</span></article>`;
  }).join('');
  return `<div class="page-header"><div><h1 class="page-title">Deine Historie</h1><p class="page-subtitle">Deine abgeschlossenen Sammlungen</p></div></div>${records.length ? `<div class="record-list">${list}</div>` : emptyView('Noch keine Sammlungen', 'Abgeschlossene Sammlungen werden hier gespeichert.')}`;
}

function statsView() {
  const now = new Date();
  const currentRecords = (period) => state.records.filter((record) => {
    const date = new Date(record.closedAt);
    if (period === 'all') return true;
    if (period === 'month') return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  });
  const records = currentRecords(state.period || 'day');
  const cents = records.reduce((sum, record) => sum + recordAmount(record), 0);
  const total = records.reduce((sum, record) => sum + quantity(record.counts), 0);
  const breakdown = TYPES.map((type) => {
    const count = records.reduce((sum, record) => sum + (Number(record.counts[type.id]) || 0), 0);
    const totalCents = records.reduce((sum, record) => sum + (Number(record.counts[type.id]) || 0) * (Number(record.unitValues[type.id]) || 0), 0);
    return `<div class="breakdown-row"><span class="type-symbol" style="width:31px;height:31px;flex-basis:31px;border-radius:11px;font-size:14px">${type.icon}</span><span class="name">${type.name}</span><span class="qty">${count} Stk.</span><strong>${fmtMoney(totalCents)}</strong></div>`;
  }).join('');
  const options = [['day', 'Heute'], ['month', 'Monat'], ['all', 'Gesamt']].map(([id, label]) => `<button data-period="${id}" class="${(state.period || 'day') === id ? 'selected' : ''}">${label}</button>`).join('');
  return `<div class="page-header"><div><h1 class="page-title">Deine Statistik</h1><p class="page-subtitle">Gesammeltes Pfand im Überblick</p></div></div>
    <div class="stack"><div class="segmented">${options}</div>
      <section class="stat-card"><span class="stat-label">Gesammeltes Pfand</span><strong class="stat-value">${fmtMoney(cents)}</strong><small>${records.length} ${records.length === 1 ? 'Sammlung' : 'Sammlungen'}</small></section>
      <section class="stat-card"><span class="stat-label">Gesammelte Stücke</span><strong class="stat-value">${total}</strong><small>über alle Pfandarten</small></section>
      <div class="section-heading"><h2>Nach Pfandart</h2></div><div class="breakdown">${breakdown}</div>
    </div>`;
}

function emptyView(title, detail) {
  return `<div class="empty-state"><div class="empty-graphic">♻</div><strong>${title}</strong><p>${detail}</p></div>`;
}

function openSettings() {
  const holder = document.querySelector('#price-fields');
  holder.innerHTML = TYPES.map((type) => `<div class="price-field"><label for="price-${type.id}">${type.name}</label><input id="price-${type.id}" data-price="${type.id}" type="text" inputmode="decimal" value="${(state.values[type.id] / 100).toFixed(2).replace('.', ',')}" /></div>`).join('');
  document.querySelector('#endpoint').value = state.endpoint;
  document.querySelector('#settings-dialog').showModal();
}

function closeSummary() {
  const lines = TYPES.map((type) => `${state.draft[type.id]} ${type.name}`).join(' · ');
  document.querySelector('#close-summary').innerHTML = `<strong>${quantity()} Stück · ${fmtMoney(amount())}</strong><br>${lines}`;
  document.querySelector('#close-dialog').showModal();
}

async function closeCollection() {
  const record = {
    id: crypto.randomUUID(),
    closedAt: Date.now(),
    counts: { ...state.draft },
    unitValues: { ...state.values },
    synced: false,
  };
  state.records.push(record);
  state.draft = emptyCounts();
  persist();
  document.querySelector('#close-dialog').close();
  currentPage = 'collection';
  render();
  showToast('Sammlung gespeichert. Eine neue Sammlung ist bereit.');
  await syncPending();
}

function saveSettings() {
  const newValues = { ...state.values };
  for (const type of TYPES) {
    const input = document.querySelector(`[data-price="${type.id}"]`);
    const parsed = Number(input.value.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 20) {
      input.focus(); showToast('Bitte gültige Beträge zwischen 0,00 € und 20,00 € eingeben.'); return;
    }
    newValues[type.id] = Math.round(parsed * 100);
  }
  const endpoint = document.querySelector('#endpoint').value.trim();
  if (endpoint && !/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/.test(endpoint)) {
    document.querySelector('#endpoint').focus(); showToast('Bitte die Apps-Script-Web-App-URL mit /exec einfügen.'); return;
  }
  state.values = newValues;
  state.endpoint = endpoint;
  state.syncMessage = endpoint ? (navigator.onLine ? 'Synchronisierung wird vorbereitet' : 'Wartet auf Verbindung') : '';
  persist();
  document.querySelector('#settings-dialog').close();
  render();
  if (endpoint && state.records.some((record) => !record.synced)) syncPending();
  showToast('Einstellungen gespeichert.');
}

function jsonpAppend(record) {
  return new Promise((resolve, reject) => {
    const url = new URL(state.endpoint);
    const callbackName = `pfandCallback_${crypto.randomUUID().replaceAll('-', '')}`;
    const script = document.createElement('script');
    let finished = false;
    const finish = (error, data) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      script.remove();
      delete window[callbackName];
      if (error) reject(error); else resolve(data);
    };
    const timeout = setTimeout(() => finish(new Error('Zeitüberschreitung')), 25000);
    window[callbackName] = (data) => finish(null, data);
    url.searchParams.set('action', 'append');
    url.searchParams.set('callback', callbackName);
    url.searchParams.set('payload', JSON.stringify({
      id: record.id,
      closedAt: record.closedAt,
      quantity: quantity(record.counts),
      amountCents: recordAmount(record),
      counts: record.counts,
      unitValues: record.unitValues,
    }));
    url.searchParams.set('_', String(Date.now()));
    script.src = url.toString();
    script.onerror = () => finish(new Error('Apps Script konnte nicht erreicht werden.'));
    document.head.append(script);
  });
}

async function syncPending() {
  if (syncBusy || !state.endpoint) return;
  const pending = state.records.filter((record) => !record.synced);
  if (!pending.length) { state.syncMessage = 'Synchronisiert'; persist(); render(); return; }
  if (!navigator.onLine) { state.syncMessage = 'Wartet auf Verbindung'; persist(); render(); return; }
  syncBusy = true;
  state.syncMessage = 'Synchronisierung läuft'; persist(); render();
  for (const record of pending) {
    try {
      const response = await jsonpAppend(record);
      if (!response || response.ok !== true) throw new Error('Der Server hat die Sammlung nicht bestätigt.');
      const saved = state.records.find((item) => item.id === record.id);
      if (saved) saved.synced = true;
      state.syncMessage = 'Synchronisiert';
      persist(); render();
    } catch (error) {
      state.syncMessage = 'Übertragung fehlgeschlagen – neuer Versuch folgt';
      persist(); render();
      break;
    }
  }
  syncBusy = false;
  if (state.records.every((record) => record.synced)) state.syncMessage = 'Synchronisiert';
  persist(); render();
}

document.querySelector('#page').addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]');
  if (action) {
    const id = action.dataset.id;
    state.draft[id] = Math.max(0, (Number(state.draft[id]) || 0) + (action.dataset.action === 'increase' ? 1 : -1));
    persist(); render(); return;
  }
  const period = event.target.closest('[data-period]');
  if (period) { state.period = period.dataset.period; render(); return; }
  if (event.target.closest('#start-close')) closeSummary();
});

document.querySelector('#page').addEventListener('change', (event) => {
  const input = event.target.closest('[data-count]');
  if (!input) return;
  state.draft[input.dataset.count] = Math.min(99999, Math.max(0, Number.parseInt(input.value, 10) || 0));
  persist(); render();
});
document.querySelector('#page').addEventListener('keydown', (event) => {
  if (event.target.matches('[data-count]') && event.key === 'Enter') event.target.blur();
});
document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => { currentPage = button.dataset.page; render(); }));
document.querySelector('#open-settings').addEventListener('click', openSettings);
document.querySelector('#settings-form').addEventListener('submit', (event) => {
  if (event.submitter?.id === 'save-settings') { event.preventDefault(); saveSettings(); }
});
document.querySelector('#keep-counting').addEventListener('click', () => document.querySelector('#close-dialog').close());
document.querySelector('#close-x').addEventListener('click', () => document.querySelector('#close-dialog').close());
document.querySelector('#confirm-close').addEventListener('click', closeCollection);
window.addEventListener('online', syncPending);
window.addEventListener('offline', () => { state.syncMessage = 'Wartet auf Verbindung'; persist(); render(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) syncPending(); });

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./service-worker.js').catch(() => {});
}
render();
if (state.endpoint && state.records.some((record) => !record.synced)) syncPending();
