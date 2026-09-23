#!/bin/bash
# ==============================================================================
# Android Box - Bitta Buyruq Bilan Hammasini Ishga Tushirish (All-in-One)
# ==============================================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}  Android Box - Avtomatlashtirilgan Ishga Tushirish   ${NC}"
echo -e "${BLUE}======================================================${NC}"

# 1. 4 ta Android Box konteynerlari holatini tekshirish
echo -e "\n${CYAN}[1/5] Android konteynerlari tekshirilmoqda...${NC}"
RUNNING_BOXES=$(docker ps --filter "name=android_box" --format "{{.Names}}" | wc -l || true)

if [ "$RUNNING_BOXES" -lt 4 ]; then
  echo -e "${YELLOW}4 ta konteyner to'liq emas (hozir: $RUNNING_BOXES ta). Ishga tushirilmoqda...${NC}"
  bash deploy_instances.sh --count 4 --start-port 5555
else
  echo -e "${GREEN} Barcha 4 ta Android Box konteyneri ishlamoqda.${NC}"
fi

# 2. Xavfsizlik devori (UFW) da portlarni ochish
echo -e "\n${CYAN}[2/5] Linux xavfsizlik devori (UFW) sozlanmoqda...${NC}"
if command -v ufw &> /dev/null; then
  ufw allow 5555:5565/tcp >/dev/null 2>&1 || true
  ufw allow 5550/tcp >/dev/null 2>&1 || true
  echo -e "${GREEN} Portlar ochildi (5550-5565/TCP)${NC}"
fi

# 3. Haqiqiy tarmoq IP sini aniqlash (Docker IP laridan holi)
echo -e "\n${CYAN}[3/5] Tarmoq va IP manzillar aniqlanmoqda...${NC}"
DEFAULT_IFACE=$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="dev") print $(i+1)}' || ip route show default | awk '{print $5; exit}')
LOCAL_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}')

if [ -z "$LOCAL_IP" ] && [ -n "$DEFAULT_IFACE" ]; then
  LOCAL_IP=$(ip -4 addr show "$DEFAULT_IFACE" 2>/dev/null | awk '/inet / {print $2}' | cut -d/ -f1 | head -n 1)
fi

PUB_IP=$(curl -s --max-time 5 https://api.ipify.org || curl -s --max-time 5 https://ifconfig.me || true)

echo -e "  Interfeys:     ${YELLOW}${DEFAULT_IFACE:-wlan0}${NC}"
echo -e "  Lokal (LAN) IP: ${GREEN}$LOCAL_IP${NC} (Routeringizdagi IP)"
echo -e "  Tashqi IP:     ${GREEN}$PUB_IP${NC}"
echo -e "  No-IP Domeni:  ${GREEN}mark-box.ddns.net${NC}"

# 4. miniupnpc orqali routerda portlarni ochish
echo -e "\n${CYAN}[4/5] Routerda UPnP orqali 5555-5558 portlarni ochish tekshirilmoqda...${NC}"
if ! command -v upnpc &> /dev/null; then
  apt-get update -qq >/dev/null 2>&1 || true
  apt-get install -y -qq miniupnpc >/dev/null 2>&1 || true
fi

UPNP_SUCCESS=false
if command -v upnpc &> /dev/null; then
  UPNPC_CMD="upnpc"
  if [ -n "$DEFAULT_IFACE" ]; then
    UPNPC_CMD="upnpc -m $DEFAULT_IFACE"
  fi

  for port in 5555 5556 5557 5558; do
    if $UPNPC_CMD -a "$LOCAL_IP" $port $port TCP >/dev/null 2>&1 || $UPNPC_CMD -r $port TCP >/dev/null 2>&1; then
      echo -e "  ${GREEN} Port $port -> $LOCAL_IP:$port routerda ochildi!${NC}"
      UPNP_SUCCESS=true
    fi
  done
fi

# 5. Linux Worker Agent (Masofadan buyruq bajarish xizmati)
echo -e "\n${CYAN}[5/5] Linux Worker Agent fon rejimida yoqilmoqda...${NC}"
pkill -f "python3.*agent.py" 2>/dev/null || true
python3 agent.py > /tmp/worker_agent.log 2>&1 &
echo -e "${GREEN} Agent port 5550 da faol.${NC}"

echo -e "\n${BLUE}================================================================${NC}"
if [ "$UPNP_SUCCESS" = true ]; then
  echo -e "${GREEN} TABRIKLAYMIZ! ROUTERDA PORTLAR MUVAFFAQIYATLI OCHILDI!${NC}"
  echo -e "${BLUE}================================================================${NC}"
  echo -e "Mac Master Dashboard ([http://localhost:3000](http://localhost:3000)) ga kiring."
  echo -e "Host: ${GREEN}mark-box.ddns.net${NC} (Portlar: 5555, 5556, 5557, 5558)"
  echo -e "Barcha qutilar avtomatik ravishda ${GREEN}ONLINE${NC} bo'ladi!"
else
  echo -e "${YELLOW} DIQQAT: Routeringizda UPnP avtomatik ochilmadi.${NC}"
  echo -e "${BLUE}================================================================${NC}"
  echo -e "Routeringiz admin paneliga kiring (http://192.168.1.1 yoki http://192.168.0.1):"
  echo -e "  -> 'Port Forwarding' bo'limiga kiring"
  echo -e "  -> Portlar:   ${CYAN}5555 - 5558 (TCP)${NC}"
  echo -e "  -> Ichki IP:  ${GREEN}$LOCAL_IP${NC}"
  echo -e ""
  echo -e "  Yoki routerga kirmasdan 100% ulanish uchun (Tailscale):"
  echo -e "  ${CYAN}sudo tailscale up${NC}"
fi
echo -e "${BLUE}================================================================${NC}\n"
