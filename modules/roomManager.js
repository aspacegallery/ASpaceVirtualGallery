import * as THREE from "three";
import { GUI } from "lil-gui";
import {
  createRoom,
  FLOOR_TEX_TILE_WORLD_UNITS,
  CEILING_TEX_TILE_WORLD_UNITS,
  WALL_SCALAR_ROUGHNESS,
  WALL_TEX_REPEAT_DIVISOR,
} from "./room.js";

/**
 * Room Manager - Simplifies creating and managing multiple rooms with doorways
 * 
 * @param {THREE.Scene} scene - The scene to add rooms to
 * @param {THREE.TextureLoader} textureLoader - Texture loader instance
 * @param {Object} config - Room configuration
 * @returns {Object} - Returns { walls, floors, rooms }
 */
export function createMultiRoomSetup(scene, textureLoader, config) {
  const {
    rooms = [],
    doorways = [],
    spotlights: customSpotlights = [],
    standaloneWalls = [],
    combinedFloorCeiling = true
  } = config;

  const roomObjects = {};
  const allFloors = [];

  // Step 1: Create all rooms
  rooms.forEach(roomConfig => {
    const { id, width, depth, height, position } = roomConfig;
    
    const room = createRoom(scene, textureLoader, {
      width,
      depth,
      height,
      position
    });

    roomObjects[id] = {
      ...room,
      config: roomConfig // Store original config for doorway calculations
    };

    // Don't add individual floors if we're making a combined one
    if (!combinedFloorCeiling) {
      allFloors.push(room.floor);
    }
  });

  // Step 1.5: Create combined floor and ceiling if enabled
  if (combinedFloorCeiling && rooms.length > 0) {
    const bounds = calculateCombinedBounds(rooms);
    
    // Remove individual floors and ceilings (combined versions span all rooms)
    Object.values(roomObjects).forEach(room => {
      room.group.remove(room.floor);
      if (room.ceiling) room.group.remove(room.ceiling);
    });
    
    // Create combined floor and ceiling
    const { floor, ceiling } = createCombinedFloorCeiling(
      scene,
      textureLoader,
      bounds
    );
    
    allFloors.push(floor);
  }

  // Step 2: Create doorways (a single wall may host multiple openings)
  const doorwayGroup = new THREE.Group();
  scene.add(doorwayGroup);
  const doorwayWallGroups = [doorwayGroup];

  const wallColorTexture = textureLoader.load("wallTexture/paperWall/tex.jpg");
  const wallNormalTexture = textureLoader.load("wallTexture/paperWall/normal.jpeg");
  const wallHeight = 20;
  const wallThickness = 0.005;

  // Collect openings per (room, wall) so walls with 2+ doorways are rebuilt once.
  const wallOpenings = new Map(); // key `${roomId}|${wall}` -> { roomId, wall, axis, fixedCoord, roomMin, roomMax, list:[{center,width}] }
  const addOpening = (roomId, wall, axis, fixedCoord, roomMin, roomMax, center, width) => {
    const key = `${roomId}|${wall}`;
    if (!wallOpenings.has(key)) {
      wallOpenings.set(key, { roomId, wall, axis, fixedCoord, roomMin, roomMax, list: [] });
    }
    wallOpenings.get(key).list.push({ center, width });
  };

  doorways.forEach(doorwayConfig => {
    const {
      room1: room1Id,
      room2: room2Id,
      width: doorwayWidth = 8,
      position: doorwayPosition = 'center'
    } = doorwayConfig;

    const room1 = roomObjects[room1Id];
    const room2 = roomObjects[room2Id];

    if (!room1 || !room2) {
      console.error(`Doorway error: Room ${room1Id} or ${room2Id} not found`);
      return;
    }

    const connection = detectRoomConnection(room1.config, room2.config);
    if (!connection) {
      console.error(`Doorway error: rooms ${room1Id} and ${room2Id} are not connectable`);
      return;
    }

    const center = resolveDoorwayCenter(
      doorwayPosition, connection.doorwayCenter,
      connection.overlapMin, connection.overlapMax, doorwayWidth
    );

    const p1 = room1.config.position;
    const p2 = room2.config.position;

    if (connection.axis === 'x') {
      // Left/right walls run along Z; openings are Z-intervals
      addOpening(room1Id, connection.room1Wall, 'z', connection.wallX.room1,
        p1.z - room1.config.depth / 2, p1.z + room1.config.depth / 2, center, doorwayWidth);
      addOpening(room2Id, connection.room2Wall, 'z', connection.wallX.room2,
        p2.z - room2.config.depth / 2, p2.z + room2.config.depth / 2, center, doorwayWidth);

      if (connection.gap > 0.1) {
        createCorridorWallAlongX(doorwayGroup, connection.wallX.room1, connection.wallX.room2,
          center - doorwayWidth / 2, wallHeight, wallThickness, wallColorTexture, wallNormalTexture);
        createCorridorWallAlongX(doorwayGroup, connection.wallX.room1, connection.wallX.room2,
          center + doorwayWidth / 2, wallHeight, wallThickness, wallColorTexture, wallNormalTexture);
      }
    } else {
      // Front/back walls run along X; openings are X-intervals
      addOpening(room1Id, connection.room1Wall, 'x', connection.wallZ.room1,
        p1.x - room1.config.width / 2, p1.x + room1.config.width / 2, center, doorwayWidth);
      addOpening(room2Id, connection.room2Wall, 'x', connection.wallZ.room2,
        p2.x - room2.config.width / 2, p2.x + room2.config.width / 2, center, doorwayWidth);

      if (connection.gap > 0.1) {
        createCorridorWall(doorwayGroup, center - doorwayWidth / 2, connection.wallZ.room1, connection.wallZ.room2,
          wallHeight, wallThickness, wallColorTexture, wallNormalTexture);
        createCorridorWall(doorwayGroup, center + doorwayWidth / 2, connection.wallZ.room1, connection.wallZ.room2,
          wallHeight, wallThickness, wallColorTexture, wallNormalTexture);
      }
    }
  });

  // Remove each affected original wall once and rebuild it with all its openings.
  wallOpenings.forEach((o) => {
    const room = roomObjects[o.roomId];
    if (room.walls[o.wall]) room.group.remove(room.walls[o.wall]);
    buildWallWithOpenings(
      doorwayGroup, o.axis, o.fixedCoord, o.roomMin, o.roomMax, o.list,
      wallHeight, wallThickness, wallColorTexture, wallNormalTexture
    );
  });

  // Step 2.5: Build free-standing interior walls
  const standaloneGroup = createStandaloneWalls(scene, textureLoader, standaloneWalls);

  // Step 3: Setup lighting for all rooms
  const lightingSystem = setupRoomLighting(scene, rooms, customSpotlights);

  // Step 4: Combine all walls for collision detection
  const allWalls = new THREE.Group();

  // Add all room walls (including doorway-modified ones)
  Object.values(roomObjects).forEach(room => {
    room.group.children.forEach(child => {
      const clonedWall = child.clone();
      const worldPos = new THREE.Vector3();
      child.getWorldPosition(worldPos);
      clonedWall.position.copy(worldPos);
      clonedWall.rotation.copy(child.rotation);
      allWalls.add(clonedWall);
    });
  });

  // Add doorway walls
  doorwayWallGroups.forEach(doorwayGroup => {
    doorwayGroup.children.forEach(child => {
      const clonedWall = child.clone();
      const worldPos = new THREE.Vector3();
      child.getWorldPosition(worldPos);
      clonedWall.position.copy(worldPos);
      clonedWall.rotation.copy(child.rotation);
      allWalls.add(clonedWall);
    });
  });

  // Add free-standing interior walls
  standaloneGroup.children.forEach(child => {
    const clonedWall = child.clone();
    const worldPos = new THREE.Vector3();
    child.getWorldPosition(worldPos);
    clonedWall.position.copy(worldPos);
    clonedWall.rotation.copy(child.rotation);
    allWalls.add(clonedWall);
  });

  return {
    walls: allWalls,
    floors: allFloors,
    rooms: roomObjects,
    lighting: lightingSystem
  };
}

