/**
 * Procedural room layout generator (rogue-like).
 *
 * Room 1 (the base room) is kept exactly as provided. A number of new rooms are
 * generated and attached to a growing tree of rooms:
 *   - At least one new room connects directly to the base room.
 *   - Each subsequent room attaches to any existing room's free wall (which may
 *     be the base room or any room already connected to it).
 *   - Rooms are aligned on the connecting wall and separated by a random gap,
 *     which the existing roomManager bridges with a textured corridor.
 *   - The doorway sits at a random position on the wall (center or against an edge).
 *
 * The output ({ rooms, doorways }) matches the shape consumed by
 * createMultiRoomSetup / loadPaintingData, so materials, corridors, lighting and
 * artwork placement all keep working unchanged.
 */

const WALLS = ['left', 'right', 'front', 'back'];

/** Wall opposite to the given one (the face a child room turns toward its parent) */
const OPPOSITE_WALL = {
  left: 'right',
  right: 'left',
  front: 'back',
  back: 'front',
};

function randFloat(min, max) {
  return min + Math.random() * (max - min);
}

function randInt(min, max) {
  return Math.floor(randFloat(min, max + 1));
}

function choice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function roomBounds(room) {
  const { x, z } = room.position;
  return {
    minX: x - room.width / 2,
    maxX: x + room.width / 2,
    minZ: z - room.depth / 2,
    maxZ: z + room.depth / 2,
  };
}

/** Axis-aligned box overlap test with an optional margin */
function boxesOverlap(a, b, margin = 0) {
  return (
    a.minX - margin < b.maxX &&
    a.maxX + margin > b.minX &&
    a.minZ - margin < b.maxZ &&
    a.maxZ + margin > b.minZ
  );
}

/**
 * Place a child room against a parent's wall, separated by `gap` and shifted by
 * `offset` along the wall (0 = aligned on the wall's center). Returns {x, z}.
 */
function placeAgainstWall(parent, wall, gap, childWidth, childDepth, offset) {
  const p = roomBounds(parent);
  switch (wall) {
    case 'right':
      return { x: p.maxX + gap + childWidth / 2, z: parent.position.z + offset };
    case 'left':
      return { x: p.minX - gap - childWidth / 2, z: parent.position.z + offset };
    case 'back':
      return { x: parent.position.x + offset, z: p.maxZ + gap + childDepth / 2 };
    case 'front':
    default:
      return { x: parent.position.x + offset, z: p.minZ - gap - childDepth / 2 };
  }
}

/**
 * Random shift along a wall such that the child still overlaps the parent by at
 * least `minOverlap` (so a doorway fits). 0 keeps it centered on the wall.
 */
function randomWallOffset(parentExtent, childExtent, minOverlap) {
  const limit = parentExtent / 2 + childExtent / 2 - minOverlap;
  if (limit <= 0) return 0; // rooms too small to shift; stay centered
  return randFloat(-limit, limit);
}

/**
 * Rectangle of the corridor channel between a parent wall and the child,
 * restricted to the perpendicular overlap of the two rooms.
 */
function corridorRect(parent, child, wall) {
  const p = roomBounds(parent);
  const c = roomBounds(child);
  if (wall === 'left' || wall === 'right') {
    const minZ = Math.max(p.minZ, c.minZ);
    const maxZ = Math.min(p.maxZ, c.maxZ);
    const minX = Math.min(p.maxX, c.maxX);
    const maxX = Math.max(p.minX, c.minX);
    return { minX: Math.min(minX, maxX), maxX: Math.max(minX, maxX), minZ, maxZ };
  }
  const minX = Math.max(p.minX, c.minX);
  const maxX = Math.min(p.maxX, c.maxX);
  const minZ = Math.min(p.maxZ, c.maxZ);
  const maxZ = Math.max(p.minZ, c.minZ);
  return { minX, maxX, minZ: Math.min(minZ, maxZ), maxZ: Math.max(minZ, maxZ) };
}

/**
 * @param {Object} options
 * @param {Object} options.baseRoom - Room 1 config { id, width, depth, height, position }
 * @param {number} [options.numNewRooms=3]
 * @param {number} [options.minGap=3]
 * @param {number} [options.maxGap=20]
 * @param {number} [options.doorwayWidth=8]
 * @returns {{ rooms: Array, doorways: Array }}
 */
