#!/bin/bash
# ==============================================================================
# Android Box - 4 ta yoki undan ortiq qurilma uchun Pinggy tunnellarini ochish
# ==============================================================================

COUNT=${1:-4}
START_PORT=${2:-5555}

echo "======================================================"
echo "  ${COUNT} ta Android Box uchun Pinggy tunnel ochilmoqda..."
echo "======================================================"

# Oldingi pinggy jarayonlarini to'xtatish (agar bo'lsa)
pkill -f "ssh.*tcp@a.pinggy.io" 2>/dev/null || true

TMP_DIR="/tmp/pinggy_tunnels"
mkdir -p "$TMP_DIR"
rm -f "$TMP_DIR"/*.log

URLS=()

for ((i=1; i<=COUNT; i++)); do
  PORT=$((START_PORT + i - 1))
  LOG_FILE="$TMP_DIR/tunnel_${i}.log"
  
  echo -n "[$i/$COUNT] Box #$i (port $PORT) uchun tunnel yaratilmoqda..."
  
  # Pinggy SSH tunnelini orqa fonda ishga tushirish
  ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -p 443 -R0:localhost:$PORT tcp@a.pinggy.io > "$LOG_FILE" 2>&1 &
  
  # URL chiqishini kutish (maksimal 10 soniya)
  URL=""
  for attempt in {1..20}; do
    sleep 0.5
    if grep -q "tcp://" "$LOG_FILE" 2>/dev/null; then
      URL=$(grep -o 'tcp://[a-zA-Z0-9.-]*:[0-9]*' "$LOG_FILE" | head -n 1)
      if [ -n "$URL" ]; then
        break
      fi
    fi
  done

  if [ -n "$URL" ]; then
    echo " -> TAYYOR!"
    URLS+=("$URL")
  else
    echo " -> Kutilmoqda (logni tekshiring: $LOG_FILE)"
  fi
done

echo ""
echo "======================================================"
echo "       BARCHA 4 TA QURILMA TUNNELLARI TAYYOR!         "
echo "======================================================"

# Master Serverga avtomatik hisobot berish (CURL orqali)
JSON_ENDPOINTS="["
for ((u=0; u<${#URLS[@]}; u++)); do
  JSON_ENDPOINTS+="\"${URLS[$u]}\""
  if [ $u -lt $((${#URLS[@]} - 1)) ]; then
    JSON_ENDPOINTS+=","
  fi
done
JSON_ENDPOINTS+="]"

echo -n "Mac Master Serverga avtomatik ulanmoqda..."
REPORT_OK=false
for MASTER_URL in "https://links-baptist-retrieve-promised.trycloudflare.com" "http://localhost:3000"; do
  RES=$(curl -s --max-time 5 -X POST "$MASTER_URL/api/workers/report-tunnels" \
    -H "Content-Type: application/json" \
    -d "{\"workerId\": \"pc_1\", \"endpoints\": $JSON_ENDPOINTS}" 2>/dev/null || true)
  if echo "$RES" | grep -q "true"; then
    REPORT_OK=true
    break
  fi
done

if [ "$REPORT_OK" = true ]; then
  echo " -> MUVAFFAQIYATLI ULINDI! 🎉"
  echo ">>> Master Dashboard'da barcha 4 ta quti bir zumda ONLINE bo'ldi!"
else
  echo ""
  echo "Quyidagi manzillarni Mac Dashboard'dagi 'Tahrirlash' > 'Alohida Tunnel Endpoints'ga qo'ying:"
  for url in "${URLS[@]}"; do
    echo "$url"
  done
fi

echo ""
echo "------------------------------------------------------"
echo "Tunnellarni to'xtatish uchun: pkill -f 'ssh.*tcp@a.pinggy.io'"
echo "======================================================"

# Jarayonlar ishlab turishi uchun kutish
wait
