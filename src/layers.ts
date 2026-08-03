import maplibregl from "maplibre-gl";

export const mapOnLoad = (map: maplibregl.Map) => () => {
  // TEMPORARILY DISABLED: the local osm2streets vector tileserver (localhost:3001)
  // is no longer used. The bike-facility overlay is instead served from the PMTiles
  // archive registered in src/bike.ts (see initBikeLayers).
  //
  // Previously this added an `osm2streets-vector-tileserver` vector source with
  // tiles: ["http://localhost:3001/tile/{z}/{x}/{y}"] and drew lane polygons.
  void map;
  console.log("osm2streets (3001) vector server disabled; using bike PMTiles overlay.");
};
