import { AdbManager } from '../core/adb_manager';
import { HumanTouch } from './human_touch';

export interface SocialAppInfo {
  packageName: string;
  activityName?: string;
}

export const SOCIAL_PACKAGES: Record<string, SocialAppInfo> = {
  instagram: {
    packageName: 'com.instagram.android',
    activityName: 'com.instagram.mainactivity.MainActivity'
  },
  tiktok: {
    packageName: 'com.zhiliaoapp.musically',
    activityName: 'com.ss.android.ugc.aweme.splash.SplashActivity'
  },
  twitter: {
    packageName: 'com.twitter.android',
    activityName: 'com.twitter.app.main.MainActivity'
  }
};

export class SocialTasks {
  private adb: AdbManager;
  private touch: HumanTouch;

  constructor(adb: AdbManager, touch: HumanTouch) {
    this.adb = adb;
    this.touch = touch;
  }

  /**
   * Ijtimoiy tarmoq ilovasini ochish
   */
  async openApp(device: string, appKey: string): Promise<void> {
    const app = SOCIAL_PACKAGES[appKey];
    if (app) {
      await this.adb.startApp(device, app.packageName, app.activityName);
    } else {
      await this.adb.startApp(device, appKey);
    }
    // Ilova to'liq yuklanishini kutish
    await this.touch.sleep(3000, 5000);
  }

  /**
   * Ilovani to'xtatish
   */
  async closeApp(device: string, appKey: string): Promise<void> {
    const app = SOCIAL_PACKAGES[appKey];
    const pkg = app ? app.packageName : appKey;
    await this.adb.stopApp(device, pkg);
  }

  /**
   * Postga Like bosish
   * Instagram/TikTok'da eng xavfsiz va aniq usul: post o'rtasiga double-tap (2 marta tez bosish)
   */
  async likeCurrentPost(device: string, appKey: string): Promise<void> {
    const screenWidth = 720;
    const screenHeight = 1280;
    const centerX = screenWidth / 2;
    const centerY = screenHeight * 0.45;

    // Postni o'qiyotgandek yoki tomosha qilayotgandek 2-4 soniya kutish
    await this.touch.sleep(2000, 4000);

    // Double-tap orqali like qo'yish
    await this.touch.humanTap(device, centerX, centerY);
    await this.touch.sleep(120, 200);
    await this.touch.humanTap(device, centerX, centerY);

    // Qisqa kechikish
    await this.touch.sleep(1000, 2500);
  }

  /**
   * Postga Komment qoldirish
   */
  async commentOnPost(device: string, commentText: string, appKey: string): Promise<void> {
    const screenWidth = 720;
    const screenHeight = 1280;

    // Komment ikonkasini bosish (taxminiy standart koordinatalar)
    // 720x1280 ekranda Instagram uchun komment ikonkasi: ~X:105, Y:710
    // TikTok uchun o'ng paneldagi komment: ~X:660, Y:750
    let commentBtnX = 105;
    let commentBtnY = 710;

    if (appKey === 'tiktok') {
      commentBtnX = 660;
      commentBtnY = 750;
    }

    // Komment tugmasini bosish
    await this.touch.humanTap(device, commentBtnX, commentBtnY);
    await this.touch.sleep(1500, 2500);

    // Matn kiritish maydonini bosish (klaviaturani chaqirish)
    await this.touch.humanTap(device, screenWidth * 0.4, screenHeight * 0.94);
    await this.touch.sleep(800, 1500);

    // Matnni insondek yozish
    await this.touch.humanType(device, commentText);
    await this.touch.sleep(1000, 2000);

    // Enter / Send tugmasini bosish (Masalan: Enter keyevent yoki Yuborish tugmasi koordinatasi)
    // Standart jo'natish tugmasi
    await this.touch.humanTap(device, screenWidth * 0.92, screenHeight * 0.94);

    // Klaviaturani yopish uchun Back tugmasi
    await this.touch.sleep(1000, 1800);
    await this.adb.keyevent(device, 4); // Android Back button
  }

  /**
   * Profilga Obuna bo'lish (Follow)
   */
  async followUser(device: string, appKey: string): Promise<void> {
    const screenWidth = 720;

    // Ko'pincha Follow tugmasi o'ng tepada yoki post sarlavhasi yonida joylashadi
    const followX = screenWidth * 0.85;
    const followY = 180;

    await this.touch.sleep(1500, 3000);
    await this.touch.humanTap(device, followX, followY);
    await this.touch.sleep(1000, 2000);
  }

  /**
   * Lenta varaqlash va akkauntni "qizdirish" (Warm-up / Feed Browsing)
   * Akkaunt ban bo'lmasligi uchun postlarni tabiiy tomosha qilish
   */
  async warmUpBrowsing(device: string, scrolls = 5): Promise<void> {
    for (let i = 0; i < scrolls; i++) {
      // 3–7 soniya postni "o'qish"
      await this.touch.sleep(3000, 7000);

      // 30% ehtimollik bilan random postga like bosish (tabiiylik uchun)
      if (Math.random() < 0.3) {
        await this.touch.humanTap(device, 360, 500);
        await this.touch.sleep(150, 220);
        await this.touch.humanTap(device, 360, 500);
        await this.touch.sleep(1000, 2000);
      }

      // Pastga scroll qilish
      await this.touch.naturalScroll(device, 'down');
    }
  }
}
