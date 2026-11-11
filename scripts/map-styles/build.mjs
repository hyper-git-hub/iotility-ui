/**
 * Builds the two FleetPoint basemap styles from one base, so light and dark share
 * every layer and differ only in colour. That is what lets a theme switch crossfade
 * instead of reloading the map.
 *
 *   node scripts/map-styles/build.mjs
 *
 * The palettes follow how Google, Apple and CARTO maps stay clean and readable:
 *   - Land is a quiet neutral, and parks and water keep real green and blue.
 *   - Roads are white on slightly darker land, ranked by width, with motorways in a
 *     soft amber so the main routes can be found at a glance.
 *   - Detail arrives with zoom. Small streets don't exist at city zoom and fade in once
 *     they are wide enough to read, so the map never turns into a mesh of thin lines.
 *   - Saturated colour is left to the data: purple routes and the status colours.
 *
  * Base: OpenFreeMap "Liberty", kept in liberty-base.json so a change upstream can't
 * restyle the app. To take a newer one, download it over that file and rebuild.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outputDir = join(here, '../../projects/fleetpoint/public/assets/map-styles');
const base = JSON.parse(readFileSync(join(here, 'liberty-base.json'), 'utf8'));

const palettes = {
  light: {
    land: '#eeeff3',
    residential: '#e9eaf0',
    // Nature in real colour, a step richer than a plain grey basemap so the country reads
    // like a map, still well short of the saturated status colours the data uses.
    water: '#9fd0f0',
    waterFar: '#b3daf3',
    waterLine: '#9fd0f0',
    waterLabel: '#3f7cac',
    park: '#c1e5c3',
    parkEdge: '#a9d8ae',
    grass: '#d2ecca',
    wood: '#b6dcb5',
    farmland: '#e5eed6',
    wetland: '#bde2d7',
    sand: '#efebe0',
    ice: '#eef3f8',
    pitch: '#c8e8c6',
    cemetery: '#cfe3cb',
    // Natural Earth's shaded relief under the land when zoomed out: green lowlands, tan
    // mountains and deserts, faded out before city zoom.
    reliefOpacity: [0, 0.5, 5, 0.42, 7.5, 0],
    hospital: '#f7e4e6',
    school: '#ecebf3',
    commercial: '#f7f0dd',
    aeroway: '#e3e4ea',
    runway: '#d2d3dc',
    // Buildings a clear step darker than the residential ground around them, edged, so
    // blocks read at neighbourhood zoom.
    building: '#d4d5e0',
    buildingEdge: '#bebfce',
    building3d: '#d4d5e0',
    boundary: '#a5a5b5',
    boundaryLocal: '#c9cad5',
    label: '#23223a',
    mutedLabel: '#5e5e74',
    parkLabel: '#3b7a4e',
    halo: 'rgba(255,255,255,0.95)',
    motorway: '#fbdc96',
    motorwayCase: '#e3b95f',
    trunk: '#fef3d6',
    trunkCase: '#e8d199',
    highwayFar: '#fdeec9',
    highwayFarCase: '#e9cf8f',
    primary: '#ffffff',
    primaryCase: '#adaebd',
    secondary: '#ffffff',
    secondaryCase: '#b0b1c1',
    local: '#ffffff',
    // Small streets keep white fills; their outline carries them against the pale land.
    localCase: '#aeafc0',
    path: '#b9bac8',
    rail: '#bcbdca',
    shieldOpacity: 0.9,
    shieldText: '#3a3950',
    hillShadow: '#b4b6c6',
    hillHighlight: '#ffffff',
    hillAccent: '#c5c7d4',
    sky: '#dfe6f0',
    horizon: '#e9ebf1',
    fog: '#eeeff3',
    atmosphere: 0.15,
  },
  dark: {
    land: '#131218',
    residential: '#18171e',
    water: '#0e2536',
    waterFar: '#0c1c29',
    waterLine: '#17384f',
    waterLabel: '#7fa8c9',
    park: '#14291f',
    parkEdge: '#1c3a2c',
    grass: '#12231b',
    wood: '#12241b',
    farmland: '#14181a',
    wetland: '#12282a',
    sand: '#1c1912',
    ice: '#1a1c24',
    pitch: '#14291f',
    cemetery: '#15221b',
    hospital: '#1e181b',
    school: '#1c1a26',
    commercial: '#262019',
    aeroway: '#1c1b23',
    runway: '#2a2933',
    building: '#292831',
    buildingEdge: '#393845',
    building3d: '#292831',
    boundary: '#5b5a6b',
    boundaryLocal: '#3b3a46',
    label: '#e4e3ec',
    mutedLabel: '#a3a2b3',
    parkLabel: '#7fbf95',
    halo: 'rgba(19,18,24,0.92)',
    motorway: '#6b5b3f',
    motorwayCase: '#2c2619',
    trunk: '#574c3a',
    trunkCase: '#25211a',
    highwayFar: '#524738',
    highwayFarCase: '#241f18',
    primary: '#4c4b58',
    primaryCase: '#1d1c23',
    secondary: '#41404c',
    secondaryCase: '#1b1a21',
    local: '#363540',
    localCase: '#17161c',
    path: '#42414d',
    rail: '#45444f',
    shieldOpacity: 0.22,
    shieldText: '#e4e3ec',
    hillShadow: '#000000',
    hillHighlight: '#2c2b36',
    hillAccent: '#000000',
    sky: '#131218',
    horizon: '#1b1a21',
    fog: '#131218',
    atmosphere: 0.3,
  },
};

/**
 * POIs a driver or dispatcher acts on. Every one is labelled from zoom 14, in darker,
 * larger text, and wins over a landmark it collides with.
 */
