#!/usr/bin/env bash
set -euo pipefail

PAYLOAD_DIR=".enterprise-frontend-payload"
B64="/tmp/asteryon-missing.b64"
ARCHIVE="/tmp/asteryon-missing.tar.gz"
STAGE="/tmp/asteryon-frontend-import"
EXPECTED_B64_SHA="f92937aa5c19396427d017bea8eb02d8b07b56b50c2f188bb9d2d1ec2e56995e"
EXPECTED_TAR_SHA="429db05362080a5862bc3c48130e1ddf22b7ac979619e669a6e581667bf2aaa7"
EXPECTED_FILES=79

cat "$PAYLOAD_DIR"/part-* > "$B64"
printf '%s  %s\n' "$EXPECTED_B64_SHA" "$B64" | sha256sum -c -
base64 --decode "$B64" > "$ARCHIVE"
printf '%s  %s\n' "$EXPECTED_TAR_SHA" "$ARCHIVE" | sha256sum -c -

rm -rf "$STAGE"
mkdir -p "$STAGE"
tar -xzf "$ARCHIVE" -C "$STAGE"

mapfile -t FILES < <(find "$STAGE/frontend/src" -type f | sort)
if [[ "${#FILES[@]}" -ne "$EXPECTED_FILES" ]]; then
  echo "ERRO: esperados $EXPECTED_FILES arquivos, encontrados ${#FILES[@]}" >&2
  exit 1
fi

for source in "${FILES[@]}"; do
  relative="${source#${STAGE}/}"
  if [[ -e "$relative" ]]; then
    echo "ERRO: importação tentaria sobrescrever arquivo protegido: $relative" >&2
    exit 1
  fi
done

if grep -RInE 'VITE_SUPABASE|/rest/v1|/storage/v1|/auth/v1|D1Database|R2Bucket|\.prepare\(' "$STAGE/frontend/src"; then
  echo 'ERRO: fonte recuperada contém acesso direto/legado proibido.' >&2
  exit 1
fi

while IFS= read -r source; do
  relative="${source#${STAGE}/}"
  mkdir -p "$(dirname "$relative")"
  cp "$source" "$relative"
done < <(printf '%s\n' "${FILES[@]}")

COUNT=$(find frontend/src -type f | wc -l | tr -d ' ')
if [[ "$COUNT" -ne 89 ]]; then
  echo "ERRO: fonte final deveria conter 89 arquivos, contém $COUNT" >&2
  exit 1
fi

node scripts/qa-enterprise-frontend-source.mjs

git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git add frontend/src
if git diff --cached --quiet; then
  echo 'Nenhum arquivo novo para importar.'
  exit 0
fi
git commit -m 'feat(frontend): completar fonte React recuperada [source-import]'
git push origin HEAD:enterprise/6-equipes-consolidacao
