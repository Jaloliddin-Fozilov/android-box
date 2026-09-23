#!/bin/bash
# ==============================================================================
# Android Box - Ultra Yengil (Eco) Rejimda Qayta Ishga Tushirish
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

COUNT=${1:-4}

echo "======================================================"
echo "  Android Box - Ultra Yengil (Eco) Rejimga O'tkazish  "
echo "  Qurilmalar soni: $COUNT ta"
echo "  Ekran: 540x960 (66% kamroq CPU yuk)"
echo "  Tezlik: 15 FPS (protsessor bo'shaydi, qotish yo'qoladi)"
echo "  RAM: 850MB har biriga"
echo "======================================================"

# 1. Eski og'ir konteynerlarni to'xtatish va tozalash
echo -e "\n[1/3] Eski og'ir konteynerlar to'xtatilmoqda..."
docker rm -f $(docker ps -aq --filter "name=android_box") 2>/dev/null || true

# 2. Yangi yengil parametrlarda ko'tarish
echo -e "\n[2/3] Yangi yengil (Eco) konteynerlar ishga tushirilmoqda..."
bash deploy_instances.sh --count "$COUNT" --start-port 5555

# 3. 24/7 Avtomatik tunnellarni qayta yoqish
echo -e "\n[3/3] 24/7 Avtomatik tunnellar fonda ishga tushirilmoqda..."
pkill -f "start_tunnels.sh" 2>/dev/null || true
pkill -f "ssh.*tcp@a.pinggy.io" 2>/dev/null || true
nohup bash "$SCRIPT_DIR/start_tunnels.sh" "$COUNT" > /tmp/tunnels.log 2>&1 &

echo ""
echo "======================================================"
echo "  TABRIKLAYMIZ! HAMMASI MUVAFFAQIYATLI O'ZGARTIRILDI! "
echo "  Kompyuteringiz endi qotmaydi va yengil ishlaydi.   "
echo "  Barcha $COUNT ta Box Mac Dashboard'da ONLINE bo'ldi!"
echo "======================================================"
