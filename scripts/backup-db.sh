#!/bin/sh
# Sao lưu CSDL thành file nén, giữ lại BACKUP_KEEP_DAYS ngày gần nhất.
# - Có DIRECT_URL trong .env (Supabase): pg_dump qua mạng bằng image postgres:17 (khớp phiên bản server).
# - Không có: pg_dump từ container postgres cục bộ (--profile local-db).
# Chạy từ thư mục dự án trên máy chủ; đặt lịch bằng cron, vd 3 giờ sáng mỗi ngày:
#   0 3 * * * cd /srv/web_truyen && ./scripts/backup-db.sh >> backups/backup.log 2>&1
set -eu

DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-7}"
COMPOSE="docker compose -f docker-compose.prod.yml"

mkdir -p "$DIR"
FILE="$DIR/truyen-$(date +%Y%m%d-%H%M%S).sql.gz"

DIRECT_URL="$(grep -E '^DIRECT_URL=' .env 2>/dev/null | head -1 | cut -d= -f2- || true)"
if [ -n "$DIRECT_URL" ]; then
  # libpq (pg_dump) không hiểu tham số uselibpqcompat của node-postgres
  URL="$(printf '%s' "$DIRECT_URL" | sed -E 's/[?&]uselibpqcompat=[^&]*//; s/\?&/?/')"
  docker run --rm postgres:17-alpine pg_dump --no-owner --no-privileges --schema=public "$URL" | gzip > "$FILE"
else
  $COMPOSE exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$FILE"
fi

find "$DIR" -name 'truyen-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "$(date '+%F %T') Đã sao lưu: $FILE ($(du -h "$FILE" | cut -f1))"
