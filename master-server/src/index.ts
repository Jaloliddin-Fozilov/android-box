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

// Boshlang'ich poolni shakllantirish
pool.setupPool(config.linuxWorker.host, config.linuxWorker.startPort, config.linuxWorker.count);

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
  pool.setupPool(config.linuxWorker.host, config.linuxWorker.startPort, config.linuxWorker.count);
  broadcastLog(`Sozlamalar yangilandi: ${config.linuxWorker.host} (${config.linuxWorker.count} ta instansiya)`, 'success');
  res.json(config);
});

// Barcha instansiyalar holatini olish
app.get('/api/instances', async (_req: Request, res: Response) => {
  const instances = await pool.refreshAll();
  res.json({
    host: config.linuxWorker.host,
    instances
  });
});

// Skrinshot olish
app.get('/api/instances/:id/screenshot', async (req: Request, res: Response) => {
  const inst = pool.get(req.params.id);
  if (!inst) {
    return res.status(404).send('Instansiya topilmadi');
  }

  try {
    const pngBuffer = await adb.screencap(inst.serial);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.send(pngBuffer);
  } catch (err: any) {
    res.status(500).send(`Skrinshot olishda xatolik: ${err.message}`);
  }
});

// Ekranga teginish (Tap / Touch)
app.post('/api/instances/:id/touch', async (req: Request, res: Response) => {
  const inst = pool.get(req.params.id);
  if (!inst) return res.status(404).json({ error: 'Topilmadi' });

  const { type, x, y } = req.body;
  try {
    if (type === 'tap') {
      await adb.tap(inst.serial, x, y);
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
