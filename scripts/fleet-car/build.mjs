// Builds IoTility's fleet car: a smooth modern crossover in pearl white with dark glass, black
// lower cladding, tyres with silver rims, smoked LED headlights and a full-width tail light bar.
// White reads on the light map, the dark map and the purple trail alike. Metres, Y up, +Z forward, +X to the car's left (the convention the maps expect).
// An original model, so no licence applies. Rebuild after changing it:
//   node scripts/fleet-car/build.mjs projects/fleetpoint/public/assets/trip-vehicles/car.glb [preview.png]
// The optional preview renders it from above, at the maps' chase angle, side-on and from the front.
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

function writeGlb({ json, bin }) {
  const pad = (buffer, byte) => {
    const extra = (4 - (buffer.length % 4)) % 4;
    return extra ? Buffer.concat([buffer, Buffer.alloc(extra, byte)]) : buffer;
  };
  const jsonChunk = pad(Buffer.from(JSON.stringify(json)), 0x20);
  const binChunk = pad(bin, 0);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);
  const chunk = (data, type) => {
    const head = Buffer.alloc(8);
    head.writeUInt32LE(data.length, 0);
    head.writeUInt32LE(type, 4);
    return Buffer.concat([head, data]);
  };
  return Buffer.concat([header, chunk(jsonChunk, 0x4e4f534a), chunk(binChunk, 0x004e4942)]);
}

const [outGlb, outPng] = process.argv.slice(2);

const L = 4.5, W = 1.86;
const HALF_L = L / 2;
const CLEARANCE = 0.2;

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

/** Half-width of the body at z: a blunt superellipse in plan, so the corners are rounded. */
function halfWidth(z) {
  const t = Math.min(0.995, Math.abs(z) / HALF_L);
  return (W / 2) * Math.pow(1 - Math.pow(t, 4.5), 1 / 4.5);
}
/** Bottom of the body: lifts at the bumpers. */
const AXLES = [1.4, -1.36];
const ARCH = 0.47; // arch radius: the tyre plus a little air
function bottomY(z) {
  const t = Math.abs(z) / HALF_L;
  let y = CLEARANCE + 0.2 * smooth(0.72, 1, t);
  for (const axle of AXLES) {
    const dz = z - axle;
    if (Math.abs(dz) < ARCH) y = Math.max(y, 0.39 + Math.sqrt(ARCH * ARCH - dz * dz) * 0.92);
  }
  return y;
}
/** Belt line / top of the lower body: a sloping bonnet at the front, a short deck at the back. */
function beltY(z) {
  if (z > 0) return lerp(1.0, 0.76, smooth(0.95, HALF_L, z)) - 0.04 * smooth(0, 0.95, z);
  return lerp(0.96, 0.98, smooth(0, -1.2, z)) - 0.1 * smooth(-1.85, -HALF_L, z);
}
/** Roof line over the cabin: windscreen rising from z = 1.0, flat roof, steep tailgate. */
const CABIN_FRONT = 1.02, CABIN_BACK = -2.02;
function roofY(z) {
  const front = smooth(CABIN_FRONT, 0.05, z); // 0 at the windscreen base, 1 at the roof
  const back = smooth(CABIN_BACK, -1.35, z); // 0 at the tailgate base, 1 at the roof
  const belt = beltY(z);
  return belt + (1.6 - belt) * Math.min(front, back) + 0.02 * Math.sin(Math.PI * smooth(CABIN_BACK, CABIN_FRONT, z));
}

const mesh = { positions: [], normals: [], tris: [] }; // tris: [a, b, c, material]

/** A lofted surface: rows of points along z, each row a cross-section. Smooth normals. */
function loft(rows, material, closed = true, pick = null, inside = (p) => [0, 0.72, p[2]]) {
  const base = mesh.positions.length;
  const cols = rows[0].length;
  for (const row of rows) for (const p of row) { mesh.positions.push(p); mesh.normals.push([0, 0, 0]); }
  const at = (r, c) => base + r * cols + (c % cols);
  const faces = [];
  for (let r = 0; r < rows.length - 1; r++)
    for (let c = 0; c < (closed ? cols : cols - 1); c++) {
      faces.push([at(r, c), at(r + 1, c), at(r + 1, c + 1)]);
      faces.push([at(r, c), at(r + 1, c + 1), at(r, c + 1)]);
    }
  outward(faces, inside);
  accumulate(faces);
  for (const f of faces) mesh.tris.push([...f, pick ? pick(f) : material]);
  return { at, cols };
}

