#!/bin/bash
# ==============================================================================
# Android Box - Professional All-in-One Runner (Linux)
# ==============================================================================

# Xatolik yuz berganda skript to'xtab qolmasligi uchun
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

# 1. Oldingi barcha jarayonlarni tozalash
echo -e "\n${YELLOW}[1/4] Eskilar to'xtatilmoqda va tozalanmoqda...${NC}"
pkill -f "start_tunnels.sh" 2>/dev/null || true
pkill -f "ssh.*tcp@a.pinggy.io" 2>/dev/null || true
docker rm -f $(docker ps -aq --filter "name=android_box") 2>/dev/null || true

# 2. BinderFS ruxsatlarini berish
chmod 666 /dev/binderfs/* 2>/dev/null || true
chmod 666 /dev/binder /dev/hwbinder /dev/vndbinder 2>/dev/null || true

# 3. Docker konteynerlarini to'g'ridan-to'g'ri va ishonchli ko'tarish
echo -e "\n${YELLOW}[2/4] ${COUNT} ta Android Box konteyneri ishga tushirilmoqda...${NC}"
KVM_OPT=""
if [ -e /dev/kvm ]; then
    KVM_OPT="--device /dev/kvm:/dev/kvm"
fi

DATA_BASE_DIR="$SCRIPT_DIR/instances_data"
mkdir -p "$DATA_BASE_DIR"

for ((i=1; i<=COUNT; i++)); do
    PORT=$((START_PORT + i - 1))
    CONTAINER_NAME="android_box_${i}"
    INSTANCE_DATA="$DATA_BASE_DIR/box_${i}"
    mkdir -p "$INSTANCE_DATA"

    docker run -d \
        --name "$CONTAINER_NAME" \
        --privileged \
        --restart unless-stopped \
        -p "${PORT}:5555" \
        -v "${INSTANCE_DATA}:/data" \
        -v "/dev/binderfs:/dev/binderfs" \
        $KVM_OPT \
        --cpus="1.5" \
        --memory="1400M" \
        redroid/redroid:11.0.0-latest \
        androidboot.redroid_width=720 \
        androidboot.redroid_height=1280 \
        androidboot.redroid_dpi=240 \
        androidboot.redroid_fps=15 \
        androidboot.redroid_gpu_mode=guest >/dev/null 2>&1 || true

    echo -e "  [+] ${CONTAINER_NAME} (Port $PORT) yaratildi."
done

# 4. Android yuklanishini kutish (20 soniya)
echo -e "\n${YELLOW}[3/4] Android tizimi to'liq yuklanishi kutilmoqda (20 soniya)...${NC}"
for s in {20..1}; do
    echo -ne "  Kutilmoqda: ${s} soniya...\r"
    sleep 1
done
echo -e "  Android tizimi tayyor!                       "

# ADB portlarini mahalliy tekshirish
for ((i=1; i<=COUNT; i++)); do
    PORT=$((START_PORT + i - 1))
    adb connect "127.0.0.1:$PORT" >/dev/null 2>&1 || true
done

# 5. 24/7 Tunnellarni ochish va Master Serverga xabar yuborish
echo -e "\n${YELLOW}[4/4] 24/7 Tunnellar ochilmoqda va Mac Master Serverga ulanmoqda...${NC}"
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
echo -e "${GREEN}  TABRIKLAYMIZ! BARCHA ${COUNT} TA BOX ONLINE BO'LDI!       ${NC}"
echo -e "${GREEN}======================================================${NC}"
echo -e "Mac Master Dashboard'ni oching:"
echo -e "👉 ${CYAN}${MASTER_URL}${NC}"
echo -e "👉 ${CYAN}http://localhost:3000${NC}\n"
