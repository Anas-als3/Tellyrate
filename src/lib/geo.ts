/** The GeoJSON shapes needed for a country-boundary containment check. */
export type PolygonGeometry = {
  type: "Polygon";
  coordinates: number[][][];
};

export type MultiPolygonGeometry = {
  type: "MultiPolygon";
  coordinates: number[][][][];
};

export type BoundaryGeometry = PolygonGeometry | MultiPolygonGeometry;

type Position = readonly [number, number];

/**
 * Return whether a longitude/latitude point lies in a GeoJSON country shape.
 * Boundary points count as inside: a facility exactly on a surveyed border
 * must be reviewed manually, never silently hidden by floating-point noise.
 */
export function pointInBoundary(
  lon: number,
  lat: number,
  geometry: BoundaryGeometry,
): boolean {
  const point: Position = [lon, lat];
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;

  return polygons.some((polygon) => pointInPolygon(point, polygon));
}

function pointInPolygon(point: Position, rings: number[][][]): boolean {
  if (rings.length === 0 || !pointInRing(point, rings[0])) return false;
  // GeoJSON's first ring is the shell; every later ring is a hole.
  return !rings.slice(1).some((hole) => pointInRing(point, hole));
}

function pointInRing([x, y]: Position, ring: number[][]): boolean {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];

    if (pointOnSegment(x, y, xi, yi, xj, yj)) return true;

    const crosses =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }

  return inside;
}

function pointOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): boolean {
  const cross = (px - ax) * (by - ay) - (py - ay) * (bx - ax);
  if (Math.abs(cross) > 1e-10) return false;

  return (
    px >= Math.min(ax, bx) - 1e-10 &&
    px <= Math.max(ax, bx) + 1e-10 &&
    py >= Math.min(ay, by) - 1e-10 &&
    py <= Math.max(ay, by) + 1e-10
  );
}