function faceNormal([a, b, c]) {
  const p = mesh.positions;
  const u = [0, 1, 2].map((k) => p[b][k] - p[a][k]), v = [0, 1, 2].map((k) => p[c][k] - p[a][k]);
  return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
}
function accumulate(faces) {
  for (const f of faces) {
    const n = faceNormal(f);
    for (const i of f) for (let k = 0; k < 3; k++) mesh.normals[i][k] += n[k];
  }
}
/** Winds each face so its normal points away from the given inside point. */
function outward(faces, inside) {
  for (const f of faces) {
    const n = faceNormal(f), c = centroid(f), o = inside(c);
    if (n[0] * (c[0] - o[0]) + n[1] * (c[1] - o[1]) + n[2] * (c[2] - o[2]) < 0) [f[1], f[2]] = [f[2], f[1]];
  }
}
const centroid = (f) => [0, 1, 2].map((k) => (mesh.positions[f[0]][k] + mesh.positions[f[1]][k] + mesh.positions[f[2]][k]) / 3);

// ── Lower body ───────────────────────────────────────────
const STATIONS = 120, AROUND = 44;
const zs = Array.from({ length: STATIONS }, (_, i) => -HALF_L * Math.cos((Math.PI * i) / (STATIONS - 1)) * 0.995);
const bodyRows = zs.map((z) => {
  const w = halfWidth(z), yb = bottomY(z), yt = beltY(z);
  const yc = (yb + yt) / 2, h = (yt - yb) / 2;
  return Array.from({ length: AROUND }, (_, j) => {
    const th = (2 * Math.PI * j) / AROUND;
    const c = Math.cos(th), s = Math.sin(th);
    const e = 2 / 5; // rounded section: soft shoulders and sills
    return [w * Math.sign(c) * Math.pow(Math.abs(c), e), yc + h * Math.sign(s) * Math.pow(Math.abs(s), e), z];
  });
});
const bodyBase = mesh.positions.length;
/**
 * Paints each face of the lower body by its grid cell (station along the car, angle around the
 * section) rather than its position, so every colour edge runs along the mesh and stays clean.
 */
const bodyMaterial = (f) => {
  const cells = f.map((i) => [Math.floor((i - bodyBase) / AROUND), (i - bodyBase) % AROUND]);
  const row = Math.min(...cells.map(([r]) => r));
  const cols = cells.map(([, c]) => c);
  const col = Math.max(...cols) - Math.min(...cols) > 1 ? AROUND - 1 : Math.min(...cols);
  const z = (zs[row] + zs[row + 1]) / 2;
  const s = Math.sin((2 * Math.PI * (col + 0.5)) / AROUND); // 1 at the top, -1 underneath
  const fromFront = HALF_L - z, fromBack = z + HALF_L;
  // Headlights: a slim smoked unit wrapping the front corners, an LED strip along its top.
  if (fromFront < 0.5 && s > 0.12 && s < 0.66) return s > 0.5 && fromFront < 0.42 ? 'headlight' : 'lamp';
  // Tail lights: a full-width red bar wrapping round the rear corners.
  if (fromBack < 0.3 && s > 0.38 && s < 0.72) return 'taillight';
  // Black cladding along the sills and arch lips, and the lower front intake.
  if (s < -0.55) return 'trim';
  if (fromFront < 0.24 && s < -0.05) return 'trim';
  return 'paint';
};
loft(bodyRows, 'paint', true, bodyMaterial);
// Caps at both ends (fans), so the body is closed.
for (const [row, flip] of [[bodyRows[0], true], [bodyRows[STATIONS - 1], false]]) {
  const centre = mesh.positions.length;
  const z = row[0][2];
  mesh.positions.push([0, (bottomY(z) + beltY(z)) / 2, z]); mesh.normals.push([0, 0, 0]);
  const start = mesh.positions.length;
  for (const p of row) { mesh.positions.push(p); mesh.normals.push([0, 0, 0]); }
  const faces = row.map((_, j) => flip ? [centre, start + ((j + 1) % row.length), start + j] : [centre, start + j, start + ((j + 1) % row.length)]);
  outward(faces, (p) => [0, 0.72, p[2] * 0.5]);
  accumulate(faces);
  for (const f of faces) mesh.tris.push([...f, 'trim']);
}

