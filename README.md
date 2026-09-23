# 🤖 Android Box - Ko'p Akkauntli Avtomatizatsiya Klasteri

Ushbu loyiha bitta markaziy kompyuter (hozircha sizning **Mac**) orqali masofaviy **Linux kompyuter**dagi o'nlab Android (ReDroid) instansiyalarini boshqarish, ijtimoiy tarmoqlarda (Instagram, TikTok, Twitter/X) inson harakatlariga o'xshatib (Anti-Ban) Like bosish, Komment yozish, Follow qilish va akkauntlarni qizdirish (Warm-up) uchun mo'ljallangan.

---

## 🏗️ Tizim Strukturasi

```
android-box/
├── worker-linux/                  # Masofaviy Linux kompyuterga joylanadigan qism
│   ├── setup_host.sh              # 1-qadam: Docker, BinderFS, KVM va drayverlar
│   ├── deploy_instances.sh        # 2-qadam: N ta Android OS ni avtomatik ko'tarish
│   ├── manage_instances.sh        # Instansiyalarni boshqarish (status, restart, stop)
│   ├── docker-compose.template.yml# Konteyner shabloni
│   ├── config/
│   │   ├── device_profiles.json   # Haqiqiy telefonlar profillari (Samsung, Xiaomi, Pixel)
│   │   └── proxies.example.txt    # SOCKS5/HTTP proksilar namunasi
│   └── scripts/
│       └── proxy_routing.sh       # Proksilarni Android'ga o'rnatish
│
├── master-server/                 # Mac'da ishlaydigan Markaziy Server (Web Dashboard)
│   ├── package.json
│   ├── src/                       # TypeScript backend & Task engine
│   │   ├── index.ts               # Express & WebSocket server
│   │   ├── config.ts              # Xost va portlar sozlamalari
│   │   ├── core/                  # ADB ulanishlar & Instansiyalar hovuzi
│   │   └── automation/            # Bezier swipe, insoniy yozish, ijtimoiy vazifalar
│   └── src/web/public/            # Chiroyli Dark-Mode Web Dashboard UI
│
└── README.md                      # Ushbu qo'llanma
```

---

## 🚀 1-QADAM: Masofaviy Linux Kompyuterni Bitta Buyruq Bilan Ishga Tushirish

Masofaviy Linux PC (Ubuntu 22.04 LTS yoki 24.04 LTS) ga kiring va quyidagilarni bajaring:

### 1. Fayllarni Linux'ga nusxalash (Mac terminalidan):
```bash
scp -r /Users/hehe/Desktop/projects/android-box/worker-linux user@<LINUX_IP>:~/android-worker
```

### 2. Linux'da Bitta Buyruq Bilan Ishga Tushirish:
Linux serveriga SSH orqali kirib, shunchaki bitta buyruqni bering:
```bash
cd ~/android-worker
sudo bash start.sh
```

**Bu buyruq nima qiladi?**
1. Docker, KVM, BinderFS va drayverlar mavjudligini tekshiradi (yo'q bo'lsa o'zi o'rnatadi).
2. 8 ta Android (ReDroid) instansiyasini to'liq ko'taradi.
3. Serverning IP manzillarini (Lokal IP va Public IP) avtomatik aniqlaydi va **ekranga qaysi IP ni Mac'ga kiritish kerakligini ko'rsatib beradi**!

### 4. Holatni tekshirish
```bash
./manage_instances.sh status
```
*Barcha konteynerlar ro'yxati, RAM/CPU iste'moli va ADB holati ko'rinadi.*

---

## 💻 2-QADAM: Mac'da Master Serverni Ishga Tushirish

Master Server Mac kompyuteringizda ishlaydi va barcha Linux qurilmalarini bitta qulay Web Dashboard'ga jamlaydi.

### 1. Kerakli paketlarni o'rnatish va loyihani yig'ish
```bash
cd /Users/hehe/Desktop/projects/android-box/master-server
npm install
npm run build
```

### 2. Serverni ishga tushirish
```bash
npm start
```
Terminalda quyidagi yozuv chiqadi:
```
=======================================================
  Android Box Master Server faollashdi!                
  Boshqaruv Paneli: http://localhost:3000           
  Nishon Linux Xost: 127.0.0.1        
=======================================================
```

