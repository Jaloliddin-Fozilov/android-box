// ==============================================================================
// Android Box - Web Dashboard Frontend Script
// ==============================================================================

let currentActiveInstanceId = null;
let screenAutoInterval = null;
let ws = null;

// Elementlar
const instancesGrid = document.getElementById('instancesGrid');
const statTotal = document.getElementById('statTotal');
const statOnline = document.getElementById('statOnline');
const statBusy = document.getElementById('statBusy');
const statOffline = document.getElementById('statOffline');
const statHost = document.getElementById('statHost');
const instanceCountBadge = document.getElementById('instanceCountBadge');
const logTerminal = document.getElementById('logTerminal');

// Modal elementlar
const taskModal = document.getElementById('taskModal');
const screenModal = document.getElementById('screenModal');
const settingsModal = document.getElementById('settingsModal');
const screenImage = document.getElementById('screenImage');
const screenLoader = document.getElementById('screenLoader');
const taskTypeSelect = document.getElementById('taskType');
const commentBoxGroup = document.getElementById('commentBoxGroup');

// Log qo'shish
function addLog(message, type = 'info') {
  const line = document.createElement('div');
  const now = new Date().toLocaleTimeString();
  let color = 'text-slate-300';
  if (type === 'success') color = 'text-emerald-400';
  if (type === 'warn') color = 'text-amber-400';
  if (type === 'error') color = 'text-rose-400';

  line.innerHTML = `<span class="text-slate-500">[${now}]</span> <span class="${color}">${message}</span>`;
  logTerminal.appendChild(line);
  logTerminal.scrollTop = logTerminal.scrollHeight;
}