export function generateRoomLayout({
  baseRoom,
  numNewRooms = 4,
  minGap = 3,
  maxGap = 20,
  doorwayWidth = 8,
  widthRange = [24, 50],
  depthRange = [24, 40],
  roomMargin = 3,
  maxPerWall = 2,
  maxAttempts = 400,
  // Fixed dimensions per generated room id (e.g. { room2: { width: 50, depth: 40 } }).
  // Any room id present here uses these dimensions instead of a random pick.
  roomOverrides = {},
  // Per-wall painting reservations: `${roomId}|${wall}` → total on-wall artwork
  // width in world units. Doorways are rejected if cutting them would leave
  // less than `reserve + wallBuffer` continuous space on either side's wall.
  wallReserves = {},
  wallBuffer = 1,
} = {}) {
  const height = baseRoom.height ?? 20;

  // Tracked rooms carry a per-wall connection count (a wall may host up to maxPerWall).
  const placed = [{ ...baseRoom, wallCount: {} }];
  const doorways = [];

  for (let i = 0; i < numNewRooms; i++) {
    const childId = `room${i + 2}`; // room2, room3, ...
    let success = false;

    for (let attempt = 0; attempt < maxAttempts && !success; attempt++) {
      // First new room must attach to the base room; others attach anywhere free.
      const candidates =
        i === 0
          ? [placed[0]]
          : placed.filter((r) => freeWalls(r, maxPerWall).length > 0);
      if (candidates.length === 0) break;

      const parent = choice(candidates);
      const available = freeWalls(parent, maxPerWall);
      if (available.length === 0) continue;

      const wall = choice(available);
      const gap = randFloat(minGap, maxGap);
      const override = roomOverrides[childId];
      const width = override?.width ?? randInt(widthRange[0], widthRange[1]);
      const depth = override?.depth ?? randInt(depthRange[0], depthRange[1]);

      // Shift along the wall so two rooms can share one wall side by side.
      const horizontal = wall === 'left' || wall === 'right';
      const offset = randomWallOffset(
        horizontal ? parent.depth : parent.width,
        horizontal ? depth : width,
        doorwayWidth
      );

      const position = { x: 0, y: 0, z: 0, ...placeAgainstWall(parent, wall, gap, width, depth, offset) };
      const child = { id: childId, width, depth, height, position, wallCount: {} };

      // Skip if opening this doorway would leave either side of the wall with
      // less continuous length than its declared painting reserve requires.
      const parentWallLen = (wall === 'front' || wall === 'back') ? parent.width : parent.depth;
      const parentReserve = wallReserves[`${parent.id}|${wall}`] || 0;
      if (parentWallLen - doorwayWidth < parentReserve + wallBuffer) continue;
      const childWall = OPPOSITE_WALL[wall];
      const childWallLen = (childWall === 'front' || childWall === 'back') ? width : depth;
      const childReserve = wallReserves[`${childId}|${childWall}`] || 0;
      if (childWallLen - doorwayWidth < childReserve + wallBuffer) continue;

      // Reject overlaps with any existing room (with margin) or corridor clipping.
      const childBox = roomBounds(child);
      const corridor = corridorRect(parent, child, wall);
      const collides = placed.some((r) => {
        const rb = roomBounds(r);
        if (boxesOverlap(childBox, rb, roomMargin)) return true;
        if (r !== parent && boxesOverlap(corridor, rb, 0)) return true;
        return false;
      });
      if (collides) continue;

      // Commit: reserve walls, record room + doorway with a random position.
      parent.wallCount[wall] = (parent.wallCount[wall] || 0) + 1;
      child.wallCount[OPPOSITE_WALL[wall]] = 1;
      placed.push(child);
      doorways.push({
        room1: parent.id,
        room2: child.id,
        width: doorwayWidth,
        position: choice(['center', 'start', 'end']),
      });
      success = true;
    }

    if (!success) {
      console.warn(`Room generator: could not place ${childId} after ${maxAttempts} attempts`);
    }
  }

  // Strip internal bookkeeping before returning configs.
  const rooms = placed.map(({ wallCount, ...room }) => room);
  return { rooms, doorways };
}

function freeWalls(room, maxPerWall) {
  return WALLS.filter((w) => (room.wallCount[w] || 0) < maxPerWall);
}