### 3. Brauzerda ochish
Brauzeringizda quyidagi manzilni oching:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## ⚙️ 3-QADAM: Mac va Linux'ni Bog'lash

1. Web Dashboard'da o'ng yuqoridagi **Sozlamalar (Gear ikonkasi)** tugmasini bosing.
2. **Linux Worker IP manzili** maydoniga masofaviy Linux kompyuteringizning IP manzilini kiriting (masalan: `192.168.1.150` yoki Tailscale IP).
3. **Instansiyalar Soni**ga Linux'da ochilgan sonni kiriting (masalan: `8`).
4. **"Saqlash & Ulanish"** tugmasini bosing.
5. Dashboard avtomatik tarzda barcha 8 ta Android instansiyasiga ulanadi va ularning holati yashil (**Online**) bo'ladi.

> [!TIP]
> **Masofaviy ulanish (VPN / Tailscale):**
> Agar Linux kompyuter boshqa tarmoqda (ofisda yoki datacentrda) bo'lsa, ikkala kompyuterga ham bepul **Tailscale** (https://tailscale.com) o'rnating. U hech qanday murakkab router sozlamalarisiz xavfsiz ichki IP beradi.

---

## 🎯 Vazifalar va Avtomatizatsiya Funksiyalari

### 1. Interaktiv Ekran Ko'rish va Boshqarish
* Har bir qurilma kartochkasidagi **"Ko'rish"** tugmasini bosing.
* Ekranni real vaqtda ko'rishingiz va **sichqoncha bilan rasm ustiga bosib**, xuddi telefon ekranini bosgandek uni masofadan boshqarishingiz mumkin!
* Pastdagi **Home**, **Back** va **Auto** (har 1.5 sek da yangilanish) tugmalari orqali to'liq nazorat qilasiz.

### 2. Guruhli Vazifa Yuborish (Vazifa Yuborish tugmasi)
* **Nishon Ilova:** Instagram, TikTok, Twitter/X.
* **Vazifa Turlari:**
  * **Like bosish:** Post o'rtasiga insoniy double-tap orqali like qo'yadi.
  * **Komment yozish:** Spin-syntax qo'llab-quvvatlaydi. Masalan:
    `Ajoyib post! | Juda zo'r chiqibdi 🔥 | Foydali ma'lumot | Rahmat kattakon`
    *Har bir Android qurilma o'ziga alohida tasodifiy variantni tanlab, insondek harfma-harf yozib qoldiradi.*
  * **Follow qilish:** Profilga obuna bo'lish tugmasini bosadi.
  * **Lenta varaqlash (Warm-Up):** Akkaunt yangi ochilganda ban bo'lmasligi uchun lentani 3–5 daqiqa tabiiy varaqlab, oraliqda random like bosib "qizdiradi".

### 3. Anti-Ban Humanizer Mexanizmi
Tizim robot emas, inson harakatlarini quyidagicha simulyatsiya qiladi:
* **Bezier Curve Swipe:** Ekranni to'g'ri chiziqda emas, tabiiy barmoq egriligi bilan suradi.
* **Human Typing Jitter:** Matn kiritishda har bir harf orasida 70ms – 190ms oraliqda tasodifiy tanaffus qiladi.
* **Jitter Touch:** Bir xil pikselga doimiy bosilmaydi, bosish nuqtasiga har doim ±4 piksel tasodifiy siljish qo'shiladi.
* **Staggered Delays:** 10 ta qurilma bir vaqtda bir xil soniyada boshlamaydi, har birining starti 2-5 soniya oraliq bilan yuboriladi.

---

## 🛡️ Proksilarni Biriktirish (Xavfsizlik)

Har bir akkaunt o'zining shaxsiy IP manzilidan chiqishi uchun:
1. `worker-linux/config/proxies.txt` faylini yarating.
2. Har bir qatorga proksilarni kiriting:
   ```text
   socks5://user1:pass1@185.220.100.1:1080
   socks5://user2:pass2@185.220.100.2:1080
   socks5://user3:pass3@185.220.100.3:1080
   ```
3. Skript orqali o'rnatish:
   ```bash
   ./scripts/proxy_routing.sh 5555 socks5://user1:pass1@185.220.100.1:1080
   ```
