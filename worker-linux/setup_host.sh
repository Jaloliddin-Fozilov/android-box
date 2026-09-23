#!/bin/bash
# ==============================================================================
# Android Box - Linux Worker Host Setup Script
# Qollab-quvvatlaydi: Ubuntu 22.04 LTS / 24.04 LTS, Debian 12
# Vazifasi: Docker, KVM, BinderFS va ReDroid uchun kerakli barcha drayverlarni o'rnatish
# ==============================================================================

set -e

# Ranglar
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}=====================================================${NC}"
echo -e "${BLUE}       Android Box - Linux Host Setup Script         ${NC}"
echo -e "${BLUE}=====================================================${NC}"

# 1. Root tekshiruvi
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[XATO] Iltimos, ushbu skriptni sudo bilan ishga tushiring: sudo bash $0${NC}"
  exit 1
fi

REAL_USER=${SUDO_USER:-$USER}

echo -e "\n${YELLOW}[1/7] Tizim paketlarini yangilash va kerakli utilitalarni o'rnatish...${NC}"
apt-get update
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    jq \
    adb \
    iptables \
    iproute2 \
    kmod \
    pciutils \
    qemu-kvm \
    libvirt-daemon-system \
    libvirt-clients \
    bridge-utils

# 2. KVM huquqlarini berish
echo -e "\n${YELLOW}[2/7] KVM virtualizatsiyasini sozlash...${NC}"
if [ -e /dev/kvm ]; then
    echo -e "${GREEN}[OK] /dev/kvm mavjud.${NC}"
    usermod -aG kvm "$REAL_USER"
    chmod 666 /dev/kvm
else
    echo -e "${YELLOW}[OGOHLANTIRISH] /dev/kvm topilmadi! BIOS/UEFI sozlamalarida CPU Virtualization (VT-x / AMD-V) yoqilganligini tekshiring.${NC}"
fi

# 3. Android BinderFS sozlash
echo -e "\n${YELLOW}[3/7] Android BinderFS drayverini yuklash va sozlash...${NC}"

# Binderfs papkasi
mkdir -p /dev/binderfs

# Agar avval ulanmagan bo'lsa, ulaymiz
if ! mountpoint -q /dev/binderfs; then
    mount -t binder binder /dev/binderfs || true
fi

# Fstab ga qo'shish (qayta yuklanganda avtomatik ulanishi uchun)
if ! grep -qs '/dev/binderfs' /etc/fstab; then
    echo "none /dev/binderfs binder nofail 0 0" >> /etc/fstab
    echo -e "${GREEN}[OK] /dev/binderfs /etc/fstab fayliga qo'shildi.${NC}"
fi

# Simlinklarni tekshirish va yaratish
mkdir -p /dev
ln -sf /dev/binderfs/binder /dev/binder || true
ln -sf /dev/binderfs/hwbinder /dev/hwbinder || true
ln -sf /dev/binderfs/vndbinder /dev/vndbinder || true
chmod 666 /dev/binderfs/* /dev/binder /dev/hwbinder /dev/vndbinder 2>/dev/null || true

echo -e "${GREEN}[OK] BinderFS drayveri muvaffaqiyatli sozlandi.${NC}"

# 4. Docker Engine o'rnatish
echo -e "\n${YELLOW}[4/7] Docker Engine va Docker Compose tekshirilmoqda...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "Docker o'rnatilmoqda..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    usermod -aG docker "$REAL_USER"
    systemctl enable docker
    systemctl start docker
    echo -e "${GREEN}[OK] Docker o'rnatildi.${NC}"
else
    echo -e "${GREEN}[OK] Docker allaqachon o'rnatilgan.${NC}"
fi

# 5. GPU Passthrough tekshiruvi (NVIDIA / Intel / AMD)
echo -e "\n${YELLOW}[5/7] Grafik protsessor (GPU) drayverlarini tekshirish...${NC}"
if lspci | grep -i nvidia > /dev/null; then
    echo -e "${GREEN}[NVIDIA] NVIDIA videokarta aniqlandi.${NC}"
    if ! command -v nvidia-container-toolkit &> /dev/null; then
        echo "NVIDIA Container Toolkit o'rnatilmoqda..."
        curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg \
        && curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
          sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
          tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
        apt-get update
        apt-get install -y nvidia-container-toolkit
        nvidia-ctk runtime configure --runtime=docker
        systemctl restart docker
        echo -e "${GREEN}[OK] NVIDIA Container Toolkit o'rnatildi va Docker qayta ishga tushirildi.${NC}"
    else
        echo -e "${GREEN}[OK] NVIDIA Container Toolkit allaqachon mavjud.${NC}"
    fi
else
    echo -e "${BLUE}[INFO] Maxsus NVIDIA GPU topilmadi. Standart Mesa/DRI yoki dasturiy render (SwiftShader) ishlatiladi.${NC}"
    if [ -d /dev/dri ]; then
        chmod 666 /dev/dri/* 2>/dev/null || true
        echo -e "${GREEN}[OK] /dev/dri huquqlari berildi.${NC}"
    fi
fi

# 6. Tarmoq forwarding (IP forwarding) yoqish
echo -e "\n${YELLOW}[6/7] IP Forwarding va tarmoq sozlamalari...${NC}"
sysctl -w net.ipv4.ip_forward=1 > /dev/null
if ! grep -qs 'net.ipv4.ip_forward=1' /etc/sysctl.conf; then
    echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
fi

# 7. ReDroid bazaviy Docker obrazini yuklash
echo -e "\n${YELLOW}[7/7] ReDroid (Android 11/12 ARM-NDK bilan) obrazini yuklash...${NC}"
echo -e "Bu jarayon bir necha daqiqa vaqt olishi mumkin (taxminan 2-3 GB)..."
docker pull redroid/redroid:11.0.0-latest || true

echo -e "\n${GREEN}=====================================================${NC}"
echo -e "${GREEN}  Tabriklaymiz! Linux Worker muvaffaqiyatli sozlandi!  ${NC}"
echo -e "${GREEN}=====================================================${NC}"
echo -e "Keyingi qadam: ${BLUE}./deploy_instances.sh --count 8${NC} buyrug'i orqali Android instansiyalarini ishga tushiring."
