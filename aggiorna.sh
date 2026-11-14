#!/bin/sh
# Rifà gli snapshot e ricostruisce il sito.
# Uso: ./aggiorna.sh            (tutto: riscarica le fonti ignorando la cache, RIFRESCA=1, poi ETL e sito.
#                                ANAC riscarica i delta e solo gli zip 2025 cambiati sul server)
#      ./aggiorna.sh cache      (ETL dai file già in data/raw/, scarica solo quelli che mancano, poi il sito)
#      ./aggiorna.sh sito       (solo il sito, dagli snapshot già presenti)
# Ogni ETL si ferma con errore se un controllo fallisce, e allora lo script si ferma (set -e).
set -eu
cd "$(dirname "$0")"
[ -x .venv/bin/python ] || { python3 -m venv .venv && .venv/bin/pip install -q -r requirements.txt; }
PY=".venv/bin/python -I"
MODO="${1:-tutto}"
case "$MODO" in
  tutto) RIFRESCA=1 ;;
  cache|sito) RIFRESCA=0 ;;
  *) echo "uso: $0 [cache|sito]" >&2; exit 2 ;;
esac
export RIFRESCA
if [ "$MODO" != "sito" ]; then
  $PY scripts/build_map.py
  $PY scripts/etl_annuario.py
  $PY scripts/etl_bilancio.py
  $PY scripts/etl_nidi.py
  $PY scripts/etl_politica.py
  $PY scripts/etl_progetti.py
  $PY scripts/etl_appalti.py
fi
$PY scripts/build.py