// WebSocket ulanish
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}`);

  ws.onopen = () => {
    addLog('WebSocket orqali real vaqt aloqasi o\'rnatildi.', 'success');
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'log') {
        addLog(data.message, data.level);
      } else if (data.type === 'instances_update') {
        renderInstances(data.instances);
      }
    } catch (err) {
      console.error('WS xabarni parse qilishda xatolik:', err);
    }
  };

  ws.onclose = () => {
    addLog('WebSocket uzildi, 3 soniyadan so\'ng qayta ulanadi...', 'warn');
    setTimeout(initWebSocket, 3000);
  };
}

// Instansiyalarni yuklash
async function fetchInstances() {
  try {
    const res = await fetch('/api/instances');
    const data = await res.json();
    renderInstances(data.instances);
    if (data.host) {
      statHost.textContent = data.host;
    }
  } catch (err) {
    addLog('Instansiyalarni olishda xatolik yuz berdi: ' + err.message, 'error');
  }
}

// UI kartochkalarini chizish
function renderInstances(instances) {
  if (!instances || instances.length === 0) {
    instancesGrid.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-400 bg-slate-900 rounded-2xl border border-slate-800">
        <i class="fa-solid fa-triangle-exclamation text-2xl text-amber-500 mb-2"></i>
        <p>Hozircha birorta ham instansiya topilmadi. Linux xost sozlamalarini tekshiring.</p>
      </div>
    `;
    updateStats([], '127.0.0.1');
    return;
  }

  updateStats(instances);
  instanceCountBadge.textContent = `${instances.length} ta instansiya`;

  instancesGrid.innerHTML = instances.map(inst => {
    let badgeClass = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
    let statusText = 'Oflayn';
    let statusDot = 'bg-rose-500';

    if (inst.status === 'online') {
      badgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      statusText = 'Online';
      statusDot = 'bg-emerald-500';
    } else if (inst.status === 'busy') {
      badgeClass = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      statusText = 'Band';
      statusDot = 'bg-amber-500 animate-pulse';
    }

    return `
      <div class="bg-slate-900 border border-slate-800 hover:border-slate-700 transition rounded-xl p-4 flex flex-col justify-between space-y-3.5 shadow-md">
        <div>
          <!-- Sarlavha -->
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <span class="w-2.5 h-2.5 rounded-full ${statusDot}"></span>
              <span class="font-bold text-sm text-white">Box #${inst.index}</span>
            </div>
            <span class="text-[10px] px-2 py-0.5 rounded-full border ${badgeClass} font-semibold uppercase tracking-wider">${statusText}</span>
          </div>

          <!-- Ma'lumotlar -->
          <div class="mt-2.5 space-y-1 text-xs">
            <div class="text-slate-400 flex justify-between">
              <span>Port:</span>
              <span class="font-mono text-slate-200">${inst.port}</span>
            </div>
            <div class="text-slate-400 flex justify-between">
              <span>Model:</span>
              <span class="font-medium text-slate-300 truncate max-w-[130px]" title="${inst.model || ''}">${inst.model || 'Aniqlanmagan'}</span>
            </div>
            <div class="text-slate-400 flex justify-between">
              <span>Akkaunt:</span>
              <span class="text-indigo-400 font-medium">${inst.assignedAccount || 'N/A'}</span>
            </div>
            <div class="text-slate-400 flex justify-between pt-1 border-t border-slate-800/80">
              <span>Joriy holat:</span>
              <span class="text-slate-300 truncate max-w-[130px]">${inst.currentTask || 'Bo\'sh'}</span>
            </div>
          </div>
        </div>

        <!-- Amallar tugmalari -->
        <div class="pt-2 border-t border-slate-800 flex items-center justify-between gap-1.5">
          <button onclick="openScreenModal('${inst.id}', 'Box #${inst.index}')" class="flex-1 py-1.5 px-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 text-xs rounded-lg transition font-medium text-center">
            <i class="fa-solid fa-eye mr-1"></i> Ko'rish
          </button>
          <button onclick="quickApp('${inst.id}', 'instagram')" class="p-1.5 bg-slate-800 hover:bg-slate-700 text-pink-400 rounded-lg text-xs" title="Instagram ochish">
            <i class="fa-brands fa-instagram"></i>
          </button>
          <button onclick="quickApp('${inst.id}', 'tiktok')" class="p-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-lg text-xs" title="TikTok ochish">
            <i class="fa-brands fa-tiktok"></i>
          </button>
          <button onclick="quickKey('${inst.id}', 3)" class="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg text-xs" title="Home">
            <i class="fa-solid fa-house"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Statistikani hisoblash
function updateStats(instances) {
  statTotal.textContent = instances.length;
  statOnline.textContent = instances.filter(i => i.status === 'online').length;
  statBusy.textContent = instances.filter(i => i.status === 'busy').length;
  statOffline.textContent = instances.filter(i => i.status === 'offline').length;
}

// Ekran ko'rish modali
async function openScreenModal(id, title) {
  currentActiveInstanceId = id;
  document.getElementById('screenModalTitle').textContent = `${title} (Jonli Ekran)`;
  screenModal.classList.remove('hidden');
  await refreshScreenShot();
}

async function refreshScreenShot() {
  if (!currentActiveInstanceId) return;
  screenLoader.classList.remove('hidden');
  try {
    const timestamp = new Date().getTime();
    screenImage.src = `/api/instances/${currentActiveInstanceId}/screenshot?t=${timestamp}`;
    screenImage.onload = () => screenLoader.classList.add('hidden');
    screenImage.onerror = () => {
      screenLoader.classList.add('hidden');
      addLog(`[${currentActiveInstanceId}] Skrinshot olishda xatolik (Qurilma oflayn bo'lishi mumkin)`, 'error');
    };
  } catch (err) {
    screenLoader.classList.add('hidden');
  }
}

// Interaktiv teginish (Click to Tap)
screenImage.addEventListener('click', async (e) => {
  if (!currentActiveInstanceId) return;
  const rect = screenImage.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;

  // 720x1280 ga o'tkazish
  const targetX = Math.round((clickX / rect.width) * 720);
  const targetY = Math.round((clickY / rect.height) * 1280);

  screenLoader.classList.remove('hidden');
  try {
    await fetch(`/api/instances/${currentActiveInstanceId}/touch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'tap', x: targetX, y: targetY })
    });
    setTimeout(refreshScreenShot, 400);
  } catch (err) {
    screenLoader.classList.add('hidden');
  }
});

// Tezkor ilovani ochish
async function quickApp(id, app) {
  addLog(`[${id}] ${app.toUpperCase()} ishga tushirilmoqda...`, 'info');
  try {
    const res = await fetch(`/api/instances/${id}/app`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app })
    });
    const data = await res.json();
    if (data.success) {
      addLog(`[${id}] ${app.toUpperCase()} ochildi.`, 'success');
    }
  } catch (err) {
    addLog(`[${id}] Xatolik: ` + err.message, 'error');
  }
}

// Tezkor tugma bosish
async function quickKey(id, keycode) {
  try {
    await fetch(`/api/instances/${id}/key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keycode })
    });
    if (currentActiveInstanceId === id) {
      setTimeout(refreshScreenShot, 300);
    }
  } catch {}
}

