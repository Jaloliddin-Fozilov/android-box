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
      const { stdout } = await execPromise(`${this.adbPath} connect ${target}`);
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
      await execPromise(`${this.adbPath} disconnect ${target}`);
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
      const { stdout } = await execPromise(`${this.adbPath} devices`);
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
  async shell(device: string, command: string): Promise<string> {
    try {
      const { stdout } = await execPromise(`${this.adbPath} -s ${device} shell "${command.replace(/"/g, '\\"')}"`);
      return stdout;
    } catch (err: any) {
      return err.stdout || '';
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
        { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 },
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
   * Matn kiritish
   */
  async inputText(device: string, text: string): Promise<void> {
    // Bo'sh joylar va maxsus belgilarni to'g'irlash
    const sanitized = text.replace(/ /g, '%s').replace(/"/g, '\\"');
    await this.shell(device, `input text "${sanitized}"`);
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
   * APK faylni qurilmaga o'rnatish
   */
  async installApk(device: string, apkPath: string): Promise<{ success: boolean; message: string }> {
    try {
      const { stdout, stderr } = await execPromise(
        `${this.adbPath} -s ${device} install -r -g "${apkPath.replace(/"/g, '\\"')}"`
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
