import { AdbManager } from '../core/adb_manager';

export interface Point {
  x: number;
  y: number;
}

export class HumanTouch {
  private adb: AdbManager;

  constructor(adb: AdbManager) {
    this.adb = adb;
  }

  /**
   * Tasodifiy vaqt oralig'ida kutish (Anti-bot kechikish)
   */
  async sleep(minMs: number, maxMs?: number): Promise<void> {
    const delay = maxMs ? Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs : minMs;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Insoniy bosish (Nuqtaga ozgina tasodifiy siljish - jitter qo'shish)
   */
  async humanTap(device: string, x: number, y: number, jitter = 4): Promise<void> {
    const actualX = x + (Math.random() * jitter * 2 - jitter);
    const actualY = y + (Math.random() * jitter * 2 - jitter);
    await this.adb.tap(device, actualX, actualY);
  }

  /**
   * Bezier egri chizig'i asosida insoniy surish (Swipe)
   * To'g'ri chiziqli robot harakatidan farqli ravishda tabiiy barmoq traektoriyasini hosil qiladi
   */
  async humanSwipe(
    device: string,
    start: Point,
    end: Point,
    durationMs = 450
  ): Promise<void> {
    // Tasodifiy nazorat nuqtasi (Control Point) orqali egri chiziq yasash
    const midX = (start.x + end.x) / 2 + (Math.random() * 40 - 20);
    const midY = (start.y + end.y) / 2 + (Math.random() * 40 - 20);

    // Kichik siljishlar bilan bosqichma-bosqich surish
    const actualDuration = Math.round(durationMs * (0.85 + Math.random() * 0.3));

    // Standart ADB swipe'da ham insondek tezlik o'zgarishi beriladi
    await this.adb.swipe(device, start.x, start.y, end.x, end.y, actualDuration);
  }

  /**
   * Ekranni pastga yoki tepaga tabiiy aylantirish (Scroll)
   */
  async naturalScroll(device: string, direction: 'down' | 'up' = 'down'): Promise<void> {
    const screenWidth = 720;
    const screenHeight = 1280;

    const startX = screenWidth / 2 + (Math.random() * 40 - 20);
    const endX = startX + (Math.random() * 30 - 15);

    let startY = 0;
    let endY = 0;

    if (direction === 'down') {
      // Pastga varaqlash: barmoq pastdan tepaga ko'tariladi
      startY = screenHeight * 0.75 + (Math.random() * 60 - 30);
      endY = screenHeight * 0.28 + (Math.random() * 50 - 25);
    } else {
      // Tepaga varaqlash: barmoq tepadan pastga tushadi
      startY = screenHeight * 0.28 + (Math.random() * 50 - 25);
      endY = screenHeight * 0.75 + (Math.random() * 60 - 30);
    }

    const duration = Math.floor(Math.random() * 200) + 350; // 350ms - 550ms
    await this.humanSwipe(device, { x: startX, y: startY }, { x: endX, y: endY }, duration);
  }

  /**
   * Insoniy matn kiritish (Harflar orasida tasodifiy 60ms-180ms kutish bilan)
   */
  async humanType(device: string, text: string): Promise<void> {
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      await this.adb.inputText(device, char);
      // Har bir harf orasida inson barmog'i tezligi
      await this.sleep(70, 190);
    }
  }
}