const FLEET_POI_CLASSES = ['fuel', 'parking', 'car', 'hospital', 'police', 'fire_station'];
/**
 * Landmarks people give directions by, from street zoom (15), the tiles' ranking deciding
 * which appear first. Kept short on purpose: restaurants, cafés and corner shops would
 * crowd out what matters to a fleet.
 */
const LANDMARK_POI_CLASSES = [
  'school', 'college', 'place_of_worship', 'shop', 'lodging', 'bank',
  'stadium', 'attraction', 'town_hall', 'bus', 'railway',
];

// [kind, fill, edge, width by zoom up to 18, edge width beyond the fill at 18, first zoom, fades in]
const ROADS = [
  ['motorway', 'motorway', 'motorwayCase', [6.5, 0.6, 9, 1.4, 12, 3, 14, 6, 18, 18], [6.5, 1, 9, 2.2, 12, 4.2, 14, 7.8], 3, 6.5],
  ['motorway_link', 'motorway', 'motorwayCase', [9, 0.8, 12, 1.6, 14, 3.6, 18, 11], [9, 1.4, 12, 2.5, 14, 5], 2.5, 9],
  ['trunk_primary', 'primary', 'primaryCase', [8, 0.7, 10, 1.5, 12, 3.2, 14, 5.6, 18, 16], [8, 1.2, 10, 2.3, 12, 4.4, 14, 7.2], 3, 8],
  ['link', 'primary', 'primaryCase', [10, 0.6, 12, 1.4, 14, 3.2, 18, 10], [10, 1, 12, 2.2, 14, 4.4], 2.5, 10],
  ['secondary_tertiary', 'secondary', 'secondaryCase', [10.5, 0.8, 12, 1.9, 14, 3.4, 15, 4.6, 18, 13], [10.5, 1.3, 12, 2.9, 14, 4.7, 15, 6], 2.5, 10.5, true],
  ['minor', 'local', 'localCase', [13, 0.8, 14, 1.8, 15, 3, 16, 4.6, 18, 10], [13, 1.2, 14, 2.8, 15, 4.2, 16, 6], 2, 13, true],
  ['street', 'local', 'localCase', [13, 0.8, 14, 1.8, 15, 3, 16, 4.6, 18, 10], [13, 1.2, 14, 2.8, 15, 4.2, 16, 6], 2, 13, true],
  ['service_track', 'local', 'localCase', [14.5, 0.8, 16, 2, 18, 5], [14.5, 1.3, 16, 3], 2, 14.5, true],
];

