import express, { Request, Response } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import cors from 'cors';
import { loadConfig, saveConfig } from './config';
import { AdbManager } from './core/adb_manager';
import { InstancePool, AndroidInstance } from './core/instance_pool';
import { HumanTouch } from './automation/human_touch';
import { SocialTasks } from './automation/social_tasks';
import { SshManager } from './core/ssh_manager';

import * as fs from 'fs';
import multer from 'multer';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const upload = multer({ dest: '/tmp/apk_uploads/' });

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let config = loadConfig();
const adb = new AdbManager(config.adbPath);
const pool = new InstancePool(adb);
const touch = new HumanTouch(adb);
const tasks = new SocialTasks(adb, touch);

app.use(cors());
app.use(express.json());

// Static fayllar yo'lini aniqlash (ts-node yoki dist/index.js uchun)
const publicDir = fs.existsSync(path.join(__dirname, 'web/public'))
  ? path.join(__dirname, 'web/public')
  : path.join(__dirname, '../src/web/public');

app.use(express.static(publicDir));

// WebSocket xabar tarqatish (Broadcast)
function broadcast(payload: any) {
  const json = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  });
}

function broadcastLog(message: string, level: 'info' | 'success' | 'warn' | 'error' = 'info') {
  broadcast({ type: 'log', message, level });
}

// Boshlang'ich poolni shakllantirish (Barcha Worker PC lar)
pool.setupWorkers(config.workers);

// -----------------------------------------------------------------------------
// REST API
// -----------------------------------------------------------------------------

// Konfiguratsiyani olish
app.get('/api/config', (_req: Request, res: Response) => {
  res.json(config);
});

// Konfiguratsiyani yangilash
app.post('/api/config', (req: Request, res: Response) => {
  config = saveConfig(req.body);
  pool.setupWorkers(config.workers);
  broadcastLog(`Sozlamalar yangilandi: ${config.workers.length} ta Worker PC faollashtirildi`, 'success');
  res.json(config);
});

// Worker PC lar ro'yxatini olish
app.get('/api/workers', (_req: Request, res: Response) => {
  res.json(config.workers);
});

// Yangi Worker PC qo'shish
app.post('/api/workers', (req: Request, res: Response) => {
  const { name, host, startPort = 5555, count = 1, endpoints, ssh } = req.body;
  if (!host) return res.status(400).json({ error: 'Worker IP yoki xost manzilini kiriting!' });

  const id = `pc_${Date.now()}`;
  const newWorker = {
    id,
    name: name || `Worker PC #${config.workers.length + 1}`,
    host: host.trim(),
    startPort: parseInt(startPort) || 5555,
    count: parseInt(count) || 1,
    endpoints: Array.isArray(endpoints) ? endpoints : [],
    ssh
  };

  config.workers.push(newWorker);
  config = saveConfig({ workers: config.workers });
  pool.setupWorkers(config.workers);
  broadcastLog(`Yangi Worker qo'shildi: ${newWorker.name} (${newWorker.host})`, 'success');
  res.json({ success: true, worker: newWorker, workers: config.workers });
});

// Worker PC ni yangilash
app.put('/api/workers/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = config.workers.findIndex(w => w.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Worker topilmadi' });

  config.workers[idx] = {
    ...config.workers[idx],
    ...req.body,
    id
  };

  config = saveConfig({ workers: config.workers });
  pool.setupWorkers(config.workers);
  broadcastLog(`Worker yangilandi: ${config.workers[idx].name}`, 'success');
  res.json({ success: true, worker: config.workers[idx], workers: config.workers });
});

// Worker PC ni o'chirish
app.delete('/api/workers/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const initialLen = config.workers.length;
  config.workers = config.workers.filter(w => w.id !== id);

  if (config.workers.length === initialLen) {
    return res.status(404).json({ error: 'Worker topilmadi' });
  }

  config = saveConfig({ workers: config.workers });
  pool.setupWorkers(config.workers);
  broadcastLog(`Worker o'chirildi: ${id}`, 'warn');
  res.json({ success: true, workers: config.workers });
});

