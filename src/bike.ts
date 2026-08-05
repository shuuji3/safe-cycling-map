import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";

/** one OSM attribute shown in the popover, with its own plain-language meaning */
export interface BikeAttr {
  /** OSM tag rendered as <code>, e.g. "highway=cycleway" */
  tag: string;
  /** plain-language explanation of this attribute, e.g. "自動車から分離された専用の自転車道路" */
  meaning: string;
}

interface BikeClassDef {
  /** value of the `class` attribute emitted by the Planetiler overlay */
  id: string;
  /** Japanese display name shown in the sidebar */
  name: string;
  /** natural-language summary, shown in the sidebar (must NOT contain tag code) */
  summary: string;
  /** OSM attributes, each explained, shown inside the per-row popover */
  attrs: BikeAttr[];
  color: string;
  /** extra `class` values rendered with this same layer (kept in data, grouped in UI) */
  aliases?: string[];
  dasharray?: number[];
}

// Cycling infrastructure ("cycleway" key).
// Colors use a colorblind-safe diverging ramp (RdYlGn) that encodes safety:
// green = safest (physically separated), red = most dangerous (shared motor traffic).
// NOTE: advisory_lane (`cycleway=lane` + `cycleway:lane=advisory`, suggestion lane)
// stays in the tile data but is folded into the shared_lane UI/color (no own checkbox).
export const BIKE_CLASSES: BikeClassDef[] = [
    {
      id: "cycleway",
      name: "自転車専用道路・自転車道",
      summary: "「自転車専用」標識がある道路、または車道沿いに構造物で分離された自転車道",
      attrs: [
        { tag: "highway=cycleway", meaning: "「自転車専用」標識がある独立した自転車専用道路（歩行者通行不可）" },
        { tag: "cycleway=track", meaning: "車道沿いに縁石や柵などの構造物で分離された自転車道（ウェイ未分離時）" },
      ],
      aliases: ["track"],
      color: "#1a9850",
    },
    {
      id: "bike_lane",
      name: "自転車専用通行帯（自転車レーン）",
      summary: "「普通自転車専用通行帯」標識や路面表示により、車道上にペイント等で指定された通行帯",
      attrs: [
        { tag: "cycleway=lane", meaning: "車道上に区画線やカラー塗装で設けられた自転車専用通行帯" },
      ],
      color: "#91cf60",
    },
    {
      id: "bicycle_designated",
      name: "自転車歩行者道（自歩道）",
      summary: "「自転車及び歩行者専用」標識や「普通自転車歩道通行可」指定のある歩道（歩行者優先）",
      attrs: [
        { tag: "highway=footway + bicycle=yes", meaning: "指定標識等により自転車の通行が許可・指定された歩道" },
        { tag: "bicycle=designated", meaning: "自転車の通行が指定されている道路・通行区分" },
      ],
      color: "#fdae61",
    },
    {
      id: "shared_lane",
      name: "車道共有（矢羽根・ナビマーク）",
      summary: "専用通行帯はなく車道を自動車と共有する区間。矢羽根型表示（ナビライン）等で走行位置を提示",
      attrs: [
        { tag: "cycleway=shared_lane", meaning: "矢羽根型表示（ナビマーク・ナビライン）がある車道共有区間" },
        { tag: "cycleway:lane=advisory", meaning: "車道上の走行推奨ライン（アドバイザリーレーン）" },
      ],
      aliases: ["advisory_lane"],
      color: "#d73027",
    },
    {
      id: "other",
      name: "その他（付帯設備・属性）",
      summary: "交差点設備や、自転車道が車道とは別ラインで描かれている場合などの補足属性",
      attrs: [
        { tag: "cycleway=crossing", meaning: "交差点等の自転車横断帯" },
        { tag: "cycleway=separate", meaning: "自転車道が車道本体とは別の独立したライン（ウェイ）として作成済み" },
        { tag: "cycleway=asl", meaning: "交差点手前の自転車用優先停止スペース（Advanced Stop Line）" },
      ],
      color: "#969696",
    },
];

