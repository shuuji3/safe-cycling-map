import maplibregl from "maplibre-gl";

interface Link {
  label: string;
  href: string;
}

function escapeHtml(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildLinks(
  lat: number,
  lng: number,
  osmId: string,
  type: "way" | "relation" | "node",
  zoom: number,
): Link[] {
  const z = Math.round(zoom);
  const idParam = type === "node" ? `n` : type === "relation" ? `r` : `w`;
  return [
    {
      label: "Street View",
      href: `https://www.google.com/maps?layer=c&cbll=${lat},${lng}&cbp=11,0,0,0,0`,
    },
    {
      label: "OSM editor",
      href: osmId
        ? `https://www.openstreetmap.org/edit?${type}=${osmId}#map=${z}/${lat}/${lng}`
        : `https://www.openstreetmap.org/edit#map=${z}/${lat}/${lng}`,
    },
    {
      label: "Rapid",
      href: osmId
        ? `https://rapideditor.org/edit#map=${z}/${lat}/${lng}&id=${idParam}${osmId}`
        : `https://rapideditor.org/edit#map=${z}/${lat}/${lng}`,
    },
  ];
}

export function featurePopover(
  map: maplibregl.Map,
  lngLat: maplibregl.LngLat,
  props: Record<string, any>,
  type: "way" | "relation" | "node",
): maplibregl.Popup {
  const rows = Object.entries(props).filter(([k]) => k !== "osm_id");
  const osmId = String(props.osm_id ?? "");
  const title =
    (props.name as string) || (props["class"] as string) || "Route info";
  const links = buildLinks(lngLat.lat, lngLat.lng, osmId, type, map.getZoom());

  const linkHtml = links
    .map(
      (l) =>
        `<a class="info-link" href="${l.href}" target="_blank" rel="noopener noreferrer"><span class="info-link-label">${escapeHtml(l.label)}</span></a>`,
    )
    .join("");

  const table = rows
    .map(
      ([k, v]) =>
        `<tr><td class="info-key">${escapeHtml(k)}</td><td class="info-val">${escapeHtml(String(v))}</td></tr>`,
    )
    .join("");

  const html = `
    <div class="feature-info">
      <div class="info-head">
        <h3 class="info-title">${escapeHtml(title)}</h3>
        <button type="button" class="info-close" aria-label="閉じる">×</button>
      </div>
      <table class="info-table">
        ${table || '<tr><td class="info-val">(no data)</td></tr>'}
      </table>
      <div class="info-links" aria-label="外部リンク">${linkHtml}</div>
    </div>`;

  const popup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    maxWidth: "300px",
  });
  popup.setLngLat(lngLat).setHTML(html).addTo(map);
  const closeBtn = popup.getElement().querySelector(".info-close");
  closeBtn?.addEventListener("click", () => popup.remove());
  return popup;
}
