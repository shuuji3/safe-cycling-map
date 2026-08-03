import React, { useEffect, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./App.css";
import { mapOnLoad } from "./layers";
import { debouncedFetchAndDrawMarkers } from "./api";
import { LoadingStatusType } from "./interfaces";

const min_overpass_turbo_zoom = 15;

/** Also the min zoom of the vector tileserver */
// const max_overpass_turbo_zoom = 15;

maplibregl.workerUrl = "/maplibre-gl-csp-worker.js";

export function Map() {
  const mapContainer = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<maplibregl.Map | null>(null);
  const markers = React.useRef<maplibregl.Marker[]>([]);
  const [loadingStatus, setLoadingStatus] =
    useState<LoadingStatusType>("ready_to_load");

  // Tokyo tower
  const [lng, setLng] = useState(139.745433);
  const [lat, setLat] = useState(35.658581);
  const [zoom, setZoom] = useState(17.5);

  useEffect(() => {
    // This is called on every pan
    if (mapContainer.current === null) {
      return;
    }
    if (mapRef.current !== null) {
      return;
    }

    mapRef.current = new maplibregl.Map({
      container: mapContainer.current,
      center: [lng, lat],
      zoom: zoom,
      hash: true,
      style: "https://tiles.openfreemap.org/styles/liberty",
    });

    const map = mapRef.current;
    map.on("load", mapOnLoad(map));

    map.addControl(new maplibregl.NavigationControl({}));
    map.addControl(new maplibregl.FullscreenControl({}));
    // map.addControl(
    //   new MapboxDirections({
    //     accessToken: mapboxgl.accessToken,
    //   }),
    //   "top-left"
    // );
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true,
        },
        trackUserLocation: true,
      })
    );

    map.on("move", () => {
      if (!map) {
        return; // wait for map to initialize
      }
      const { lng, lat } = map.getCenter();
      const zoom = map.getZoom();
      if (zoom < min_overpass_turbo_zoom) {
        setLoadingStatus("too_zoomed_out");
      } else {
        setLoadingStatus("ready_to_load");
      }
      // console.log(lng, lat, zoom);

      setLng(map.getCenter().lng);
      setLat(map.getCenter().lat);
      setZoom(map.getZoom());
    });

    if (map.getZoom() < min_overpass_turbo_zoom) {
      setLoadingStatus("too_zoomed_out");
    } else {
      console.log(`zoom is ${map.getZoom()}`);
      debouncedFetchAndDrawMarkers(map, markers, setLoadingStatus);
    }

    map.on("moveend", async () => {
      if (map === null) {
        return;
      }
      const zoom = map.getZoom();
      if (zoom > min_overpass_turbo_zoom) {
        console.log(`zoom is ${zoom}`);
        debouncedFetchAndDrawMarkers(map, markers, setLoadingStatus);
      }
    });
  });
  const statusMessages = {
    loading: "Loading safety ratings...",
    success: "Done loading safety ratings",
    ready_to_load: "About to load ratings...",
    too_zoomed_out: "Zoom in to see street safety ratings",
    unknownerror: "Error loading. Please wait a bit",
    "429error": "Too many requests, please try in a bit",
  };

  const statusText = statusMessages[loadingStatus];
  return (
    <div>
      <div className="sidebar">
        <label>
          <span color="red">Warning:</span> Data is open source and not guaranteed to be
          accurate.
          <br></br>
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://github.com/jakecoppinger/safe-cycling-map/blob/main/docs/key.md"
          >
            View map key and how safety is calculated
          </a>
          <br></br>
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://github.com/jakecoppinger/safe-cycling-map"
          >
            About this map
          </a>
          <br></br>
          {statusText}
        </label>
      </div>
      <div ref={mapContainer} className="map-container" />
    </div>
  );
}
