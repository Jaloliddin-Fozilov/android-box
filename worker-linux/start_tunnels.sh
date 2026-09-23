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
echo "Quyidagi manzillarni nusxalang va Mac Dashboard'dagi"
echo "Sozlamalar (Gear) > 'Alohida Tunnel Endpoints' oynasiga qo'ying:"
echo ""

for url in "${URLS[@]}"; do
  echo "$url"
done

echo ""
echo "------------------------------------------------------"
echo "Tunnellarni to'xtatish uchun: pkill -f 'ssh.*tcp@a.pinggy.io'"
echo "======================================================"

# Jarayonlar ishlab turishi uchun kutish
wait
