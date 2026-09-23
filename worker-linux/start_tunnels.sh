#!/bin/bash
# ==============================================================================
# Android Box - Pinggy Auto-Renewing 24/7 Tunnel Daemon
# ==============================================================================

# Argumentlarni tahlil qilish (raqam yoki URL bo'lishi mumkin)
if [[ "$1" =~ ^https?:// ]]; then
  CUSTOM_URL="$1"
  COUNT=4
else
  COUNT=${1:-4}
  CUSTOM_URL="$2"
fi
START_PORT=5555

DEFAULT_MASTER_URL="https://democrats-deliver-value-richardson.trycloudflare.com"
TMP_DIR="/tmp/pinggy_tunnels"
mkdir -p "$TMP_DIR"

echo "======================================================"
echo "  Android Box - 24/7 Avtomatik Uzluksiz Tunnel Xizmati"
echo "  Qurilmalar soni: ${COUNT}"
echo "======================================================"

run_tunnels() {
  echo ""
  echo "[$(date '+%H:%M:%S')] Yangi tunnellarni ochish boshlandi..."
  pkill -f "ssh.*tcp@a.pinggy.io" 2>/dev/null || true
  sleep 1
  rm -f "$TMP_DIR"/*.log

  URLS=()

  for ((i=1; i<=COUNT; i++)); do
    PORT=$((START_PORT + i - 1))
    LOG_FILE="$TMP_DIR/tunnel_${i}.log"
    
    echo -n "[$i/$COUNT] Box #$i (port $PORT) ulanmoqda..."
    
    ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=15 -o ServerAliveCountMax=3 -p 443 -R0:localhost:$PORT tcp@a.pinggy.io > "$LOG_FILE" 2>&1 &
    
    URL=""
    for attempt in {1..25}; do
      sleep 0.4
      if grep -q "tcp://" "$LOG_FILE" 2>/dev/null; then
        URL=$(grep -o 'tcp://[a-zA-Z0-9.-]*:[0-9]*' "$LOG_FILE" | head -n 1)
        if [ -n "$URL" ]; then
          break
        fi
      fi
    done

    if [ -n "$URL" ]; then
      echo " -> TAYYOR! ($URL)"
      URLS+=("$URL")
    else
      echo " -> Kutilmoqda..."
    fi
  done

  if [ ${#URLS[@]} -eq 0 ]; then
    echo "[!] Hech qanday tunnel ochilmadi. 10 soniyadan so'ng qayta urinib ko'riladi..."
    return 1
  fi

  # JSON shakllantirish
  JSON_ENDPOINTS="["
  for ((u=0; u<${#URLS[@]}; u++)); do
    JSON_ENDPOINTS+="\"${URLS[$u]}\""
    if [ $u -lt $((${#URLS[@]} - 1)) ]; then
      JSON_ENDPOINTS+=","
    fi
  done
  JSON_ENDPOINTS+="]"

  # Master Serverga xabar berish
  REPORT_OK=false
  CANDIDATE_URLS=()
  [ -n "$CUSTOM_URL" ] && CANDIDATE_URLS+=("$CUSTOM_URL")
  CANDIDATE_URLS+=("$DEFAULT_MASTER_URL" "http://localhost:3000")

  echo -n "[$(date '+%H:%M:%S')] Master Serverga yangi ulanishlar yuborilmoqda..."
  for M_URL in "${CANDIDATE_URLS[@]}"; do
    RES=$(curl -s --max-time 6 -X POST "$M_URL/api/workers/report-tunnels" \
      -H "Content-Type: application/json" \
      -d "{\"workerId\": \"pc_1\", \"endpoints\": $JSON_ENDPOINTS}" 2>/dev/null || true)
    if echo "$RES" | grep -q "true"; then
      REPORT_OK=true
      echo " -> MUVAFFAQIYATLI ULINDI! ($M_URL) 🎉"
      break
    fi
  done

  if [ "$REPORT_OK" != true ]; then
    echo " -> [Ogohlantirish] Master Serverga avto-ulanish amalga oshmadi."
  fi
}

# 24/7 Monitoring va Avto-Yangilash sikli
# Pinggy 60 daqiqada tugagani uchun, biz har 50 daqiqada yoki bitta tunnel uzilsa avtomatik yangilaymiz
while true; do
  run_tunnels
  
  START_TIME=$(date +%s)
  MAX_SESSION_SEC=3000 # 50 daqiqa

  echo "[$(date '+%H:%M:%S')] 50 daqiqalik barqaror seans boshlandi. Tunnellar kuzatuv ostida..."

  while true; do
    sleep 15
    NOW=$(date +%s)
    ELAPSED=$((NOW - START_TIME))

    # 1. Vaqt bo'yicha yangilash (50 daqiqa to'lganda)
    if [ $ELAPSED -ge $MAX_SESSION_SEC ]; then
      echo ""
      echo "[$(date '+%H:%M:%S')] Pinggy 50 daqiqalik muddati yetdi. Yangi seansga uzluksiz o'tilmoqda..."
      break
    fi

    # 2. Jarayonlar o'chib qolmaganini tekshirish
    RUNNING_COUNT=$(pgrep -f "ssh.*tcp@a.pinggy.io" | wc -l || true)
    if [ "$RUNNING_COUNT" -lt "$COUNT" ]; then
      echo ""
      echo "[$(date '+%H:%M:%S')] Ogohlantirish: ayrim tunnellar uzildi (faol: $RUNNING_COUNT / $COUNT). Qayta ulanmoqda..."
      break
    fi
  done
done
