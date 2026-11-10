import { AmbientLight, DirectionalLight, LayersList, LightingEffect } from '@deck.gl/core';
import { SolidPolygonLayer } from '@deck.gl/layers';
import { ScenegraphLayer } from '@deck.gl/mesh-layers';

/**
 * The 3D vehicle drawn on single-vehicle maps (trip replay and the vehicle detail live map),
 * as deck.gl layers on a MapboxOverlay. One place for the model, its size, shadow, lighting
 * and body motion, so both maps look and move the same.
 *
 * Every vehicle is drawn as the same car for now: IoTility's own model (assets/trip-vehicles/
 * car.glb, built by scripts/fleet-car/build.mjs), a pearl white crossover with dark glass, red
 * tail lights and smoked headlights, so the front and back read at a glance. White is what most
 * fleet vehicles are, and it stands out on the light map, the dark map and the purple trail.
 */
export type Rgba = [number, number, number, number];

const MODEL_URLS = ['/assets/fleetpoint/trip-vehicles/car.glb', '/assets/trip-vehicles/car.glb'];
// The model faces +Z and stands on Y-up; this turns it to face the heading on the map.
const MODEL_YAW_OFFSET = 180;
/** The car's body in metres, [length, width]. The model is built in metres, so needs no scale. */
const FOOTPRINT: readonly [number, number] = [4.5, 1.86];
/**
 * The vehicle never draws smaller than this many pixels per metre (about 50 px long), so it
 * stays a clear marker at route zoom. The shadow scales the same way.
 */
const MIN_PIXELS_PER_METRE = 11;
// Body motion, so the vehicle reads as driven rather than slid along the road: it leans out of
// turns by sideways acceleration and dips its nose under braking (lifts it pulling away).
const LEAN_DEG_PER_MS2 = 0.6;
const MAX_LEAN_DEG = 4;
const DIP_DEG_PER_MS2 = 0.6;
const MAX_DIP_DEG = 3;
const BODY_DAMPING = 5;
/**
 * The contact shadow, as three stacked rounded rectangles that fade out from under the body:
 * about half as dark right beneath it, a few percent at the edge, so it grounds the car without
 * a visible pad round it. `grow` is against the body, [along, across]; `alpha` is [light map,
 * dark map].
 */
const SHADOW_STEPS: ReadonlyArray<{ grow: readonly [number, number]; alpha: readonly [number, number] }> = [
  { grow: [1.1, 1.22], alpha: [22, 30] },
  { grow: [1.04, 1.1], alpha: [45, 60] },
  { grow: [0.99, 1.02], alpha: [85, 110] },
];
const SHADOW_LIGHT_TINT = [10, 12, 20] as const;
/** Rounded-rectangle outline of the shadow, as unit cosines and sines (a superellipse, n = 4). */
const OUTLINE = Array.from({ length: 32 }, (_, index) => {
  const angle = (index / 32) * Math.PI * 2;
  const round = (value: number) => Math.sign(value) * Math.sqrt(Math.abs(value));
  return [round(Math.cos(angle)), round(Math.sin(angle))] as const;
});
const METRES_PER_DEGREE = 111_320;

/**
 * For everything painted flat on the ground (trails, shadow). The vehicle's
 * wheels sit at ground height too, so with depth testing the two fought over the same depth every
 * frame and the underside flickered. Ground layers neither test nor write depth; drawn first,
 * they always end up beneath the vehicle.
 */
export const GROUND_LAYER_PARAMETERS = { depthWriteEnabled: false, depthCompare: 'always' } as const;

/**
 * Lighting tuned for the white body. In luma's PBR shader a directional light's `direction`
 * points from the surface *towards* the light (the opposite of its Phong lighting), so these
 * point up: a key light high in the north-east and a soft light from straight above. PBR divides
 * diffuse light by π; with these the roof and bonnet, which the map camera mostly sees, come out
 * about 97% white without clipping, sunlit sides about 94% and shaded sides about 82%, so the
 * body reads white with a clear shape. A new effect per overlay, since an effect belongs to one
 * deck.
 */
