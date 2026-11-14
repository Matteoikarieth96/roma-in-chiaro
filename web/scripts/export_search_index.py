"""Scrive l'indice della ricerca (/cerca) per il sito Next.js.

Fa lo stesso passo di scripts/build.py (aggiungi_ricerca): legge data/snapshot/*.json e chiama
scripts/build_search.build_index. Non calcola né cambia numeri: l'indice contiene solo puntatori
ai record degli snapshot, come nel sito statico. Lanciato da scripts/prepare-data.mjs.

Uso: ../.venv/bin/python -I scripts/export_search_index.py generated/search-index.json
"""
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def main(out):
    data = {f.stem: json.loads(f.read_text()) for f in sorted((ROOT / "data/snapshot").glob("*.json"))}
    spec = importlib.util.spec_from_file_location("build_search", ROOT / "scripts/build_search.py")
    bs = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(bs)
    indice = bs.build_index(data, ROOT)
    Path(out).write_text(json.dumps(indice, ensure_ascii=False, separators=(",", ":")))
    print(f"indice ricerca: {len(indice['doc'])} documenti, {Path(out).stat().st_size // 1024} KB")


if __name__ == "__main__":
    main(sys.argv[1])
