// Random furniture spawner for rogue-like rooms.
// Each furniture type has a count range and a footprint radius used for
// non-overlap checks. Positions are chosen to stay >= wallMargin from every
// wall of the picked room and >= (r1 + r2) apart from any other placed piece.

import * as THREE from 'three';
import { loadOBJMTL } from './model.js';

/**
 * Build XZ exclusion rectangles in front of every wall-mounted painting so
 * furniture doesn't spawn where it would block the artwork. Each rect spans
 * the painting's width along the wall and extends `depth` units toward the
 * room interior.
 *
 * @param {THREE.Mesh[]} paintings
 * @param {number} [depth=10]
 * @returns {Array<{minX:number, maxX:number, minZ:number, maxZ:number}>}
 */
export function computePaintingExclusionRects(paintings, depth = 10) {
  const rects = [];
  const seenGrids = new Set();

  for (const p of paintings) {
    // Grid artwork: use the full grid footprint once, then skip its siblings.
    const gridId = p.userData?.gridId;
    if (gridId) {
      if (seenGrids.has(gridId)) continue;
      seenGrids.add(gridId);
      const w = p.userData.gridWidth;
      const ry = p.rotation.y;
      const { x, z } = p.userData.gridCenter;
      const halfW = w / 2;
      if (Math.abs(ry) < 0.01) {
        rects.push({ minX: x - halfW, maxX: x + halfW, minZ: z, maxZ: z + depth });
      } else if (Math.abs(ry - Math.PI) < 0.01) {
        rects.push({ minX: x - halfW, maxX: x + halfW, minZ: z - depth, maxZ: z });
      } else if (Math.abs(ry - Math.PI / 2) < 0.01) {
        rects.push({ minX: x, maxX: x + depth, minZ: z - halfW, maxZ: z + halfW });
      } else if (Math.abs(ry + Math.PI / 2) < 0.01) {
        rects.push({ minX: x - depth, maxX: x, minZ: z - halfW, maxZ: z + halfW });
      }
      continue;
    }

    // Single-image artwork: per-mesh geometry width.
    const w = p.geometry?.parameters?.width;
    if (!w) continue;
    const halfW = w / 2;
    const x = p.position.x;
    const z = p.position.z;
    const ry = p.rotation.y;

    if (Math.abs(ry) < 0.01) {
      rects.push({ minX: x - halfW, maxX: x + halfW, minZ: z, maxZ: z + depth });
    } else if (Math.abs(ry - Math.PI) < 0.01) {
      rects.push({ minX: x - halfW, maxX: x + halfW, minZ: z - depth, maxZ: z });
    } else if (Math.abs(ry - Math.PI / 2) < 0.01) {
      rects.push({ minX: x, maxX: x + depth, minZ: z - halfW, maxZ: z + halfW });
    } else if (Math.abs(ry + Math.PI / 2) < 0.01) {
      rects.push({ minX: x - depth, maxX: x, minZ: z - halfW, maxZ: z + halfW });
    }
  }
  return rects;
}

// scale / y values were tuned by hand in the size-check pass — do not touch
// unless you also verify them in-scene.
const FURNITURE_TYPES = [
  {
    name: 'Gurney',
    countMin: 0,
    countMax: 1,
    variants: [
      { basePath: '/models/gurney/', mtlName: 'Gurney.mtl', objName: 'Gurney.obj' },
    ],
    scale: 0.042,
    y: -3.17,
    clearance: 4,
  },
  {
    name: 'Hotel Chair',
    countMin: 2,
    countMax: 4,
    variants: [
      { basePath: '/models/hotelChair/', mtlName: 'Hotel%20Chair.mtl', objName: 'Hotel%20Chair.obj' },
    ],
    scale: 0.052,
    y: -1.29,
    clearance: 3,
  },
  {
    name: 'Hotel Wardrobe',
    countMin: 1,
    countMax: 2,
    variants: [
      { basePath: '/models/hotelWardrobe/', mtlName: 'Hotel%20Wardrobe.mtl', objName: 'Hotel%20Wardrobe.obj' },
    ],
    scale: 0.067,
    y: -3.16,
    clearance: 4,
  },
  {
    name: 'Iron Cabinet',
    countMin: 1,
    countMax: 3,
    variants: [
      { basePath: '/models/ironCabinet/', mtlName: 'Cabinet_Iron.mtl', objName: 'Cabinet_Iron.obj' },
      { basePath: '/models/ironCabinet/', mtlName: 'Cabinet_Iron_open.mtl', objName: 'Cabinet_Iron_open.obj' },
    ],
    scale: 0.03,
    y: -3.15,
    clearance: 3,
  },
];

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randFloat = (min, max) => Math.random() * (max - min) + min;
const randSign = () => (Math.random() < 0.5 ? -1 : 1);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Random 3-axis rotation in degrees where |x|+|y|+|z| <= maxTotal.
function randomRotationBudget(maxTotal = 180) {
  const wx = Math.random();
  const wy = Math.random();
  const wz = Math.random();
  const wsum = wx + wy + wz || 1;
  const total = Math.random() * maxTotal;
  return [
    (wx / wsum) * total * randSign(),
    (wy / wsum) * total * randSign(),
    (wz / wsum) * total * randSign(),
  ];
}

