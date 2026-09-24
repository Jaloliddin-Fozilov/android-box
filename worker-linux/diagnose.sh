#!/bin/bash
# ==============================================================================
# Android Box - Tezkor Diagnostika va Tekshiruv Skripti
# ==============================================================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}======================================================${NC}"
echo -e "${CYAN}     Android Box - Tizim Diagnostikasi (Linux)        ${NC}"
echo -e "${CYAN}======================================================${NC}"

# 1. BinderFS tekshirish
echo -e "\n${YELLOW}[1] /dev/binderfs holati:${NC}"
if [ -d /dev/binderfs ]; then
    ls -la /dev/binderfs
else
    echo -e "${RED}[XATO] /dev/binderfs papkasi mavjud emas!${NC}"
fi

# 2. Kernel drayverlari
echo -e "\n${YELLOW}[2] Kernel filesystems & modules:${NC}"
grep -E "binder|ashmem" /proc/filesystems /proc/misc 2>/dev/null || true
lsmod | grep -E "binder|ashmem|kvm" || true

# 3. Docker holati
echo -e "\n${YELLOW}[3] Docker konteynerlari holati:${NC}"
docker ps --filter "name=android_box" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 4. Android ichidagi jarayonlar (Zygote, System Server, Surfaceflinger, adbd)
echo -e "\n${YELLOW}[4] Android Box #1 ichki jarayonlari (ps -A):${NC}"
docker exec android_box_1 ps -A 2>/dev/null | grep -E "adbd|system_server|zygote|surfaceflinger" || echo -e "${RED}[XATO] docker exec ishlamadi yoki jarayonlar yo'q!${NC}"

# 5. Android Boot va Model holati
echo -e "\n${YELLOW}[5] Android Boot xususiyatlari (getprop):${NC}"
docker exec android_box_1 getprop sys.boot_completed 2>/dev/null | xargs -I{} echo "sys.boot_completed: {}"
docker exec android_box_1 getprop ro.product.model 2>/dev/null | xargs -I{} echo "ro.product.model: {}"
docker exec android_box_1 getprop ro.adb.secure 2>/dev/null | xargs -I{} echo "ro.adb.secure: {}"

# 6. Oxirgi xato loglari (Logcat)
echo -e "\n${YELLOW}[6] Android Logcat (oxirgi 25 qator):${NC}"
docker exec android_box_1 logcat -d -t 25 2>&1 || true

# 7. Kernel dmesg loglari
echo -e "\n${YELLOW}[7] Kernel dmesg (binder/redroid):${NC}"
dmesg | grep -i -E "binder|redroid|ashmem" | tail -n 15 || true

# 8. Mahalliy ADB ulanishi
echo -e "\n${YELLOW}[8] Mahalliy ADB testi:${NC}"
adb connect 127.0.0.1:5555
adb devices

echo -e "\n${CYAN}======================================================${NC}"
echo -e "${CYAN}             Diagnostika yakunlandi                   ${NC}"
echo -e "${CYAN}======================================================${NC}"