/**
 * Build free-standing interior walls from specs (paperWall texture, double-sided).
 * Each spec: { center:{x,z}, length, height, thickness, axis:'x'|'z' }
 * Sits on the floor at y = -Math.PI.
 * @private
 */
function createStandaloneWalls(scene, textureLoader, wallSpecs = []) {
  const group = new THREE.Group();
  scene.add(group);

  const floorY = -Math.PI;
  const colorTexture = textureLoader.load("wallTexture/paperWall/tex.jpg");
  const normalTexture = textureLoader.load("wallTexture/paperWall/normal.jpeg");

  const D = WALL_TEX_REPEAT_DIVISOR;
  const doubleSided = (mat) => { mat.side = THREE.DoubleSide; return mat; };

  wallSpecs.forEach((spec) => {
    const { center, length, height, thickness, axis } = spec;
    // Per-face materials so each face gets texels sized to its own dimensions.
    // BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z (box is length×height×thickness).
    const capMat = doubleSided(makeWallMaterial(colorTexture, normalTexture, thickness / D, height / D)); // ±X end caps
    const longMat = doubleSided(makeWallMaterial(colorTexture, normalTexture, length / D, height / D));    // ±Z long faces
    const topMat = doubleSided(makeWallMaterial(colorTexture, normalTexture, length / D, thickness / D));  // ±Y top/bottom
    const materials = [capMat, capMat, topMat, topMat, longMat, longMat];

    const geom = new THREE.BoxGeometry(length, height, thickness);
    const mesh = new THREE.Mesh(geom, materials);
    if (axis === 'z') mesh.rotation.y = Math.PI / 2; // run along Z
    mesh.position.set(center.x, floorY + height / 2, center.z);
    group.add(mesh);
  });

  return group;
}

