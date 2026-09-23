#!/bin/bash
# ==============================================================================
# Android Box - Deploy Instances Script
# Vazifasi: Ko'rsatilgan miqdorda ReDroid Android instansiyalarini avtomatik ko'tarish
# Foydalanish: ./deploy_instances.sh [--count 8] [--start-port 5555] [--gpu]
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$SCRIPT_DIR/config"
DATA_BASE_DIR="$SCRIPT_DIR/instances_data"

COUNT=8
START_PORT=5555
ENABLE_GPU=false
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.generated.yml"

# Argumentlarni o'qish
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --count) COUNT="$2"; shift ;;
        --start-port) START_PORT="$2"; shift ;;
        --gpu) ENABLE_GPU=true ;;
        -h|--help)
            echo "Foydalanish: $0 [--count <soni>] [--start-port <boshlangich_port>] [--gpu]"
            echo "Misol: $0 --count 8 --start-port 5555"
            exit 0
            ;;
        *) echo "Noma'lum parametr: $1"; exit 1 ;;
    esac
    shift
done

echo "====================================================="
echo "   Android Box - Instansiyalarni Ishga Tushirish     "
echo "   Soni: $COUNT ta instansiya"
echo "   Boshlang'ich ADB Port: $START_PORT"
echo "   GPU tezlatish: $ENABLE_GPU"
echo "====================================================="

# BinderFS tekshirish
if [ ! -d /dev/binderfs ]; then
    echo "[OGOHLANTIRISH] /dev/binderfs topilmadi! Oldin 'sudo bash setup_host.sh' ni bajarganingizga ishonch hosil qiling."
fi

mkdir -p "$DATA_BASE_DIR"

# Qurilma profillarini yuklash
PROFILES_FILE="$CONFIG_DIR/device_profiles.json"
if [ ! -f "$PROFILES_FILE" ]; then
    echo "[XATO] $PROFILES_FILE topilmadi!"
    exit 1
fi

PROFILES_COUNT=$(jq '. | length' "$PROFILES_FILE")

# Proksilar ro'yxati
PROXIES_FILE="$CONFIG_DIR/proxies.txt"
if [ ! -f "$PROXIES_FILE" ]; then
    PROXIES_FILE="$CONFIG_DIR/proxies.example.txt"
fi

# docker-compose.generated.yml faylini noldan boshlash
cat <<EOF > "$COMPOSE_FILE"
version: '3.8'

services:
EOF

echo -e "\nKonteynerlar konfiguratsiyasi generatsiya qilinmoqda..."

for ((i=1; i<=COUNT; i++)); do
    PORT=$((START_PORT + i - 1))
    CONTAINER_NAME="android_box_${i}"
    INSTANCE_DATA="$DATA_BASE_DIR/box_${i}"
    mkdir -p "$INSTANCE_DATA"

    # Profil tanlash (tsiklik ravishda)
    PROFILE_IDX=$(( (i - 1) % PROFILES_COUNT ))
    BRAND=$(jq -r ".[$PROFILE_IDX].brand" "$PROFILES_FILE")
    MODEL=$(jq -r ".[$PROFILE_IDX].model" "$PROFILES_FILE")
    DEVICE=$(jq -r ".[$PROFILE_IDX].device" "$PROFILES_FILE")
    MANUFACTURER=$(jq -r ".[$PROFILE_IDX].manufacturer" "$PROFILES_FILE")
    FINGERPRINT=$(jq -r ".[$PROFILE_IDX].fingerprint" "$PROFILES_FILE")

    cat <<EOF >> "$COMPOSE_FILE"
  ${CONTAINER_NAME}:
    image: redroid/redroid:11.0.0-latest
    container_name: ${CONTAINER_NAME}
    privileged: true
    restart: unless-stopped
    ports:
      - "${PORT}:5555"
    volumes:
      - ${INSTANCE_DATA}:/data
      - /dev/binderfs:/dev/binderfs
    devices:
      - /dev/kvm:/dev/kvm
    deploy:
      resources:
        limits:
          cpus: '1.5'
          memory: 1400M
        reservations:
          memory: 400M
    command:
      - androidboot.redroid_width=720
      - androidboot.redroid_height=1280
      - androidboot.redroid_dpi=240
      - androidboot.redroid_fps=15
      - androidboot.redroid_gpu_mode=auto
      - ro.product.brand=${BRAND}
      - ro.product.model=${MODEL}
      - ro.product.name=${DEVICE}
      - ro.product.device=${DEVICE}
      - ro.product.manufacturer=${MANUFACTURER}
      - ro.build.fingerprint=${FINGERPRINT}

