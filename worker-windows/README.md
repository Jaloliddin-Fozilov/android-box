# 🚀 Android Box - Windows LDPlayer 9 Worker Qo'llanmasi

Ushbu qo'llanma orqali Windows kompyuteringizda **LDPlayer 9** emulyatorini eng yengil sozlamalar bilan o'rnatib, Mac'dagi Master Server Dashboard'ga bir zumda ulaysiz.

---

## ⚡ Nega LDPlayer 9?
* **Kompyuter qotmaydi:** Grafika to'liq videokartangiz (GPU) orqali ishlaydi, protsessorga yuk tushmaydi.
* **Eco Mode (Optimizatsiya):** Har bir oyna `540x960`, `20 FPS`, `1 CPU`, `1.5GB RAM` rejimida ishlaydi — 4-8 ta oyna ham yengil ishlaydi.
* **Mac Master Serverga 100% mos:** Master Dashboard barcha oynalarni jonli boshqaradi, dastur o'rnatadi va ekranini ko'rsatadi.

---

## 📥 1-Qadam: LDPlayer 9 O'rnatish
1. Rasmiy saytdan yuklab oling va o'rnating:
   👉 **[https://www.ldplayer.net/](https://www.ldplayer.net/)** (LDPlayer 9 tavsiya etiladi).
2. O'rnatish odatda `C:\LDPlayer\LDPlayer9` papkasiga bo'ladi.

---

## ⚙️ 2-Qadam: Oynalarni yaratish va sozlash (1 ta klik)
Loyiha papkasidagi `worker-windows` papkasiga kiring:
* **`setup_ldplayer.bat`** faylini ikki marta bosing.
* U avtomatik ravishda:
  - 4 ta optimallashtirilgan Android Box oynasini yaratadi.
  - Eng kam resurs yeydigan qilib sozlaydi (`540x960`, `1 CPU`, `1536MB RAM`, `20 FPS`).
  - Barchasini birdaniga ishga tushiradi!

*(Agar qo'lda **LDMultiPlayer** dasturidan foydalanmoqchi bo'lsangiz:)*
1. Ish stolingizdagi **LDMultiPlayer** belgisini oching.
2. Pastdagi **"Optimization" (Optimizatsiya)** tugmasini bosing:
   - Multi-instance FPS: **20 FPS** ga qo'ying.
   - Disable audio: **Belgilang** (ovozni o'chirish protsessorni ancha bo'shatadi).
3. "Add instance" (Yangi oyna) orqali kerakli miqdorda oyna oching.

---

## 🔗 3-Qadam: Mac Master Serverga ulash
Oynalar ochilgach, shu papkadagi:
* **`start_worker.bat`** faylini ikki marta bosing.
* U barcha ochiq turgan LDPlayer oynalarining ADB portlarini aniqlaydi.
* Tunnellarni ochadi va Mac Master Serverga avtomatik hisobot beradi.
* **Barcha oynalar Mac Dashboard'da ONLINE bo'ladi!**
* Skript 24/7 avtomatik yangilanish rejimida fonda ishlayveradi.

---

## 🛠 Muammolarni hal qilish
- **ADB sozlamasi:** Agar ulanmasa, LDPlayer sozlamalarida (`Settings` -> `Other`) "ADB debugging" bandi yoqilganligiga (`Open local connection` yoki `Open remote connection`) ishonch hosil qiling.
- **Portlar:** LDPlayer har bir oyna uchun avtomatik ravishda `5555`, `5557`, `5559`, `5561` portlarini beradi.
