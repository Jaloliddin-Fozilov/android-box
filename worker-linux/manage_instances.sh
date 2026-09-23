#!/bin/bash
# ==============================================================================
# Android Box - Instance Manager Script
# Vazifasi: Konteynerlarni to'xtatish, qayta ishga tushirish, holatini tekshirish
# Foydalanish: ./manage_instances.sh [status|start|stop|restart|clean|logs]
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.generated.yml"

ACTION="${1:-status}"

case "$ACTION" in
    status)
        echo "================================================================="
        echo "            Android Box - Instansiyalar Holati                   "
        echo "================================================================="
        if [ -f "$COMPOSE_FILE" ]; then
            docker compose -f "$COMPOSE_FILE" ps
            echo ""
            echo "--- Resurs iste'moli (RAM / CPU) ---"
            docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" | grep "android_box" || echo "Faol konteynerlar yo'q."
        else
            echo "docker-compose.generated.yml fayli topilmadi. Hali instansiyalar ko'tarilmagan."
        fi
        ;;

    start)
        echo "Barcha instansiyalar ishga tushirilmoqda..."
        docker compose -f "$COMPOSE_FILE" start
        ;;

    stop)
        echo "Barcha instansiyalar to'xtatilmoqda..."
        docker compose -f "$COMPOSE_FILE" stop
        ;;

    restart)
        echo "Barcha instansiyalar qayta ishga tushirilmoqda..."
        docker compose -f "$COMPOSE_FILE" restart
        ;;

    clean)
        echo "OGOHLANTIRISH: Barcha Android konteynerlari o'chiriladi."
        read -p "Rostdan ham o'chirmoqchimisiz? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker compose -f "$COMPOSE_FILE" down
            echo "[OK] Konteynerlar tozalandi."
        fi
        ;;

    logs)
        INSTANCE_NAME="${2:-android_box_1}"
        echo "Loglar ko'rsatilmoqda: $INSTANCE_NAME..."
        docker logs -f "$INSTANCE_NAME"
        ;;

    *)
        echo "Noto'g'ri buyruq: $ACTION"
        echo "Foydalanish: $0 {status|start|stop|restart|clean|logs <nomi>}"
        exit 1
        ;;
esac