/**
 * Setup lighting automatically for all rooms based on wall positions
 * @private
 */
function setupRoomLighting(scene, rooms, customSpotlights = []) {
  const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const gui = import.meta.env.PROD ? null : new GUI();

  // Ambient light (shared across all rooms)
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  if (gui) {
    const ambientFolder = gui.addFolder("Ambient Light");
    ambientFolder.add(ambientLight, "intensity", 0, 20).name("Intensity");
  }

  // Helper to create a spotlight
  function createSpotlight(x, y, z, intensity, targetPosition, name, castShadow = false) {
    const spotlight = new THREE.SpotLight(0xffffff, intensity);
    spotlight.position.set(x, y, z);
    spotlight.target.position.copy(targetPosition);
    spotlight.castShadow = castShadow && !isMobile;
    spotlight.angle = 1.26134;
    spotlight.penumbra = 0.35;
    spotlight.decay = 0.4;
    spotlight.distance = 16;
    spotlight.shadow.mapSize.width = isMobile ? 512 : 1024;
    spotlight.shadow.mapSize.height = isMobile ? 512 : 1024;

    scene.add(spotlight);
    scene.add(spotlight.target);

    if (gui) {
      const folder = gui.addFolder(name || `Spotlight (${x}, ${y}, ${z})`);
      folder.add(spotlight, "intensity", 0, 20).name("Intensity");
      folder.add(spotlight, "angle", 0, Math.PI / 2).name("Angle");
      folder.add(spotlight, "penumbra", 0, 1).name("Penumbra");
      folder.add(spotlight, "decay", 0, 2).name("Decay");
      folder.add(spotlight, "distance", 0, 100).name("Distance");
      folder.add(spotlight.position, "x", -100, 100);
      folder.add(spotlight.position, "y", -50, 50);
      folder.add(spotlight.position, "z", -100, 100);
      folder.add(spotlight.target.position, "x", -100, 100);
      folder.add(spotlight.target.position, "y", -50, 50);
      folder.add(spotlight.target.position, "z", -100, 100);
    }

    return spotlight;
  }

  const allSpotlights = [];

  rooms.forEach(room => {
    const { id, width, depth, position } = room;
    const cx = position.x;
    const cz = position.z;

    const halfW = width / 2;
    const halfD = depth / 2;
    const lightY = 6.7;
    const lightOffset = 7;
    const intensity = 2;

    const frontBackCount = Math.max(1, Math.round(width / 26.7));
    const leftRightCount = Math.max(1, Math.round(depth / 40));

    console.log(`Room "${id}": ${frontBackCount} front/back lights, ${leftRightCount} left/right lights`);

    // Front wall spotlights (Z = -halfD)
    // Old pattern: 3 lights on 80-unit wall at x = -25, 0, 25
    // That's dividing the wall into 3 equal sections, light at center of each
    for (let i = 0; i < frontBackCount; i++) {
      const sectionWidth = width / frontBackCount;
      const x = cx - halfW + sectionWidth * (i + 0.5);
      const spotlight = createSpotlight(
        x, lightY, cz - halfD + lightOffset, intensity,
        new THREE.Vector3(x, 0, cz - halfD),
        `${id} Front ${i + 1}`
      );
      allSpotlights.push(spotlight);
    }

    // Back wall spotlights (Z = +halfD)
    for (let i = 0; i < frontBackCount; i++) {
      const sectionWidth = width / frontBackCount;
      const x = cx - halfW + sectionWidth * (i + 0.5);
      const spotlight = createSpotlight(
        x, lightY, cz + halfD - lightOffset, intensity,
        new THREE.Vector3(x, 0, cz + halfD),
        `${id} Back ${i + 1}`
      );
      allSpotlights.push(spotlight);
    }

    // Left wall spotlight (X = -halfW)
    // Old pattern: 1 light in center for 40-unit wall
    for (let i = 0; i < leftRightCount; i++) {
      const sectionDepth = depth / leftRightCount;
      const z = cz - halfD + sectionDepth * (i + 0.5);
      const spotlight = createSpotlight(
        cx - halfW + lightOffset, lightY, z, intensity,
        new THREE.Vector3(cx - halfW, 0, z),
        `${id} Left ${i + 1}`
      );
      allSpotlights.push(spotlight);
    }

    // Right wall spotlight (X = +halfW)
    for (let i = 0; i < leftRightCount; i++) {
      const sectionDepth = depth / leftRightCount;
      const z = cz - halfD + sectionDepth * (i + 0.5);
      const spotlight = createSpotlight(
        cx + halfW - lightOffset, lightY, z, intensity,
        new THREE.Vector3(cx + halfW, 0, z),
        `${id} Right ${i + 1}`
      );
      allSpotlights.push(spotlight);
    }
  });

  // Create custom spotlights (e.g. for models like fountain)
  customSpotlights.forEach(config => {
    const {
      position: pos,
      target,
      intensity: sIntensity = 8,
      name: sName = 'Custom',
      shadow = false,
      angle,
      decay,
      penumbra,
      distance
    } = config;

    const spotlight = createSpotlight(
      pos.x, pos.y, pos.z, sIntensity,
      new THREE.Vector3(target.x, target.y, target.z),
      sName,
      shadow
    );

    // Apply custom overrides
    if (angle !== undefined) spotlight.angle = angle;
    if (decay !== undefined) spotlight.decay = decay;
    if (penumbra !== undefined) spotlight.penumbra = penumbra;
    if (distance !== undefined) spotlight.distance = distance;

    allSpotlights.push(spotlight);
  });

  return {
    ambientLight,
    spotlights: allSpotlights,
    gui
  };
}

