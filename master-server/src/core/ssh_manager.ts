import { Client, ConnectConfig } from 'ssh2';

export interface SshCommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

export class SshManager {
  /**
   * Masofaviy Linux kompyuterda SSH orqali buyruq bajarish
   */
  static executeCommand(config: ConnectConfig, command: string, timeoutMs = 20000): Promise<SshCommandResult> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      let timer: NodeJS.Timeout | null = null;

      timer = setTimeout(() => {
        try {
          conn.end();
        } catch {}
        reject(new Error(`SSH buyrug'i vaqt chegarasidan oshib ketdi (${timeoutMs / 1000}s)`));
      }, timeoutMs);

      conn.on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            if (timer) clearTimeout(timer);
            try { conn.end(); } catch {}
            return reject(err);
          }

          let stdout = '';
          let stderr = '';

          stream.on('close', (code: number) => {
            if (timer) clearTimeout(timer);
            try { conn.end(); } catch {}
            resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code: code || 0 });
          });

          stream.on('data', (data: Buffer) => {
            stdout += data.toString();
          });

          stream.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
          });
        });
      });

      conn.on('error', (err) => {
        if (timer) clearTimeout(timer);
        reject(err);
      });

      try {
        conn.connect({
          readyTimeout: 10000,
          ...config
        });
      } catch (err) {
        if (timer) clearTimeout(timer);
        reject(err);
      }
    });
  }
}
