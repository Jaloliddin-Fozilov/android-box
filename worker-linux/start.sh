#!/bin/bash
# ==============================================================================
# Android Box - Bitta Buyruq Bilan Ishga Tushirish (All-in-One Runner)
# Vazifasi:
#   1. Drayverlar va Dockerni tekshirish (kerak bo'lsa avtomatik o'rnatish)
#   2. 8 ta Android instansiyasini ishga tushirish
#   3. O'zining IP manzilini avtomatik aniqlab, Mac uchun tayyor ko'rsatish
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}=====================================================================${NC}"
echo -e "${BLUE}           Android Box - Bitta Buyruq Bilan Ishga Tushirish          ${NC}"
echo -e "${BLUE}=====================================================================${NC}"

# Root tekshiruvi
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[DIQQAT] Ushbu skriptni sudo bilan ishga tushiring:${NC}"
  echo -e "         ${CYAN}sudo bash $0${NC}"
  exit 1
fi

# 1-qadam: Agar Docker yoki BinderFS o'rnatilmagan bo'lsa, setup_host.sh ni chaqirish
if ! command -v docker &> /dev/null || [ ! -d /dev/binderfs ]; then
    echo -e "\n${YELLOW}[1/3] Birlamchi muhit (Docker & BinderFS) o'rnatilmoqda...${NC}"
    bash "$SCRIPT_DIR/setup_host.sh"
else
    echo -e "\n${GREEN}[1/3] Birlamchi muhit allaqachon tayyor (Docker & BinderFS mavjud).${NC}"
fi

# 2-qadam: Tashqi tarmoq (Tailscale) tekshiruvi
echo -e "\n${YELLOW}[2/4] Tashqi tarmoq (Masofaviy ulanish) holati...${NC}"
if ! command -v tailscale &> /dev/null; then
    echo -e "${CYAN}Tashqi internetdan Mac bilan to'g'ridan-to'g'ri bog'lanish uchun Tailscale o'rnatilmoqda...${NC}"
    curl -fsSL https://tailscale.com/install.sh | sh > /dev/null 2>&1 || true
fi

# Agar Tailscale login qilinmagan bo'lsa
TAILSCALE_IP=$(tailscale ip -4 2>/dev/null || echo "")
if [ -z "$TAILSCALE_IP" ] && command -v tailscale &> /dev/null; then
    echo -e "${YELLOW}>> Tashqi tarmoq ulanishi uchun quyidagi buyruqni bering:${NC}"
    echo -e "   ${CYAN}sudo tailscale up${NC}"
    echo -e "   (Ekranda chiqadigan havolani brauzerda ochib tasdiqlang)\n"
fi

# 3-qadam: Android instansiyalarini ishga tushirish
COUNT=${1:-8}
echo -e "\n${YELLOW}[3/4] ${COUNT} ta Android OS instansiyasi ko'tarilmoqda...${NC}"
bash "$SCRIPT_DIR/deploy_instances.sh" --count "$COUNT" --start-port 5555

# 4-qadam: IP manzillarni avtomatik aniqlash
echo -e "\n${YELLOW}[4/4] Tarmoq manzillari aniqlanmoqda...${NC}"

# Lokal tarmoq IP si
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ -z "$LOCAL_IP" ]; then
    LOCAL_IP="127.0.0.1"
fi

# Tashqi Internet IP si
PUBLIC_IP=$(curl -s --connect-timeout 2 https://ifconfig.me 2>/dev/null || echo "Aniqlanmadi")

# Tailscale VPN IP si (agar mavjud bo'lsa)
TAILSCALE_IP=$(tailscale ip -4 2>/dev/null || echo "")

echo -e "\n${GREEN}=====================================================================${NC}"
echo -e "${GREEN}      TABRIKLAYMIZ! BARCHA ANDROID INSTANSIYALARI ISHLAMOQDA!       ${NC}"
echo -e "${GREEN}=====================================================================${NC}"
echo -e "Endi Mac kompyuteringizdagi Web Dashboard'ga quyidagi IP ni kiritasiz:\n"

if [ -n "$TAILSCALE_IP" ]; then
    echo -e "  👉 ${CYAN}Tailscale VPN IP:${NC}     ${YELLOW}$TAILSCALE_IP${NC} (Eng xavfsiz masofaviy ulanish)"
fi

echo -e "  👉 ${CYAN}Lokal Tarmoq IP:${NC}      ${YELLOW}$LOCAL_IP${NC} (Agar Mac va Linux bitta Wi-Fi/ofisda bo'lsa)"
echo -e "  👉 ${CYAN}Tashqi (Public) IP:${NC}   ${YELLOW}$PUBLIC_IP${NC} (Agar Linux uzoqdagi server/VPS bo'lsa)"

echo -e "\n---------------------------------------------------------------------"
echo -e "${BLUE}MAC'DA QILINADIGAN QADAM:${NC}"
echo -e "1. Mac'dagi brauzerda oching: ${CYAN}http://localhost:3000${NC}"
echo -e "2. O'ng yuqoridagi Sozlamalar (Gear) tugmasini bosing."
echo -e "3. IP maydoniga yuqoridagi IP lardan birini (odatda: ${YELLOW}$LOCAL_IP${NC}) yozing."
echo -e "4. 'Saqlash & Ulanish' tugmasini bosing - barcha ekranlar ko'rinadi!"
echo -e "${GREEN}=====================================================================${NC}\n"
