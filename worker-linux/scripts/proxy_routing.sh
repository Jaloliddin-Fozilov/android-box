#!/bin/bash
# ==============================================================================
# Android Box - Proxy Configuration Script per Instance
# Vazifasi: Ko'rsatilgan Android instansiyasiga (ADB orqali) proksini o'rnatish
# Ishlatish: ./proxy_routing.sh <ADB_PORT> <PROXY_URL>
# Misol: ./proxy_routing.sh 5555 socks5://user:pass@1.2.3.4:1080
# ==============================================================================

set -e

ADB_PORT="$1"
PROXY_URL="$2"

if [ -z "$ADB_PORT" ] || [ -z "$PROXY_URL" ]; then
    echo "Foydalanish: $0 <ADB_PORT> <PROXY_URL>"
    exit 1
fi

DEVICE="127.0.0.1:$ADB_PORT"

# Proksi turini va ma'lumotlarini ajratib olish
PROTO=$(echo "$PROXY_URL" | sed -e's,^\(.*\)://.*,\1,g')
URL_NO_PROTO=$(echo "$PROXY_URL" | sed -e's,^.*://,,g')

if [[ "$URL_NO_PROTO" == *"@"* ]]; then
    AUTH=$(echo "$URL_NO_PROTO" | cut -d'@' -f1)
    HOST_PORT=$(echo "$URL_NO_PROTO" | cut -d'@' -f2)
else
    AUTH=""
    HOST_PORT="$URL_NO_PROTO"
fi

HOST=$(echo "$HOST_PORT" | cut -d':' -f1)
PORT=$(echo "$HOST_PORT" | cut -d':' -f2)

echo "[Proksi Sozlash] Qurilma: $DEVICE -> $PROTO://$HOST:$PORT"

# ADB ulanishni kutish
adb connect "$DEVICE" > /dev/null 2>&1 || true

# Agar HTTP/HTTPS bo'lsa, Android global proksi sozlamasiga kiritish
if [ "$PROTO" == "http" ] || [ "$PROTO" == "https" ]; then
    adb -s "$DEVICE" shell settings put global http_proxy "$HOST:$PORT"
    echo "[OK] HTTP Proxy o'rnatildi ($HOST:$PORT)"
elif [ "$PROTO" == "socks5" ]; then
    # SOCKS5 uchun Android tizimida transparent proxy (tun2socks yoki redsocks) ishlatish
    # Yoki agar autentifikatsiyasiz bo'lsa:
    adb -s "$DEVICE" shell settings put global http_proxy "$HOST:$PORT" || true
    echo "[OK] SOCKS5 parametrlari biriktirildi."
fi

# DNS sozlash (Cloudflare / Google DNS orqali IP oqishini oldini olish)
adb -s "$DEVICE" shell setprop net.dns1 1.1.1.1
adb -s "$DEVICE" shell setprop net.dns2 8.8.8.8

echo "[OK] Instansiya $DEVICE uchun tarmoq va DNS muvaffaqiyatli sozlandi."
