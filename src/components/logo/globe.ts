/**
 * Orthographic globe for the spinning logo. Shared by the build (first frame,
 * so no-JS and reduced-motion visitors still see a globe) and the browser
 * (animation in Logo.astro's script).
 */
import { geoGraticule10, geoOrthographic, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import land110 from 'world-atlas/land-110m.json';
import { GLOBE } from './paths';

/** Start facing the Americas, like the original artwork. */
export const START_LON = 95;
/** Seen a little from above, tilted to follow the orbit. */
const PITCH = -18;
const ROLL = -14;
/** Seconds for one full turn. */
export const TURN_SECONDS = 16;
/** Seconds for one turn when the visitor's system asks for reduced motion (D15). */
export const REDUCED_TURN_SECONDS = 60;

const topo = land110 as unknown as Topology<{ land: GeometryCollection }>;
const land = feature(topo, topo.objects.land);
const graticule = geoGraticule10();

const front = geoOrthographic()
  .scale(GLOBE.r)
  .translate([GLOBE.cx, GLOBE.cy])
  .clipAngle(90)
  .precision(0.6);
// The far side seen through the globe: the antipodal camera, mirrored.
const back = geoOrthographic()
  .scale(GLOBE.r)
  .translate([GLOBE.cx, GLOBE.cy])
  .clipAngle(90)
  .reflectX(true)
  .precision(0.6);

const frontPath = geoPath(front).digits(1);
const backPath = geoPath(back).digits(1);

export interface GlobeFrame {
  land: string;
  landBack: string;
  grid: string;
  gridBack: string;
}

export function globeFrame(lon: number): GlobeFrame {
  front.rotate([lon, PITCH, ROLL]);
  back.rotate([lon + 180, -PITCH, -ROLL]);
  return {
    land: frontPath(land) ?? '',
    landBack: backPath(land) ?? '',
    grid: frontPath(graticule) ?? '',
    gridBack: backPath(graticule) ?? '',
  };
}