/**
 * Creates a doorway between two rooms
 * @private
 */
/**
 * Rebuild a room wall as solid segments that flank one or more openings.
 * @param {'z'|'x'} axis - 'z': wall runs along Z (left/right wall); 'x': wall runs along X (front/back wall)
 * @param {number} fixedCoord - the wall's constant coordinate (x for 'z' walls, z for 'x' walls)
 * @param {number} roomMin - wall start along its running axis
 * @param {number} roomMax - wall end along its running axis
 * @param {Array<{center:number,width:number}>} openingList - openings to leave out
 * @private
 */
function buildWallWithOpenings(
  doorwayWalls,
  axis,
  fixedCoord,
  roomMin,
  roomMax,
  openingList,
  wallHeight,
  wallThickness,
  colorTexture,
  normalTexture
) {
  // Normalize + sort openings, clamped to the wall extent.
  const openings = openingList
    .map((o) => ({
      start: Math.max(roomMin, o.center - o.width / 2),
      end: Math.min(roomMax, o.center + o.width / 2),
    }))
    .filter((o) => o.end > o.start)
    .sort((a, b) => a.start - b.start);

  const addSegment = (a, b) => {
    const len = b - a;
    if (len <= 0.01) return;
    const center = (a + b) / 2;
    const wallSeg = Math.min(10, Math.max(4, Math.floor(len / 14)));
    const material = makeWallMaterial(
      colorTexture, normalTexture,
      len / WALL_TEX_REPEAT_DIVISOR, wallHeight / WALL_TEX_REPEAT_DIVISOR
    );
    const geom = new THREE.BoxGeometry(len, wallHeight, wallThickness, wallSeg, wallSeg, 1);
    const mesh = new THREE.Mesh(geom, material);
    if (axis === 'z') {
      mesh.rotation.y = Math.PI / 2;
      mesh.position.set(fixedCoord, 0, center);
    } else {
      mesh.position.set(center, 0, fixedCoord);
    }
    doorwayWalls.add(mesh);
  };

  // Walk left to right, emitting wall between the cursor and each opening (unions overlaps).
  let cursor = roomMin;
  openings.forEach((op) => {
    if (op.start > cursor) addSegment(cursor, op.start);
    cursor = Math.max(cursor, op.end);
  });
  if (roomMax > cursor) addSegment(cursor, roomMax);
}

