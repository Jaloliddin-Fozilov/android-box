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
const apkModal = document.getElementById('apkModal');
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

let isFetchingScreen = false;
const screenLatency = document.getElementById('screenLatency');
const screenQualitySelect = document.getElementById('screenQuality');
const touchRippleLayer = document.getElementById('touchRippleLayer');

async function refreshScreenShot() {
  if (!currentActiveInstanceId || isFetchingScreen) return;
  isFetchingScreen = true;
  const startTime = Date.now();
  const quality = screenQualitySelect ? screenQualitySelect.value : 'low';

  try {
    const timestamp = Date.now();
    const newImg = new Image();
    newImg.src = `/api/instances/${currentActiveInstanceId}/screenshot?quality=${quality}&t=${timestamp}`;

    newImg.onload = () => {
      screenImage.src = newImg.src;
      screenLoader.classList.add('hidden');
      isFetchingScreen = false;
      const latency = Date.now() - startTime;
      if (screenLatency) {
        screenLatency.textContent = `${latency} ms`;
        if (latency < 120) {
          screenLatency.className = 'text-[10px] bg-slate-800 text-emerald-400 px-1.5 py-0.5 rounded font-mono';
        } else if (latency < 350) {
          screenLatency.className = 'text-[10px] bg-slate-800 text-amber-400 px-1.5 py-0.5 rounded font-mono';
        } else {
          screenLatency.className = 'text-[10px] bg-slate-800 text-rose-400 px-1.5 py-0.5 rounded font-mono';
        }
      }
    };

    newImg.onerror = () => {
      screenLoader.classList.add('hidden');
      isFetchingScreen = false;
    };
  } catch (err) {
    screenLoader.classList.add('hidden');
    isFetchingScreen = false;
  }
}

// 100% aniqlikdagi sensor koordinatalarini hisoblash (Letterbox/Pillarbox kompensatsiyasi)
function getScreenCoords(clientX, clientY) {
  const rect = screenImage.getBoundingClientRect();
  const actualW = screenImage.naturalWidth || 720;
  const actualH = screenImage.naturalHeight || 1280;
  const imgRatio = actualW / actualH;
  const elemRatio = rect.width / rect.height;

  let renderedW = rect.width;
  let renderedH = rect.height;
  let offsetX = 0;
  let offsetY = 0;

  if (elemRatio > imgRatio) {
    renderedW = rect.height * imgRatio;
    offsetX = (rect.width - renderedW) / 2;
  } else {
    renderedH = rect.width / imgRatio;
    offsetY = (rect.height - renderedH) / 2;
  }

  const relX = clientX - rect.left - offsetX;
  const relY = clientY - rect.top - offsetY;

  const normX = Math.max(0, Math.min(1, relX / renderedW));
  const normY = Math.max(0, Math.min(1, relY / renderedH));

  return {
    x: Math.round(normX * 720),
    y: Math.round(normY * 1280),
    cssX: clientX - rect.left,
    cssY: clientY - rect.top
  };
}

// Vizual touch animatsiyasi (Barmoq qayerga tekkanni ko'rsatish)
function showTouchRipple(x, y) {
  if (!touchRippleLayer) return;
  const ripple = document.createElement('div');
  ripple.className = 'absolute w-8 h-8 -ml-4 -mt-4 rounded-full bg-indigo-400/50 border border-white pointer-events-none animate-ping';
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  touchRippleLayer.appendChild(ripple);
  setTimeout(() => ripple.remove(), 400);
}

// Barmoq harakatlari (Sensor & Swipe / Scroll)
let pointerStart = null;

screenImage.addEventListener('pointerdown', (e) => {
  if (!currentActiveInstanceId) return;
  e.preventDefault();
  const coords = getScreenCoords(e.clientX, e.clientY);
  pointerStart = {
    x: coords.x,
    y: coords.y,
    cssX: coords.cssX,
    cssY: coords.cssY,
    time: Date.now()
  };
  showTouchRipple(coords.cssX, coords.cssY);
});

