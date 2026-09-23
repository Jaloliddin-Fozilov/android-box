import { AdbManager } from './adb_manager';

export interface AndroidInstance {
  id: string;
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
   * Instansiyalar ro'yxatini shakllantirish
   */
  setupPool(host: string, startPort: number, count: number): void {
    this.instances.clear();
    for (let i = 1; i <= count; i++) {
      const port = startPort + i - 1;
      const serial = `${host}:${port}`;
      const id = `box_${i}`;

      this.instances.set(id, {
        id,
        index: i,
        host,
        port,
        serial,
        status: 'offline',
        model: 'Yuklanmoqda...',
        assignedAccount: `Akkaunt #${i}`,
        currentTask: 'Kutmoqda'
      });
    }
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
            const modelName = await this.adb.shell(inst.serial, 'getprop ro.product.model');
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
