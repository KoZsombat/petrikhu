#!/bin/sh
# Nightly PostgreSQL backup (the media lives in the database too, so this is a backup of the whole site).
# Runs inside the `backup` service of docker-compose.yml: one custom-format dump per day into /backups,
# keeping the last PNW_BACKUP_KEEP_DAYS days (default 14). Restore: see README.md "Backups".
set -eu

DIR="${PNW_BACKUP_TARGET:-/backups}"
KEEP_DAYS="${PNW_BACKUP_KEEP_DAYS:-14}"
AT="${PNW_BACKUP_AT:-03:30}"

dump() {
  file="$DIR/petrik-$(date -u +%Y%m%d-%H%M%S).dump"
  # Write to a temporary name first, so a half-written dump is never mistaken for a good one.
  pg_dump --format=custom --compress=6 --file="$file.part" && mv "$file.part" "$file"
  echo "[backup] $(date -u +%FT%TZ) wrote $file ($(du -h "$file" | cut -f1))"
  find "$DIR" -name 'petrik-*.dump' -mtime +"$KEEP_DAYS" -print -delete
  find "$DIR" -name '*.part' -mmin +600 -delete
}

if [ "${1:-}" = "once" ]; then
  dump
  exit 0
fi

echo "[backup] daily at $AT UTC, keeping $KEEP_DAYS days"
while true; do
  now=$(date -u +%s)
  next=$(date -u -d "$(date -u +%F) $AT" +%s)
  [ "$next" -le "$now" ] && next=$((next + 86400))
  sleep $((next - now))
  dump || echo "[backup] $(date -u +%FT%TZ) FAILED" >&2
done
