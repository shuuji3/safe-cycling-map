#!/usr/bin/env bash
# Build a Japan-wide bike-facility overlay PMTiles archive from OSM data using Planetiler.
#
# Produces: public/bike.pmtiles
# The overlay covers all of Japan.
#
# Requirements:
#   - Java 21 (set JAVA_HOME to a Java 21 JDK)
#   - planetiler.jar (set PLANETILER_JAR)
set -euo pipefail

# Directory of this script / repo root
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

JAR="${PLANETILER_JAR:-/tmp/opencode/planetiler/planetiler.jar}"
JAVA_BIN="${JAVA_HOME:+$JAVA_HOME/bin/}java"
if [ -z "${JAVA_HOME:-}" ]; then
  # Prefer a Java 21 install if present
  for j in "$HOME/.sdkman/candidates/java/21.0.12-amzn" "$HOME/.sdkman/candidates/java/current"; do
    if [ -x "$j/bin/java" ]; then
      JAVA_BIN="$j/bin/java"
      break
    fi
  done
fi

OSM_PATH="data/japan.osm.pbf"
OSM_URL="https://download.geofabrik.de/asia/japan-latest.osm.pbf"
ROUTES_GEOJSON="data/route_networks.geojson"
OUTPUT="public/bike.pmtiles"
MINZOOM="${MINZOOM:-0}"
MAXZOOM="${MAXZOOM:-16}"

if [ ! -f "$OSM_PATH" ]; then
  echo "Downloading Japan OSM extract ($OSM_URL) ..."
  mkdir -p "$(dirname "$OSM_PATH")"
  curl --user-agent "japan-safe-cycling-map (https://github.com/shuuji3/japan-safe-cycling-map)" -L --fail -o "$OSM_PATH" "$OSM_URL"
fi

echo "Resolving route=bicycle relations -> $ROUTES_GEOJSON ..."
python3 scripts/generate-route-networks.py "$OSM_PATH" "$ROUTES_GEOJSON"

mkdir -p "$(dirname "$OUTPUT")"

echo "Building bike overlay (z$MINZOOM-z$MAXZOOM) ..."
"$JAVA_BIN" -Xmx8g -jar "$JAR" generate-custom \
  --schema=scripts/planetiler/bike-schema.yml \
  --osm_path="$OSM_PATH" \
  --output="$OUTPUT" \
  --minzoom="$MINZOOM" \
  --maxzoom="$MAXZOOM" \
  "$@"

echo "Done: $OUTPUT"