// Signed cycle ROUTE networks (route=bicycle + network=icn/ncn/rcn/lcn).
// These are NOT physical lanes; they follow ordinary roads with no lane tags.
// They render in the same solid color as the dedicated cycleway (専用道路) since
// they are cycleway-equivalent roads, and are toggled implicitly with the
// "cycleway" checkbox rather than having their own toggle.
// icn is included for use outside Japan.
export const ROUTE_NETWORKS: BikeClassDef[] = [
  {
    id: "icn",
    name: "国際サイクルルート",
    summary: "国境を越える国際ルート",
    attrs: [{ tag: "network=icn", meaning: "国際サイクルネットワーク" }],
    color: "#1a9850",
  },
  {
    id: "ncn",
    name: "ナショナルサイクルルート",
    summary: "国内の主要なルート",
    attrs: [{ tag: "network=ncn", meaning: "国家サイクルネットワーク" }],
    color: "#1a9850",
  },
  {
    id: "rcn",
    name: "リージョナルサイクルルート",
    summary: "地域をまたぐルート",
    attrs: [{ tag: "network=rcn", meaning: "地域サイクルネットワーク" }],
    color: "#1a9850",
  },
  {
    id: "lcn",
    name: "ローカルサイクルルート",
    summary: "地元のルート",
    attrs: [{ tag: "network=lcn", meaning: "地方サイクルネットワーク" }],
    color: "#1a9850",
  },
];

const SOURCE_ID = "bike-overlay";
const LAYER_PREFIX = "bike-";
const ROUTE_PREFIX = "route-";

let registered = false;
// pmtiles uses window.location in the browser; guard for any non-browser context.
const inBrowser = typeof window !== "undefined";

function ensureProtocol(): void {
  if (inBrowser && !registered) {
    registered = true;
    // maplibre-gl v2 uses callback-style addProtocol; pmtiles Protocol.tile
    // detects the second argument and returns a { cancel } handle accordingly.
    const protocol = new Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);
  }
}

function sourceUrl(): string {
  // Static host: build an absolute URL from /bike.pmtiles
  return "pmtiles://" + window.location.origin + "/bike.pmtiles";
}

export function initBikeLayers(map: maplibregl.Map): void {
  ensureProtocol();
  if (!inBrowser || map.getSource(SOURCE_ID)) {
    return;
  }
  map.addSource(SOURCE_ID, {
    type: "vector",
    url: sourceUrl(),
    minzoom: 0,
    maxzoom: 16,
  } as any);

  for (const def of BIKE_CLASSES) {
    map.addLayer(
      {
        id: LAYER_PREFIX + def.id,
        type: "line",
        source: SOURCE_ID,
        "source-layer": "bike",
        "layout": {
          "line-cap": "round",
          "line-join": "round",
          "visibility": "none",
        },
        "paint": {
          "line-color": def.color,
          // Width scales with zoom so the overlay is legible both zoomed-out
          // (thin overview lines) and zoomed-in (wider detailed lines).
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0,
            0.5,
            8,
            1,
            12,
            3,
            16,
            7,
          ],
          "line-opacity": 0.85,
          "line-dasharray": def.dasharray || [1, 0],
        },
        // A def with aliases renders those extra data classes under this layer too
        // (e.g. advisory_lane folded into shared_lane).
        "filter":
          def.aliases && def.aliases.length
            ? ["in", "class", def.id, ...def.aliases]
            : ["==", "class", def.id],
      } as any,
    );
  }

  // Route networks use the same source but the "route_network" source-layer,
  // filtered by the `network` value of each member way.
  const routeWidth: any = [
    "interpolate",
    ["linear"],
    ["zoom"],
    0,
    0.4,
    8,
    0.8,
    12,
    2,
    16,
    5,
  ];
  for (const def of ROUTE_NETWORKS) {
    map.addLayer(
      {
        id: ROUTE_PREFIX + def.id,
        type: "line",
        source: SOURCE_ID,
        "source-layer": "route_network",
        "layout": {
          "line-cap": "round",
          "line-join": "round",
          "visibility": "none",
        },
        "paint": {
          "line-color": def.color,
          "line-width": routeWidth,
          "line-opacity": 0.75,
          "line-dasharray": def.dasharray || [1, 0],
        },
        "filter": ["==", "network", def.id],
        "minzoom": 4,
      } as any,
    );
  }
}

export function setBikeClassVisible(map: maplibregl.Map, cls: string, visible: boolean): void {
  const id = LAYER_PREFIX + cls;
  if (map.getLayer(id)) {
    map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
}

export function setRouteNetworkVisible(map: maplibregl.Map, net: string, visible: boolean): void {
  const id = ROUTE_PREFIX + net;
  if (map.getLayer(id)) {
    map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
}

export function bikeLayerIds(): string[] {
  return BIKE_CLASSES.map((d) => LAYER_PREFIX + d.id);
}

export function routeLayerIds(): string[] {
  return ROUTE_NETWORKS.map((d) => ROUTE_PREFIX + d.id);
}