/**
 * Past zoom 18 a road keeps its width on the ground: twice the pixels per zoom step, as the
 * ground does, up to the closest zoom (20). Without this, roads stopped widening at 18 and
 * thinned to ribbons next to the vehicles driving on them. The edge stays a fixed hairline.
 */
function roadWidths(fill, edgeLow, edge) {
  const at18 = fill[fill.length - 1];
  const fillStops = [...fill, 19, at18 * 2, 20, at18 * 4];
  const edgeStops = [...edgeLow, 18, at18 + edge, 19, at18 * 2 + edge, 20, at18 * 4 + edge];
  return [fillStops, edgeStops];
}

const PREFIXES = ['road', 'bridge', 'tunnel'];

const byZoom = (stops) => ['interpolate', ['linear'], ['zoom'], ...stops];

function buildStyle(name, palette) {
  const style = structuredClone(base);
  const layerById = new Map(style.layers.map((layer) => [layer.id, layer]));
  const edit = (id, change) => {
    const layer = layerById.get(id);
    if (!layer) return;
    layer.paint ??= {};
    layer.layout ??= {};
    change(layer);
  };
  const paint = (id, property, value) => edit(id, (layer) => (layer.paint[property] = value));
  const remove = (id) => {
    style.layers = style.layers.filter((layer) => layer.id !== id);
    layerById.delete(id);
  };

  style.name = `IoTility ${name}`;
  style.transition = { duration: 300, delay: 0 };
  // No glyphs URL: MapLibre then draws labels with the page's own fonts, which puts
  // the app's Inter on the map (see the 'Inter SemiBold' face in theme.css).
  delete style.glyphs;

  // Natural Earth's coloured relief stays on the light map when zoomed out (see
  // `reliefOpacity`); the dark map has the terrain below instead, as its bright
  // colours would glare there. The pattern on pedestrian areas is noise at fleet
  // zooms. Fill patterns would also hide the palette: a pattern always wins over a
  // fill colour.
  if (palette.reliefOpacity) {
    edit('natural_earth', (layer) => {
      layer.maxzoom = 7.5;
      layer.paint['raster-opacity'] = byZoom(palette.reliefOpacity);
    });
  } else {
    remove('natural_earth');
    delete style.sources.ne2_shaded;
  }
  remove('road_area_pattern');
  for (const layer of style.layers) if (layer.paint) delete layer.paint['fill-pattern'];

  style.sources.terrain = {
    type: 'raster-dem',
    tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
    encoding: 'terrarium',
    tileSize: 256,
    maxzoom: 12,
    attribution:
      '<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank">Terrain data</a>',
  };

  paint('background', 'background-color', palette.land);
  paint('landuse_residential', 'fill-color', palette.residential);
  // Water starts soft: at country zoom big rivers are polygons, and full blue overpowers the roads.
  paint('water', 'fill-color', byZoom([6, palette.waterFar, 10, palette.water]));
  for (const id of ['waterway_river', 'waterway_other', 'waterway_tunnel'])
    paint(id, 'line-color', palette.waterLine);
  paint('park', 'fill-color', palette.park);
  paint('park_outline', 'line-color', palette.parkEdge);
  paint('park', 'fill-outline-color', palette.parkEdge);
  paint('landcover_grass', 'fill-color', palette.grass);
  paint('landcover_wood', 'fill-color', palette.wood);
  // Farmland, which the base leaves undrawn, is most of the countryside: a soft green-yellow
  // under the woods and grass, quieter again at street zoom where roads and buildings lead.
  style.layers.splice(
    style.layers.findIndex((layer) => layer.id === 'landcover_wood'),
    0,
    {
      id: 'landcover_farmland',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landcover',
      filter: ['==', ['get', 'class'], 'farmland'],
      paint: {
        'fill-color': palette.farmland,
        'fill-opacity': byZoom([5, 0, 7, 0.85, 13, 0.85, 16, 0.5]),
      },
    },
  );
  paint('landcover_wetland', 'fill-color', palette.wetland);
  paint('landcover_sand', 'fill-color', palette.sand);
  paint('landcover_sand', 'fill-opacity', byZoom([5, 0.4, 9, 0.6, 12, 0.85]));
  paint('landcover_ice', 'fill-color', palette.ice);
  paint('landuse_pitch', 'fill-color', palette.pitch);
  paint('landuse_track', 'fill-color', palette.pitch);
  paint('landuse_cemetery', 'fill-color', palette.cemetery);
  paint('landuse_hospital', 'fill-color', palette.hospital);
  paint('landuse_school', 'fill-color', palette.school);
  paint('aeroway_fill', 'fill-color', palette.aeroway);
  paint('aeroway_runway', 'line-color', palette.runway);
  paint('aeroway_taxiway', 'line-color', palette.runway);
  // The base style drops flat buildings at zoom 14 and leaves only the 3D layer. Keeping them
  // means a building is the same solid block at every zoom, tilted or not.
  edit('building', (layer) => {
    delete layer.maxzoom;
    layer.paint['fill-color'] = palette.building;
    layer.paint['fill-outline-color'] = palette.buildingEdge;
  });

  for (const id of ['boundary_2', 'boundary_disputed']) {
    paint(id, 'line-color', palette.boundary);
    paint(id, 'line-dasharray', [3, 2]);
    paint(id, 'line-width', byZoom([3, 0.8, 8, 1.1, 12, 1.5]));
  }
  // Province and district lines matter when zoomed out and are clutter once you're following
  // roads, so they thin and fade away before city zoom.
  edit('boundary_3', (layer) => {
    layer.maxzoom = 11;
    layer.paint['line-color'] = palette.boundaryLocal;
    layer.paint['line-dasharray'] = [3, 2];
    layer.paint['line-width'] = byZoom([5, 0.6, 9, 0.9]);
    layer.paint['line-opacity'] = byZoom([9, 1, 11, 0]);
  });

  for (const prefix of PREFIXES) {
    for (const [kind, color, casing, fillLow, edgeLow, edge, minZoom, fades] of ROADS) {
      const [width, casingWidth] = roadWidths(fillLow, edgeLow, edge);
      for (const [id, lineColor, lineWidth] of [
        [`${prefix}_${kind}`, color, width],
        [`${prefix}_${kind}_casing`, casing, casingWidth],
      ]) {
        edit(id, (layer) => {
          layer.paint['line-color'] = palette[lineColor];
          layer.paint['line-width'] = byZoom(lineWidth);
          layer.layout['line-cap'] = 'round';
          layer.layout['line-join'] = 'round';
          layer.minzoom = minZoom;
          if (fades) layer.paint['line-opacity'] = byZoom([minZoom, 0, minZoom + 0.7, 1]);
          else delete layer.paint['line-opacity'];
        });
      }
    }
    // National highways are amber like motorways but paler, and at country zoom every main
    // road is, because a thin white line on pale land can't be followed.
    const highway = (far, trunk, primary) =>
      byZoom([10.5, palette[far], 12.5, ['match', ['get', 'class'], 'trunk', palette[trunk], palette[primary]]]);
    paint(`${prefix}_trunk_primary`, 'line-color', highway('highwayFar', 'trunk', 'primary'));
    paint(`${prefix}_trunk_primary_casing`, 'line-color', highway('highwayFarCase', 'trunkCase', 'primaryCase'));
    paint(`${prefix}_path_pedestrian`, 'line-color', palette.path);
    // Footpaths stay a light dotted thread at every zoom. Grown like roads, they turned into
    // heavy ladders across the street view.
    edit(`${prefix}_path_pedestrian`, (layer) => {
      layer.minzoom = 15;
      layer.paint['line-width'] = byZoom([15, 1, 17, 1.6, 18, 2.2, 20, 3.4]);
    });
    for (const rail of ['major_rail', 'major_rail_hatching', 'transit_rail', 'transit_rail_hatching'])
      paint(`${prefix}_${rail}`, 'line-color', palette.rail);
  }
  paint('bridge_path_pedestrian_casing', 'line-color', palette.localCase);
  paint('bridge_path_pedestrian_casing', 'line-width', byZoom([15, 2.2, 17, 3, 18, 3.8, 20, 5.2]));

  // Terrain sits over the land colours and under everything drawn on them, and
  // fades away before the zooms where a fleet map is read street by street.
  // Commercial and retail districts get a soft warm ground, so shopping areas read at a
  // glance. Whole areas, not single buildings: the tiles can't say what a building is used for.
  const commercialAt = style.layers.findIndex((layer) => layer.id === 'waterway_tunnel');
  style.layers.splice(commercialAt, 0, {
    id: 'landuse_commercial',
    type: 'fill',
    source: 'openmaptiles',
    'source-layer': 'landuse',
    minzoom: 11.5,
    filter: ['match', ['get', 'class'], ['commercial', 'retail'], true, false],
    paint: {
      'fill-color': palette.commercial,
      // Strong enough to find a market from across the city, then quieter at street zoom,
      // where the amber highways running past it must keep their edge.
      'fill-opacity': byZoom([11.5, 0, 12.5, 0.9, 15, 0.9, 17, 0.5]),
    },
  });

  const firstWater = style.layers.findIndex((layer) => layer.id === 'waterway_tunnel');
  style.layers.splice(firstWater, 0, {
    id: 'terrain-shade',
    type: 'hillshade',
    source: 'terrain',
    maxzoom: 13.5,
    paint: {
      'hillshade-exaggeration': byZoom([5, 0.2, 9, 0.22, 11, 0.16, 13.5, 0]),
      'hillshade-shadow-color': palette.hillShadow,
      'hillshade-highlight-color': palette.hillHighlight,
      'hillshade-accent-color': palette.hillAccent,
    },
  });

  // One 3D buildings layer, rising and fading in rather than popping.
  edit('building-3d', (layer) => {
    layer.minzoom = 14;
    layer.paint = {
      'fill-extrusion-color': palette.building3d,
      'fill-extrusion-height': byZoom([14, 0, 15, ['coalesce', ['to-number', ['get', 'render_height']], 6]]),
      'fill-extrusion-base': ['coalesce', ['to-number', ['get', 'render_min_height']], 0],
      'fill-extrusion-opacity': byZoom([14, 0, 15, 1]),
      // Off, with soft light on the style: the gradient and the default light turn low
      // buildings into dark slivers rather than solid blocks.
      'fill-extrusion-vertical-gradient': false,
    };
  });

  // Districts get their own layer, earlier than the rest of `label_other`: in a city like
  // Islamabad the sector (F-7, G-9, Blue Area) is how a vehicle's whereabouts are told.
  // Neighbourhoods, hamlets and localities stay in `label_other`, half a zoom later.
  const districtKinds = ['suburb', 'quarter'];
  edit('label_other', (layer) => {
    const suburb = structuredClone(layer);
    suburb.id = 'label_district';
    suburb.filter = ['match', ['get', 'class'], districtKinds, true, false];
    style.layers.splice(style.layers.indexOf(layer), 0, suburb);
    layerById.set(suburb.id, suburb);
    layer.filter = [
      'match', ['get', 'class'],
      ['city', 'continent', 'country', 'state', 'town', 'village', ...districtKinds], false, true,
    ];
  });
  // Park and reserve names, in green, under the place names so a district name wins a clash.
  const labelsAt = style.layers.findIndex((layer) => layer.id === 'label_district');
  const englishName = ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name_en'], ''];
  const parkLabel = (id, sourceLayer, minzoom, filter, size) => ({
    id,
    type: 'symbol',
    source: 'openmaptiles',
    'source-layer': sourceLayer,
    minzoom,
    filter,
    layout: { 'text-field': englishName, 'text-font': ['Inter'], 'text-size': size, 'text-max-width': 8, 'text-padding': 4 },
    paint: { 'text-color': palette.parkLabel },
  });
  style.layers.splice(
    labelsAt,
    0,
    // Large parks and reserves (Margalla Hills, Shakarparian) carry a label point in `park`.
    parkLabel('park_label', 'park', 9, ['match', ['geometry-type'], ['MultiPoint', 'Point'], true, false], byZoom([9, 10.5, 14, 12.5])),
    // City parks (Fatima Jinnah, Lake View) come as POIs once zoomed in.
    parkLabel('poi_park_label', 'poi', 14, ['==', ['get', 'class'], 'park'], byZoom([14, 10.5, 16, 12])),
  );

  for (const layer of style.layers) {
    if (layer.type !== 'symbol') continue;
    const layout = (layer.layout ??= {});
    const isBold = JSON.stringify(layout['text-font'] ?? '').includes('Bold');
    if (layout['text-font']) layout['text-font'] = [isBold ? 'Inter SemiBold' : 'Inter'];
    if (JSON.stringify(layout['text-field'] ?? '').includes('name'))
      // English, then a Latin spelling, then the local name (name_en quietly falls back to it).
      layout['text-field'] = ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name_en'], ''];
    if (!layout['text-field']) continue;
    layer.paint ??= {};
    layer.paint['text-halo-color'] = palette.halo;
    layer.paint['text-halo-width'] = layer.id.startsWith('label_') ? 1.6 : 1.3;
    layer.paint['text-halo-blur'] = 0.4;
  }

  // Place names: plain text centred on the place. No dots, and no variable anchors,
  // which is what makes labels jump about while panning.
  for (const id of ['label_village', 'label_town', 'label_city', 'label_city_capital']) {
    edit(id, (layer) => {
      delete layer.layout['icon-image'];
      delete layer.layout['text-offset'];
      delete layer.layout['text-variable-anchor'];
      delete layer.layout['text-radial-offset'];
      layer.layout['text-anchor'] = 'center';
      layer.layout['text-padding'] = 2;
    });
  }
  for (const [id, minZoom] of [
    ['label_city_capital', 3],
    ['label_city', 4],
    ['label_town', 6],
    ['label_village', 8],
    ['label_district', 11.5],
    ['label_other', 12.5],
    ['highway-name-major', 11],
    ['highway-name-minor', 12.5],
  ])
    edit(id, (layer) => (layer.minzoom = minZoom));
  // A place name belongs to the zoom where the place fits on screen. Without an end, the
  // city label sat on the Zero Point interchange at a 20 m scale. Each fades out first.
  for (const [id, maxZoom] of [
    ['label_city_capital', 14.5],
    ['label_city', 14.5],
    ['label_town', 15.5],
    ['label_village', 16.5],
  ])
    edit(id, (layer) => {
      layer.maxzoom = maxZoom;
      layer.paint['text-opacity'] = byZoom([maxZoom - 0.8, 1, maxZoom, 0]);
    });
  edit('label_other', (layer) => {
    layer.layout['text-transform'] = 'none';
    layer.layout['text-letter-spacing'] = 0;
    layer.layout['text-size'] = byZoom([12.5, 10, 16, 12]);
    layer.layout['text-padding'] = 4;
  });
  // Districts a touch bolder than the rest, packed close enough that a city's grid of
  // sectors all get their name.
  edit('label_district', (layer) => {
    layer.layout['text-transform'] = 'none';
    layer.layout['text-letter-spacing'] = 0.01;
    layer.layout['text-font'] = ['Inter SemiBold'];
    layer.layout['text-size'] = byZoom([11.5, 10.5, 15, 13]);
    layer.layout['text-padding'] = 3;
  });
  // Road names a little smaller at city zoom, so more of them fit beside the place names.
  for (const id of ['highway-name-major', 'highway-name-minor'])
    edit(id, (layer) => (layer.layout['text-size'] = byZoom([11, 10, 13, 11, 15, 12.5, 17, 13.5])));
  const quietLabels = ['label_other', 'label_district', 'label_state'];
  for (const layer of style.layers.filter(({ id }) => id.startsWith('label_')))
    layer.paint['text-color'] = quietLabels.includes(layer.id) ? palette.mutedLabel : palette.label;
  for (const id of ['highway-name-major', 'highway-name-minor', 'highway-name-path', 'airport'])
    paint(id, 'text-color', palette.mutedLabel);
  for (const id of ['waterway_line_label', 'water_name_point_label', 'water_name_line_label'])
    paint(id, 'text-color', palette.waterLabel);
  for (const id of ['highway-shield-non-us', 'highway-shield-us-interstate', 'road_shield_us'])
    edit(id, (layer) => {
      layer.paint['icon-opacity'] = palette.shieldOpacity;
      layer.paint['text-color'] = palette.shieldText;
      // Route numbers further apart as roads lengthen on screen. At a fixed 200 px a divided
      // highway carried a dozen "E-75" boxes at street zoom, one row per carriageway.
      layer.layout['symbol-spacing'] = byZoom([8, 200, 13, 280, 16, 460, 18, 700]);
    });
  for (const id of ['road_one_way_arrow', 'road_one_way_arrow_opposite'])
    paint(id, 'icon-opacity', 0.5);

  // Fleet places first, then landmarks, and only once zoomed in, so the basemap never
  // competes with vehicles and event dots at the zooms a fleet is watched at.
  edit('poi_r1', (layer) => {
    const fleet = structuredClone(layer);
    fleet.id = 'poi_fleet';
    fleet.minzoom = 14;
    fleet.filter = [
      'all',
      ['match', ['geometry-type'], ['MultiPoint', 'Point'], true, false],
      ['match', ['get', 'class'], FLEET_POI_CLASSES, true, false],
    ];
    fleet.layout['text-font'] = ['Inter SemiBold'];
    fleet.layout['text-size'] = byZoom([14, 11.5, 17, 13]);
    fleet.layout['icon-size'] = byZoom([14, 1, 17, 1.15]);
    fleet.paint['text-color'] = palette.label;
    fleet.paint['icon-opacity'] = 1;
    // Later in the list is placed first, so these win any clash with a landmark.
    style.layers.splice(style.layers.indexOf(layer) + 1, 0, fleet);
    layerById.set(fleet.id, fleet);
  });
  for (const id of ['poi_r1', 'poi_r7', 'poi_r20']) {
    edit(id, (layer) => {
      layer.filter = ['all', layer.filter, ['match', ['get', 'class'], LANDMARK_POI_CLASSES, true, false]];
      layer.paint['text-color'] = palette.mutedLabel;
      layer.paint['icon-opacity'] = 0.85;
      layer.layout['text-size'] = byZoom([15, 11, 17, 12.5]);
    });
  }
  edit('poi_transit', (layer) => {
    layer.filter = ['match', ['get', 'class'], ['airport', 'rail'], true, false];
    layer.minzoom = 14;
    layer.paint['text-color'] = palette.mutedLabel;
    layer.paint['icon-opacity'] = 0.85;
  });

  style.light = { anchor: 'viewport', color: '#ffffff', intensity: 0.15 };
  style.sky = {
    'sky-color': palette.sky,
    'horizon-color': palette.horizon,
    'fog-color': palette.fog,
    'fog-ground-blend': 0.5,
    'horizon-fog-blend': 0.6,
    'sky-horizon-blend': 0.8,
    'atmosphere-blend': palette.atmosphere,
  };

  return style;
}

mkdirSync(outputDir, { recursive: true });
for (const [name, palette] of Object.entries(palettes)) {
  const style = buildStyle(name === 'light' ? 'Light' : 'Dark', palette);
  const file = join(outputDir, `iotility-${name}.json`);
  writeFileSync(file, JSON.stringify(style));
  console.log(`${name}: ${style.layers.length} layers, ${Math.round(JSON.stringify(style).length / 1024)} KB`);
}
