#!/bin/bash
# ==============================================================================
# Android Box - Professional Ishga Tushirish va Avto-Sozlash
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

COUNT=${1:-4}

echo "======================================================"
echo "  Android Box - Professional Qayta Ishga Tushirish    "
echo "  Qurilmalar soni: $COUNT ta"
echo "  Rejim: Guest Software Rendering (100% barqaror)"
echo "  Kadrlar tezligi: 15 FPS (protsessor qizimaydi va qotmaydi)"
echo "======================================================"

# 1. Eski to'xtatish
echo -e "\n[1/3] Eskilar to'xtatilmoqda va tozalanmoqda..."
pkill -f "start_tunnels.sh" 2>/dev/null || true
pkill -f "ssh.*tcp@a.pinggy.io" 2>/dev/null || true
docker rm -f $(docker ps -aq --filter "name=android_box") 2>/dev/null || true

# 2. Yangi konteynerlarni deploy qilish va to'liq yuklanishini kutish
echo -e "\n[2/3] Konteynerlar ishga tushirilmoqda..."
bash deploy_instances.sh --count "$COUNT" --start-port 5555

# 3. 24/7 Avtomatik tunnellarni qayta yoqish
echo -e "\n[3/3] 24/7 Avtomatik tunnellar yoqilmoqda va Mac Serverga ulanmoqda..."
pkill -f "start_tunnels.sh" 2>/dev/null || true
pkill -f "ssh.*tcp@a.pinggy.io" 2>/dev/null || true
nohup bash "$SCRIPT_DIR/start_tunnels.sh" "$COUNT" > /tmp/tunnels.log 2>&1 &

echo "Tunnellar ochilishi kutilmoqda (5 soniya)..."
sleep 5

echo ""
echo "======================================================"
echo "  HAMMASI TAYYOR! Barcha $COUNT ta Box ONLINE bo'ldi! "
echo "  Endi Mac Dashboard orqali APK o'rnata olasiz va     "
echo "  ekranlarni jonli boshqara olasiz.                   "
echo "======================================================"