// ── Cabin (glasshouse) ───────────────────────────────────
const CABIN_STATIONS = 48, CABIN_AROUND = 30;
const cabinZs = Array.from({ length: CABIN_STATIONS }, (_, i) => lerp(CABIN_BACK, CABIN_FRONT, i / (CABIN_STATIONS - 1)));
const cabinRows = cabinZs.map((z) => {
  const yb = beltY(z) - 0.02, yr = roofY(z);
  const wb = halfWidth(z) - 0.07;
  const lift = Math.max(0.001, yr - yb);
  const wt = wb - Math.min(0.26, lift * 0.42); // tumblehome: the sides lean in
  // Section from the left belt, up the left side, across the roof, down the right side.
  return Array.from({ length: CABIN_AROUND }, (_, j) => {
    const u = j / (CABIN_AROUND - 1); // 0 = left belt, 1 = right belt
    const a = Math.PI * u; // half superellipse over the top
    const c = Math.cos(a), s = Math.sin(a);
    const e = 2 / 5;
    const x = Math.sign(c) * Math.pow(Math.abs(c), e);
    const y = Math.pow(s, e);
    const halfW = lerp(wb, wt, y);
    return [x * halfW, yb + y * lift, z];
  });
});
const cabinBase = mesh.positions.length;
const cabin = loft(cabinRows, 'glass', false, (f) => {
  // Grid cell of the face: row (station along the car) and column (around the section).
  const cells = f.map((i) => [Math.floor((i - cabinBase) / CABIN_AROUND), (i - cabinBase) % CABIN_AROUND]);
  const row = Math.min(...cells.map(([r]) => r)), col = Math.min(...cells.map(([, c]) => c));
  const z = cabinZs[row];
  const full = Math.min(smooth(CABIN_FRONT, 0.05, z), smooth(CABIN_BACK, -1.35, z));
  const u = (col + 0.5) / (CABIN_AROUND - 1);
  return full > 0.9 && u > 0.2 && u < 0.8 ? 'roof' : 'glass';
});

// ── Wheels ───────────────────────────────────────────────
const R = 0.39, TYRE = 0.26, RIM = 0.25, SEG = 40;
function wheel(cx, cz) {
  const side = Math.sign(cx);
  const inner = cx - side * TYRE / 2, outer = cx + side * TYRE / 2;
  const ring = (x, radius, dx = 0) => Array.from({ length: SEG }, (_, i) => {
    const a = (2 * Math.PI * i) / SEG;
    return [x + dx, R + radius * Math.sin(a), cz + radius * Math.cos(a)];
  });
  // Tyre tread with rounded shoulders.
  const tread = [ring(inner, R * 0.92), ring(inner + side * 0.03, R), ring(outer - side * 0.03, R), ring(outer, R * 0.92)];
  loft(tread, 'tyre', true, null, (p) => [p[0], R, cz]);
  // Outer face: black sidewall ring, then a slightly recessed silver rim.
  const faces = (rings, material) => loft(rings, material, true, null, (p) => [cx, R, cz]);
  faces([ring(outer, R * 0.92), ring(outer, RIM)], 'tyre');
  faces([ring(outer, RIM), ring(outer - side * 0.03, RIM * 0.6), ring(outer - side * 0.02, 0.04)], 'rim');
  // Inner face, closed in black.
  faces([ring(inner, 0.04), ring(inner, R * 0.92)], 'tyre');
}
for (const x of [W / 2 - 0.15, -(W / 2 - 0.15)]) for (const z of AXLES) wheel(x, z);

// ── Mirrors ──────────────────────────────────────────────
function box(cx, cy, cz, sx, sy, sz, material) {
  const corners = [];
  for (const dx of [-1, 1]) for (const dy of [-1, 1]) for (const dz of [-1, 1]) corners.push([cx + dx * sx, cy + dy * sy, cz + dz * sz]);
  const quads = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]];
  for (const q of quads) {
    const base = mesh.positions.length;
    for (const i of q) { mesh.positions.push(corners[i]); mesh.normals.push([0, 0, 0]); }
    const f1 = [base, base + 1, base + 2], f2 = [base, base + 2, base + 3];
    accumulate([f1, f2]);
    mesh.tris.push([...f1, material], [...f2, material]);
  }
}
for (const side of [1, -1]) box(side * (halfWidth(0.9) - 0.02), 1.03, 0.88, 0.06, 0.045, 0.08, 'trim');

// ── Materials ────────────────────────────────────────────
const MATERIALS = {
  paint: { color: [0.94, 0.945, 0.96], metallic: 0.05, roughness: 0.32 },
  roof: { color: [0.94, 0.945, 0.96], metallic: 0.05, roughness: 0.32 },
  glass: { color: [0.05, 0.06, 0.085], metallic: 0.2, roughness: 0.12 },
  trim: { color: [0.11, 0.115, 0.13], metallic: 0, roughness: 0.6 },
  tyre: { color: [0.06, 0.06, 0.07], metallic: 0, roughness: 0.85 },
  // Low metallic: with no environment map to reflect, a metallic rim would render dark.
  rim: { color: [0.72, 0.74, 0.78], metallic: 0.3, roughness: 0.35 },
  lamp: { color: [0.07, 0.08, 0.1], metallic: 0.1, roughness: 0.15 },
  headlight: { color: [0.92, 0.95, 1], metallic: 0, roughness: 0.2, emissive: [0.75, 0.82, 0.95] },
  taillight: { color: [0.75, 0.05, 0.08], metallic: 0, roughness: 0.25, emissive: [0.85, 0.05, 0.08] },
};