// Worker Linux dan avtomatik tunnel endpoints qabul qilish
app.post('/api/workers/report-tunnels', (req: Request, res: Response) => {
  const { workerId, endpoints } = req.body;
  if (!Array.isArray(endpoints) || endpoints.length === 0) {
    return res.status(400).json({ error: 'Endpoints ro\'yxati kiritilmadi' });
  }

  const targetId = workerId || (config.workers[0] ? config.workers[0].id : 'pc_1');
  const idx = config.workers.findIndex(w => w.id === targetId);

  if (idx !== -1) {
    config.workers[idx].endpoints = endpoints;
    config.workers[idx].count = endpoints.length;
  } else {
    config.workers.push({
      id: targetId,
      name: 'Linux Worker (Tunnel)',
      host: 'tunnel',
      startPort: 5555,
      count: endpoints.length,
      endpoints
    });
  }

  config = saveConfig({ workers: config.workers });
  pool.setupWorkers(config.workers);
  broadcastLog(`[Avto-Tunnel] Worker uchun ${endpoints.length} ta tunnel ulandi!`, 'success');
  pool.refreshAll().then(instances => {
    broadcast({ type: 'instances_update', instances, workers: config.workers });
  });

  res.json({ success: true, count: endpoints.length, workers: config.workers });
});