/**
 * Resolve a doorway's center coordinate along the shared wall axis.
 * Accepts 'center' | 'start' | 'end' | a number (offset from center),
 * then clamps so the opening stays within the shared overlap region.
 * @private
 */
function resolveDoorwayCenter(doorwayPosition, overlapCenter, overlapMin, overlapMax, doorwayWidth) {
  let center = overlapCenter;
  const minCenter = overlapMin + doorwayWidth / 2;
  const maxCenter = overlapMax - doorwayWidth / 2;

  if (typeof doorwayPosition === 'number') {
    center = overlapCenter + doorwayPosition;
  } else if (doorwayPosition === 'start') {
    center = minCenter;
  } else if (doorwayPosition === 'end') {
    center = maxCenter;
  }
  // 'center' (default) keeps overlapCenter

  if (minCenter > maxCenter) return overlapCenter; // opening wider than overlap; keep centered
  return Math.min(maxCenter, Math.max(minCenter, center));
}

/**
 * Detect which walls connect two rooms
 * @private
 */
function detectRoomConnection(room1Config, room2Config) {
  const r1 = room1Config;
  const r2 = room2Config;

  // X-axis boundaries
  const r1Right = r1.position.x + r1.width / 2;
  const r1Left = r1.position.x - r1.width / 2;
  const r2Right = r2.position.x + r2.width / 2;
  const r2Left = r2.position.x - r2.width / 2;

  // Z-axis boundaries (front = -Z, back = +Z)
  const r1Front = r1.position.z - r1.depth / 2;
  const r1Back = r1.position.z + r1.depth / 2;
  const r2Front = r2.position.z - r2.depth / 2;
  const r2Back = r2.position.z + r2.depth / 2;

  // X overlap (shared span along X for a front/back doorway)
  const overlapMinX = Math.max(r1Left, r2Left);
  const overlapMaxX = Math.min(r1Right, r2Right);
  const doorwayCenterX = (overlapMinX + overlapMaxX) / 2;
  const hasXOverlap = overlapMaxX > overlapMinX;

  // Z overlap (shared span along Z for a left/right doorway)
  const overlapMinZ = Math.max(r1Front, r2Front);
  const overlapMaxZ = Math.min(r1Back, r2Back);
  const doorwayCenterZ = (overlapMinZ + overlapMaxZ) / 2;
  const hasZOverlap = overlapMaxZ > overlapMinZ;

  // ---- Left/right (X axis) connection: allows a corridor gap ----
  if (hasZOverlap && r2Left >= r1Right - 2) {
    // room2 is to the right of room1
    return {
      axis: 'x', room1Wall: 'right', room2Wall: 'left',
      wallX: { room1: r1Right, room2: r2Left },
      room1Depth: r1.depth, room2Depth: r2.depth,
      room1CenterZ: r1.position.z, room2CenterZ: r2.position.z,
      overlapMin: overlapMinZ, overlapMax: overlapMaxZ,
      doorwayCenter: doorwayCenterZ, gap: Math.max(0, r2Left - r1Right)
    };
  }
  if (hasZOverlap && r1Left >= r2Right - 2) {
    // room2 is to the left of room1
    return {
      axis: 'x', room1Wall: 'left', room2Wall: 'right',
      wallX: { room1: r1Left, room2: r2Right },
      room1Depth: r1.depth, room2Depth: r2.depth,
      room1CenterZ: r1.position.z, room2CenterZ: r2.position.z,
      overlapMin: overlapMinZ, overlapMax: overlapMaxZ,
      doorwayCenter: doorwayCenterZ, gap: Math.max(0, r1Left - r2Right)
    };
  }

  // ---- Front/back (Z axis) connection: allows a corridor gap ----
  if (hasXOverlap && r2Front >= r1Back - 2) {
    // room2 is behind room1
    return {
      axis: 'z', room1Wall: 'back', room2Wall: 'front',
      wallZ: { room1: r1Back, room2: r2Front },
      room1Width: r1.width, room2Width: r2.width,
      room1CenterX: r1.position.x, room2CenterX: r2.position.x,
      overlapMin: overlapMinX, overlapMax: overlapMaxX,
      doorwayCenter: doorwayCenterX, gap: Math.max(0, r2Front - r1Back)
    };
  }
  if (hasXOverlap && r1Front >= r2Back - 2) {
    // room2 is in front of room1
    return {
      axis: 'z', room1Wall: 'front', room2Wall: 'back',
      wallZ: { room1: r1Front, room2: r2Back },
      room1Width: r1.width, room2Width: r2.width,
      room1CenterX: r1.position.x, room2CenterX: r2.position.x,
      overlapMin: overlapMinX, overlapMax: overlapMaxX,
      doorwayCenter: doorwayCenterX, gap: Math.max(0, r1Front - r2Back)
    };
  }

  return null;
}

