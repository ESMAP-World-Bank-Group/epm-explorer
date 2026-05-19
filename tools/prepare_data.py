"""Convert epm-explorer data files to GeoJSON for MapLibre."""
import json
import math
import yaml
import shutil
from pathlib import Path

def _safe_mw(v):
    try:
        f = float(v or 0)
        return 0.0 if (math.isnan(f) or math.isinf(f)) else round(f, 1)
    except (TypeError, ValueError):
        return 0.0

SRC  = Path(__file__).resolve().parents[2] / "epm-explorer" / "data"
DST  = Path(__file__).resolve().parents[1] / "public" / "data"
DST.mkdir(parents=True, exist_ok=True)
(DST / "cache").mkdir(exist_ok=True)

# 1. regions.yaml → regions.json
with open(SRC / "regions.yaml", encoding="utf-8") as f:
    regions = yaml.safe_load(f)
with open(DST / "regions.json", "w", encoding="utf-8") as f:
    json.dump(regions, f)
print("✓ regions.json")

# 2. countries_110m.geojson (copy as-is)
shutil.copy(SRC / "countries_110m.geojson", DST / "countries_110m.geojson")
print("✓ countries_110m.geojson")

# 3. plants: {lat,lon,name,fuel,mw} → GeoJSON FeatureCollection
for src_path in (SRC / "cache").glob("region_plants_*.json"):
    region_id = src_path.stem.replace("region_plants_", "")
    plants = json.loads(src_path.read_text(encoding="utf-8"))
    geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "id": i,
                "geometry": {"type": "Point", "coordinates": [p["lon"], p["lat"]]},
                "properties": {
                    "name":    p.get("name") or "",
                    "fuel":    (p.get("fuel") or "unknown").split(";")[0].strip().lower(),
                    "mw":      _safe_mw(p.get("mw")),
                    "country": p.get("country") or "",
                },
            }
            for i, p in enumerate(plants)
            if p.get("lat") and p.get("lon")
        ],
    }
    out = DST / "cache" / f"region_plants_{region_id}.geojson"
    out.write_text(json.dumps(geojson), encoding="utf-8")
    print(f"✓ {out.name}  ({len(geojson['features'])} plants)")

# 4. lines: {v, lats, lons} → GeoJSON FeatureCollection
for src_path in (SRC / "cache").glob("region_lines_*.json"):
    region_id = src_path.stem.replace("region_lines_", "")
    data = json.loads(src_path.read_text(encoding="utf-8"))
    geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[lon, lat] for lon, lat in zip(seg["lons"], seg["lats"])],
                },
                "properties": {"v": seg["v"]},
            }
            for seg in data["segments"]
            if len(seg.get("lons", [])) >= 2
        ],
    }
    out = DST / "cache" / f"region_lines_{region_id}.geojson"
    out.write_text(json.dumps(geojson), encoding="utf-8")
    print(f"✓ {out.name}  ({len(geojson['features'])} segments)")

# 5. capacity summary (copy as-is — already clean JSON)
for src_path in (SRC / "cache").glob("region_capacity_*.json"):
    region_id = src_path.stem.replace("region_capacity_", "")
    dst = DST / "cache" / f"region_capacity_{region_id}.json"
    shutil.copy(src_path, dst)
    n = len(json.loads(dst.read_text(encoding="utf-8")).get("countries", {}))
    print(f"✓ region_capacity_{region_id}.json  ({n} countries)")

# 6. substations: [{lat,lon,name,v}] → GeoJSON FeatureCollection
for src_path in (SRC / "cache").glob("region_substations_*.json"):
    region_id = src_path.stem.replace("region_substations_", "")
    subs = json.loads(src_path.read_text(encoding="utf-8"))
    geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [s["lon"], s["lat"]]},
                "properties": {
                    "name": s.get("name") or "",
                    "v":    int(s.get("v") or 0),
                },
            }
            for s in subs
            if s.get("lat") and s.get("lon")
        ],
    }
    out = DST / "cache" / f"region_substations_{region_id}.geojson"
    out.write_text(json.dumps(geojson), encoding="utf-8")
    print(f"✓ {out.name}  ({len(geojson['features'])} substations)")

# 7. fleet age (copy as-is — already clean JSON)
for src_path in (SRC / "cache").glob("region_age_*.json"):
    region_id = src_path.stem.replace("region_age_", "")
    dst = DST / "cache" / f"region_age_{region_id}.json"
    shutil.copy(src_path, dst)
    print(f"✓ region_age_{region_id}.json")

print("\nAll done.")