// ipify orqali tashqi Public IP ni olish
app.get('/api/ipify', async (_req: Request, res: Response) => {
  try {
    const response = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(5000) });
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Barcha instansiyalar holatini olish
app.get('/api/instances', async (_req: Request, res: Response) => {
  const instances = await pool.refreshAll();
  res.json({
    workers: config.workers,
    instances
  });
});

const lastScreenshots = new Map<string, { buffer: Buffer; contentType: string; time: number }>();
const inFlightScreenshots = new Map<string, Promise<Buffer>>();

// Skrinshot olish (Adaptive tezkor kompressiya va kesh bilan)
app.get('/api/instances/:id/screenshot', async (req: Request, res: Response) => {
  const inst = pool.get(req.params.id);
  if (!inst) {
    return res.status(404).send('Instansiya topilmadi');
  }

  const quality = (req.query.quality as string) || 'low'; // Standart: ultra-tezkor (low)

  try {
    let pngPromise = inFlightScreenshots.get(inst.serial);
    if (!pngPromise) {
      pngPromise = adb.screencap(inst.serial).finally(() => {
        inFlightScreenshots.delete(inst.serial);
      });
      inFlightScreenshots.set(inst.serial, pngPromise);
    }
    const pngBuffer = await pngPromise;

    if (quality === 'raw' || quality === 'high') {
      lastScreenshots.set(inst.id, { buffer: pngBuffer, contentType: 'image/png', time: Date.now() });
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      return res.send(pngBuffer);
    }

    // macOS native 'sips' utilitasi orqali lahzada 300KB -> 12KB ga tushirish
    const tmpPng = `/tmp/screen_${inst.id}_${Date.now()}.png`;
    const tmpJpg = `/tmp/screen_${inst.id}_${Date.now()}.jpg`;

    await fs.promises.writeFile(tmpPng, pngBuffer);
    const sipsQuality = quality === 'medium' ? 65 : 45;
    const sipsWidth = quality === 'medium' ? 540 : 400;

    await execAsync(`sips -s format jpeg -s formatOptions ${sipsQuality} -Z ${sipsWidth} "${tmpPng}" --out "${tmpJpg}" >/dev/null 2>&1`);
    const jpgBuffer = await fs.promises.readFile(tmpJpg);

    // Vaqtinchalik fayllarni o'chirish
    fs.unlink(tmpPng, () => {});
    fs.unlink(tmpJpg, () => {});

    lastScreenshots.set(inst.id, { buffer: jpgBuffer, contentType: 'image/jpeg', time: Date.now() });
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.send(jpgBuffer);
  } catch (err: any) {
    const cached = lastScreenshots.get(inst.id);
    if (cached) {
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      return res.send(cached.buffer);
    }
    res.status(500).send(`Skrinshot olishda xatolik: ${err.message}`);
  }
});

// Ekranga teginish va surish (Tap & Swipe / Scroll)
app.post('/api/instances/:id/touch', async (req: Request, res: Response) => {
  const inst = pool.get(req.params.id);
  if (!inst) return res.status(404).json({ error: 'Topilmadi' });

  const { type, x, y, x1, y1, x2, y2, duration = 280 } = req.body;
  try {
    if (type === 'tap') {
      await adb.tap(inst.serial, x, y);
      res.json({ success: true });
    } else if (type === 'swipe') {
      await adb.swipe(inst.serial, x1, y1, x2, y2, duration);
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Noma\'lum touch turi' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Ilovani ochish
app.post('/api/instances/:id/app', async (req: Request, res: Response) => {
  const inst = pool.get(req.params.id);
  if (!inst) return res.status(404).json({ error: 'Topilmadi' });

  const { app: appName } = req.body;
  try {
    await tasks.openApp(inst.serial, appName);
    broadcastLog(`[${inst.id}] ${appName.toUpperCase()} ochildi.`, 'success');
    res.json({ success: true });
  } catch (err: any) {
    broadcastLog(`[${inst.id}] Xatolik: ${err.message}`, 'error');
    res.status(400).json({ error: err.message });
  }
});

// O'rnatilgan paketlar ro'yxatini olish
app.get('/api/instances/:id/packages', async (req: Request, res: Response) => {
  const inst = pool.get(req.params.id);
  if (!inst) return res.status(404).json({ error: 'Topilmadi' });

  const pkgs = await adb.getInstalledPackages(inst.serial);
  res.json({ packages: pkgs });
});

// APK o'rnatish (Fayl yuklash yoki URL orqali)
app.post('/api/packages/install', upload.single('apkFile'), async (req: Request, res: Response) => {
  const { apkUrl, targetScope, targetInstanceId } = req.body;
  let localApkPath = '';

  if (req.file) {
    localApkPath = req.file.path;
  } else if (apkUrl) {
    broadcastLog(`[APK Installer] APK URL orqali yuklab olinmoqda: ${apkUrl}...`, 'info');
    localApkPath = `/tmp/apk_download_${Date.now()}.apk`;
    try {
      await execAsync(`curl -L -s -o "${localApkPath}" "${apkUrl}"`);
    } catch (err: any) {
      return res.status(400).json({ error: `APK yuklab olishda xatolik: ${err.message}` });
    }
  } else {
    return res.status(400).json({ error: 'Iltimos, APK fayl yuklang yoki APK URL manzilini kiriting!' });
  }

  // Nishon qurilmalarni aniqlash
  let targets: AndroidInstance[] = [];
  if (targetInstanceId) {
    const inst = pool.get(targetInstanceId);
    if (inst) targets = [inst];
  } else if (targetScope === 'single') {
    targets = pool.getAll().filter(i => i.status === 'online').slice(0, 1);
  } else {
    targets = pool.getAll().filter(i => i.status === 'online');
  }

  if (targets.length === 0) {
    return res.status(400).json({ error: 'Birorta ham onlayn qurilma topilmadi!' });
  }

  res.json({ success: true, message: `APK ${targets.length} ta qurilmaga o'rnatilmoqda...` });

  // O'rnatishni fonda bajarish
  (async () => {
    broadcastLog(`[APK Installer] ${targets.length} ta qurilmaga o'rnatish boshlandi...`, 'info');
    for (const inst of targets) {
      broadcastLog(`[${inst.id}] APK o'rnatilmoqda...`, 'info');
      const result = await adb.installApk(inst.serial, localApkPath);
      if (result.success) {
        broadcastLog(`[${inst.id}] APK muvaffaqiyatli o'rnatildi! 🎉`, 'success');
      } else {
        broadcastLog(`[${inst.id}] APK o'rnatishda xato: ${result.message}`, 'error');
      }
    }

    // Vaqtinchalik faylni tozalash
    try {
      if (fs.existsSync(localApkPath)) fs.unlinkSync(localApkPath);
    } catch {}
  })();
});

// Tizimni yangilash (Git pull & Server recompile)
app.post('/api/system/update', async (_req: Request, res: Response) => {
  broadcastLog('[System Update] Yangilanishlar tekshirilmoqda (git pull)...', 'info');
  try {
    const rootDir = path.join(__dirname, '../../');
    const { stdout, stderr } = await execAsync('git pull origin main', { cwd: rootDir });
    const output = (stdout + ' ' + stderr).trim();
    broadcastLog(`[System Update] Git natijasi: ${output}`, 'success');

    // Serverni qayta yig'ish (build)
    if (output.includes('Updating') || output.includes('files changed')) {
      broadcastLog('[System Update] Loyiha qayta yig\'ilmoqda (npm run build)...', 'info');
      await execAsync('npm run build', { cwd: path.join(rootDir, 'master-server') });
      broadcastLog('[System Update] Yangilanish muvaffaqiyatli yakunlandi!', 'success');
    } else {
      broadcastLog('[System Update] Tizim allaqachon eng oxirgi versiyada.', 'info');
    }

    res.json({ success: true, output });
  } catch (err: any) {
    broadcastLog(`[System Update] Yangilanishda xatolik: ${err.message}`, 'error');
    res.status(500).json({ error: err.message });
  }
});

// Tugma bosish (Keyevent)
app.post('/api/instances/:id/key', async (req: Request, res: Response) => {
  const inst = pool.get(req.params.id);
  if (!inst) return res.status(404).json({ error: 'Topilmadi' });

  const { keycode } = req.body;
  try {
    await adb.keyevent(inst.serial, keycode);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Matn kiritish (Text typing & Copy-Paste)
app.post('/api/instances/:id/text', async (req: Request, res: Response) => {
  const inst = pool.get(req.params.id);
  if (!inst) return res.status(404).json({ error: 'Topilmadi' });

  const { text } = req.body;
  if (text === undefined || text === null) {
    return res.status(400).json({ error: 'Matn ko\'rsatilmadi' });
  }

  try {
    await adb.inputText(inst.serial, String(text));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Masofaviy ADB shell buyrug'ini bajarish (Terminal)
app.post('/api/commands/exec', async (req: Request, res: Response) => {
  const { command, targetScope = 'all', targetInstanceId } = req.body;
  if (!command || typeof command !== 'string' || !command.trim()) {
    return res.status(400).json({ error: 'Buyruq kiritilmadi' });
  }

  const cleanCmd = command.trim();
  let targets: AndroidInstance[] = [];

  if (targetInstanceId) {
    const inst = pool.get(targetInstanceId);
    if (inst) targets = [inst];
  } else if (targetScope === 'all') {
    targets = pool.getAll().filter(i => i.status === 'online');
    if (targets.length === 0) {
      targets = pool.getAll();
    }
  } else {
    const inst = pool.get(targetScope);
    if (inst) targets = [inst];
  }

  if (targets.length === 0) {
    return res.status(400).json({ error: 'Qurilmalar topilmadi. Sozlamalarni tekshiring.' });
  }

  broadcastLog(`[Terminal] Buyruq bajarilmoqda (${targets.length} ta qurilma): "${cleanCmd}"`, 'info');

  const results: Array<{ id: string; serial: string; output: string; success: boolean }> = [];

  for (const inst of targets) {
    try {
      const output = await adb.shell(inst.serial, cleanCmd, 12000); // 12s timeout
      results.push({
        id: inst.id,
        serial: inst.serial,
        output: output || '(Javob yo\'q / Buyruq bajarildi)',
        success: true
      });
    } catch (err: any) {
      results.push({
        id: inst.id,
        serial: inst.serial,
        output: `Xatolik: ${err.message}`,
        success: false
      });
    }
  }

  res.json({ success: true, command: cleanCmd, results });
});

// Masofaviy Linux xostida buyruq bajarish (SSH yoki Worker Agent orqali)
app.post('/api/linux/exec', async (req: Request, res: Response) => {
  const { command, method = 'auto', sshHost, sshPort, sshUser, sshPass, agentUrl } = req.body;
  if (!command || typeof command !== 'string' || !command.trim()) {
    return res.status(400).json({ error: 'Buyruq kiritilmadi' });
  }

  const cleanCmd = command.trim();
  broadcastLog(`[Linux Host] Buyruq bajarilmoqda: "${cleanCmd}"`, 'info');

  const effectiveAgentUrl = agentUrl || config.linuxWorker.agentUrl || `http://${config.linuxWorker.host}:5550/exec`;

  // 1. Agar Worker Agent usuli tanlangan bo'lsa
  if (method === 'agent') {
    try {
      const fetchRes = await fetch(effectiveAgentUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cleanCmd })
      });
      const data: any = await fetchRes.json();
      return res.json({ success: true, method: 'agent', ...data });
    } catch (err: any) {
      return res.status(500).json({ error: `Worker Agent bilan bog'lanib bo'lmadi (${effectiveAgentUrl}): ${err.message}` });
    }
  }

  // 2. SSH orqali bajarish
  const host = sshHost || config.linuxWorker.ssh?.host || config.linuxWorker.host;
  const port = parseInt(sshPort || config.linuxWorker.ssh?.port || 22);
  const username = sshUser || config.linuxWorker.ssh?.username || 'sherzodbek';
  const password = sshPass || config.linuxWorker.ssh?.password || '';

  try {
    const result = await SshManager.executeCommand({
      host,
      port,
      username,
      password: password || undefined
    }, cleanCmd, 25000);

    return res.json({
      success: result.code === 0,
      method: 'ssh',
      stdout: result.stdout,
      stderr: result.stderr,
      code: result.code
    });
  } catch (sshErr: any) {
    // Agar SSH ulanmasa va auto rejim bo'lsa, Agent portini ham sinab ko'ramiz
    if (method === 'auto') {
      try {
        const fetchRes = await fetch(effectiveAgentUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: cleanCmd }),
          signal: AbortSignal.timeout(3000)
        });
        const data: any = await fetchRes.json();
        return res.json({ success: true, method: 'agent', ...data });
      } catch {}
    }

    return res.status(500).json({
      error: `Linux xostiga SSH orqali ulanishda xato (${username}@${host}:${port}): ${sshErr.message}`
    });
  }
});

// Guruhli vazifani ishga tushirish (Like, Comment, Follow, Warmup)
app.post('/api/tasks/run', async (req: Request, res: Response) => {
  const { app: targetApp, taskType, commentText, scope } = req.body;

  const allInstances = pool.getAll().filter(i => i.status === 'online');
  let selectedInstances: AndroidInstance[] = [];

  if (scope === 'single') {
    selectedInstances = allInstances.slice(0, 1);
  } else if (scope === 'half') {
    selectedInstances = allInstances.slice(0, Math.ceil(allInstances.length / 2));
  } else {
    selectedInstances = allInstances;
  }

  if (selectedInstances.length === 0) {
    return res.status(400).json({ error: 'Birorta ham onlayn qurilma mavjud emas!' });
  }

  res.json({
    success: true,
    startedCount: selectedInstances.length
  });

  // Vazifani asinxron fonda parallel/navbat bilan bajarish
  (async () => {
    broadcastLog(`[Task Engine] ${selectedInstances.length} ta qurilmada vazifa boshlandi: ${taskType.toUpperCase()}`, 'info');

    // Komment variantlarini ajratib olish (Spin-syntax)
    const commentOptions = commentText
      ? commentText.split('|').map((s: string) => s.trim()).filter(Boolean)
      : ['Ajoyib!', 'Juda zo\'r! 🔥', 'Foydali kontent'];

    for (let i = 0; i < selectedInstances.length; i++) {
      const inst = selectedInstances[i];
      pool.setTaskStatus(inst.id, 'busy', `${taskType.toUpperCase()} bajarilmoqda`);
      broadcast({ type: 'instances_update', instances: pool.getAll() });

      // Har bir instansiyani fonda alohida ishlatish
      (async () => {
        try {
          broadcastLog(`[${inst.id}] Ilova ochilmoqda (${targetApp})...`);
          await tasks.openApp(inst.serial, targetApp);

          if (taskType === 'like') {
            broadcastLog(`[${inst.id}] Postga Like bosilmoqda...`);
            await tasks.likeCurrentPost(inst.serial, targetApp);
            broadcastLog(`[${inst.id}] Like muvaffaqiyatli qo'yildi!`, 'success');
          } else if (taskType === 'comment') {
            const randomComment = commentOptions[Math.floor(Math.random() * commentOptions.length)];
            broadcastLog(`[${inst.id}] Komment yozilmoqda: "${randomComment}"`);
            await tasks.commentOnPost(inst.serial, randomComment, targetApp);
            broadcastLog(`[${inst.id}] Komment muvaffaqiyatli yuborildi!`, 'success');
          } else if (taskType === 'follow') {
            broadcastLog(`[${inst.id}] Follow tugmasi bosilmoqda...`);
            await tasks.followUser(inst.serial, targetApp);
            broadcastLog(`[${inst.id}] Profilga obuna bo'lindi!`, 'success');
          } else if (taskType === 'warmup') {
            broadcastLog(`[${inst.id}] Akkaunt qizdirish: Lenta tomosha qilinmoqda...`);
            await tasks.warmUpBrowsing(inst.serial, 4);
            broadcastLog(`[${inst.id}] Qizdirish sessiyasi yakunlandi.`, 'success');
          }

          pool.setTaskStatus(inst.id, 'online', 'Vazifa bajarildi');
        } catch (err: any) {
          broadcastLog(`[${inst.id}] Vazifa bajarishda xatolik: ${err.message}`, 'error');
          pool.setTaskStatus(inst.id, 'online', 'Xatolik yuz berdi');
        } finally {
          broadcast({ type: 'instances_update', instances: pool.getAll() });
        }
      })();

      // Instansiyalar starti orasida insoniy kechikish (Anti-detection)
      const staggerDelay = Math.floor(Math.random() * 2000) + 1500;
      await new Promise(r => setTimeout(r, staggerDelay));
    }
  })();
});

// Boshlang'ich sahifaga kirganda index.html ni berish
app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Serverni ishga tushirish
const PORT = process.env.PORT || config.port || 3000;
server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  Android Box Master Server faollashdi!                `);
  console.log(`  Boshqaruv Paneli: http://localhost:${PORT}           `);
  console.log(`  Nishon Linux Xost: ${config.linuxWorker.host}        `);
  console.log(`=======================================================`);
});