// Normalise the accumulated normals.
for (const n of mesh.normals) {
  const len = Math.hypot(...n) || 1;
  n[0] /= len; n[1] /= len; n[2] /= len;
}

// ── Preview: smooth-shaded software render at the maps' camera angles ──
function preview() {
  const { PNG } = createRequire(import.meta.url)('pngjs');
  const views = [
    { yaw: 0, pitch: 0, scale: 52, label: 'top' },
    { yaw: 0, pitch: 0.91, scale: 52, label: 'chase 52°' },
    { yaw: 0.6, pitch: 0.91, scale: 52, label: 'chase, turning' },
    { yaw: Math.PI / 2, pitch: 1.25, scale: 52, label: 'side' },
    { yaw: Math.PI + 0.5, pitch: 0.95, scale: 52, label: 'front' },
  ];
  const backgrounds = [[238, 239, 243], [19, 18, 24]];
  const cell = 260;
  const image = new PNG({ width: cell * views.length, height: cell * backgrounds.length });
  const light = [0.35, 0.8, 0.55]; const ll = Math.hypot(...light); light.forEach((v, i) => (light[i] = v / ll));
  backgrounds.forEach((bg, row) => views.forEach((view, col) => {
    const ox = col * cell, oy = row * cell;
    for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
      const o = ((oy + y) * image.width + ox + x) * 4;
      image.data[o] = bg[0]; image.data[o + 1] = bg[1]; image.data[o + 2] = bg[2]; image.data[o + 3] = 255;
    }
    const depth = new Float32Array(cell * cell).fill(-Infinity);
    const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw), cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
    const toGround = ([mx, my, mz]) => { let gx = -mx, gy = mz; [gx, gy] = [gx * cy + gy * sy, -gx * sy + gy * cy]; return [gx, gy, my]; };
    const project = (p) => { const [gx, gy, gz] = toGround(p); return [cell / 2 + gx * view.scale, cell * 0.58 - (gy * cp + gz * sp) * view.scale, gz * cp - gy * sp]; };
    const eye = [0, -sp, cp]; // towards the viewer in ground space (east, north, up)
    // Soft contact shadow.
    for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
      const gx = (x - cell / 2) / view.scale; const gyp = (cell * 0.58 - y) / view.scale; const gy = cp > 0.05 ? gyp / cp : 0;
      const [mx, mz] = [-(gx * cy - gy * sy), gx * sy + gy * cy];
      const d = Math.pow(Math.abs(mx) / (W / 2 + 0.1), 4) + Math.pow(Math.abs(mz) / (HALF_L + 0.1), 4);
      if (d < 1.4) { const a = 0.35 * (1 - Math.min(1, d / 1.4)); const o = ((oy + y) * image.width + ox + x) * 4; for (let k = 0; k < 3; k++) image.data[o + k] *= 1 - a; }
    }
    for (const [a, b, c, material] of mesh.tris) {
      const v = [a, b, c].map((i) => project(mesh.positions[i]));
      const area = (v[1][0] - v[0][0]) * (v[2][1] - v[0][1]) - (v[1][1] - v[0][1]) * (v[2][0] - v[0][0]);
      if (Math.abs(area) < 1e-9) continue;
      const m = MATERIALS[material];
      const ns = [a, b, c].map((i) => toGround(mesh.normals[i]));
      const minX = Math.max(0, Math.floor(Math.min(v[0][0], v[1][0], v[2][0]))), maxX = Math.min(cell - 1, Math.ceil(Math.max(v[0][0], v[1][0], v[2][0])));
      const minY = Math.max(0, Math.floor(Math.min(v[0][1], v[1][1], v[2][1]))), maxY = Math.min(cell - 1, Math.ceil(Math.max(v[0][1], v[1][1], v[2][1])));
      for (let py = minY; py <= maxY; py++) for (let px = minX; px <= maxX; px++) {
        const qx = px + 0.5, qy = py + 0.5;
        const w0 = ((v[1][0] - qx) * (v[2][1] - qy) - (v[1][1] - qy) * (v[2][0] - qx)) / area;
        const w1 = ((v[2][0] - qx) * (v[0][1] - qy) - (v[2][1] - qy) * (v[0][0] - qx)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * v[0][2] + w1 * v[1][2] + w2 * v[2][2];
        const di = py * cell + px;
        if (z <= depth[di]) continue;
        depth[di] = z;
        let n = [0, 1, 2].map((k) => w0 * ns[0][k] + w1 * ns[1][k] + w2 * ns[2][k]);
        const nl = Math.hypot(...n) || 1; n = n.map((x) => x / nl);
        if (n[0] * eye[0] + n[1] * eye[1] + n[2] * eye[2] < 0) n = n.map((x) => -x);
        const lambert = Math.max(0, n[0] * light[0] + n[1] * light[1] + n[2] * light[2]);
        const sky = Math.max(0, n[2]);
        const h = [light[0] + eye[0], light[1] + eye[1], light[2] + eye[2]]; const hl = Math.hypot(...h);
        const spec = Math.pow(Math.max(0, (n[0] * h[0] + n[1] * h[1] + n[2] * h[2]) / hl), 2 / Math.max(0.02, m.roughness ** 2) / 4) * (1 - m.roughness) * 0.6;
        const shade = 0.42 + 0.45 * lambert + 0.22 * sky;
        const o = ((oy + py) * image.width + ox + px) * 4;
        for (let k = 0; k < 3; k++) {
          const base = m.color[k] * shade + spec + (m.emissive?.[k] ?? 0) * 0.6;
          image.data[o + k] = Math.min(255, Math.round(Math.pow(Math.min(1, base), 1 / 1.25) * 255));
        }
      }
    }
  }));
  writeFileSync(outPng, PNG.sync.write(image));
}
if (outPng) preview();