export function vehicleLighting(): LightingEffect {
  return new LightingEffect({
    ambient: new AmbientLight({ color: [255, 255, 255], intensity: 2.5 }),
    key: new DirectionalLight({ color: [255, 255, 255], intensity: 1, direction: [3, 8, 5] }),
    sky: new DirectionalLight({ color: [255, 255, 255], intensity: 0.55, direction: [0, 0, 1] }),
  });
}

/** The model loads once per page session and is shared by every map that shows it. */
let modelUrl: string | undefined;
let modelRequest: Promise<string | null> | undefined;

function loadModel(): Promise<string | null> {
  modelRequest ??= (async () => {
    let lastError: unknown;
    for (const path of MODEL_URLS) {
      try {
        const response = await fetch(new URL(path, window.location.origin));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const bytes = await response.arrayBuffer();
        const magic = new TextDecoder('ascii').decode(bytes.slice(0, 4));
        if (magic !== 'glTF') throw new Error(`Expected GLB data but received ${magic || 'an empty response'}`);
        modelUrl = URL.createObjectURL(new Blob([bytes], { type: 'model/gltf-binary' }));
        return modelUrl;
      } catch (error) {
        lastError = error;
      }
    }
    // Let a later render try again rather than caching the failure.
    modelRequest = undefined;
    console.error('The vehicle model could not be downloaded.', lastError);
    return null;
  })();
  return modelRequest;
}

/**
 * Leans the body out of turns and dips the nose under braking, from real speed and the road's
 * curvature, so it looks the same at any playback speed. Settles level when stopped.
 */
export class VehicleBody {
  lean = 0;
  dip = 0;
  private last?: { heading: number; speed: number };

  /** Advance one frame: `travelledMetres` since the last call, `speedKph` the vehicle's real speed. */
  update(heading: number, speedKph: number, travelledMetres: number, dt: number, still = false): void {
    const speed = Math.max(0, speedKph) / 3.6;
    let leanTarget = 0;
    let dipTarget = 0;
    const last = this.last;
    if (last && !still && travelledMetres > 0.05 && travelledMetres < 200) {
      const turn = ((heading - last.heading + 540) % 360) - 180;
      const curvature = ((turn * Math.PI) / 180) / travelledMetres;
      const sideways = speed * speed * curvature;
      const forwards = (speed * (speed - last.speed)) / travelledMetres;
      const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));
      leanTarget = clamp(sideways * LEAN_DEG_PER_MS2, MAX_LEAN_DEG);
      dipTarget = clamp(-forwards * DIP_DEG_PER_MS2, MAX_DIP_DEG);
    }
    this.last = { heading, speed };
    const blend = 1 - Math.exp(-BODY_DAMPING * dt);
    this.lean += (leanTarget - this.lean) * blend;
    this.dip += (dipTarget - this.dip) * blend;
    if (Math.abs(this.lean) < 0.01) this.lean = 0;
    if (Math.abs(this.dip) < 0.01) this.dip = 0;
  }

  /** Still leaning or dipping, so a paused map needs a few more frames to settle level. */
  get settling(): boolean {
    return this.lean !== 0 || this.dip !== 0;
  }

  reset(): void {
    this.lean = 0;
    this.dip = 0;
    this.last = undefined;
  }
}

interface ModelState {
  position: [longitude: number, latitude: number, altitude: number];
  heading: number;
}
interface GroundShape {
  polygon: Array<[number, number]>;
  color: Rgba;
}

const newOutline = () => OUTLINE.map(() => [0, 0] as [number, number]);
const shapePolygon = (shape: GroundShape) => shape.polygon;
const shapeColor = (shape: GroundShape) => shape.color;

export interface VehicleFrame {
  lng: number;
  lat: number;
  /** Compass heading, degrees clockwise from north. */
  heading: number;
  /** Map zoom, so the shadow matches the vehicle's on-screen size. */
  zoom: number;
}

/**
 * Builds the vehicle's layers each frame (shadow, model), reusing its own buffers. `onReady`
 * runs when the model finishes loading, so the caller can draw again.
 */