screenImage.addEventListener('pointerup', async (e) => {
  if (!currentActiveInstanceId || !pointerStart) return;
  e.preventDefault();
  const coords = getScreenCoords(e.clientX, e.clientY);
  const dx = coords.x - pointerStart.x;
  const dy = coords.y - pointerStart.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const duration = Math.min(1000, Date.now() - pointerStart.time);

  const startPt = { ...pointerStart };
  pointerStart = null;

  try {
    if (dist < 15) {
      // 1. Oddiy Bosish (TAP)
      await fetch(`/api/instances/${currentActiveInstanceId}/touch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'tap', x: coords.x, y: coords.y })
      });
    } else {
      // 2. Surish va Varaqlash (SWIPE / SCROLL)
      await fetch(`/api/instances/${currentActiveInstanceId}/touch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'swipe',
          x1: startPt.x,
          y1: startPt.y,
          x2: coords.x,
          y2: coords.y,
          duration: Math.max(180, duration)
        })
      });
    }
    setTimeout(refreshScreenShot, 200);
  } catch (err) {}
});

// Sifat o'zgarganda darhol qayta yuklash
if (screenQualitySelect) {
  screenQualitySelect.addEventListener('change', refreshScreenShot);
}

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
    if (res.ok && data.success) {
      addLog(`[${id}] ${app.toUpperCase()} muvaffaqiyatli ochildi.`, 'success');
      if (currentActiveInstanceId === id) {
        setTimeout(refreshScreenShot, 2500);
      }
    } else {
      addLog(`[${id}] Ogohlantirish: ${data.error || 'Ilovani ochib bo\'lmadi'}`, 'error');
      if (data.error && data.error.includes("o'rnatilmagan")) {
        apkModal.classList.remove('hidden');
        addLog(`[${id}] Ilova o'rnatilmagan. Iltimos, APK o'rnatish oynasidan foydalaning.`, 'warn');
      }
    }
  } catch (err) {
    addLog(`[${id}] Tarmoq xatosi: ` + err.message, 'error');
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

async function sendQuickKey(keycode) {
  if (!currentActiveInstanceId) return;
  await quickKey(currentActiveInstanceId, keycode);
}

// Matn yuborish (Typing / Paste)
async function sendTextToDevice(id, text) {
  if (!id || !text) return;
  try {
    const res = await fetch(`/api/instances/${id}/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (res.ok) {
      setTimeout(refreshScreenShot, 250);
    }
  } catch (err) {
    console.error('sendText xato:', err);
  }
}

// Modal yopish hodisalari
document.querySelectorAll('.modal-close').forEach(btn => {
  btn.addEventListener('click', () => {
    taskModal.classList.add('hidden');
    screenModal.classList.add('hidden');
    settingsModal.classList.add('hidden');
    apkModal.classList.add('hidden');
    const cmdModal = document.getElementById('commandModal');
    if (cmdModal) cmdModal.classList.add('hidden');
    if (screenAutoInterval) {
      clearInterval(screenAutoInterval);
      screenAutoInterval = null;
    }
  });
});

// Qurilmalar sonini tezkor tanlash
function setBoxCount(n) {
  const el = document.getElementById('cfgCount');
  if (el) el.value = n;
}

// Vazifalar modali boshqaruvi
document.getElementById('btnOpenTaskModal').addEventListener('click', () => taskModal.classList.remove('hidden'));
document.getElementById('btnOpenSettings').addEventListener('click', async () => {
  try {
    const res = await fetch('/api/config');
    const cfg = await res.json();
    document.getElementById('cfgHost').value = cfg.linuxWorker.host || '';
    document.getElementById('cfgStartPort').value = cfg.linuxWorker.startPort || 5555;
    document.getElementById('cfgCount').value = cfg.linuxWorker.count || 4;
    const endpointsArea = document.getElementById('cfgEndpoints');
    if (endpointsArea) {
      endpointsArea.value = (cfg.linuxWorker.endpoints || []).join('\n');
    }
    document.getElementById('cfgHumanTyping').checked = cfg.antiBan ? cfg.antiBan.humanTyping : true;
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
  const startPort = parseInt(document.getElementById('cfgStartPort').value) || 5555;
  const count = parseInt(document.getElementById('cfgCount').value) || 4;
  const endpointsArea = document.getElementById('cfgEndpoints');
  const endpoints = endpointsArea ? endpointsArea.value.split('\n').map(s => s.trim()).filter(Boolean) : [];
  const humanTyping = document.getElementById('cfgHumanTyping').checked;

  try {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        linuxWorker: { host, startPort, count, endpoints },
        antiBan: { humanTyping }
      })
    });
    settingsModal.classList.add('hidden');
    addLog('Sozlamalar saqlandi. Qurilmalarga ulanish amalga oshirilmoqda...', 'success');
    await fetchInstances();
  } catch (err) {
    alert('Sozlamalarni saqlashda xatolik yuz berdi: ' + err.message);
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
    screenAutoInterval = setInterval(refreshScreenShot, 400); // 400ms tezkor oqim
    document.getElementById('btnScreenAuto').classList.remove('bg-indigo-600/30', 'text-indigo-300');
    document.getElementById('btnScreenAuto').classList.add('bg-emerald-600/30', 'text-emerald-300');
    addLog('Jonli oqim faollashdi (400ms - ultra tezkor).', 'success');
  }
});

const btnScreenRefresh = document.getElementById('btnScreenRefresh');
if (btnScreenRefresh) btnScreenRefresh.addEventListener('click', refreshScreenShot);
document.getElementById('btnScreenHome').addEventListener('click', () => quickKey(currentActiveInstanceId, 3));
document.getElementById('btnScreenBack').addEventListener('click', () => quickKey(currentActiveInstanceId, 4));

// Matn yuborish va Clipboard (Paste) hodisalari
const screenTextInput = document.getElementById('screenTextInput');
const btnSendText = document.getElementById('btnSendText');
const btnPasteClipboard = document.getElementById('btnPasteClipboard');

async function handleSendText() {
  if (!currentActiveInstanceId || !screenTextInput) return;
  const val = screenTextInput.value;
  if (!val) return;
  await sendTextToDevice(currentActiveInstanceId, val);
  screenTextInput.value = '';
  addLog(`[${currentActiveInstanceId}] Matn yuborildi: "${val.substring(0, 30)}..."`, 'info');
}

if (btnSendText) {
  btnSendText.addEventListener('click', handleSendText);
}

if (screenTextInput) {
  screenTextInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendText();
    }
  });
}

if (btnPasteClipboard) {
  btnPasteClipboard.addEventListener('click', async () => {
    if (!currentActiveInstanceId) return;
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        addLog('Clipboard bo\'sh yoki ruxsat berilmadi.', 'warn');
        return;
      }
      await sendTextToDevice(currentActiveInstanceId, text);
      addLog(`[${currentActiveInstanceId}] Clipboard'dan nusxalandi: "${text.substring(0, 30)}..."`, 'success');
    } catch (err) {
      const manual = prompt('Matnni bu yerga paste (Cmd+V) qiling:');
      if (manual) {
        await sendTextToDevice(currentActiveInstanceId, manual);
        addLog(`[${currentActiveInstanceId}] Matn kiritildi.`, 'success');
      }
    }
  });
}