/**
 * Generate free-standing interior wall specs. Each wall is a partition that
 * sticks out perpendicular from one of the room's walls: its thickness end-face
 * sits flush against the room wall and it extends inward.
 *
 * Rules:
 *   - thickness = 2 units
 *   - height random in [minHeight, maxHeight] (defaults 6 .. 13.2)
 *   - length in [5, half the room] (the perpendicular room dimension / 2), stays inside
 *   - at least `parallelClearance` (7) units from the parallel room walls
 *   - avoids covering any doorway opening on the attach wall
 *   - at most `maxPerRoom` (2) per room
 *   - total across all rooms <= number of rooms
 *
 * @param {Array} rooms - room configs { id, width, depth, position }
 * @param {Array} doorways - doorway configs { room1, room2, width, position }
 * @returns {Array} wall specs { center:{x,z}, length, height, thickness, axis }
 *   axis 'x' = wall runs along X (attached to a left/right wall),
 *   axis 'z' = wall runs along Z (attached to a front/back wall).
 */
export function generateStandaloneWalls(rooms, doorways = [], {
  thickness = 2,
  minHeight = 6,
  maxHeight = 13.2,
  minLength = 5,
  parallelClearance = 7,
  doorClearance = 1,
  maxPerRoom = 2,
  avoidPoints = [], // [{ x, z, r }] — walls stay >= r from these XZ points
  blockedWalls = [], // [{ roomId, wall }] — never attach to these room+wall pairs
  // Per-wall painting reservations: `${roomId}|${wall}` → total on-wall
  // artwork width. Standalone partitions skip walls where their attachment
  // footprint wouldn't fit beside the paintings.
  wallReserves = {},
  wallBuffer = 1,
} = {}) {
  if (!rooms || rooms.length === 0) return [];

  const openings = computeDoorwayOpenings(rooms, doorways);
  const totalCap = rooms.length; // total walls <= number of rooms
  const totalMin = Math.ceil(rooms.length / 2); // at least half the number of rooms
  const total = randInt(totalMin, totalCap);

  const counts = {}; // roomId -> placed count
  const specs = [];

  let guard = 0;
  while (specs.length < total && guard < total * 100 + 100) {
    guard++;
    const room = choice(rooms.filter((r) => (counts[r.id] || 0) < maxPerRoom));
    if (!room) break;

    const { x: px, z: pz } = room.position;
    const halfW = room.width / 2;
    const halfD = room.depth / 2;

    // Pick the room wall this partition attaches to; it extends inward.
    const attachWall = choice(WALLS);

    // Skip walls that host grid artworks (need continuous wall space).
    if (blockedWalls.some((b) => b.roomId === room.id && b.wall === attachWall)) continue;

    // Skip walls where paintings already leave no room for the partition's
    // attachment footprint (thickness + a small clearance either side).
    const attachWallLen = (attachWall === 'front' || attachWall === 'back') ? room.width : room.depth;
    const reserve = wallReserves[`${room.id}|${attachWall}`] || 0;
    if (attachWallLen - reserve < thickness + 2 * doorClearance + wallBuffer) continue;
    // Wall runs perpendicular to the attach wall. Its length spans the
    // perpendicular room dimension, capped at half the room.
    const runsAlongZ = attachWall === 'front' || attachWall === 'back';
    const perpHalf = runsAlongZ ? halfD : halfW;
    const maxLength = Math.max(minLength, perpHalf); // half the room
    const length = randFloat(minLength, maxLength);
    const height = randFloat(minHeight, maxHeight);

    // Free axis = along the attach wall. Keep >= parallelClearance from the
    // two parallel walls (the ones perpendicular to the attach wall).
    const freeHalf = (runsAlongZ ? halfW : halfD) - parallelClearance - thickness / 2;
    if (freeHalf <= 0) continue; // room too narrow for this orientation

    const freePos = randFloat(-freeHalf, freeHalf);
    const freeCenter = (runsAlongZ ? px : pz) + freePos;

    // Avoid covering a doorway opening on the attach wall.
    const footMin = freeCenter - thickness / 2 - doorClearance;
    const footMax = freeCenter + thickness / 2 + doorClearance;
    const blocked = openings.some(
      (o) => o.roomId === room.id && o.wall === attachWall && o.end > footMin && o.start < footMax
    );
    if (blocked) continue;

    const center = { x: px, z: pz };
    if (runsAlongZ) {
      center.x = freeCenter;
      center.z = attachWall === 'front' ? pz - halfD + length / 2 : pz + halfD - length / 2;
    } else {
      center.z = freeCenter;
      center.x = attachWall === 'left' ? px - halfW + length / 2 : px + halfW - length / 2;
    }

    // Reject if this wall's rectangle is inside the clearance radius of any
    // avoid-point (e.g. the player spawn point).
    if (avoidPoints.length > 0) {
      const wMinX = runsAlongZ ? center.x - thickness / 2 : center.x - length / 2;
      const wMaxX = runsAlongZ ? center.x + thickness / 2 : center.x + length / 2;
      const wMinZ = runsAlongZ ? center.z - length / 2 : center.z - thickness / 2;
      const wMaxZ = runsAlongZ ? center.z + length / 2 : center.z + thickness / 2;
      const tooClose = avoidPoints.some((p) => {
        const dx = Math.max(wMinX - p.x, 0, p.x - wMaxX);
        const dz = Math.max(wMinZ - p.z, 0, p.z - wMaxZ);
        return Math.hypot(dx, dz) < (p.r ?? 0);
      });
      if (tooClose) continue;
    }

    specs.push({
      center, length, height, thickness,
      axis: runsAlongZ ? 'z' : 'x',
      roomId: room.id,
      attachWall,
    });
    counts[room.id] = (counts[room.id] || 0) + 1;
  }

  return specs;
}

