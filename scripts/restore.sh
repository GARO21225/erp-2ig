#!/bin/bash
# ================================================================
# ERP 2IG — Script de restauration PostgreSQL
# Usage : ./restore.sh <fichier_backup.sql.gz> [--force]
# ================================================================
set -euo pipefail

BACKUP_FILE="${1:-}"
FORCE="${2:-}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log() { echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1"; }
ok()  { log "${GREEN}✅ $1${NC}"; }
err() { log "${RED}❌ $1${NC}"; exit 1; }
warn(){ log "${YELLOW}⚠️  $1${NC}"; }
info(){ log "${BLUE}ℹ️  $1${NC}"; }

[ -z "$BACKUP_FILE" ] && err "Usage: ./restore.sh <fichier.sql.gz> [--force]"
[ ! -f "$BACKUP_FILE" ] && err "Fichier introuvable : $BACKUP_FILE"

if [ -z "${DATABASE_URL:-}" ]; then
  err "DATABASE_URL non définie"
fi

DB_USER=$(echo "$DATABASE_URL" | sed 's/.*:\/\/\([^:]*\):.*/\1/')
DB_PASS=$(echo "$DATABASE_URL" | sed 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/')
DB_HOST=$(echo "$DATABASE_URL" | sed 's/.*@\([^:]*\):.*/\1/')
DB_PORT=$(echo "$DATABASE_URL" | sed 's/.*:\([0-9]*\)\/.*/\1/')
DB_NAME=$(echo "$DATABASE_URL" | sed 's/.*\/\([^?]*\).*/\1/')

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "ERP 2IG — RESTAURATION POSTGRESQL"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
warn "⚠ ATTENTION : Cette opération va REMPLACER toutes les données de ${DB_NAME}"
info "Fichier source : ${BACKUP_FILE}"
info "Base cible    : ${DB_NAME} @ ${DB_HOST}:${DB_PORT}"

if [ "$FORCE" != "--force" ]; then
  echo ""
  echo -n "Confirmer la restauration ? (tapez 'RESTAURER' pour confirmer) : "
  read CONFIRMATION
  [ "$CONFIRMATION" != "RESTAURER" ] && err "Restauration annulée"
fi

export PGPASSWORD="${DB_PASS}"

log "Vérification intégrité du backup..."
if gzip -t "${BACKUP_FILE}" 2>/dev/null; then
  ok "Intégrité gzip OK"
else
  err "Fichier backup corrompu — vérifier l'intégrité"
fi

log "Décompression en cours..."
DECOMPRESSED=$(mktemp /tmp/restore_XXXXXX.sql)
gunzip -c "${BACKUP_FILE}" > "${DECOMPRESSED}"
ok "Décompression OK ($(du -sh "${DECOMPRESSED}" | cut -f1))"

log "Restauration PostgreSQL..."
START=$(date +%s)
if pg_restore \
  --host="${DB_HOST}" --port="${DB_PORT}" \
  --username="${DB_USER}" --dbname="${DB_NAME}" \
  --no-password --clean --if-exists \
  "${DECOMPRESSED}" 2>&1 | grep -v "^pg_restore:" | head -20; then
  ok "Restauration OK ($(( $(date +%s) - START ))s)"
else
  # pg_restore retourne non-0 même pour des warnings normaux
  warn "pg_restore terminé avec avertissements — vérifier les tables"
fi

rm -f "${DECOMPRESSED}"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ok "Restauration terminée. Redémarrer le backend."
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
