import * as fs from 'fs';
import * as path from 'path';

export interface WorkerConfig {
  id: string;
  name: string;
  host: string;
  startPort: number;
  count: number;
  endpoints?: string[];
  ssh?: {
    host?: string;
    port?: number;
    username?: string;
    password?: string;
  };
  agentUrl?: string;
}

export interface AppConfig {
  port: number;
  workers: WorkerConfig[];
  linuxWorker: {
    host: string;
    startPort: number;
    count: number;
    endpoints?: string[];
    ssh?: {
      host?: string;
      port?: number;
      username?: string;
      password?: string;
    };
    agentUrl?: string;
  };
  adbPath: string;
  antiBan: {
    minDelayMs: number;
    maxDelayMs: number;
    humanTyping: boolean;
  };
}

const CONFIG_PATH = path.join(__dirname, '../config.json');

export const defaultConfig: AppConfig = {
  port: 3000,
  workers: [
    {
      id: 'pc_1',
      name: 'Linux Worker #1',
      host: '127.0.0.1',
      startPort: 5555,
      count: 4
    }
  ],
  linuxWorker: {
    host: '127.0.0.1',
    startPort: 5555,
    count: 4
  },
  adbPath: 'adb',
  antiBan: {
    minDelayMs: 1500,
    maxDelayMs: 4000,
    humanTyping: true
  }
};

export function loadConfig(): AppConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const parsed = JSON.parse(data);
      const merged: AppConfig = { ...defaultConfig, ...parsed };

      // Agar workers ro'yxati bo'lmasa, mavjud linuxWorker sozlamasidan shakllantiramiz
      if (!merged.workers || merged.workers.length === 0) {
        if (merged.linuxWorker) {
          merged.workers = [
            {
              id: 'pc_1',
              name: 'Linux Worker #1',
              host: merged.linuxWorker.host,
              startPort: merged.linuxWorker.startPort,
              count: merged.linuxWorker.count,
              endpoints: merged.linuxWorker.endpoints,
              ssh: merged.linuxWorker.ssh,
              agentUrl: merged.linuxWorker.agentUrl
            }
          ];
        } else {
          merged.workers = [...defaultConfig.workers];
        }
      }
      return merged;
    }
  } catch (err) {
    console.warn('[Config] config.json o\'qishda xatolik, standart sozlamalar ishlatilmoqda:', err);
  }
  return defaultConfig;
}

export function saveConfig(newConfig: Partial<AppConfig>): AppConfig {
  const current = loadConfig();
  const merged: AppConfig = {
    ...current,
    ...newConfig,
    workers: newConfig.workers || current.workers,
    linuxWorker: {
      ...current.linuxWorker,
      ...(newConfig.linuxWorker || {})
    },
    antiBan: {
      ...current.antiBan,
      ...(newConfig.antiBan || {})
    }
  };

  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Config] config.json ni saqlashda xatolik:', err);
  }

  return merged;
}
