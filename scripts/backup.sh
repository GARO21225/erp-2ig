#!/bin/bash
# ================================================================
# ERP 2IG — Script de sauvegarde PostgreSQL
# Usage : ./backup.sh [daily|weekly|monthly]
# Prérequis : DATABASE_URL dans l'environnement, pg_dump installé
# ================================================================
set -euo pipefail

TYPE="${1:-daily}"
TIMESTAMP=$(date '+%Y-%m-%d_%H-%M-%S')
BACKUP_DIR="${BACKUP_DIR:-/tmp/erp-2ig-backups}"
BACKUP_FILE="${BACKUP_DIR}/${TYPE}/postgres-${TYPE}-${TIMESTAMP}.sql.gz"
LOG_FILE="${BACKUP_DIR}/backup.log"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"; }
ok()  { log "${GREEN}✅ $1${NC}"; }
err() { log "${RED}❌ $1${NC}"; exit 1; }
warn(){ log "${YELLOW}⚠️  $1${NC}"; }

# Créer les répertoires
mkdir -p "${BACKUP_DIR}/${TYPE}" "${BACKUP_DIR}/tmp"

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "ERP 2IG — Sauvegarde PostgreSQL (${TYPE})"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Vérifier DATABASE_URL
if [ -z "${DATABASE_URL:-}" ]; then
  err "DATABASE_URL non définie. Sourcer le fichier .env : source /chemin/.env"
fi

# Parser DATABASE_URL
DB_USER=$(echo "$DATABASE_URL" | sed 's/.*:\/\/\([^:]*\):.*/\1/')
DB_PASS=$(echo "$DATABASE_URL" | sed 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/')
DB_HOST=$(echo "$DATABASE_URL" | sed 's/.*@\([^:]*\):.*/\1/')
DB_PORT=$(echo "$DATABASE_URL" | sed 's/.*:\([0-9]*\)\/.*/\1/')
DB_NAME=$(echo "$DATABASE_URL" | sed 's/.*\/\([^?]*\).*/\1/')

log "Base : ${DB_NAME} @ ${DB_HOST}:${DB_PORT}"

# Sauvegarde
TMP_FILE="${BACKUP_DIR}/tmp/backup_${TIMESTAMP}.sql.gz"
export PGPASSWORD="${DB_PASS}"

log "Démarrage pg_dump..."
START_TIME=$(date +%s)

if pg_dump \
  --host="${DB_HOST}" \
  --port="${DB_PORT}" \
  --username="${DB_USER}" \
  --dbname="${DB_NAME}" \
  --format=custom \
  --compress=9 \
  --no-password \
  2>>"${LOG_FILE}" | gzip -9 > "${TMP_FILE}"; then
  
  END_TIME=$(date +%s)
  DURATION=$((END_TIME - START_TIME))
  SIZE=$(du -sh "${TMP_FILE}" | cut -f1)
  
  # Vérification intégrité gzip
  if gzip -t "${TMP_FILE}" 2>/dev/null; then
    mv "${TMP_FILE}" "${BACKUP_FILE}"
    ok "Sauvegarde OK : ${BACKUP_FILE} (${SIZE}, ${DURATION}s)"
  else
    err "Sauvegarde corrompue — gzip test échoué"
  fi
else
  err "pg_dump échoué — voir ${LOG_FILE}"
fi

# Upload S3 si configuré
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  log "Upload vers S3 : s3://${BACKUP_S3_BUCKET}/backups/${TYPE}/"
  if aws s3 cp "${BACKUP_FILE}" "s3://${BACKUP_S3_BUCKET}/backups/${TYPE}/$(basename "${BACKUP_FILE}")" \
    --storage-class STANDARD_IA \
    --quiet 2>>"${LOG_FILE}"; then
    ok "Upload S3 OK"
  else
    warn "Échec upload S3 — backup local conservé"
  fi
fi

# Upload FTP si configuré
if [ -n "${BACKUP_FTP_HOST:-}" ]; then
  log "Upload vers FTP : ${BACKUP_FTP_HOST}"
  if curl -s --ftp-create-dirs \
    -T "${BACKUP_FILE}" \
    "ftp://${BACKUP_FTP_HOST}/${BACKUP_FTP_DIR:-/backups/erp-2ig}/${TYPE}/$(basename "${BACKUP_FILE}")" \
    --user "${BACKUP_FTP_USER}:${BACKUP_FTP_PASS}" 2>>"${LOG_FILE}"; then
    ok "Upload FTP OK"
  else
    warn "Échec upload FTP — backup local conservé"
  fi
fi

# Rotation — supprimer les anciens backups
RETENTION=7
case "$TYPE" in
  weekly)  RETENTION=4  ;;
  monthly) RETENTION=12 ;;
esac

log "Rotation : conservation des ${RETENTION} derniers backups (${TYPE})"
ls -t "${BACKUP_DIR}/${TYPE}"/postgres-${TYPE}-*.gz 2>/dev/null | tail -n +$((RETENTION+1)) | while read f; do
  rm -f "$f"
  warn "Supprimé : $f"
done

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ok "Sauvegarde ${TYPE} terminée avec succès"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