EOF
done

echo "[OK] docker-compose.generated.yml yaratildi."

# BinderFS huquqlarini hamma foydalanuvchilar (shu jumladan Android) uchun ochish
chmod 666 /dev/binderfs/* 2>/dev/null || true
chmod 666 /dev/binder /dev/hwbinder /dev/vndbinder 2>/dev/null || true

# Docker API versiyasini daemon bilan sinxronlash (client 1.43 too old xatosini oldini olish)
SERVER_API=$(docker version --format '{{.Server.APIVersion}}' 2>/dev/null || echo "1.44")
export DOCKER_API_VERSION="${SERVER_API:-1.44}"

echo -e "\nDocker konteynerlari ishga tushirilmoqda (Docker API: $DOCKER_API_VERSION)..."
DOCKER_API_VERSION="$DOCKER_API_VERSION" docker compose -f "$COMPOSE_FILE" down 2>/dev/null || true
if ! DOCKER_API_VERSION="$DOCKER_API_VERSION" docker compose -f "$COMPOSE_FILE" up -d 2>&1; then
    echo -e "\n[OGOHLANTIRISH] docker compose orqali yuklashda API versiya xatosi bo'ldi."
    echo -e "Docker-compose yangilanmoqda yoki to'g'ridan-to'g'ri 'docker run' orqali yuklanmoqda..."
    sudo apt-get update -y && sudo apt-get install --only-upgrade docker-ce-cli docker-compose-plugin -y 2>/dev/null || true
    docker compose -f "$COMPOSE_FILE" up -d || {
        echo "Konteynerlar to'g'ridan-to'g'ri docker run orqali ishga tushirilmoqda..."
        KVM_OPT=""
        if [ -e /dev/kvm ]; then
            KVM_OPT="--device /dev/kvm:/dev/kvm"
        fi
        for ((i=1; i<=COUNT; i++)); do
            PORT=$((START_PORT + i - 1))
            CONTAINER_NAME="android_box_${i}"
            INSTANCE_DATA="$DATA_BASE_DIR/box_${i}"
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
                androidboot.redroid_gpu_mode=auto 2>/dev/null || true
        done
    }
fi

echo -e "\nInstansiyalar to'liq yuklanishi kutilmoqda (Android Boot Completed)..."
for ((i=1; i<=COUNT; i++)); do
    PORT=$((START_PORT + i - 1))
    echo -n "  Box #$i (port $PORT) yuklanmoqda"
    BOOT_OK=false
    for attempt in {1..35}; do
        adb connect "127.0.0.1:$PORT" > /dev/null 2>&1 || true
        STATE=$(adb -s "127.0.0.1:$PORT" get-state 2>/dev/null || echo "offline")
        if [ "$STATE" = "device" ]; then
            BOOT=$(adb -s "127.0.0.1:$PORT" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')
            if [ "$BOOT" = "1" ]; then
                echo " -> TAYYOR (online)!"
                BOOT_OK=true
                break
            fi
        fi
        echo -n "."
        sleep 2
    done
    if [ "$BOOT_OK" != true ]; then
        echo " -> [Kutilmoqda]"
    fi
done

echo -e "\n=========================================================================="
printf "%-16s | %-10s | %-15s | %-12s\n" "Konteyner" "ADB Port" "Telefon Modeli" "Holat"
echo "--------------------------------------------------------------------------"

for ((i=1; i<=COUNT; i++)); do
    PORT=$((START_PORT + i - 1))
    CONTAINER_NAME="android_box_${i}"
    PROFILE_IDX=$(( (i - 1) % PROFILES_COUNT ))
    MODEL=$(jq -r ".[$PROFILE_IDX].model" "$PROFILES_FILE")

    # ADB ulanishni tekshirish
    adb connect "127.0.0.1:$PORT" > /dev/null 2>&1 || true
    STATUS=$(adb -s "127.0.0.1:$PORT" get-state 2>/dev/null || echo "offline")

    printf "%-16s | %-10s | %-15s | %-12s\n" "$CONTAINER_NAME" "$PORT" "$MODEL" "$STATUS"
done

echo "=========================================================================="
echo -e "\nBarcha $COUNT ta Android instansiyasi muvaffaqiyatli ko'tarildi!"