/**
 * Prepare a textured wall material with the given UV repeat
 * @private
 */
function makeWallMaterial(colorTexture, normalTexture, repeatX, repeatY) {
  const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const colorTex = colorTexture.clone();
  const normalTex = normalTexture.clone();
  [colorTex, normalTex].forEach((tex) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = isMobile ? 1 : 2;
  });
  colorTex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({
    map: colorTex,
    normalMap: normalTex,
    metalness: 0,
    roughness: WALL_SCALAR_ROUGHNESS,
    side: THREE.FrontSide,
  });
}

/**
 * Create a single corridor side wall running along X between two X positions
 * @private
 */
function createCorridorWallAlongX(
  doorwayWalls,
  xStart,
  xEnd,
  z,
  wallHeight,
  wallThickness,
  colorTexture,
  normalTexture
) {
  const length = Math.abs(xEnd - xStart);
  if (length <= 0.01) return;
  const centerX = (xStart + xEnd) / 2;

  const wallSeg = Math.min(10, Math.max(4, Math.floor(length / 14)));
  const material = makeWallMaterial(
    colorTexture, normalTexture,
    length / WALL_TEX_REPEAT_DIVISOR, wallHeight / WALL_TEX_REPEAT_DIVISOR
  );
  const geom = new THREE.BoxGeometry(length, wallHeight, wallThickness, wallSeg, wallSeg, 1);
  const mesh = new THREE.Mesh(geom, material);
  mesh.position.set(centerX, 0, z);
  doorwayWalls.add(mesh);
}

/**
 * Create a single corridor side wall running along Z between two Z positions
 * @private
 */
