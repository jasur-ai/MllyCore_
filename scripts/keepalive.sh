#!/bin/bash
# MllyCore Keep-Alive — router har 4 soatda uzilishini oldini oladi
# Router: http://192.168.88.1
# Har 30 soniyada ping + HTTP so'rov yuborib, NAT sessiyasini jonli ushlab turadi

LOGFILE="$HOME/.mllycore_keepalive.log"
PIDFILE="/tmp/mllycore_keepalive.pid"
ROUTER_IP="192.168.88.1"
PUBLIC_DNS="8.8.8.8"
INTERVAL=30   # har 30 soniya

# Ranglar
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
  echo -e "$msg"
  echo "$msg" >> "$LOGFILE"
}

cleanup() {
  log "${YELLOW}Keep-alive to'xtatilmoqda...${NC}"
  rm -f "$PIDFILE"
  exit 0
}

trap cleanup SIGINT SIGTERM

show_status() {
  if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
    echo -e "${GREEN}✅ Keep-alive ishlamoqda (PID: $(cat "$PIDFILE"))${NC}"
    echo "   Router: $ROUTER_IP"
    echo "   Interval: $INTERVAL soniya"
    echo "   Log: $LOGFILE"
  else
    echo -e "${RED}❌ Keep-alive ishlamayapti${NC}"
  fi
}

start_keepalive() {
  if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
    echo -e "${YELLOW}⚠️ Keep-alive allaqachon ishlamoqda (PID: $(cat "$PIDFILE"))${NC}"
    return
  fi

  log "${GREEN}🔄 Keep-alive boshlandi (interval: ${INTERVAL}s)${NC}"
  log "   Router: $ROUTER_IP"
  echo $$ > "$PIDFILE"

  local fail_count=0
  while true; do
    # 1. Routerni ping qilish
    if ping -c 1 -W 2 "$ROUTER_IP" >/dev/null 2>&1; then
      fail_count=0
    else
      fail_count=$((fail_count + 1))
      log "${RED}❌ Router ($ROUTER_IP) ga ping ketmadi! ($fail_count marta)${NC}"
    fi

    # 2. Har 2 daqiqada HTTP so'rov yuborish (NAT sessionni jonli ushlab turadi)
    if [ $((SECONDS % 120)) -lt 30 ]; then
      curl -s -o /dev/null --connect-timeout 3 "http://$ROUTER_IP/" >/dev/null 2>&1 &
    fi

    # 3. Agar 3 marta ketma-ket ping ketmasa, public DNS ga ping tashlash
    if [ $fail_count -ge 3 ]; then
      if ping -c 1 -W 2 "$PUBLIC_DNS" >/dev/null 2>&1; then
        log "${YELLOW}⚠️ Router ping ketmadi, lekin internet ishlayapti ($PUBLIC_DNS)${NC}"
        fail_count=0
      else
        log "${RED}🔴 Ham router, ham internet uzilgan! ($fail_count marta)${NC}"
      fi
    fi

    sleep "$INTERVAL"
  done
}

stop_keepalive() {
  if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
    kill "$(cat "$PIDFILE")" 2>/dev/null
    rm -f "$PIDFILE"
    log "${GREEN}✅ Keep-alive to'xtatildi${NC}"
  else
    echo -e "${RED}❌ Keep-alive ishlamayapti${NC}"
  fi
}

# ─── CLI ───
case "${1:-start}" in
  start)
    start_keepalive
    ;;
  stop)
    stop_keepalive
    ;;
  restart)
    stop_keepalive
    sleep 1
    start_keepalive
    ;;
  status)
    show_status
    ;;
  logs)
    tail -f "$LOGFILE" 2>/dev/null || echo "Log topilmadi: $LOGFILE"
    ;;
  install)
    echo -e "${YELLOW}⚙️ Systemd servis o'rnatilmoqda...${NC}"
    SCRIPT_PATH="$(realpath "$0")"
    SERVICE_CONTENT="[Unit]
Description=MllyCore Keep-Alive — prevent router idle disconnect
After=network.target

[Service]
ExecStart=$SCRIPT_PATH start
ExecStop=$SCRIPT_PATH stop
Type=forking
PIDFile=$PIDFILE
Restart=always
RestartSec=10
User=$(whoami)

[Install]
WantedBy=default.target"

    echo "$SERVICE_CONTENT" | sudo tee /etc/systemd/system/mllycore-keepalive.service > /dev/null
    sudo systemctl daemon-reload
    sudo systemctl enable mllycore-keepalive
    sudo systemctl start mllycore-keepalive
    echo -e "${GREEN}✅ Servis o'rnatildi va ishga tushdi!${NC}"
    echo "   Tekshirish: sudo systemctl status mllycore-keepalive"
    ;;
  *)
    echo "MllyCore Keep-Alive — Router uzilishining oldini olish"
    echo ""
    echo "Ishlatish:"
    echo "  $0 start     — Ishga tushirish"
    echo "  $0 stop      — To'xtatish"
    echo "  $0 restart   — Qayta ishga tushirish"
    echo "  $0 status    — Holatni tekshirish"
    echo "  $0 logs      — Loglarni kuzatish"
    echo "  $0 install   — Systemd servis sifatida o'rnatish (avtomatik ishga tushadi)"
    ;;
esac