// ── GLB: one primitive per material, flat-indexed per primitive ──
const groups = new Map();
for (const [a, b, c, material] of mesh.tris) {
  if (!groups.has(material)) groups.set(material, []);
  groups.get(material).push(a, b, c);
}
const chunks = [];
const json = {
  asset: { version: '2.0', generator: 'IoTility fleet car builder', copyright: 'IoTility (original model)' },
  scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: 'car' }],
  meshes: [{ name: 'car', primitives: [] }],
  materials: [], accessors: [], bufferViews: [], buffers: [],
};
let offset = 0;
const pushView = (buffer, target) => {
  const padded = Buffer.concat([buffer, Buffer.alloc((4 - (buffer.length % 4)) % 4)]);
  json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: buffer.length, target });
  chunks.push(padded);
  offset += padded.length;
  return json.bufferViews.length - 1;
};
for (const [name, indices] of groups) {
  // Re-index into a compact vertex set for this material.
  const remap = new Map(); const pos = []; const nor = []; const idx = [];
  for (const i of indices) {
    if (!remap.has(i)) { remap.set(i, pos.length / 3); pos.push(...mesh.positions[i]); nor.push(...mesh.normals[i]); }
    idx.push(remap.get(i));
  }
  const min = [0, 1, 2].map((k) => Math.min(...pos.filter((_, j) => j % 3 === k)));
  const max = [0, 1, 2].map((k) => Math.max(...pos.filter((_, j) => j % 3 === k)));
  const posView = pushView(Buffer.from(new Float32Array(pos).buffer), 34962);
  const norView = pushView(Buffer.from(new Float32Array(nor).buffer), 34962);
  const idxView = pushView(Buffer.from(new Uint32Array(idx).buffer), 34963);
  json.accessors.push({ bufferView: posView, componentType: 5126, count: pos.length / 3, type: 'VEC3', min, max });
  json.accessors.push({ bufferView: norView, componentType: 5126, count: nor.length / 3, type: 'VEC3' });
  json.accessors.push({ bufferView: idxView, componentType: 5125, count: idx.length, type: 'SCALAR' });
  const m = MATERIALS[name];
  json.materials.push({
    name,
    pbrMetallicRoughness: { baseColorFactor: [...m.color, 1], metallicFactor: m.metallic, roughnessFactor: m.roughness },
    ...(m.emissive ? { emissiveFactor: m.emissive } : {}),
    doubleSided: true,
  });
  const a = json.accessors.length;
  json.meshes[0].primitives.push({ attributes: { POSITION: a - 3, NORMAL: a - 2 }, indices: a - 1, material: json.materials.length - 1 });
}
const bin = Buffer.concat(chunks);
json.buffers.push({ byteLength: bin.length });
writeFileSync(outGlb, writeGlb({ json, bin }));
console.log(`triangles ${mesh.tris.length}, vertices ${mesh.positions.length}, glb ${Math.round(bin.length / 1024)} KB`);