function createCorridorWall(
  doorwayWalls,
  wallX,
  zStart,
  zEnd,
  wallHeight,
  wallThickness,
  colorTexture,
  normalTexture
) {
  const length = Math.abs(zEnd - zStart);
  if (length <= 0.01) return;
  const centerZ = (zStart + zEnd) / 2;

  const wallSeg = Math.min(10, Math.max(4, Math.floor(length / 14)));
  const material = makeWallMaterial(
    colorTexture, normalTexture,
    length / WALL_TEX_REPEAT_DIVISOR, wallHeight / WALL_TEX_REPEAT_DIVISOR
  );
  const geom = new THREE.BoxGeometry(length, wallHeight, wallThickness, wallSeg, wallSeg, 1);
  const mesh = new THREE.Mesh(geom, material);
  mesh.rotation.y = Math.PI / 2;
  mesh.position.set(wallX, 0, centerZ);
  doorwayWalls.add(mesh);
}

/**
 * Calculate the combined bounds of all rooms
 * @private
 */
function calculateCombinedBounds(rooms) {
  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  rooms.forEach(room => {
    const { width, depth, position } = room;
    const left = position.x - width / 2;
    const right = position.x + width / 2;
    const front = position.z - depth / 2;
    const back = position.z + depth / 2;

    minX = Math.min(minX, left);
    maxX = Math.max(maxX, right);
    minZ = Math.min(minZ, front);
    maxZ = Math.max(maxZ, back);
  });

  return {
    width: maxX - minX,
    depth: maxZ - minZ,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2
  };
}

/**
 * Create a single floor and ceiling that spans all rooms
 * @private
 */
function createCombinedFloorCeiling(scene, textureLoader, bounds) {
  const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

  // ====== FLOOR (carpet: Color + NormalGL) ======
  const carpetBase = "floorTexture/carpet/Carpet016_1K-JPG";
  const floorColorTexture = textureLoader.load(`${carpetBase}_Color.jpg`);
  const floorNormalTexture = textureLoader.load(`${carpetBase}_NormalGL.jpg`);

  const floorRepeatX = bounds.width / FLOOR_TEX_TILE_WORLD_UNITS;
  const floorRepeatY = bounds.depth / FLOOR_TEX_TILE_WORLD_UNITS;

  [floorColorTexture, floorNormalTexture].forEach((tex) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(floorRepeatX, floorRepeatY);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = isMobile ? 1 : 2;
  });
  floorColorTexture.colorSpace = THREE.SRGBColorSpace;

  const floorGeometry = new THREE.PlaneGeometry(bounds.width, bounds.depth);

  const floorMaterial = new THREE.MeshStandardMaterial({
    map: floorColorTexture,
    normalMap: floorNormalTexture,
    metalness: 0,
    roughness: 0.95,
    side: THREE.FrontSide,
  });

  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(bounds.centerX, -Math.PI, bounds.centerZ);
  scene.add(floor);

  // ====== CEILING (backroom) ======
  const ceilingBase = "ceilingTexture/backroom/OfficeCeiling002_1K-JPG";
  const ceilingColorTexture = textureLoader.load(`${ceilingBase}_Color.jpg`);
  const ceilingEmissionTexture = textureLoader.load(`${ceilingBase}_Emission.jpg`);

  const ceilingRepeatX = bounds.width / CEILING_TEX_TILE_WORLD_UNITS;
  const ceilingRepeatY = bounds.depth / CEILING_TEX_TILE_WORLD_UNITS;

  [ceilingColorTexture, ceilingEmissionTexture].forEach((tex) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(ceilingRepeatX, ceilingRepeatY);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = isMobile ? 1 : 2;
  });
  ceilingColorTexture.colorSpace = THREE.SRGBColorSpace;
  ceilingEmissionTexture.colorSpace = THREE.SRGBColorSpace;

  const ceilingGeometry = new THREE.PlaneGeometry(bounds.width, bounds.depth);
  const ceilingMaterial = new THREE.MeshStandardMaterial({
    map: ceilingColorTexture,
    emissiveMap: ceilingEmissionTexture,
    emissive: 0xffffff,
    emissiveIntensity: 2,
    metalness: 0.0,
    roughness: 1.0,
    side: THREE.FrontSide,
  });
  const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(bounds.centerX, 10, bounds.centerZ);
  scene.add(ceiling);

  return { floor, ceiling };
}