// Klaviaturadan to'g'ridan-to'g'ri boshqarish (Keyboard events)
window.addEventListener('keydown', async (e) => {
  if (!currentActiveInstanceId || screenModal.classList.contains('hidden')) return;

  // Agar boshqa modallardagi input yoki textarea bo'lsa, xalaqit bermaymiz
  if (e.target && e.target.tagName === 'INPUT' && e.target !== screenTextInput) return;
  if (e.target && e.target.tagName === 'TEXTAREA') return;

  // 1. Cmd+V / Ctrl+V - Clipboard paste
  if ((e.metaKey || e.ctrlKey) && (e.key === 'v' || e.key === 'V')) {
    if (document.activeElement === screenTextInput) return; // input o'zi paste qilsin

    e.preventDefault();
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        await sendTextToDevice(currentActiveInstanceId, text);
        addLog(`[${currentActiveInstanceId}] ⌘+V orqali paste qilindi: "${text.substring(0, 30)}..."`, 'success');
      }
    } catch {
      if (screenTextInput) screenTextInput.focus();
    }
    return;
  }

  // Agar screenTextInput fokusda bo'lsa, qolgan tugmalarni o'ziga qoldiramiz
  if (document.activeElement === screenTextInput) return;

  // 2. Maxsus boshqaruv tugmalari (Backspace, Enter, Space, Arrow keys, Esc)
  if (e.key === 'Backspace') {
    e.preventDefault();
    await quickKey(currentActiveInstanceId, 67); // KEYCODE_DEL
  } else if (e.key === 'Enter') {
    e.preventDefault();
    await quickKey(currentActiveInstanceId, 66); // KEYCODE_ENTER
  } else if (e.key === ' ') {
    e.preventDefault();
    await quickKey(currentActiveInstanceId, 62); // KEYCODE_SPACE
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    await quickKey(currentActiveInstanceId, 19);
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    await quickKey(currentActiveInstanceId, 20);
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    await quickKey(currentActiveInstanceId, 21);
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    await quickKey(currentActiveInstanceId, 22);
  } else if (e.key === 'Escape') {
    e.preventDefault();
    await quickKey(currentActiveInstanceId, 4); // KEYCODE_BACK
  } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
    // 3. Oddiy harflar va sonlar (a-z, 0-9 va boshqalar)
    e.preventDefault();
    await sendTextToDevice(currentActiveInstanceId, e.key);
  }
});

