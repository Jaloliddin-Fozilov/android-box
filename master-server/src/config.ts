import * as fs from 'fs';
import * as path from 'path';

export interface AppConfig {
  port: number;
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
  linuxWorker: {
    host: '127.0.0.1',
    startPort: 5555,
    count: 8
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
      return { ...defaultConfig, ...JSON.parse(data) };
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