/**
 * Resolve a doorway center along the shared wall axis (mirrors roomManager).
 */
function resolveDoorwayCenter(position, overlapCenter, overlapMin, overlapMax, width) {
  let center = overlapCenter;
  const minC = overlapMin + width / 2;
  const maxC = overlapMax - width / 2;
  if (typeof position === 'number') center = overlapCenter + position;
  else if (position === 'start') center = minC;
  else if (position === 'end') center = maxC;
  if (minC > maxC) return overlapCenter;
  return Math.min(maxC, Math.max(minC, center));
}

/**
 * Compute each doorway's opening interval on both rooms' walls.
 * Returns [{ roomId, wall, start, end }] where start/end run along that wall
 * (Z for left/right walls, X for front/back walls), in world coordinates.
 */
export function computeDoorwayOpenings(rooms, doorways) {
  const byId = {};
  rooms.forEach((r) => { byId[r.id] = r; });
  const result = [];

  doorways.forEach((d) => {
    const r1 = byId[d.room1];
    const r2 = byId[d.room2];
    if (!r1 || !r2) return;
    const width = d.width ?? 8;

    const r1Left = r1.position.x - r1.width / 2, r1Right = r1.position.x + r1.width / 2;
    const r2Left = r2.position.x - r2.width / 2, r2Right = r2.position.x + r2.width / 2;
    const r1Front = r1.position.z - r1.depth / 2, r1Back = r1.position.z + r1.depth / 2;
    const r2Front = r2.position.z - r2.depth / 2, r2Back = r2.position.z + r2.depth / 2;

    const oMinX = Math.max(r1Left, r2Left), oMaxX = Math.min(r1Right, r2Right);
    const oMinZ = Math.max(r1Front, r2Front), oMaxZ = Math.min(r1Back, r2Back);
    const hasXOverlap = oMaxX > oMinX;
    const hasZOverlap = oMaxZ > oMinZ;

    let room1Wall, room2Wall, overlapMin, overlapMax;
    if (hasZOverlap && r2Left >= r1Right - 2) {
      room1Wall = 'right'; room2Wall = 'left'; overlapMin = oMinZ; overlapMax = oMaxZ;
    } else if (hasZOverlap && r1Left >= r2Right - 2) {
      room1Wall = 'left'; room2Wall = 'right'; overlapMin = oMinZ; overlapMax = oMaxZ;
    } else if (hasXOverlap && r2Front >= r1Back - 2) {
      room1Wall = 'back'; room2Wall = 'front'; overlapMin = oMinX; overlapMax = oMaxX;
    } else if (hasXOverlap && r1Front >= r2Back - 2) {
      room1Wall = 'front'; room2Wall = 'back'; overlapMin = oMinX; overlapMax = oMaxX;
    } else {
      return;
    }

    const center = resolveDoorwayCenter(d.position, (overlapMin + overlapMax) / 2, overlapMin, overlapMax, width);
    const start = center - width / 2;
    const end = center + width / 2;
    result.push({ roomId: r1.id, wall: room1Wall, start, end });
    result.push({ roomId: r2.id, wall: room2Wall, start, end });
  });

  return result;
}
