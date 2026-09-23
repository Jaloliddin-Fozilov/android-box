import { exec, execFile } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export class AdbManager {
  private adbPath: string;

  constructor(adbPath = 'adb') {
    this.adbPath = adbPath;
  }

  /**
   * Masofaviy Android instansiyasiga ulanish (TCP/IP)
   */
  async connect(host: string, port: number): Promise<boolean> {
    const target = `${host}:${port}`;
    try {
      const { stdout } = await execPromise(`${this.adbPath} connect ${target}`, { timeout: 4000 });
      return stdout.includes('connected') || stdout.includes('already connected');
    } catch (err) {
      console.error(`[ADB] ${target} ga ulanishda xato:`, err);
      return false;
    }
  }

  /**
   * Instansiyadan uzilish
   */
  async disconnect(host: string, port: number): Promise<boolean> {
    const target = `${host}:${port}`;
    try {
      await execPromise(`${this.adbPath} disconnect ${target}`, { timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Barcha ulangan qurilmalar holatini olish
   */
  async getDevices(): Promise<Array<{ serial: string; state: string }>> {
    try {
      const { stdout } = await execPromise(`${this.adbPath} devices`, { timeout: 4000 });
      const lines = stdout.trim().split('\n').slice(1);
      const devices: Array<{ serial: string; state: string }> = [];

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          devices.push({ serial: parts[0], state: parts[1] });
        }
      }
      return devices;
    } catch (err) {
      console.error('[ADB] Qurilmalar ro\'yxatini olishda xatolik:', err);
      return [];
    }
  }

  /**
   * Muayyan qurilmada shell buyrug'ini bajarish
   */
  async shell(device: string, command: string, timeout = 7000): Promise<string> {
    try {
      const { stdout, stderr } = await execPromise(`${this.adbPath} -s ${device} shell "${command.replace(/"/g, '\\"')}"`, { timeout });
      const combined = [stdout, stderr].filter(Boolean).join('\n').trim();
      return combined;
    } catch (err: any) {
      const errOut = [err.stdout, err.stderr, err.message].filter(Boolean).join('\n').trim();
      return errOut;
    }
  }

  /**
   * Skrinshot olish va Buffer (PNG) qaytarish
   */
  screencap(device: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      execFile(
        this.adbPath,
        ['-s', device, 'exec-out', 'screencap', '-p'],
        { encoding: 'buffer', maxBuffer: 15 * 1024 * 1024, timeout: 15000 },
        (error, stdout) => {
          if (error) {
            reject(error);
          } else {
            resolve(stdout);
          }
        }
      );
    });
  }

  /**
   * Ekranga bosish (Tap)
   */
  async tap(device: string, x: number, y: number): Promise<void> {
    await this.shell(device, `input tap ${Math.round(x)} ${Math.round(y)}`);
  }

  /**
   * Ekranni surish (Swipe)
   */
  async swipe(device: string, x1: number, y1: number, x2: number, y2: number, durationMs = 300): Promise<void> {
    await this.shell(
      device,
      `input swipe ${Math.round(x1)} ${Math.round(y1)} ${Math.round(x2)} ${Math.round(y2)} ${durationMs}`
    );
  }

  /**
   * Matn kiritish (harflar, belgilar, bo'sh joylar va o'zbekcha harflarni to'g'ri o'tkazish)
   */
  async inputText(device: string, text: string): Promise<void> {
    if (!text) return;
    const formatted = text
      .replace(/\r?\n/g, ' ')
      .replace(/([\\$"`&();<>|*?~#!^'])/g, '\\$1')
      .replace(/ /g, '%s');

    await new Promise<void>((resolve) => {
      execFile(this.adbPath, ['-s', device, 'shell', 'input', 'text', formatted], (err) => {
        if (err) {
          console.warn(`[ADB] inputText xatolik (${device}):`, err.message);
        }
        resolve();
      });
    });
  }

  /**
   * Tugma bosish (Masalan: 3=Home, 4=Back, 66=Enter)
   */
  async keyevent(device: string, keycode: number): Promise<void> {
    await this.shell(device, `input keyevent ${keycode}`);
  }

  /**
   * Ilova o'rnatilganligini tekshirish
   */
  async isPackageInstalled(device: string, packageName: string): Promise<boolean> {
    try {
      const output = await this.shell(device, `pm path ${packageName}`);
      return output.includes('package:');
    } catch {
      return false;
    }
  }

  /**
   * O'rnatilgan foydalanuvchi ilovalari ro'yxatini olish
   */
  async getInstalledPackages(device: string): Promise<string[]> {
    try {
      const output = await this.shell(device, 'pm list packages -3');
      return output
        .split('\n')
        .map(line => line.replace('package:', '').trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * Qurilma holatini tekshirish ('device', 'offline', 'unauthorized')
   */
  async getState(device: string): Promise<string> {
    try {
      const { stdout } = await execPromise(`${this.adbPath} -s ${device} get-state`, { timeout: 3000 });
      return stdout.trim();
    } catch {
      return 'offline';
    }
  }

  /**
   * APK faylni qurilmaga o'rnatish
   */
  async installApk(device: string, apkPath: string): Promise<{ success: boolean; message: string }> {
    try {
      let state = await this.getState(device);
      if (state !== 'device') {
        // Agar offline bo'lsa, reconnect qilib qayta urinib ko'ramiz
        await execPromise(`${this.adbPath} -s ${device} reconnect`, { timeout: 3000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 1500));
        state = await this.getState(device);
        if (state !== 'device') {
          return { success: false, message: `Qurilma hozirda '${state}' holatida. Tizim to'liq yuklanmaguncha kuting.` };
        }
      }

      const { stdout, stderr } = await execPromise(
        `${this.adbPath} -s ${device} install -r -g "${apkPath.replace(/"/g, '\\"')}"`,
        { timeout: 60000 }
      );
      const combined = (stdout + ' ' + stderr).trim();
      if (combined.includes('Success')) {
        return { success: true, message: 'Muvaffaqiyatli o\'rnatildi' };
      }
      return { success: false, message: combined || 'O\'rnatishda xatolik yuz berdi' };
    } catch (err: any) {
      return { success: false, message: err.message || 'O\'rnatishda xatolik' };
    }
  }

  /**
   * Ilovani ochish (oldin o'rnatilganligini tekshiradi)
   */
  async startApp(device: string, packageName: string, activityName?: string): Promise<void> {
    const isInstalled = await this.isPackageInstalled(device, packageName);
    if (!isInstalled) {
      throw new Error(`"${packageName}" ilovasi bu telefonda o'rnatilmagan! Iltimos, oldin APK o'rnating.`);
    }

    if (activityName) {
      await this.shell(device, `am start -n ${packageName}/${activityName}`);
    } else {
      await this.shell(device, `monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`);
    }
  }

  /**
   * Ilovani to'xtatish (Force Stop)
   */
  async stopApp(device: string, packageName: string): Promise<void> {
    await this.shell(device, `am force-stop ${packageName}`);
  }
}
