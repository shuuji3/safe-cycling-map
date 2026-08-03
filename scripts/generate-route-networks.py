#!/usr/bin/env python3
"""Preprocess Kanto PBF -> GeoJSON of route=bicycle member ways (network icn/ncn/rcn/lcn).

Planetiler custommap cannot resolve route relations onto member ways, so we do it
here with pyosmium and feed the result as a geojson source.
"""
import argparse, json, osmium

NETWORKS = {"icn", "ncn", "rcn", "lcn"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pbf")
    ap.add_argument("out")
    args = ap.parse_args()

    class RelCollect(osmium.SimpleHandler):
        def __init__(self):
            super().__init__()
            self.way2net = {}  # way id -> set of networks

        def relation(self, r):
            t = dict(r.tags)
            if t.get("type") == "route" and t.get("route") == "bicycle":
                net = t.get("network")
                if net not in NETWORKS:
                    return
                for m in r.members:
                    if m.type == "w":
                        self.way2net.setdefault(m.ref, set()).add(net)

    rc = RelCollect()
    rc.apply_file(args.pbf, locations=False)
    print(f"route-bicycle member ways: {len(rc.way2net)}", file=__import__("sys").stderr)

    class WayGen(osmium.SimpleHandler):
        def __init__(self):
            super().__init__()
            self.features = []

        def way(self, w):
            nets = rc.way2net.get(w.id)
            if not nets:
                return
            coords = [[n.lon, n.lat] for n in w.nodes]
            if len(coords) < 2:
                return
            for net in sorted(nets):
                self.features.append({
                    "type": "Feature",
                    "properties": {"osm_id": w.id, "network": net},
                    "geometry": {"type": "LineString", "coordinates": coords},
                })

    wg = WayGen()
    wg.apply_file(args.pbf, locations=True)

    fc = {"type": "FeatureCollection", "features": wg.features}
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(fc, f)
    counts = {}
    for feat in fc["features"]:
        n = feat["properties"]["network"]
        counts[n] = counts.get(n, 0) + 1
    print("feature counts by network:", counts, file=__import__("sys").stderr)
    print(f"wrote {args.out}")


if __name__ == "__main__":
    main()
