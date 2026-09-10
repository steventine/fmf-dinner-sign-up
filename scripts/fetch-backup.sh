#!/usr/bin/env bash
#
# Download the most recent nightly backup from S3, decrypt it if it is encrypted,
# and unpack it into a local directory.
#
#   BACKUP_S3_BUCKET=my-bucket ./scripts/fetch-backup.sh [destDir]
#
# Pass a backup filename as BACKUP_FILE=... to fetch a specific one instead of
# the latest. Restore instructions: README.md, "Database backups".
set -euo pipefail

BUCKET="${BACKUP_S3_BUCKET:?set BACKUP_S3_BUCKET to the bucket holding the backups}"
PREFIX="${BACKUP_S3_PREFIX:-fmf-dinner-signup}"
DEST="${1:-./restore}"

if [ -n "${BACKUP_FILE:-}" ]; then
  file="$BACKUP_FILE"
else
  # Filenames embed a UTC ISO timestamp, so lexical order is chronological order.
  file="$(aws s3 ls "s3://$BUCKET/$PREFIX/" \
    | awk '{print $4}' \
    | grep -E '^fmf-dinner-signup-.*\.tar\.gz(\.gpg)?$' \
    | sort \
    | tail -1)"
  if [ -z "$file" ]; then
    echo "No backups found under s3://$BUCKET/$PREFIX/" >&2
    exit 1
  fi
fi

mkdir -p "$DEST"
echo "Downloading $file ..."
aws s3 cp "s3://$BUCKET/$PREFIX/$file" "$DEST/$file"

archive="$DEST/$file"
if [[ "$file" == *.gpg ]]; then
  echo "Decrypting (enter the BACKUP_GPG_PASSPHRASE value) ..."
  gpg --output "${archive%.gpg}" --decrypt "$archive"
  archive="${archive%.gpg}"
fi

extracted="$DEST/$(basename "$archive" .tar.gz)"
mkdir -p "$extracted"
tar -xzf "$archive" -C "$extracted"

echo
cat "$extracted/MANIFEST.TXT"
echo
echo "Unpacked to $extracted"
echo "Restore with: psql \"\$NEW_DB_URL\" -v ON_ERROR_STOP=1 -f $extracted/public-schema-and-data.sql"
