#!/bin/bash
# ==============================================================================
# Android Box - No-IP (DDNS) Avtomatik Sozlash Skripti
# Sayt: https://www.noip.com
# Vazifasi: Linux kompyuteringiz uchun doimiy tekin domen (masalan: mark-box.ddns.net)
# orqali ulanishni ta'minlash va IP o'zgarganda avtomatik yangilab turish.
# ==============================================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}  Android Box - No-IP (DDNS) Integratsiyasi           ${NC}"
echo -e "${BLUE}  https://www.noip.com                                ${NC}"
echo -e "${BLUE}======================================================${NC}"

# Parametrlarni olish yoki so'rash
NOIP_HOST="$1"
NOIP_USER="$2"
NOIP_PASS="$3"

if [ -z "$NOIP_HOST" ]; then
  echo -e "\n${YELLOW}1. No-IP.com saytida yaratgan bepul domeningizni kiriting:${NC}"
  read -p "Domen (masalan: mark-box.ddns.net): " NOIP_HOST
fi

if [ -z "$NOIP_USER" ]; then
  echo -e "${YELLOW}2. No-IP.com dagi Email yoki Username (yoki DDNS Key Username):${NC}"
  read -p "Username / Email: " NOIP_USER
fi

if [ -z "$NOIP_PASS" ]; then
  echo -e "${YELLOW}3. No-IP.com parolingiz (yoki DDNS Key Password):${NC}"
  read -s -p "Parol: " NOIP_PASS
  echo ""
fi

if [ -z "$NOIP_HOST" ] || [ -z "$NOIP_USER" ] || [ -z "$NOIP_PASS" ]; then
  echo -e "${RED}Xatolik: Domen, username va parol kiritilishi shart!${NC}"
  exit 1
fi

echo -e "\n${CYAN}[1/3] No-IP serveri bilan aloqa tekshirilmoqda...${NC}"
RESPONSE=$(curl -s -A "AndroidBoxDDNS/1.0 support@noip.com" -u "$NOIP_USER:$NOIP_PASS" "https://dynupdate.no-ip.com/nic/update?hostname=$NOIP_HOST" || true)

echo -e "No-IP javobi: ${YELLOW}$RESPONSE${NC}"

if [[ "$RESPONSE" == *"good"* ]] || [[ "$RESPONSE" == *"nochg"* ]]; then
  echo -e "${GREEN} TABRIKLAYMIZ! No-IP muvaffaqiyatli bog'landi va IP yangilandi!${NC}"
elif [[ "$RESPONSE" == *"badauth"* ]]; then
  echo -e "${RED} Xatolik: Username yoki parol noto'g'ri (badauth). Tekshirib qaytadan kiriting.${NC}"
  exit 1
elif [[ "$RESPONSE" == *"nohost"* ]]; then
  echo -e "${RED} Xatolik: '$NOIP_HOST' nomli domen No-IP akkauntingizda topilmadi (nohost).${NC}"
  echo -e "Avval noip.com saytida ushbu domenni 'Create Hostname' orqali oching."
  exit 1
else
  echo -e "${YELLOW}Ogohlantirish: Kutilmagan javob olindi ($RESPONSE), lekin sozlash davom etadi.${NC}"
fi

# 2. Avtomatik yangilab turuvchi skript yaratish
echo -e "\n${CYAN}[2/3] Har 10 daqiqada IP ni avtomatik yangilovchi xizmat yaratilmoqda...${NC}"
CONFIG_DIR="/etc/android-box"
sudo mkdir -p "$CONFIG_DIR"

cat << 'EOF' | sudo tee "$CONFIG_DIR/update_noip.sh" > /dev/null
#!/bin/bash
HOST="__HOST__"
USER="__USER__"
PASS="__PASS__"

curl -s -A "AndroidBoxDDNS/1.0 support@noip.com" -u "$USER:$PASS" "https://dynupdate.no-ip.com/nic/update?hostname=$HOST" > /tmp/noip_last_update.log 2>&1
EOF

sudo sed -i "s|__HOST__|$NOIP_HOST|g" "$CONFIG_DIR/update_noip.sh"
sudo sed -i "s|__USER__|$NOIP_USER|g" "$CONFIG_DIR/update_noip.sh"
sudo sed -i "s|__PASS__|$NOIP_PASS|g" "$CONFIG_DIR/update_noip.sh"
sudo chmod 700 "$CONFIG_DIR/update_noip.sh"

# 3. Systemd Timer yoki Cron orqali fonda ishga tushirish
cat << EOF | sudo tee /etc/systemd/system/noip-updater.service > /dev/null
[Unit]
Description=Android Box No-IP DDNS Updater
After=network.target

[Service]
Type=oneshot
ExecStart=/bin/bash /etc/android-box/update_noip.sh
EOF

cat << EOF | sudo tee /etc/systemd/system/noip-updater.timer > /dev/null
[Unit]
Description=Run No-IP DDNS Updater every 10 minutes

[Timer]
OnBootSec=1min
OnUnitActiveSec=10min
Unit=noip-updater.service

[Install]
WantedBy=timers.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now noip-updater.timer > /dev/null 2>&1 || true

echo -e "${GREEN} Doimiy fon xizmati faollashdi (IP o'zgarsa har 10 daqiqada avtomatik yangilanadi).${NC}"

# Lokal IP ni chiqarish (Router port forwarding uchun)
DEFAULT_IFACE=$(ip route show default 2>/dev/null | awk '{print $5; exit}' || ip route get 1.1.1.1 2>/dev/null | grep -oP 'dev \K\S+' || true)
LOCAL_IP=""
if [ -n "$DEFAULT_IFACE" ]; then
  LOCAL_IP=$(ip -4 addr show "$DEFAULT_IFACE" 2>/dev/null | grep -oP 'inet \K[\d.]+' | head -n 1 || true)
fi
if [ -z "$LOCAL_IP" ]; then
  LOCAL_IP=$(hostname -I | tr ' ' '\n' | grep -v '^172\.' | grep -v '^127\.' | head -n 1 || true)
fi

echo -e "\n${BLUE}================================================================${NC}"
echo -e "${GREEN} BARCHASI TAYYOR!${NC}"
echo -e "${BLUE}================================================================${NC}"
echo -e "1. Mac Master Dashboard'da (${CYAN}http://localhost:3000${NC}) kiriting:"
echo -e "   - PC Nomi:     ${YELLOW}Linux Worker (No-IP)${NC}"
echo -e "   - Host (Domen): ${GREEN}$NOIP_HOST${NC}"
echo -e "   - Boshl. Port: ${CYAN}5555${NC}"
echo -e "   - Qutilar:     ${CYAN}4 ta${NC}"
echo -e ""
echo -e "2. Wi-Fi Router sozlamalarida (Port Forwarding):"
echo -e "   - Portlar:     ${CYAN}5555 - 5558 (TCP)${NC}"
echo -e "   - Ichki IP:    ${YELLOW}$LOCAL_IP${NC}"
echo -e "${BLUE}================================================================${NC}\n"
