#!/bin/bash
# ==============================================================================
# Android Box - Professional All-in-One Runner (Linux)
# ==============================================================================

set +e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

COUNT=${1:-4}
START_PORT=5555
MASTER_URL="https://intl-theatre-insurance-offset.trycloudflare.com"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}  Android Box - 100% Avtomatlashtirilgan Ishga Tushirish  ${NC}"
echo -e "${BLUE}  Qurilmalar soni: ${COUNT} ta                        ${NC}"
echo -e "${BLUE}======================================================${NC}"

# 1. Oldingi xizmatlarni va konteynerlarni to'xtatish
echo -e "\n${YELLOW}[1/4] Eskilar to'xtatilmoqda va tozalanmoqda...${NC}"
pkill -f "start_tunnels.sh" 2>/dev/null || true
pkill -f "ssh.*tcp@a.pinggy.io" 2>/dev/null || true
docker rm -f $(docker ps -aq --filter "name=android_box") 2>/dev/null || true

# 2. BinderFS va KVM drayverlarini to'liq yuklash va sozlash
echo -e "\n${YELLOW}[2/4] Tizim drayverlari (BinderFS & KVM) sozlanmoqda...${NC}"
bash "$SCRIPT_DIR/fix_binder.sh"

# 3. deploy_instances.sh orqali konteynerlarni to'liq konfiguratsiya bilan ko'tarish
echo -e "\n${YELLOW}[3/4] Konteynerlar yaratilmoqda va ishga tushirilmoqda...${NC}"
bash deploy_instances.sh --count "$COUNT" --start-port "$START_PORT"

# 4. Mahalliy ADB orqali haqiqatda online bo'lganligini qat'iy tekshirish
echo -e "\n${YELLOW}[Tekshiruv] Android to'liq yuklanishi kutilmoqda...${NC}"
adb kill-server >/dev/null 2>&1 || true
adb start-server >/dev/null 2>&1 || true

ALL_READY=false
for attempt in {1..30}; do
    ONLINE_N=0
    for ((i=1; i<=COUNT; i++)); do
        P=$((START_PORT + i - 1))
        adb connect "127.0.0.1:$P" >/dev/null 2>&1 || true
        S=$(adb -s "127.0.0.1:$P" get-state 2>/dev/null || echo "offline")
        if [ "$S" = "device" ]; then
            ONLINE_N=$((ONLINE_N + 1))
        fi
    done
    echo -ne "  Lokal holat: ${ONLINE_N} / ${COUNT} ta qurilma online (kutilmoqda: $attempt/30)... \r"
    if [ "$ONLINE_N" -eq "$COUNT" ]; then
        ALL_READY=true
        break
    fi
    sleep 2
done
echo ""

if [ "$ALL_READY" != true ]; then
    echo -e "${RED}[OGOHLANTIRISH] Tizim kutilganidan sekinroq yuklanmoqda.${NC}"
    echo -e "${YELLOW}Docker konteynerlari holati:${NC}"
    docker ps --filter "name=android_box" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo -e "\n${YELLOW}android_box_1 loglari:${NC}"
    docker logs --tail 25 android_box_1 2>&1 || true
    echo ""
    echo -e "${YELLOW}Lokal ADB holati:${NC}"
    adb devices
    echo -e "${RED}Yuklanish to'liq tugamadi, loglarni tekshiring.${NC}"
    exit 1
fi

echo -e "${GREEN}  BARCHA ${COUNT} TA ANDROID QURILMASI LOKAL TIZIMDA TAYYOR (online)! 🎉${NC}"

# 5. Faqat va faqat qurilmalar online bo'lgach, 24/7 tunnellarni yoqish
echo -e "\n${YELLOW}[4/4] 24/7 Tunnellar ochilmoqda va Mac Serverga xabar berilmoqda...${NC}"
TMP_DIR="/tmp/pinggy_tunnels"
mkdir -p "$TMP_DIR"
rm -f "$TMP_DIR"/*.log

URLS=()
for ((i=1; i<=COUNT; i++)); do
    PORT=$((START_PORT + i - 1))
    LOG_FILE="$TMP_DIR/tunnel_${i}.log"
    echo -n "  Box #$i (port $PORT) tunnel ochilmoqda..."

    ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=15 -o ServerAliveCountMax=3 -p 443 -R0:localhost:$PORT tcp@a.pinggy.io > "$LOG_FILE" 2>&1 &

    URL=""
    for attempt in {1..30}; do
        sleep 0.5
        if grep -q "tcp://" "$LOG_FILE" 2>/dev/null; then
            URL=$(grep -o 'tcp://[a-zA-Z0-9.-]*:[0-9]*' "$LOG_FILE" | head -n 1)
            if [ -n "$URL" ]; then
                break
            fi
        fi
    done

    if [ -n "$URL" ]; then
        echo -e " -> ${GREEN}TAYYOR! ($URL)${NC}"
        URLS+=("$URL")
    else
        echo -e " -> ${RED}Kutilmoqda...${NC}"
    fi
done

if [ ${#URLS[@]} -gt 0 ]; then
    JSON_ENDPOINTS="["
    for ((u=0; u<${#URLS[@]}; u++)); do
        JSON_ENDPOINTS+="\"${URLS[$u]}\""
        if [ $u -lt $((${#URLS[@]} - 1)) ]; then
            JSON_ENDPOINTS+=","
        fi
    done
    JSON_ENDPOINTS+="]"

    echo -ne "  Mac Master Serverga ulanmoqda..."
    RES=$(curl -s --max-time 7 -X POST "$MASTER_URL/api/workers/report-tunnels" \
        -H "Content-Type: application/json" \
        -d "{\"workerId\": \"pc_1\", \"endpoints\": $JSON_ENDPOINTS}" 2>/dev/null || true)
    
    if echo "$RES" | grep -q "true"; then
        echo -e " -> ${GREEN}MUVAFFAQIYATLI ULINDI! 🎉${NC}"
    else
        echo -e " -> ${YELLOW}Master Server javobi: $RES${NC}"
    fi
fi

# Doimiy fonda monitoring qilib turuvchi tsiklni ishga tushirish
nohup bash "$SCRIPT_DIR/start_tunnels.sh" "$COUNT" "$MASTER_URL" > /tmp/tunnels.log 2>&1 &

echo -e "\n${GREEN}======================================================${NC}"
echo -e "${GREEN}  TABRIKLAYMIZ! BARCHA ${COUNT} TA BOX MASTER SERVERDA ONLINE!${NC}"
echo -e "${GREEN}======================================================${NC}"
echo -e "Mac Master Dashboard'ni oching:"
echo -e "👉 ${CYAN}${MASTER_URL}${NC}"
echo -e "👉 ${CYAN}http://localhost:3000${NC}\n"