document.getElementById('btnRefresh').addEventListener('click', () => {
  addLog('Qurilmalar holati qayta tekshirilmoqda...', 'info');
  fetchInstances();
});

// APK Modali
document.getElementById('btnOpenApkModal').addEventListener('click', () => {
  apkModal.classList.remove('hidden');
});

// Tayyor APK havolalari
function setPresetApk(type) {
  const urlInput = document.getElementById('apkUrlInput');
  if (type === 'instagram_lite') {
    urlInput.value = 'https://d.apkpure.net/b/APK/com.instagram.lite?version=latest';
  } else if (type === 'tiktok') {
    urlInput.value = 'https://d.apkpure.net/b/APK/com.zhiliaoapp.musically.go?version=latest';
  }
}

// APK o'rnatishni boshlash
document.getElementById('btnStartApkInstall').addEventListener('click', async () => {
  const fileInput = document.getElementById('apkFileInput');
  const urlInput = document.getElementById('apkUrlInput');
  const scope = document.getElementById('apkTargetScope').value;
  const progressBox = document.getElementById('apkInstallProgress');

  const file = fileInput.files[0];
  const apkUrl = urlInput.value.trim();

  if (!file && !apkUrl) {
    alert('Iltimos, APK faylni tanlang yoki APK URL manzilini kiriting!');
    return;
  }

  const formData = new FormData();
  if (file) {
    formData.append('apkFile', file);
  } else {
    formData.append('apkUrl', apkUrl);
  }
  formData.append('targetScope', scope);

  progressBox.classList.remove('hidden');
  addLog('APK fayl serverga yuklanmoqda va o\'rnatish boshlanmoqda...', 'info');

  try {
    const res = await fetch('/api/packages/install', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (res.ok) {
      addLog(`[APK Installer] ${data.message}`, 'success');
      setTimeout(() => {
        apkModal.classList.add('hidden');
        progressBox.classList.add('hidden');
        fileInput.value = '';
        urlInput.value = '';
      }, 1500);
    } else {
      progressBox.classList.add('hidden');
      addLog(`[APK Installer] Xatolik: ${data.error}`, 'error');
    }
  } catch (err) {
    progressBox.classList.add('hidden');
    addLog('[APK Installer] Tarmoq xatosi: ' + err.message, 'error');
  }
});

// Tizimni yangilash (Git Update)
document.getElementById('btnSystemUpdate').addEventListener('click', async () => {
  if (!confirm('Tizim eng so\'nggi versiyaga yangilansinmi (git pull)?')) return;
  addLog('[Tizim] Yangilanishlar tekshirilmoqda...', 'info');

  try {
    const res = await fetch('/api/system/update', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      addLog(`[Tizim] Natija: ${data.output}`, 'success');
      alert(`Tizim yangilandi:\n${data.output}`);
    } else {
      addLog(`[Tizim] Xatolik: ${data.error}`, 'error');
    }
  } catch (err) {
    addLog('[Tizim] Yangilashda xato: ' + err.message, 'error');
  }
});

document.getElementById('btnClearLogs').addEventListener('click', () => {
  logTerminal.innerHTML = '<div class="text-slate-500">[Tozalandi]</div>';
});

// =============================================================================
// Masofaviy ADB Terminal / Buyruqlar Markazi
// =============================================================================
const commandModal = document.getElementById('commandModal');
const btnOpenCommandModal = document.getElementById('btnOpenCommandModal');
const cmdInput = document.getElementById('cmdInput');
const btnExecuteCommand = document.getElementById('btnExecuteCommand');
const cmdPresetSelect = document.getElementById('cmdPresetSelect');
const cmdTargetScope = document.getElementById('cmdTargetScope');
const cmdOutput = document.getElementById('cmdOutput');
const btnClearCmdOutput = document.getElementById('btnClearCmdOutput');
const btnCopyCmdOutput = document.getElementById('btnCopyCmdOutput');

if (btnOpenCommandModal && commandModal) {
  btnOpenCommandModal.addEventListener('click', () => {
    commandModal.classList.remove('hidden');
    if (cmdInput) cmdInput.focus();
  });
}

if (cmdPresetSelect) {
  cmdPresetSelect.addEventListener('change', () => {
    if (cmdPresetSelect.value && cmdInput) {
      cmdInput.value = cmdPresetSelect.value;
      cmdInput.focus();
    }
  });
}

async function executeCommand() {
  if (!cmdInput || !cmdOutput) return;
  const cmd = cmdInput.value.trim();
  if (!cmd) return;

  const targetScope = cmdTargetScope ? cmdTargetScope.value : 'all';
  const timeStr = new Date().toLocaleTimeString();

  // Loading holati
  cmdOutput.innerHTML += `\n<span class="text-sky-400 font-semibold">[${timeStr}] $ ${cmd}</span>\n<span class="text-slate-500">Buyruq yuborildi, bajarilmoqda...</span>\n`;
  cmdOutput.scrollTop = cmdOutput.scrollHeight;

  try {
    const res = await fetch('/api/commands/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: cmd, targetScope })
    });
    const data = await res.json();

    if (res.ok) {
      let resultText = '';
      data.results.forEach((r) => {
        const badgeColor = r.success ? 'text-emerald-400' : 'text-red-400';
        resultText += `<span class="${badgeColor} font-bold">[${r.id.toUpperCase()}]</span>\n${r.output}\n\n`;
      });
      cmdOutput.innerHTML += resultText;
      addLog(`[Terminal] "${cmd}" bajarildi (${data.results.length} ta qurilma).`, 'success');
    } else {
      cmdOutput.innerHTML += `<span class="text-red-400">[Xatolik]: ${data.error || 'Noma\'lum xato'}</span>\n\n`;
      addLog(`[Terminal] Xatolik: ${data.error}`, 'error');
    }
  } catch (err) {
    cmdOutput.innerHTML += `<span class="text-red-400">[Tarmoq xatosi]: ${err.message}</span>\n\n`;
    addLog(`[Terminal] Tarmoq xatosi: ${err.message}`, 'error');
  }

  cmdOutput.scrollTop = cmdOutput.scrollHeight;
}

if (btnExecuteCommand) {
  btnExecuteCommand.addEventListener('click', executeCommand);
}

if (cmdInput) {
  cmdInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeCommand();
    }
  });
}

if (btnClearCmdOutput && cmdOutput) {
  btnClearCmdOutput.addEventListener('click', () => {
    cmdOutput.innerHTML = '<span class="text-slate-500">Terminal tozalandi. Yangi buyruq kiriting.</span>\n';
  });
}

if (btnCopyCmdOutput && cmdOutput) {
  btnCopyCmdOutput.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(cmdOutput.innerText);
      btnCopyCmdOutput.innerHTML = '<i class="fa-solid fa-check text-emerald-400 mr-1"></i> Nusxalandi!';
      setTimeout(() => {
        btnCopyCmdOutput.innerHTML = '<i class="fa-solid fa-copy mr-1"></i> Nusxalash';
      }, 2000);
    } catch {
      alert('Nusxalashda xatolik');
    }
  });
}

// Boshlang'ich yuklash
initWebSocket();
fetchInstances();
setInterval(fetchInstances, 10000); // Har 10 soniyada fon yangilanishi
