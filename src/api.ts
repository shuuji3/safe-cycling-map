import debounce from "debounce";
import maplibregl from "maplibre-gl";
import { LoadingStatusType, OverpassResponse} from "./interfaces";

import * as http from "https";
import { addStreetLayers, removeStreetLayers } from "./drawing";
import { safeCycleways } from "./overpass-requests";

import osmtogeojson from 'osmtogeojson';

/**
 * Make request to Overpass Turbo.
 * @param overpassQuery Overpass turbo query string
 * @returns
 */
export async function getOSMData(overpassQuery: string): Promise<OverpassResponse> {
  // overpass.kumi.systems
    // hostname: "overpass-api.de",
  const options = {
    hostname: "overpass-api.de",
    port: 443,
    path: "/api/interpreter",
    method: "POST",
    headers: {
      // "Content-Type": "application/json",
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'safe-cycling-map (https://github.com/shuuji3/safe-cycling-map)'
    },
  };

  return new Promise((resolve, reject) => {
    var req = http.request(options, function (res) {
      var body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (body += chunk));
      res.on("end", function () {
        if (res.statusCode !== 200) {
          console.log("error code", res.statusCode);
          reject(res.statusCode);
          return;
        }

        const jsonResponse = JSON.parse(body);
        resolve(jsonResponse);
      });
    });
    req.on("error", function (e) {
      reject(e.message);
    });
    req.write(new URLSearchParams({
      'data': overpassQuery,
    }).toString());
    req.end();
  });
}

export const debouncedFetchAndDrawMarkers = debounce(fetchAndDrawMarkers, 2000);

async function fetchAndDrawMarkers(
  map: maplibregl.Map,
  markers: React.MutableRefObject<maplibregl.Marker[]>,
  setLoadingStatus: React.Dispatch<React.SetStateAction<LoadingStatusType>>
) {
  setLoadingStatus("loading");
  const bounds = map.getBounds();
  const southernLat = bounds.getSouth();
  const westLong = bounds.getWest();
  const northLat = bounds.getNorth();
  const eastLong = bounds.getEast();

  const overpassBounds = [southernLat, westLong, northLat, eastLong];
  const boundsStr = overpassBounds.join(",");
  const safeRoutesOverpassQuery = safeCycleways(boundsStr);

  console.log("Started POST request...");

  const maxAttempts = 4;
  const baseDelayMs = 3000;
  let safeRoutes: OverpassResponse | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      safeRoutes = await getOSMData(safeRoutesOverpassQuery);
      break;
    } catch (e) {
      console.log("Error:", e, `(attempt ${attempt}/${maxAttempts})`);
      if (attempt === maxAttempts) {
        setLoadingStatus("unknownerror");
        return;
      }
      // Let the user know we're retrying, and how many times left.
      const remaining = maxAttempts - attempt;
      setLoadingStatus("retrying");
      console.log(`Overpass busy, retrying in ${Math.round((baseDelayMs * attempt) / 1000)}s (${remaining} left)`);
      await sleep(baseDelayMs * attempt);
    }
  }

  if (!safeRoutes) {
    setLoadingStatus("unknownerror");
    return;
  }

  const geoJson = osmtogeojson(safeRoutes, {})
  console.log(geoJson);
  console.log("Adding geojson to map...");

  removeStreetLayers(map);
  addStreetLayers(map, geoJson);

  setLoadingStatus("success");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
