#!/bin/bash
# ==============================================================================
# Android Box - Public IP & UPnP Port Forwarding Sozlash Skripti
# Vazifasi: ipify orqali Public IP ni aniqlash va routerda portlarni (5555-5558) ochish
# ==============================================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}  Android Box - Public IP & Port Sozlash (ipify)      ${NC}"
echo -e "${BLUE}======================================================${NC}"

# 1. ipify orqali Public IP ni aniqlash
echo -e "\n${CYAN}[1/4] ipify orqali Public IP olinmoqda...${NC}"
PUB_IP=$(curl -s --max-time 5 https://api.ipify.org || curl -s --max-time 5 https://ifconfig.me || curl -s --max-time 5 https://icanhazip.com || true)

if [ -z "$PUB_IP" ]; then
  echo -e "${RED}Xatolik: Public IP manzilni olib bo'lmadi. Internetni tekshiring.${NC}"
  exit 1
fi
echo -e "${GREEN}>>> Sizning Public (Tashqi) IP manzilingiz: ${YELLOW}$PUB_IP${NC}"

# 2. Ichki lokal IP
LOCAL_IP=$(hostname -I | awk '{print $1}')
echo -e "\n${CYAN}[2/4] Ichki lokal IP aniqlandi: ${YELLOW}$LOCAL_IP${NC}"

# 3. Linux Firewall (UFW)
echo -e "\n${CYAN}[3/4] Linux xavfsizlik devorida (UFW) ADB portlari ochilmoqda...${NC}"
if command -v ufw &> /dev/null; then
  sudo ufw allow 5555:5565/tcp >/dev/null 2>&1 || true
  sudo ufw allow 5550/tcp >/dev/null 2>&1 || true
  echo -e "${GREEN} UFW portlari ochildi (5550-5565/TCP)${NC}"
else
  echo -e "${YELLOW}ℹ UFW o'rnatilmagan, barcha portlar ochiq.${NC}"
fi

# 4. UPnP orqali routerda portlarni ochish
COUNT=${1:-4}
START_PORT=${2:-5555}

echo -e "\n${CYAN}[4/4] Routerda UPnP orqali portlarni tashqariga ochish tekshirilmoqda...${NC}"
if ! command -v upnpc &> /dev/null; then
  echo -e "miniupnpc dasturi o'rnatilmoqda..."
  sudo apt-get update -qq >/dev/null 2>&1 || true
  sudo apt-get install -y -qq miniupnpc >/dev/null 2>&1 || true
fi

UPNP_SUCCESS=false
if command -v upnpc &> /dev/null; then
  echo -e "Router bilan bog'lanish va UPnP portlarni yo'naltirish..."
  for ((i=0; i<COUNT; i++)); do
    PORT=$((START_PORT + i))
    if upnpc -r $PORT TCP >/dev/null 2>&1; then
      echo -e "  ${GREEN} Port $PORT -> $LOCAL_IP:$PORT routerda muvaffaqiyatli ochildi!${NC}"
      UPNP_SUCCESS=true
    else
      echo -e "  ${YELLOW}⚠ Port $PORT UPnP orqali ochilmadi.${NC}"
    fi
  done
fi

echo -e "\n${BLUE}================================================================${NC}"
if [ "$UPNP_SUCCESS" = true ]; then
  echo -e "${GREEN} TABRIKLAYMIZ! Public IP orqali to'g'ridan-to'g'ri ulanish tayyor.${NC}"
  echo -e "${BLUE}================================================================${NC}"
  echo -e "Endi Mac Master Dashboard'da quyidagilarni kiriting:"
  echo -e "  PC Nomi:     ${YELLOW}Linux Worker${NC}"
  echo -e "  Host (IP):   ${GREEN}$PUB_IP${NC}"
  echo -e "  Boshl. Port: ${CYAN}$START_PORT${NC}"
  echo -e "  Qutilar:     ${CYAN}$COUNT ta${NC}"
else
  echo -e "${YELLOW} DIQQAT: Routeringizda UPnP avtomatik ochilmadi.${NC}"
  echo -e "${BLUE}================================================================${NC}"
  echo -e "Sizning tashqi Public IP manzilingiz: ${GREEN}$PUB_IP${NC}"
  echo -e ""
  echo -e "Ushbu IP dan to'g'ridan-to'g'ri foydalanish uchun 2 ta variant bor:"
  echo -e "  1. Wi-Fi Router sozlamalariga kirib (192.168.0.1 yoki 192.168.1.1):"
  echo -e "     'Port Forwarding' bo'limiga $START_PORT-$((START_PORT+COUNT-1)) portlarni"
  echo -e "     lokal IP ${YELLOW}$LOCAL_IP${NC} ga yo'naltiring."
  echo -e ""
  echo -e "  2. Yoki eng oson va barqaror bepul yo'l — Tailscale:"
  echo -e "     ${CYAN}sudo tailscale up${NC}"
  echo -e "     (Router sozlamalarisiz to'g'ridan-to'g'ri ulanadi)"
fi
echo -e "${BLUE}================================================================${NC}\n"
