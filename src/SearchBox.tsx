import React, { useEffect, useState } from "react";

// Free geocoding via Komoot's public Photon instance. It's a courtesy API:
// "use the API for your project as long as the number of requests stay in a
// reasonable limit. Extensive usage will be throttled or completely banned."
// We keep load modest: debounced keystrokes (300ms), a Japan-only bounding box,
// countrycode=JP, a small result limit, and cancellation of in-flight requests.
const PHOTON_URL = "https://photon.komoot.io/api";
const JP_BBOX = "122.9,20.4,153.9,45.5";
const KANTO_LON = 139.9599;
const KANTO_LAT = 35.6493;

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    city?: string;
    district?: string;
    state?: string;
    country?: string;
    osm_key?: string;
    osm_value?: string;
  };
}

interface SearchBoxProps {
  onSelect: (coords: [number, number]) => void;
}

function resultLabel(feature: PhotonFeature): string {
  const p = feature.properties;
  const parts = [
    p.name,
    p.district,
    p.city,
    p.state,
    p.country,
  ].filter((x): x is string => !!x);
  return parts.join("、");
}

export function SearchBox({ onSelect }: SearchBoxProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PhotonFeature[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setOpen(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          q: trimmed,
          countrycode: "JP",
          bbox: JP_BBOX,
          limit: "6",
          lat: String(KANTO_LAT),
          lon: String(KANTO_LON),
          zoom: "6",
        });
        const res = await fetch(`${PHOTON_URL}?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`Photon returned ${res.status}`);
        }
        const data = await res.json();
        const features: PhotonFeature[] = (data && data.features) || [];
        setResults(features);
        setActive(0);
        setOpen(features.length > 0);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setResults([]);
          setOpen(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const choose = (feature: PhotonFeature) => {
    onSelect(feature.geometry.coordinates);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  return (
    <div className="search-box">
      <input
        type="text"
        placeholder="場所を検索"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results[active]) {
            choose(results[active]);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Escape") {
            setOpen(false);
          }
          e.stopPropagation();
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && results.length > 0 && (
        <ul className="search-results">
          {results.map((f, i) => (
            <li
              key={`${f.properties.osm_key}-${f.properties.osm_value}-${i}`}
              className={i === active ? "search-result active" : "search-result"}
              onMouseDown={() => choose(f)}
              onMouseEnter={() => setActive(i)}
            >
              {resultLabel(f)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
