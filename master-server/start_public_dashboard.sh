#!/bin/bash
# ==============================================================================
# Mac Master Dashboard - Klientga Ko'rsatish Uchun Public HTTPS Havola Ochish
# ==============================================================================

echo "======================================================"
echo "  Mac Master Dashboard - Public HTTPS Havola          "
echo "======================================================"
echo "Havola ochilmoqda, iltimos 3 soniya kuting..."
echo ""

cloudflared tunnel --url http://localhost:3000
