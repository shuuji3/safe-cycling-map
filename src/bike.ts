import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import { defineMessage } from "@lingui/macro";
import { MessageDescriptor } from "@lingui/core";

/** one OSM attribute shown in the popover, with its own plain-language meaning */
export interface BikeAttr {
  /** real OSM tags rendered each in its own <code>, e.g. "cycleway=track" plus "cycleway:left" / "cycleway:right" / "cycleway:both" */
  tags: string[];
  /** translatable plain-language explanation of this attribute */
  meaning: MessageDescriptor;
}

interface BikeClassDef {
  /** value of the `class` attribute emitted by the Planetiler overlay */
  id: string;
  /** translatable display name shown in the sidebar */
  name: MessageDescriptor;
  /** translatable natural-language summary (must NOT contain tag code) */
  summary: MessageDescriptor;
  /** OSM attributes, each explained, shown inside the per-row popover */
  attrs: BikeAttr[];
  color: string;
  /** extra `class` values rendered with this same layer (kept in data, grouped in UI) */
  aliases?: string[];
  dasharray?: number[];
}

export const BIKE_CLASSES: BikeClassDef[] = [
    {
      id: "cycleway",
      name: defineMessage({ message: "自転車専用道路・自転車道" }),
      summary: defineMessage({ message: "「自転車専用」標識がある道路、または車道沿いに構造物で分離された自転車道" }),
      attrs: [
        { tags: ["highway=cycleway"], meaning: defineMessage({ message: "「自転車専用」標識がある独立した自転車専用道路（歩行者通行不可）" }) },
        { tags: ["cycleway=track", "cycleway:left", "cycleway:right", "cycleway:both"], meaning: defineMessage({ message: "車道沿いに縁石や柵などの構造物で分離された自転車道" }) },
      ],
      aliases: ["track"],
      color: "#1a9850",
    },
    {
      id: "bike_lane",
      name: defineMessage({ message: "自転車専用通行帯（自転車レーン）" }),
      summary: defineMessage({ message: "「普通自転車専用通行帯」標識や路面表示により、車道上にペイント等で指定された通行帯" }),
      attrs: [
        { tags: ["cycleway=lane", "cycleway:left", "cycleway:right", "cycleway:both", "cycleway:lane=advisory"], meaning: defineMessage({ message: "車道上に区画線やカラー塗装で設けられた自転車専用通行帯（自転車レーン）" }) },
      ],
      color: "#91cf60",
    },
    {
      id: "bicycle_designated",
      name: defineMessage({ message: "自転車歩行者道（自歩道）" }),
      summary: defineMessage({ message: "「自転車及び歩行者専用」標識や「普通自転車歩道通行可」指定のある歩道（歩行者優先）" }),
      attrs: [
        { tags: ["highway=footway + bicycle=yes"], meaning: defineMessage({ message: "指定標識等により自転車の通行が許可・指定された歩道" }) },
        { tags: ["bicycle=designated"], meaning: defineMessage({ message: "自転車の通行が指定されている道路・通行区分" }) },
      ],
      color: "#fdae61",
    },
    {
      id: "shared_lane",
      name: defineMessage({ message: "車道共有（矢羽根・ナビマーク）" }),
      summary: defineMessage({ message: "専用通行帯はなく車道を自動車と共有する区間。矢羽根型表示（ナビライン）等で走行位置を提示" }),
      attrs: [
        { tags: ["cycleway=shared_lane", "cycleway:left", "cycleway:right", "cycleway:both", "cycleway:lane=pictogram"], meaning: defineMessage({ message: "矢羽根型表示（ナビマーク・ナビライン）がある車道共有区間" }) },
      ],
      color: "#d73027",
    },
    {
      id: "other",
      name: defineMessage({ message: "その他（付帯設備・属性）" }),
      summary: defineMessage({ message: "交差点設備や、自転車道が車道とは別ラインで描かれている場合などの補足属性" }),
      attrs: [
        { tags: ["cycleway=crossing"], meaning: defineMessage({ message: "交差点等の自転車横断帯" }) },
        { tags: ["cycleway=separate"], meaning: defineMessage({ message: "自転車道が車道本体とは別の独立したライン（ウェイ）として作成済み" }) },
        { tags: ["cycleway=asl"], meaning: defineMessage({ message: "交差点手前の自転車用優先停止スペース（Advanced Stop Line）" }) },
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
    name: defineMessage({ message: "国際サイクルルート" }),
    summary: defineMessage({ message: "国境を越える国際ルート" }),
    attrs: [{ tags: ["network=icn"], meaning: defineMessage({ message: "国際サイクルネットワーク" }) }],
    color: "#1a9850",
  },
  {
    id: "ncn",
    name: defineMessage({ message: "ナショナルサイクルルート" }),
    summary: defineMessage({ message: "国内の主要なルート" }),
    attrs: [{ tags: ["network=ncn"], meaning: defineMessage({ message: "国家サイクルネットワーク" }) }],
    color: "#1a9850",
  },
  {
    id: "rcn",
    name: defineMessage({ message: "リージョナルサイクルルート" }),
    summary: defineMessage({ message: "地域をまたぐルート" }),
    attrs: [{ tags: ["network=rcn"], meaning: defineMessage({ message: "地域サイクルネットワーク" }) }],
    color: "#1a9850",
  },
  {
    id: "lcn",
    name: defineMessage({ message: "ローカルサイクルルート" }),
    summary: defineMessage({ message: "地元のルート" }),
    attrs: [{ tags: ["network=lcn"], meaning: defineMessage({ message: "地方サイクルネットワーク" }) }],
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
  const external = process.env.REACT_APP_BIKE_PMTILES_URL;
  if (external) {
    return "pmtiles://" + external;
  }
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

  // Draw order: safest (green) on top, least-safe (gray "other") at the bottom so
  // the green dedicated/separated lanes are never covered by gray ancillary lines.
  // addLayer stacks later layers above earlier ones, so iterate in reverse safety.
  for (const def of [...BIKE_CLASSES].reverse()) {
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
        // (e.g. track under the cycleway layer).
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
