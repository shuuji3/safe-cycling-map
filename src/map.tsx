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

function MapComponent() {
  const mapContainer = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<maplibregl.Map | null>(null);

  // Centering Japan
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
      style: "https://api.protomaps.com/styles/v5/light/en.json?key=51f8408cd47ce4e9",
    });
    mapRef.current = map;

    map.on("load", () => {
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
        const type =
          String(f.layer?.id ?? "").startsWith("route-")
            ? "relation"
            : "way";
        popup = featurePopover(
          map,
          e.lngLat,
          (f.properties || {}) as any,
          type,
        );
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
        handleOpen={() => setLegendOpen((v) => !v)}
      />
      <div ref={mapContainer} className="map-container" />
    </div>
  );
}

export const Map = React.memo(MapComponent);
