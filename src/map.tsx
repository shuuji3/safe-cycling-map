import React, { useEffect, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./App.css";
import { BikeLegend } from "./BikeLegend";
import { SearchBox } from "./SearchBox";
import {
  BIKE_CLASSES,
  ROUTE_NETWORKS,
  bikeLayerIds,
  initBikeLayers,
  routeLayerIds,
  setBikeClassVisible,
  setRouteNetworkVisible,
} from "./bike";
import { featurePopover } from "./featureInfo";
maplibregl.workerUrl = "/maplibre-gl-csp-worker.js";

// No yellowish roads — liberty's warm palette is re-hued to a light cool-blue
// ramp so nothing clashes with the bike colors and it stays a light-theme map
// (fills are pale, casings only slightly darker). Hierarchy comes from the
// fill strength (motorway most present, minor lightest). Applied across
// road_/tunnel_/bridge_ groups. Bike lines are untouched.
const ROAD_COOL: Record<string, { fill: string; casing: string }> = {
  motorway: { fill: "#a5bfd4", casing: "#8ba8c0" },
  motorway_link: { fill: "#a5bfd4", casing: "#8ba8c0" },
  trunk_primary: { fill: "#b6cce0", casing: "#9db9cf" },
  secondary_tertiary: { fill: "#c6d8e8", casing: "#b0c7da" },
  link: { fill: "#d3e2ee", casing: "#bed2e2" },
};
const ROAD_PREFIXES = ["road", "tunnel", "bridge"];

function neutralizeYellowRoads(map: maplibregl.Map): void {
  for (const prefix of ROAD_PREFIXES) {
    for (const [type, colors] of Object.entries(ROAD_COOL)) {
      const fill = `${prefix}_${type}`;
      if (map.getLayer(fill)) {
        map.setPaintProperty(fill, "line-color", colors.fill);
      }
      const casing = `${prefix}_${type}_casing`;
      if (map.getLayer(casing)) {
        map.setPaintProperty(casing, "line-color", colors.casing);
      }
    }
  }
}

export function Map() {
  const mapContainer = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<maplibregl.Map | null>(null);

  // Centering Kanto region
  const [lng, setLng] = useState(139.9599);
  const [lat, setLat] = useState(35.6493);
  const [zoom, setZoom] = useState(9);

  // Per-facility-type checkbox state (default: all visible)
  const [visible, setVisible] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(BIKE_CLASSES.map((c) => [c.id, true]))
  );

  // Whether the legend sidebar is expanded or collapsed to a small button.
  // Collapsed by default on narrow (mobile) screens.
  const [legendOpen, setLegendOpen] = useState(
    () => typeof window === "undefined" || window.innerWidth > 768,
  );

  useEffect(() => {
    if (mapContainer.current === null) {
      return;
    }
    if (mapRef.current !== null) {
      return;
    }

    const map = new maplibregl.Map({
      container: mapContainer.current,
      center: [lng, lat],
      zoom: zoom,
      hash: true,
      style: "https://tiles.openfreemap.org/styles/liberty",
    });
    mapRef.current = map;

    map.on("load", () => {
      neutralizeYellowRoads(map);
      initBikeLayers(map);
      // Layers are initially added hidden; default all facility types to visible.
      for (const def of BIKE_CLASSES) {
        setBikeClassVisible(map, def.id, true);
      }
      // Route networks are toggled implicitly with the cycleway checkbox.
      for (const def of ROUTE_NETWORKS) {
        setRouteNetworkVisible(map, def.id, true);
      }

      // Info popover: hover shows it, click pins it, Esc / outside-click closes.
      let popup: maplibregl.Popup | null = null;
      let pinned = false;
      let over = false;
      const ids = [...bikeLayerIds(), ...routeLayerIds()];

      function showPopup(e: any, pin: boolean): void {
        const features = map.queryRenderedFeatures(e.point, { layers: ids });
        if (!features.length) {
          return;
        }
        const f = features[0];
        popup?.remove();
        popup = featurePopover(map, e.lngLat, (f.properties || {}) as any);
        pinned = pin;
        popup.on("close", () => {
          popup = null;
          pinned = false;
        });
      }

      function closePopup(): void {
        popup?.remove();
        popup = null;
        pinned = false;
      }

      map.on("mousemove", (e: any) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ids });
        if (features.length) {
          map.getCanvas().style.cursor = "pointer";
          if (!over) {
            over = true;
            if (!pinned) {
              showPopup(e, false);
            }
          }
        } else {
          map.getCanvas().style.cursor = "";
          over = false;
          if (!pinned) {
            closePopup();
          }
        }
      });
      map.on("click", (e: any) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ids });
        if (features.length) {
          showPopup(e, true);
        }
      });
      map.on("dblclick", closePopup);
      map.on("contextmenu", closePopup);
      document.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape") {
          closePopup();
        }
      });
    });

    map.addControl(new maplibregl.NavigationControl({}));
    map.addControl(new maplibregl.FullscreenControl({}));
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      })
    );

    map.on("move", () => {
      setLng(map.getCenter().lng);
      setLat(map.getCenter().lat);
      setZoom(map.getZoom());
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply checkbox changes to layer visibility.
  // Route networks follow the "cycleway" checkbox implicitly.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    for (const def of BIKE_CLASSES) {
      setBikeClassVisible(map, def.id, !!visible[def.id]);
    }
    const routesOn = !!visible["cycleway"];
    for (const def of ROUTE_NETWORKS) {
      setRouteNetworkVisible(map, def.id, routesOn);
    }
  }, [visible]);

  return (
    <div>
      <SearchBox
        onSelect={(coords) =>
          mapRef.current?.flyTo({ center: coords, zoom: 13 })
        }
      />
      <BikeLegend
        visible={visible}
        onToggle={(id, checked) =>
          setVisible((v) => ({ ...v, [id]: checked }))
        }
        open={legendOpen}
        onFold={() => setLegendOpen((v) => !v)}
      />
      <div ref={mapContainer} className="map-container" />
    </div>
  );
}
