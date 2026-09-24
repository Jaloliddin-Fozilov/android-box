#!/bin/bash
# ==============================================================================
# Android Box - BinderFS Drayverini To'liq Tuzatish va Yuklash
# ==============================================================================

set +e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}======================================================${NC}"
echo -e "${CYAN}     Android BinderFS Drayverini Sozlash              ${NC}"
echo -e "${CYAN}======================================================${NC}"

# Root tekshiruvi
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[XATO] Iltimos, sudo bilan ishga tushiring: sudo bash $0${NC}"
  exit 1
fi

# 1. linux-modules-extra paketini tekshirish
echo -e "\n${YELLOW}[1/4] Kernel qo'shimcha drayverlari tekshirilmoqda...${NC}"
KERNEL_VER=$(uname -r)
if ! modinfo binder_linux &>/dev/null; then
    echo "  linux-modules-extra-$KERNEL_VER o'rnatilmoqda..."
    apt-get update -qq
    apt-get install -y "linux-modules-extra-$KERNEL_VER" || true
else
    echo -e "  ${GREEN}[OK] binder_linux moduli mavjud.${NC}"
fi

# 2. binder_linux modulini parametrlar bilan yuklash
echo -e "\n${YELLOW}[2/4] binder_linux yadrogaga yuklanmoqda...${NC}"
modprobe binder_linux devices="binder,hwbinder,vndbinder" 2>/dev/null || true

# Avto-yuklashga qo'shish (/etc/modules-load.d/)
echo "binder_linux" > /etc/modules-load.d/redroid.conf
echo "options binder_linux devices=binder,hwbinder,vndbinder" > /etc/modprobe.d/redroid.conf

# 3. /dev/binderfs ni mount qilish
echo -e "\n${YELLOW}[3/4] /dev/binderfs ulanmoqda (mount)...${NC}"
mkdir -p /dev/binderfs
umount /dev/binderfs 2>/dev/null || true
mount -t binder binder /dev/binderfs 2>/dev/null || mount -t binder binderfs /dev/binderfs 2>/dev/null || true

# /etc/fstab ga qo'shish (qayta yuklanganda avtomatik ulanishi uchun)
if ! grep -qs '/dev/binderfs' /etc/fstab; then
    echo "none /dev/binderfs binder nofail 0 0" >> /etc/fstab
fi

# 4. Qurilma simlinklari va huquqlari
echo -e "\n${YELLOW}[4/4] Ruxsatlar berilmoqda va tekshirilmoqda...${NC}"
mkdir -p /dev
ln -sf /dev/binderfs/binder /dev/binder 2>/dev/null || true
ln -sf /dev/binderfs/hwbinder /dev/hwbinder 2>/dev/null || true
ln -sf /dev/binderfs/vndbinder /dev/vndbinder 2>/dev/null || true
chmod 666 /dev/binderfs/* /dev/binder /dev/hwbinder /dev/vndbinder /dev/kvm 2>/dev/null || true

echo ""
echo -e "${YELLOW}Natija tekshiruvi:${NC}"
ls -la /dev/binderfs
echo ""
ls -la /dev/binder

if [ -e /dev/binderfs/binder ] || [ -e /dev/binder ]; then
    echo -e "\n${GREEN}======================================================${NC}"
    echo -e "${GREEN}  MUVAFFAQIYAT! BINDER DRAYVERI TO'LIQ FAOL BO'LDI! 🎉${NC}"
    echo -e "${GREEN}======================================================${NC}"
    echo -e "Endi quyidagi buyruq bilan konteynerlarni qayta ishga tushiring:"
    echo -e "${CYAN}sudo bash restart_eco.sh 4${NC}\n"
else
    echo -e "\n${RED}[OGOHLANTIRISH] /dev/binderfs/binder yaratilmadi.${NC}"
    echo -e "Iltimos, kompyuterni bir marta qayta yuklang: sudo reboot"
fi
