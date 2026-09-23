import { AdbManager } from './adb_manager';
import { WorkerConfig } from '../config';

export interface AndroidInstance {
  id: string;
  workerId: string;
  workerName: string;
  index: number;
  host: string;
  port: number;
  serial: string;
  status: 'online' | 'offline' | 'busy' | 'connecting';
  model?: string;
  assignedAccount?: string;
  assignedProxy?: string;
  currentTask?: string;
  lastSeen?: Date;
}

export class InstancePool {
  private instances: Map<string, AndroidInstance> = new Map();
  private adb: AdbManager;

  constructor(adb: AdbManager) {
    this.adb = adb;
  }

  /**
   * Barcha Worker PC lar bo'yicha instansiyalarni shakllantirish (Guruhlash)
   */
  setupWorkers(workers: WorkerConfig[]): void {
    this.instances.clear();
    let globalIndex = 1;

    for (const worker of workers) {
      if (worker.endpoints && worker.endpoints.length > 0) {
        worker.endpoints.forEach((ep, idx) => {
          const clean = ep.trim();
          if (!clean) return;
          const [epHost, epPortStr] = clean.replace('tcp://', '').split(':');
          const port = parseInt(epPortStr) || 5555;
          const serial = `${epHost}:${port}`;
          const id = `${worker.id}_box_${idx + 1}`;

          this.instances.set(id, {
            id,
            workerId: worker.id,
            workerName: worker.name,
            index: globalIndex++,
            host: epHost,
            port,
            serial,
            status: 'offline',
            model: 'Yuklanmoqda...',
            assignedAccount: `Akkaunt #${globalIndex - 1}`,
            currentTask: 'Kutmoqda'
          });
        });
      } else {
        const count = worker.count || 1;
        const startPort = worker.startPort || 5555;
        for (let i = 1; i <= count; i++) {
          const port = startPort + i - 1;
          const serial = `${worker.host}:${port}`;
          const id = `${worker.id}_box_${i}`;

          this.instances.set(id, {
            id,
            workerId: worker.id,
            workerName: worker.name,
            index: globalIndex++,
            host: worker.host,
            port,
            serial,
            status: 'offline',
            model: 'Yuklanmoqda...',
            assignedAccount: `Akkaunt #${globalIndex - 1}`,
            currentTask: 'Kutmoqda'
          });
        }
      }
    }
  }

  /**
   * Eskicha bitta xost uchun setup (backward-compatible)
   */
  setupPool(host: string, startPort: number, count: number, endpoints?: string[]): void {
    this.setupWorkers([{
      id: 'pc_1',
      name: 'Linux Worker #1',
      host,
      startPort,
      count,
      endpoints
    }]);
  }

  /**
   * Barcha instansiyalarga ulanish va ularning holatini tekshirish
   */
  async refreshAll(): Promise<AndroidInstance[]> {
    const devices = await this.adb.getDevices();
    const onlineSerials = new Set(
      devices.filter(d => d.state === 'device').map(d => d.serial)
    );

    const checkPromises = Array.from(this.instances.values()).map(async (inst) => {
      // Agar avval ulanmagan bo'lsa, ulanishga harakat qilamiz
      if (!onlineSerials.has(inst.serial) && inst.status !== 'busy') {
        const connected = await this.adb.connect(inst.host, inst.port);
        if (connected) {
          onlineSerials.add(inst.serial);
        }
      }

      if (onlineSerials.has(inst.serial)) {
        if (inst.status !== 'busy') {
          inst.status = 'online';
        }
        inst.lastSeen = new Date();

        // Model nomini olish (agar hali olinmagan bo'lsa)
        if (inst.model === 'Yuklanmoqda...' || !inst.model) {
          try {
            const modelName = await this.adb.shell(inst.serial, 'getprop ro.product.model', 3000);
            inst.model = modelName.trim() || `Android Box #${inst.index}`;
          } catch {
            inst.model = `Android Box #${inst.index}`;
          }
        }
      } else {
        if (inst.status !== 'busy') {
          inst.status = 'offline';
        }
      }
    });

    await Promise.allSettled(checkPromises);
    return Array.from(this.instances.values());
  }

  getAll(): AndroidInstance[] {
    return Array.from(this.instances.values());
  }

  get(id: string): AndroidInstance | undefined {
    return this.instances.get(id);
  }

  setTaskStatus(id: string, status: 'online' | 'offline' | 'busy', taskName?: string): void {
    const inst = this.instances.get(id);
    if (inst) {
      inst.status = status;
      if (taskName !== undefined) {
        inst.currentTask = taskName;
      }
    }
  }

  updateAccount(id: string, accountName: string): void {
    const inst = this.instances.get(id);
    if (inst) {
      inst.assignedAccount = accountName;
    }
  }
}