// Modal yopish hodisalari
document.querySelectorAll('.modal-close').forEach(btn => {
  btn.addEventListener('click', () => {
    taskModal.classList.add('hidden');
    screenModal.classList.add('hidden');
    settingsModal.classList.add('hidden');
    if (screenAutoInterval) {
      clearInterval(screenAutoInterval);
      screenAutoInterval = null;
    }
  });
});

// Vazifalar modali boshqaruvi
document.getElementById('btnOpenTaskModal').addEventListener('click', () => taskModal.classList.remove('hidden'));
document.getElementById('btnOpenSettings').addEventListener('click', async () => {
  try {
    const res = await fetch('/api/config');
    const cfg = await res.json();
    document.getElementById('cfgHost').value = cfg.linuxWorker.host;
    document.getElementById('cfgStartPort').value = cfg.linuxWorker.startPort;
    document.getElementById('cfgCount').value = cfg.linuxWorker.count;
    document.getElementById('cfgHumanTyping').checked = cfg.antiBan.humanTyping;
    settingsModal.classList.remove('hidden');
  } catch {}
});

taskTypeSelect.addEventListener('change', () => {
  if (taskTypeSelect.value === 'comment') {
    commentBoxGroup.classList.remove('hidden');
  } else {
    commentBoxGroup.classList.add('hidden');
  }
});

// Vazifani ishga tushirish
document.getElementById('btnExecuteTask').addEventListener('click', async () => {
  const app = document.getElementById('taskApp').value;
  const taskType = document.getElementById('taskType').value;
  const commentText = document.getElementById('taskCommentText').value;
  const scope = document.getElementById('taskScope').value;

  taskModal.classList.add('hidden');
  addLog(`Yangi vazifa yuborilmoqda: ${taskType.toUpperCase()} (${app})...`, 'info');

  try {
    const res = await fetch('/api/tasks/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app, taskType, commentText, scope })
    });
    const data = await res.json();
    addLog(`Vazifa qabul qilindi: ${data.startedCount} ta qurilmada ish boshlandi.`, 'success');
  } catch (err) {
    addLog('Vazifa yuborishda xatolik: ' + err.message, 'error');
  }
});

// Sozlamalarni saqlash
document.getElementById('btnSaveSettings').addEventListener('click', async () => {
  const host = document.getElementById('cfgHost').value.trim();
  const startPort = parseInt(document.getElementById('cfgStartPort').value);
  const count = parseInt(document.getElementById('cfgCount').value);
  const humanTyping = document.getElementById('cfgHumanTyping').checked;

  try {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        linuxWorker: { host, startPort, count },
        antiBan: { humanTyping }
      })
    });
    settingsModal.classList.add('hidden');
    addLog('Sozlamalar saqlandi. Yangi manzillarga ulanish amalga oshirilmoqda...', 'success');
    await fetchInstances();
  } catch (err) {
    alert('Sozlamalarni saqlashda xatolik yuz berdi');
  }
});

// Ekranni avtomatik yangilash
document.getElementById('btnScreenAuto').addEventListener('click', () => {
  if (screenAutoInterval) {
    clearInterval(screenAutoInterval);
    screenAutoInterval = null;
    document.getElementById('btnScreenAuto').classList.remove('bg-emerald-600/30', 'text-emerald-300');
    document.getElementById('btnScreenAuto').classList.add('bg-indigo-600/30', 'text-indigo-300');
    addLog('Avtomatik ekran yangilanishi o\'chirildi.', 'info');
  } else {
    screenAutoInterval = setInterval(refreshScreenShot, 1500);
    document.getElementById('btnScreenAuto').classList.remove('bg-indigo-600/30', 'text-indigo-300');
    document.getElementById('btnScreenAuto').classList.add('bg-emerald-600/30', 'text-emerald-300');
    addLog('Avtomatik ekran yangilanishi yoqildi (har 1.5 sek).', 'success');
  }
});

document.getElementById('btnScreenRefresh').addEventListener('click', refreshScreenShot);
document.getElementById('btnScreenHome').addEventListener('click', () => quickKey(currentActiveInstanceId, 3));
document.getElementById('btnScreenBack').addEventListener('click', () => quickKey(currentActiveInstanceId, 4));

document.getElementById('btnRefresh').addEventListener('click', () => {
  addLog('Qurilmalar holati qayta tekshirilmoqda...', 'info');
  fetchInstances();
});

document.getElementById('btnClearLogs').addEventListener('click', () => {
  logTerminal.innerHTML = '<div class="text-slate-500">[Tozalandi]</div>';
});

// Boshlang'ich yuklash
initWebSocket();
fetchInstances();
setInterval(fetchInstances, 10000); // Har 10 soniyada fon yangilanishi
