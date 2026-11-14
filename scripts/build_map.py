"""Proietta i confini dei 15 municipi in percorsi SVG pronti per il sito.

Ingresso: data/raw/municipi-roma.geojson (OpenStreetMap, admin_level=9, ODbL).
Uscita:   data/snapshot/mappa.json con viewBox, un path e un punto etichetta per municipio.

Proiezione equirettangolare con correzione cos(lat): per un'area grande come Roma
l'errore rispetto a una UTM è trascurabile a schermo.
"""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data/raw/municipi-roma.geojson"
OUT = ROOT / "data/snapshot/mappa.json"
WIDTH = 800
PAD = 10


def rings(geom):
    if geom["type"] == "Polygon":
        return [geom["coordinates"]]
    return geom["coordinates"]


def ring_area_centroid(pts):
    a = cx = cy = 0.0
    for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]):
        c = x0 * y1 - x1 * y0
        a += c
        cx += (x0 + x1) * c
        cy += (y0 + y1) * c
    a /= 2
    if a == 0:
        return 0, pts[0]
    return abs(a), (cx / (6 * a), cy / (6 * a))


def main():
    gj = json.loads(SRC.read_text())
    feats = gj["features"]
    lats = [pt[1] for f in feats for poly in rings(f["geometry"]) for r in poly for pt in r]
    lons = [pt[0] for f in feats for poly in rings(f["geometry"]) for r in poly for pt in r]
    k = math.cos(math.radians(sum(lats) / len(lats)))
    minx, maxx = min(lons) * k, max(lons) * k
    miny, maxy = min(lats), max(lats)
    scale = (WIDTH - 2 * PAD) / (maxx - minx)
    height = round((maxy - miny) * scale + 2 * PAD)

    def proj(lon, lat):
        return (round((lon * k - minx) * scale + PAD, 1), round((maxy - lat) * scale + PAD, 1))

    out = []
    for f in sorted(feats, key=lambda f: f["properties"]["municipio"]):
        p = f["properties"]
        parts, best = [], (0, None)
        for poly in rings(f["geometry"]):
            for i, r in enumerate(poly):
                pts = [proj(*pt) for pt in r]
                parts.append("M" + "L".join(f"{x},{y}" for x, y in pts) + "Z")
                if i == 0:
                    area, c = ring_area_centroid(pts)
                    if area > best[0]:
                        best = (area, c)
        cx, cy = best[1]
        out.append({
            "municipio": p["municipio"],
            "romano": p["romano"],
            "path": "".join(parts),
            "label": [round(cx, 1), round(cy, 1)],
        })
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "viewBox": f"0 0 {WIDTH} {height}",
        "fonte": "OpenStreetMap, confini amministrativi admin_level=9 (ODbL 1.0, © OpenStreetMap contributors)",
        "municipi": out,
    }, ensure_ascii=False))
    print(f"{len(out)} municipi, viewBox 0 0 {WIDTH} {height}, {OUT.stat().st_size} byte")


if __name__ == "__main__":
    main()