export class VehicleRenderer {
  readonly body = new VehicleBody();
  private readonly model: ModelState[] = [{ position: [0, 0, 0], heading: 0 }];
  private readonly shadows: GroundShape[] = SHADOW_STEPS.map(() => ({ polygon: newOutline(), color: [0, 0, 0, 0] }));
  private readonly orientation: [number, number, number] = [0, 0, 90];
  private readonly getPosition = (state: ModelState) => state.position;
  // [pitch, yaw, roll]: deck.gl's pitch tilts the model about its length (the lean) and the roll
  // of 90 stands the Y-up model upright, so the nose dip is added to it.
  private readonly getOrientation = (state: ModelState) => {
    this.orientation[0] = this.body.lean;
    this.orientation[1] = -state.heading + MODEL_YAW_OFFSET;
    this.orientation[2] = 90 + this.body.dip;
    return this.orientation;
  };

  /**
   * `size` scales how large the vehicle draws on screen: 1 for trip replay, larger where one
   * vehicle is the whole point of the map (vehicle detail).
   */
  constructor(
    private readonly id: string,
    private readonly onReady: () => void,
    private readonly size = 1,
  ) {}

  /** Starts fetching the model ahead of time, so it is ready when first drawn. */
  preload(): void {
    if (!modelUrl) void loadModel().then((url) => url && this.onReady());
  }

  layers(frame: VehicleFrame): LayersList {
    const scenegraph = modelUrl;
    if (!scenegraph) {
      this.preload();
      return [];
    }
    const { lng, lat, heading, zoom } = frame;
    this.model[0].position[0] = lng;
    this.model[0].position[1] = lat;
    this.model[0].heading = heading;
    const dark = document.documentElement.classList.contains('dark');
    const cosLat = Math.max(Math.cos((lat * Math.PI) / 180), 1e-6);
    const pixelsPerMetre = (512 * 2 ** zoom) / (40_075_016.686 * cosLat);
    // The model never draws below its minimum size, so the shadow grows with it.
    const enlarge = Math.max(1, (MIN_PIXELS_PER_METRE * this.size) / pixelsPerMetre);
    SHADOW_STEPS.forEach(({ grow, alpha }, index) => {
      const shadow = this.shadows[index];
      shadow.color = dark ? [0, 0, 0, alpha[1]] : [...SHADOW_LIGHT_TINT, alpha[0]];
      this.placeOutline(shadow.polygon, frame, cosLat, enlarge, grow);
    });
    return [
      // A contact shadow the size of the body keeps the vehicle on the road instead of
      // floating over it, as Google and Uber draw theirs.
      new SolidPolygonLayer<GroundShape>({
        id: `${this.id}-shadow`,
        data: this.shadows,
        getPolygon: shapePolygon,
        getFillColor: shapeColor,
        pickable: false,
        parameters: GROUND_LAYER_PARAMETERS,
        updateTriggers: { getPolygon: [lng, lat, heading, zoom], getFillColor: [dark] },
      }),
      new ScenegraphLayer<ModelState>({
        id: `${this.id}-model`,
        data: this.model,
        scenegraph,
        getPosition: this.getPosition,
        getOrientation: this.getOrientation,
        sizeScale: 1,
        // Pixels per metre, not per model: the vehicle keeps a readable size when zoomed out.
        sizeMinPixels: MIN_PIXELS_PER_METRE * this.size,
        pickable: false,
        _lighting: 'pbr',
        updateTriggers: {
          getPosition: [lng, lat],
          getOrientation: [heading, this.body.lean, this.body.dip],
        },
      }),
    ];
  }

  /** Lays a rounded rectangle on the ground under the body, `grow` times its footprint. */
  private placeOutline(
    polygon: Array<[number, number]>,
    { lng, lat, heading }: VehicleFrame,
    cosLat: number,
    enlarge: number,
    [growAlong, growAcross]: readonly [number, number],
  ): void {
    const halfLength = (FOOTPRINT[0] / 2) * enlarge * growAlong;
    const halfWidth = (FOOTPRINT[1] / 2) * enlarge * growAcross;
    const radians = (heading * Math.PI) / 180;
    const forward = [Math.sin(radians), Math.cos(radians)];
    const right = [Math.cos(radians), -Math.sin(radians)];
    OUTLINE.forEach(([along, across], index) => {
      const ahead = along * halfLength;
      const aside = across * halfWidth;
      const point = polygon[index];
      point[0] = lng + (ahead * forward[0] + aside * right[0]) / (METRES_PER_DEGREE * cosLat);
      point[1] = lat + (ahead * forward[1] + aside * right[1]) / METRES_PER_DEGREE;
    });
  }
}