/**
 * Spawn random furniture across the given rooms.
 * @param {THREE.Scene} scene
 * @param {Array} rooms - room configs: { id, width, depth, position: {x, y, z} }
 * @param {Object} [options]
 * @param {number} [options.wallMargin=3]  - min distance from any wall (units)
 * @param {Array}  [options.preOccupied=[]] - known static obstacles: [{ x, z, r }]
 * @param {Array}  [options.avoidRects=[]]  - XZ exclusion rectangles: [{minX,maxX,minZ,maxZ}]
 */
export function spawnRoomFurniture(scene, rooms, options = {}) {
  const { wallMargin = 3, preOccupied = [], avoidRects = [] } = options;

  const placed = preOccupied.map((p) => ({ x: p.x, z: p.z, r: p.r ?? 2 }));

  FURNITURE_TYPES.forEach((type) => {
    const count = randInt(type.countMin, type.countMax);

    for (let i = 0; i < count; i++) {
      const room = pick(rooms);
      const halfW = room.width / 2 - wallMargin;
      const halfD = room.depth / 2 - wallMargin;
      if (halfW <= 0 || halfD <= 0) continue;

      let x = 0, z = 0, ok = false;
      for (let tries = 0; tries < 30 && !ok; tries++) {
        x = room.position.x + randFloat(-halfW, halfW);
        z = room.position.z + randFloat(-halfD, halfD);
        const clearOfPlaced = placed.every(
          (p) => Math.hypot(p.x - x, p.z - z) >= p.r + type.clearance
        );
        if (!clearOfPlaced) continue;
        // Distance from candidate circle to each exclusion rect (AABB).
        const clearOfRects = avoidRects.every((r) => {
          const dx = Math.max(r.minX - x, 0, x - r.maxX);
          const dz = Math.max(r.minZ - z, 0, z - r.maxZ);
          return Math.hypot(dx, dz) >= type.clearance;
        });
        ok = clearOfRects;
      }
      if (!ok) continue;
      placed.push({ x, z, r: type.clearance });

      const variant = pick(type.variants);

      // Backroom weights: 50% normal, 25% overlap-self, 25% sunken-into-floor.
      const roll = Math.random();
      let mode;
      if (roll < 0.5) mode = 'normal';
      else if (roll < 0.75) mode = 'overlap';
      else mode = 'sunken';

      const baseName = `${type.name} #${i + 1} (${room.id}) [${mode}]`;

      if (mode === 'normal') {
        // Unchanged behavior: random Y-only rotation.
        loadOBJMTL(scene, {
          basePath: variant.basePath,
          mtlName: variant.mtlName,
          objName: variant.objName,
          position: [x, type.y, z],
          scale: type.scale,
          rotationY: randFloat(0, 360),
          name: baseName,
        });
      } else if (mode === 'sunken') {
        // Same footprint, drop 2–3 units into the floor + budgeted 3-axis rotation.
        const rotation = randomRotationBudget(180);
        loadOBJMTL(scene, {
          basePath: variant.basePath,
          mtlName: variant.mtlName,
          objName: variant.objName,
          position: [x, type.y - randFloat(1, 2), z],
          scale: type.scale,
          rotation,
          name: baseName,
        });
      } else {
        // Overlap self: two copies sharing the same rotation, offset by
        // 0.5–1.5 units on each axis (random sign).
        const rotation = randomRotationBudget(180);
        const offset = [
          randFloat(0.5, 1.5) * randSign(),
          randFloat(0.5, 1.5) * randSign(),
          randFloat(0.5, 1.5) * randSign(),
        ];
        loadOBJMTL(scene, {
          basePath: variant.basePath,
          mtlName: variant.mtlName,
          objName: variant.objName,
          position: [x, type.y, z],
          scale: type.scale,
          rotation,
          name: baseName,
        });
        loadOBJMTL(scene, {
          basePath: variant.basePath,
          mtlName: variant.mtlName,
          objName: variant.objName,
          position: [x + offset[0], type.y + offset[1], z + offset[2]],
          scale: type.scale,
          rotation,
          name: `${type.name} #${i + 1} (${room.id}) [overlap-copy]`,
        });
      }
    }
  });
}
