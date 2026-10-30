#!/bin/sh
# Sao lưu Postgres thành file nén, giữ lại BACKUP_KEEP_DAYS ngày gần nhất.
# Chạy từ thư mục dự án trên máy chủ; đặt lịch bằng cron, vd 3 giờ sáng mỗi ngày:
#   0 3 * * * cd /srv/web_truyen && ./scripts/backup-db.sh >> backups/backup.log 2>&1
set -eu

DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-7}"
COMPOSE="docker compose -f docker-compose.prod.yml"

mkdir -p "$DIR"
FILE="$DIR/truyen-$(date +%Y%m%d-%H%M%S).sql.gz"
$COMPOSE exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$FILE"
find "$DIR" -name 'truyen-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "$(date '+%F %T') Đã sao lưu: $FILE ($(du -h "$FILE" | cut -f1))"
