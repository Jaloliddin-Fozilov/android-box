#!/bin/bash
# ==============================================================================
# Android Box - ALL-IN-ONE LINUX INSTALLER
# Ushbu butun matnni Linux terminaliga nusxalab (Paste qilib) tashlasangiz kifoya!
# U barcha papka va konfiguratsiyalarni o'zi yaratib, 8 ta Android OS'ni ko'taradi.
# ==============================================================================

set -e

WORK_DIR="$HOME/android-box-worker"
mkdir -p "$WORK_DIR/config" "$WORK_DIR/scripts"
cd "$WORK_DIR"

echo "=========================================================="
echo "      Android Box - Linux Worker O'rnatilmoqda...         "
echo "=========================================================="

# 1. Device Profiles yaratish
cat << 'EOF' > config/device_profiles.json
[
  {
    "brand": "samsung",
    "model": "SM-G998B",
    "device": "p3s",
    "manufacturer": "samsung",
    "fingerprint": "samsung/p3sxeea/p3s:12/SP1A.210812.016/G998BXXU4BVG4:user/release-keys"
  },
  {
    "brand": "google",
    "model": "Pixel 6",
    "device": "oriole",
    "manufacturer": "Google",
    "fingerprint": "google/oriole/oriole:12/SQ3A.220705.004/8836740:user/release-keys"
  },
  {
    "brand": "Xiaomi",
    "model": "2201123G",
    "device": "cupid",
    "manufacturer": "Xiaomi",
    "fingerprint": "Xiaomi/cupid_eea/cupid:12/SKQ1.211006.001/V13.0.18.0.SLCEUXM:user/release-keys"
  }
]
EOF

# 2. Setup Host skripti
cat << 'EOF' > setup_host.sh
#!/bin/bash
set -e
echo "[1/4] Paketlar yangilanmoqda va Docker tekshirilmoqda..."
sudo apt-get update -y
sudo apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release jq adb iptables kmod

# Binderfs sozlash
sudo mkdir -p /dev/binderfs
if ! mountpoint -q /dev/binderfs; then
    sudo mount -t binder binder /dev/binderfs || true
fi
sudo ln -sf /dev/binderfs/binder /dev/binder || true
sudo ln -sf /dev/binderfs/hwbinder /dev/hwbinder || true
sudo ln -sf /dev/binderfs/vndbinder /dev/vndbinder || true
sudo chmod 666 /dev/binderfs/* /dev/binder /dev/hwbinder /dev/vndbinder 2>/dev/null || true

# Docker
if ! command -v docker &> /dev/null; then
    echo "Docker o'rnatilmoqda..."
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker $USER || true
fi

# ReDroid obrazini yuklash
echo "ReDroid Android 11 obrazi yuklanmoqda..."
sudo docker pull redroid/redroid:11.0.0-latest
echo "[OK] Barcha drayverlar va Docker tayyor!"
EOF
chmod +x setup_host.sh

# 3. Deploy Instances skripti
cat << 'EOF' > deploy_instances.sh
#!/bin/bash
set -e
COUNT=${1:-8}
START_PORT=5555
COMPOSE_FILE="docker-compose.generated.yml"
PROFILES_FILE="config/device_profiles.json"
PROFILES_COUNT=$(jq '. | length' "$PROFILES_FILE")

cat << 'COMPOSE_HEAD' > "$COMPOSE_FILE"
version: '3.8'
services:
COMPOSE_HEAD

for ((i=1; i<=COUNT; i++)); do
    PORT=$((START_PORT + i - 1))
    NAME="android_box_${i}"
    DATA_DIR="./instances_data/box_${i}"
    mkdir -p "$DATA_DIR"

    PIDX=$(( (i - 1) % PROFILES_COUNT ))
    BRAND=$(jq -r ".[$PIDX].brand" "$PROFILES_FILE")
    MODEL=$(jq -r ".[$PIDX].model" "$PROFILES_FILE")
    DEVICE=$(jq -r ".[$PIDX].device" "$PROFILES_FILE")
    MANUF=$(jq -r ".[$PIDX].manufacturer" "$PROFILES_FILE")
    FPRINT=$(jq -r ".[$PIDX].fingerprint" "$PROFILES_FILE")

    cat << C_ENTRY >> "$COMPOSE_FILE"
  ${NAME}:
    image: redroid/redroid:11.0.0-latest
    container_name: ${NAME}
    privileged: true
    restart: unless-stopped
    ports:
      - "${PORT}:5555"
    volumes:
      - ${DATA_DIR}:/data
      - /dev/binderfs:/dev/binderfs
    devices:
      - /dev/kvm:/dev/kvm
    command:
      - androidboot.redroid_width=720
      - androidboot.redroid_height=1280
      - androidboot.redroid_dpi=240
      - androidboot.redroid_fps=25
      - androidboot.redroid_gpu_mode=auto
      - ro.product.brand=${BRAND}
      - ro.product.model=${MODEL}
      - ro.product.name=${DEVICE}
      - ro.product.device=${DEVICE}
      - ro.product.manufacturer=${MANUF}
      - ro.build.fingerprint=${FPRINT}
C_ENTRY
done

echo "Instansiyalar ko'tarilmoqda..."
sudo docker compose -f "$COMPOSE_FILE" up -d
sleep 4
echo "[OK] $COUNT ta instansiya ishga tushdi!"
EOF
chmod +x deploy_instances.sh

# 4. Start skripti
cat << 'EOF' > start.sh
#!/bin/bash
set -e

if ! command -v docker &> /dev/null || [ ! -d /dev/binderfs ]; then
    bash setup_host.sh
fi

bash deploy_instances.sh 8

LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
PUBLIC_IP=$(curl -s --connect-timeout 2 https://ifconfig.me 2>/dev/null || echo "Aniqlanmadi")

echo ""
echo "====================================================================="
echo "   TABRIKLAYMIZ! 8 TA ANDROID INSTANSIYASI ISHLAMOQDA!              "
echo "====================================================================="
echo "Endi Mac kompyuteringizdagi Web Dashboard'ga quyidagi IP ni kiritasiz:"
echo ""
echo "  👉 Lokal Tarmoq IP:     $LOCAL_IP"
echo "  👉 Tashqi (Public) IP:  $PUBLIC_IP"
echo "---------------------------------------------------------------------"
echo "Mac brauzerida http://localhost:3000 ni oching va Sozlamalarga shu IP ni yozing."
echo "====================================================================="
EOF
chmod +x start.sh

# O'rnatishni boshlash
bash start.sh
