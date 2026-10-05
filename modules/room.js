import * as THREE from "three";

/** Floor texture repeat divisor: repeat = size/divisor → each full texture tile spans divisor world units along X and Z. Larger = bigger tiles = less dense/repetitive. */
export const FLOOR_TEX_TILE_WORLD_UNITS = 20;
/** Ceiling texture repeat divisor */
export const CEILING_TEX_TILE_WORLD_UNITS = 30;
/** Diamond plate floor: scalar PBR when roughness/metalness maps are omitted */
export const FLOOR_SCALAR_ROUGHNESS = 0.92;
export const FLOOR_SCALAR_METALNESS = 0.25;
/** Wall UV repeat = wallSize/divisor → one texture spans ~DIVISOR world units along each edge. Larger = bigger tiles = less dense/repetitive. */
export const WALL_TEX_REPEAT_DIVISOR = 14;
/** Walls: scalar roughness. LOWER = sharper/stronger reflections (mirror-like),
 *  HIGHER = matte/blurred. ~0.1–0.3 gives visibly reflective metal. */
export const WALL_SCALAR_ROUGHNESS = 0.2;

/**
 * Creates a complete room with walls, floor, and ceiling.
 * @param {THREE.Scene} scene - The scene to add the room to
 * @param {THREE.TextureLoader} textureLoader - Texture loader instance
 * @param {Object} config - Room configuration
 * @param {number} config.width - Room width (X-axis)
 * @param {number} config.depth - Room depth (Z-axis)
 * @param {number} config.height - Room height (Y-axis)
 * @param {Object} config.position - Room center position {x, y, z}
 * @returns {Object} - Returns { walls, floor, ceiling }
 */
export function createRoom(scene, textureLoader, config = {}) {
  // Default configuration
  const {
    width = 80,
    depth = 40,
    height = 20,
    position = { x: 0, y: 0, z: 0 }
  } = config;

  // Detect mobile for performance optimizations
  const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

  // Create a group to hold all room elements
  const roomGroup = new THREE.Group();
  roomGroup.position.set(position.x, position.y, position.z);
  scene.add(roomGroup);

  // ====== WALLS ======
  const wallThickness = 0.005;

  // Walls: metal/Metal009 color + normal (scalar metalness=1 enabled;
  // roughness scalar, AO/metalness/roughness/displacement maps omitted for performance)
  const wallBase = "wallTexture/metal/Metal009_1K-JPG";
  const wallColorTexture = textureLoader.load(`${wallBase}_Color.jpg`);
  const wallNormalTexture = textureLoader.load(`${wallBase}_NormalGL.jpg`);

  const wallRepeatX = width / WALL_TEX_REPEAT_DIVISOR;
  const wallRepeatY = height / WALL_TEX_REPEAT_DIVISOR;
  const sideWallRepeatX = depth / WALL_TEX_REPEAT_DIVISOR;

  [wallColorTexture, wallNormalTexture].forEach((tex) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(wallRepeatX, wallRepeatY);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = isMobile ? 1 : 2;
  });
  wallColorTexture.colorSpace = THREE.SRGBColorSpace;

  const wallSeg = Math.min(12, Math.max(4, Math.floor(Math.max(width, depth) / 16)));

  const wallMaterial = new THREE.MeshStandardMaterial({
    map: wallColorTexture,
    normalMap: wallNormalTexture,
    metalness: 0.5,
    roughness: WALL_SCALAR_ROUGHNESS,
    side: THREE.FrontSide,
  });

  function makeSideTextures(repeatAcross, repeatUp) {
    const c = wallColorTexture.clone();
    const n = wallNormalTexture.clone();
    [c, n].forEach((tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(repeatAcross, repeatUp);
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.anisotropy = isMobile ? 1 : 2;
    });
    c.colorSpace = THREE.SRGBColorSpace;
    return {
      sideMat: new THREE.MeshStandardMaterial({
        map: c,
        normalMap: n,
        metalness: 0.5,
        roughness: WALL_SCALAR_ROUGHNESS,
        side: THREE.FrontSide,
      }),
    };
  }

  // Front Wall (negative Z)
  const geomFrontBack = new THREE.BoxGeometry(width, height, wallThickness, wallSeg, wallSeg, 1);
  const frontWall = new THREE.Mesh(geomFrontBack, wallMaterial);
  frontWall.position.z = -depth / 2;
  roomGroup.add(frontWall);

  // Back Wall (positive Z)
  const geomBack = new THREE.BoxGeometry(width, height, wallThickness, wallSeg, wallSeg, 1);
  const backWall = new THREE.Mesh(geomBack, wallMaterial);
  backWall.position.z = depth / 2;
  roomGroup.add(backWall);

  const { sideMat: leftWallMaterial } = makeSideTextures(sideWallRepeatX, wallRepeatY);
  const geomLeftRight = new THREE.BoxGeometry(depth, height, wallThickness, wallSeg, wallSeg, 1);
  const leftWall = new THREE.Mesh(geomLeftRight, leftWallMaterial);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.x = -width / 2;
  roomGroup.add(leftWall);

  const { sideMat: rightWallMaterial } = makeSideTextures(sideWallRepeatX, wallRepeatY);
  const geomRight = new THREE.BoxGeometry(depth, height, wallThickness, wallSeg, wallSeg, 1);
  const rightWall = new THREE.Mesh(geomRight, rightWallMaterial);
  rightWall.rotation.y = Math.PI / 2;
  rightWall.position.x = width / 2;
  roomGroup.add(rightWall);

  // ====== FLOOR (rock: Color + NormalGL only; Roughness/AO/Displacement maps omitted for perf) ======
  const floorBase = "floorTexture/rock/Rock063_1K-JPG";
  const floorColorTexture = textureLoader.load(`${floorBase}_Color.jpg`);
  const floorNormalTexture = textureLoader.load(`${floorBase}_NormalGL.jpg`);

  const floorRepeatX = width / FLOOR_TEX_TILE_WORLD_UNITS;
  const floorRepeatY = depth / FLOOR_TEX_TILE_WORLD_UNITS;

  [floorColorTexture, floorNormalTexture].forEach((tex) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(floorRepeatX, floorRepeatY);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = isMobile ? 1 : 2;
  });
  floorColorTexture.colorSpace = THREE.SRGBColorSpace;

  const floorGeometry = new THREE.PlaneGeometry(width, depth);

  const floorMaterial = new THREE.MeshStandardMaterial({
    map: floorColorTexture,
    normalMap: floorNormalTexture,
    metalness: 0,
    roughness: 0.95,
    side: THREE.FrontSide,
  });

  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -Math.PI; // Match old floor position
  roomGroup.add(floor);

  // ====== CEILING removed — rooms are open to the HDRI sky.
  // (Previously a backroom ceiling plane was created here and then replaced by
  // the combined ceiling in roomManager; both are now gone.)

  // Return components for further manipulation
  return {
    group: roomGroup,
    walls: { front: frontWall, back: backWall, left: leftWall, right: rightWall },
    floor: floor,
    ceiling: null
  };
}
