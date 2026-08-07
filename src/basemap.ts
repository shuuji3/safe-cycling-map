import maplibregl from "maplibre-gl";

export type Basemap = "map" | "aerial";

// The basemap vector source inside the Protomaps style document.
export const PM_SOURCE = "protomaps";

export const GSI_SOURCE = "gsi-seamlessphoto";
export const GSI_LAYER = "gsi-seamlessphoto";
export const GSI_URL =
  "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg";

// Required 国土地理院 (GSI) citation for シームレス空中写真, attached to the
// raster source so MapLibre's attribution control shows it when aerial is on.
// The "加工" wording is required because we overlay Protomaps labels/POIs on top.
export const GSI_ATTRIBUTION = [
  "写真は国土地理院(https://maps.gsi.go.jp/development/ichiran.html)の地理院タイル（シームレス空中写真）を加工して作成",
  "データソース：Landsat8画像（GSI,TSIC,GEO Grid/AIST）, Landsat8画像（courtesy of the U.S. Geological Survey）, 海底地形（GEBCO）",
  "GRUS画像（© Axelspace）",
].join(" ");
// Symbol layers omitted from the aerial hybrid (house numbers, road-arrow icons).
const HIDE_IF_SYMBOL = new Set(["address_label", "roads_oneway"]);
// Keep the lines (roads/water/rail/boundaries) but semi-transparent so the
// satellite photo still reads through. Main roads (highway/major) keep a stronger
// presence; minor/sub roads, water, rail and boundaries are faded more so the
// photo isn't overpowered by pale line work.
const MAJOR_LINE_OPACITY = 0.4;
const MINOR_LINE_OPACITY = 0.2;

function lineOpacityFor(id: string): number {
  return /highway|major/.test(id) ? MAJOR_LINE_OPACITY : MINOR_LINE_OPACITY;
}

function isProtomapsLayer(map: maplibregl.Map, id: string): boolean {
  const l = map.getLayer(id);
  return !!l && (l as any).source === PM_SOURCE;
}

// Id of the layer to insert the satellite *under*: the first non-background
// layer, i.e. at the very bottom of the style. Roads/lines/labels then paint on
// top of the photo (hybrid), which is what the aerial mode needs.
function bottomAnchorId(map: maplibregl.Map): string | undefined {
  const first = map.getStyle().layers.find((l) => l.id !== "background");
  return first ? first.id : undefined;
}

function setLineOpacity(map: maplibregl.Map, opacityFor: (id: string) => number | undefined): void {
  for (const l of map.getStyle().layers) {
    if (!isProtomapsLayer(map, l.id) || l.type !== "line") {
      continue;
    }
    try {
      map.setPaintProperty(l.id, "line-opacity", opacityFor(l.id));
    } catch {
      /* ignore */
    }
  }
}

// In aerial mode the satellite sits at the bottom; hide the opaque layers that
// would cover it (fills/landcover/water/buildings), but KEEP line layers (roads,
// water, rail, boundaries) and labels so real roads stay findable on the photo.
function hideOpaqueLayers(map: maplibregl.Map): void {
  for (const l of map.getStyle().layers) {
    if (!isProtomapsLayer(map, l.id)) {
      continue;
    }
    if (l.type === "line") {
      continue;
    }
    if (l.type === "symbol") {
      if (HIDE_IF_SYMBOL.has(l.id)) {
        try {
          map.setLayoutProperty(l.id, "visibility", "none");
        } catch {
          /* ignore */
        }
      }
      continue;
    }
    try {
      map.setLayoutProperty(l.id, "visibility", "none");
    } catch {
      /* background & un-togglable layers can't be set to none; ignore */
    }
  }
}

function showAllLayers(map: maplibregl.Map): void {
  for (const l of map.getStyle().layers) {
    if (!isProtomapsLayer(map, l.id)) {
      continue;
    }
    try {
      map.setLayoutProperty(l.id, "visibility", "visible");
    } catch {
      /* ignore */
    }
  }
}

function ensureSatellite(map: maplibregl.Map): void {
  if (map.getSource(GSI_SOURCE)) {
    return;
  }
  map.addSource(GSI_SOURCE, {
    type: "raster",
    tiles: [GSI_URL],
    tileSize: 256,
    maxzoom: 18,
    attribution: GSI_ATTRIBUTION,
  } as any);
  // Insert at the very bottom (above background, below every Protomaps layer).
  map.addLayer(
    { id: GSI_LAYER, type: "raster", source: GSI_SOURCE },
    bottomAnchorId(map),
  );
}

function removeSatellite(map: maplibregl.Map): void {
  if (map.getLayer(GSI_LAYER)) {
    map.removeLayer(GSI_LAYER);
  }
  if (map.getSource(GSI_SOURCE)) {
    map.removeSource(GSI_SOURCE);
  }
}

export function applyBasemap(map: maplibregl.Map, mode: Basemap): void {
  if (mode === "aerial") {
    ensureSatellite(map);
    hideOpaqueLayers(map);
    setLineOpacity(map, lineOpacityFor);
  } else {
    showAllLayers(map);
    setLineOpacity(map, () => undefined);
    removeSatellite(map);
  }
}
