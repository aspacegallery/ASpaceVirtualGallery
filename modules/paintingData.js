import { computeDoorwayOpenings } from './roomGenerator.js';

/** JSON may use boolean or strings "true" / "false". Missing field defaults to true (prior behavior). */
function parseArtworkAudio(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return Boolean(value);
}

/**
 * Split a wall span [center - width/2, center + width/2] into sub-wall segments,
 * removing the given doorway openings. Returns [{ length, center }].
 */
function computeWallSegments(center, width, openings) {
  const min = center - width / 2;
  const max = center + width / 2;
  const ops = openings
    .map((o) => ({ start: Math.max(min, o.start), end: Math.min(max, o.end) }))
    .filter((o) => o.end > o.start)
    .sort((a, b) => a.start - b.start);

  const segs = [];
  let cursor = min;
  ops.forEach((op) => {
    if (op.start > cursor) segs.push({ a: cursor, b: op.start });
    cursor = Math.max(cursor, op.end);
  });
  if (max > cursor) segs.push({ a: cursor, b: max });

  return segs.map((s) => ({ length: s.b - s.a, center: (s.a + s.b) / 2 }));
}

/** Distribute n items across segments proportional to length (largest remainder). */
function distributeByLength(n, lengths) {
  const total = lengths.reduce((a, b) => a + b, 0);
  if (total <= 0 || n <= 0) return lengths.map(() => 0);
  const ideal = lengths.map((L) => (n * L) / total);
  const base = ideal.map((v) => Math.floor(v));
  let remaining = n - base.reduce((a, b) => a + b, 0);
  const order = ideal
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; remaining > 0 && order.length > 0; k++, remaining--) {
    base[order[k % order.length].i]++;
  }
  return base;
}

// Load painting data from JSON file
export async function loadPaintingData(roomConfig) {
  try {
    const response = await fetch('artworks/currentShow.json');
    const data = await response.json();
    const artworks = data.currentShow;
    
    // Scale by a constant factor to fit gallery (1 cm = 0.05 units in Three.js)
    const scale = 0.05;
    const WALL_HEIGHT = 2; // Default Y position for artworks
    
    // Build room dimensions map from roomConfig
    const roomDimensions = {};
    if (roomConfig && roomConfig.rooms) {
      roomConfig.rooms.forEach(room => {
        roomDimensions[room.id] = {
          width: room.width,
          depth: room.depth,
          position: room.position
        };
      });
    } else {
      // Fallback to main room only if no config provided
      roomDimensions['main'] = {
        width: 80,
        depth: 40,
        position: { x: 0, y: 0, z: 0 }
      };
    }
    
    // PASS 1: Calculate dimensions and group by room and wall
    const artworksByRoomAndWall = {};
    
    artworks.forEach((artwork, i) => {
      // Calculate dimensions based on artwork.dimension
      let width = 5;
      let height = 3;
      let depth = 0.1;
      
      // Optional per-artwork scale for the 3D scene only (does not affect the
      // dimension string shown in the info panel). 1 = real size, 2 = double, etc.
      const sceneScale = typeof artwork.sceneScale === 'number' && artwork.sceneScale > 0
        ? artwork.sceneScale
        : 1;

      if (artwork.dimension) {
        const dims = artwork.dimension.match(/(\d+\.?\d*)\s*x\s*(\d+\.?\d*)/);
        if (dims) {
          const h = parseFloat(dims[1]);
          const w = parseFloat(dims[2]);
          width = w * scale * sceneScale;
          height = h * scale * sceneScale;
        }
      }
      
      if (artwork.depth) {
        const depthMatch = artwork.depth.toString().match(/(\d+\.?\d*)/);
        if (depthMatch) {
          const d = parseFloat(depthMatch[1]);
          depth = d * scale;
        }
      }
      
      // Normalise all file paths (strip `public/` prefix if present) and drop
      // empty entries. When more than one path is supplied, this artwork will
      // render as a 2-row grid of canvases (columns = ceil(N/2)).
      const stripPublic = (p) => (p && p.startsWith('public/') ? p.substring(7) : p);
      const filePaths = (Array.isArray(artwork.filePath) ? artwork.filePath : [artwork.filePath])
        .filter((p) => typeof p === 'string' && p.trim().length > 0)
        .map(stripPublic);
      let imgSrc = filePaths[0] || '';

      // If multiple images, build a grid spec. The width/height stored on
      // artworkData below becomes the overall grid footprint so PASS 2 can
      // reserve wall space; individual canvases keep the per-item dimension.
      const GRID_GAP = 0.3; // world units between canvases
      let grid = null;
      if (filePaths.length > 1) {
        const rows = 2;
        const cols = Math.ceil(filePaths.length / rows);
        const canvasW = width;
        const canvasH = height;
        const gridW = cols * canvasW + (cols - 1) * GRID_GAP;
        const gridH = rows * canvasH + (rows - 1) * GRID_GAP;
        grid = { rows, cols, canvasW, canvasH, gap: GRID_GAP, filePaths };
        width = gridW;
        height = gridH;
      }
      
      // Get room and wall from artwork data (with fallbacks)
      // Support both numeric and string IDs
      let roomId = artwork.room || 'main';
      let wall = artwork.wall || 'front';
      
      // Convert numeric IDs if present (see ROOM_ID_MAP / WALL_ID_MAP below).
      if (ROOM_ID_MAP[roomId]) roomId = ROOM_ID_MAP[roomId];
      if (WALL_ID_MAP[wall]) wall = WALL_ID_MAP[wall];
      
      const artworkData = {
        artwork: artwork,
        width: width,
        height: height,
        depth: depth,
        imgSrc: imgSrc,
        grid: grid,
        originalIndex: i,
        room: roomId,
        wall: wall
      };
      
      // Create nested structure: room -> wall -> artworks array
      if (!artworksByRoomAndWall[roomId]) {
        artworksByRoomAndWall[roomId] = {};
      }
      if (!artworksByRoomAndWall[roomId][wall]) {
        artworksByRoomAndWall[roomId][wall] = [];
      }
      
      artworksByRoomAndWall[roomId][wall].push(artworkData);
    });
    
    // PASS 2: Calculate positions with even gaps
    const paintingData = [];
    
    // Function to get wall configuration based on room and wall
    function getWallConfig(roomId, wall, roomDim) {
      const roomPos = roomDim.position;
      const roomWidth = roomDim.width;
      const roomDepth = roomDim.depth;
      
      const configs = {
        'front': {
          name: `${roomId}-front`,
          axis: 'x',
          wallPosition: roomPos.z - roomDepth / 2,  // Front of room
          wallWidth: roomWidth,
          rotation: 0,
          centerOffset: roomPos.x
        },
        'back': {
          name: `${roomId}-back`,
          axis: 'x',
          wallPosition: roomPos.z + roomDepth / 2,  // Back of room
          wallWidth: roomWidth,
          rotation: Math.PI,
          centerOffset: roomPos.x
        },
        'left': {
          name: `${roomId}-left`,
          axis: 'z',
          wallPosition: roomPos.x - roomWidth / 2,  // Left of room
          wallWidth: roomDepth,
          rotation: Math.PI / 2,
          centerOffset: roomPos.z
        },
        'right': {
          name: `${roomId}-right`,
          axis: 'z',
          wallPosition: roomPos.x + roomWidth / 2,  // Right of room
          wallWidth: roomDepth,
          rotation: -Math.PI / 2,
          centerOffset: roomPos.z
        }
      };
      
      return configs[wall] || configs['front'];
    }
    
    // Function to calculate positions for a wall
    function calculateWallPositions(wallArtworks, wallConfig) {
      const numWorks = wallArtworks.length;
      if (numWorks === 0) return [];
      
      const wallWidth = wallConfig.wallWidth;
      const totalArtworkWidth = wallArtworks.reduce((sum, art) => sum + art.width, 0);
      const gap = (wallWidth - totalArtworkWidth) / (numWorks + 1);
      
      console.log(`${wallConfig.name}: ${numWorks} artworks, total width: ${totalArtworkWidth.toFixed(2)}, gap: ${gap.toFixed(2)}, wall width: ${wallWidth}`);
      
      // Start from left edge of wall + gap, relative to wall center
      let currentPosition = -wallWidth / 2 + gap;
      
      return wallArtworks.flatMap((artData, index) => {
        const xOrZ = currentPosition + artData.width / 2 + wallConfig.centerOffset;

        console.log(`  ${wallConfig.name} artwork ${index + 1}: position = ${xOrZ.toFixed(2)}, width = ${artData.width.toFixed(2)}`);

        // Per-artwork Y override: use `positionY` from JSON if provided,
        // otherwise fall back to the default wall-height.
        const yPos = typeof artData.artwork.positionY === 'number'
          ? artData.artwork.positionY
          : WALL_HEIGHT;

        // Per-artwork wall-offset override: positive pushes the artwork away
        // from its wall into the room interior. Useful for GLB sculptures that
        // sit visibly in front of the wall.
        const wallOffset = typeof artData.artwork.wallOffset === 'number'
          ? artData.artwork.wallOffset
          : 0;
        // Interior direction derived from the wall's facing rotation.
        const dxOff = Math.sin(wallConfig.rotation) * wallOffset;
        const dzOff = Math.cos(wallConfig.rotation) * wallOffset;

        const groupPos =
          wallConfig.axis === 'x'
            ? { x: xOrZ + dxOff, y: yPos, z: wallConfig.wallPosition + dzOff }
            : { x: wallConfig.wallPosition + dxOff, y: yPos, z: xOrZ + dzOff };

        const rotationY = wallConfig.rotation;
        currentPosition += artData.width + gap;

        const info = {
          title: artData.artwork.title,
          artist: artData.artwork.artist,
          description: artData.artwork.description,
          date: artData.artwork.date,
          medium: artData.artwork.medium,
          dimension: artData.artwork.dimension,
          category: artData.artwork.category.join(', '),
          link: artData.artwork.link || '',
        };

        // Single-image artwork: unchanged behavior.
        if (!artData.grid) {
          return [{
            imgSrc: artData.imgSrc,
            width: artData.width,
            height: artData.height,
            depth: artData.depth,
            position: groupPos,
            rotationY,
            modelRotation: artData.artwork.modelRotation,
            hasArtworkAudio: parseArtworkAudio(artData.artwork.audio),
            info,
            originalIndex: artData.originalIndex,
          }];
        }

        // Grid artwork: emit N sub-canvases in a 2-row layout centered on groupPos.
        const { rows, cols, canvasW, canvasH, gap: gGap, filePaths } = artData.grid;
        const stepAlong = canvasW + gGap;
        const stepVert = canvasH + gGap;
        const audio = parseArtworkAudio(artData.artwork.audio);
        // Shared identity + dimensions so downstream (furniture avoidance,
        // standalone-wall avoidance) treats the whole grid as one block.
        const gridId = `grid-${artData.originalIndex}`;
        const gridWidth = artData.width;   // full along-wall footprint
        const gridHeight = artData.height; // full vertical footprint
        const gridCenter = { ...groupPos };

        return filePaths.map((src, i) => {
          const c = i % cols;
          const r = Math.floor(i / cols);
          const alongOff = (c - (cols - 1) / 2) * stepAlong;
          const vertOff = ((rows - 1) / 2 - r) * stepVert; // row 0 is top
          const pos = { ...groupPos, y: groupPos.y + vertOff };
          if (wallConfig.axis === 'x') {
            pos.x = groupPos.x + alongOff;
          } else {
            pos.z = groupPos.z + alongOff;
          }
          return {
            imgSrc: src,
            width: canvasW,
            height: canvasH,
            depth: artData.depth,
            position: pos,
            rotationY,
            modelRotation: artData.artwork.modelRotation,
            // Only attach audio to the first sub-canvas of the grid.
            hasArtworkAudio: i === 0 ? audio : false,
            info,
            // Grid metadata — shared across all sub-canvases of this artwork.
            gridId,
            gridWidth,
            gridHeight,
            gridCenter,
            // Bump the sort key slightly per sub-canvas so they stay together.
            originalIndex: artData.originalIndex + i * 1e-4,
          };
        });
      });
    }
    
    // Build blockers per room/wall (doorway openings + standalone partitions)
    // so artworks avoid them and center within the resulting sub-walls.
    const openingsByRoomWall = {};
    const addBlocker = (roomId, wall, start, end) => {
      if (!openingsByRoomWall[roomId]) openingsByRoomWall[roomId] = {};
      if (!openingsByRoomWall[roomId][wall]) openingsByRoomWall[roomId][wall] = [];
      openingsByRoomWall[roomId][wall].push({ start, end });
    };

    if (roomConfig && roomConfig.rooms && roomConfig.doorways) {
      computeDoorwayOpenings(roomConfig.rooms, roomConfig.doorways).forEach((o) => {
        addBlocker(o.roomId, o.wall, o.start, o.end);
      });
    }

    // Standalone partition walls block the wall they attach to (their thickness footprint).
    if (roomConfig && roomConfig.standaloneWalls) {
      roomConfig.standaloneWalls.forEach((w) => {
        if (!w.roomId || !w.attachWall) return;
        const along = (w.attachWall === 'front' || w.attachWall === 'back') ? w.center.x : w.center.z;
        addBlocker(w.roomId, w.attachWall, along - w.thickness / 2, along + w.thickness / 2);
      });
    }

    // Process each room and wall
    for (const [roomId, walls] of Object.entries(artworksByRoomAndWall)) {
      const roomDim = roomDimensions[roomId];
      
      if (!roomDim) {
        console.warn(`Room "${roomId}" not found in config, skipping artworks`);
        continue;
      }
      
      for (const [wall, artworks] of Object.entries(walls)) {
        const wallConfig = getWallConfig(roomId, wall, roomDim);
        const openings = (openingsByRoomWall[roomId] && openingsByRoomWall[roomId][wall]) || [];

        // Split the wall into sub-walls around doorway openings, then place
        // each sub-wall's share of artworks centered with even gaps.
        const segments = computeWallSegments(wallConfig.centerOffset, wallConfig.wallWidth, openings);
        if (segments.length === 0) continue;

        const counts = distributeByLength(artworks.length, segments.map((s) => s.length));
        let idx = 0;
        segments.forEach((seg, si) => {
          const segArtworks = artworks.slice(idx, idx + counts[si]);
          idx += counts[si];
          if (segArtworks.length === 0) return;
          const segConfig = { ...wallConfig, wallWidth: seg.length, centerOffset: seg.center };
          const positioned = calculateWallPositions(segArtworks, segConfig);
          paintingData.push(...positioned);
        });
      }
    }
    
    // Sort by original index to maintain order
    paintingData.sort((a, b) => a.originalIndex - b.originalIndex);
    
    return paintingData;
  } catch (error) {
    console.error('Error loading painting data:', error);
    return [];
  }
}

// Numeric-to-name maps used by both PASS 1 and pre-load helpers.
const ROOM_ID_MAP = {
  1: 'main', 2: 'room2', 3: 'room3', 4: 'room4', 5: 'room5',
  '1': 'main', '2': 'room2', '3': 'room3', '4': 'room4', '5': 'room5',
};
const WALL_ID_MAP = {
  1: 'front', 2: 'back', 3: 'left', 4: 'right',
  '1': 'front', '2': 'back', '3': 'left', '4': 'right',
};

/**
 * Pre-fetch the artwork JSON and return the set of (roomId, wall) pairs that
 * host a multi-image grid artwork. Used to keep standalone partitions off
 * walls that need continuous space for a wide grid layout.
 * @returns {Promise<Array<{roomId: string, wall: string}>>}
 */
export async function getGridWalls() {
  try {
    const response = await fetch('artworks/currentShow.json');
    const data = await response.json();
    const artworks = data.currentShow || [];
    const seen = new Set();
    const result = [];
    artworks.forEach((art) => {
      const paths = Array.isArray(art.filePath) ? art.filePath : [art.filePath];
      const cleanPaths = paths.filter((p) => typeof p === 'string' && p.trim().length > 0);
      if (cleanPaths.length <= 1) return;
      const roomId = ROOM_ID_MAP[art.room] ?? (art.room || 'main');
      const wall = WALL_ID_MAP[art.wall] ?? (art.wall || 'front');
      const key = `${roomId}|${wall}`;
      if (seen.has(key)) return;
      seen.add(key);
      result.push({ roomId, wall });
    });
    return result;
  } catch (err) {
    console.warn('getGridWalls: failed to pre-fetch artwork data', err);
    return [];
  }
}

/**
 * Pre-fetch the artwork JSON and return the total on-wall artwork width per
 * (roomId, wall) pair, in world units. This is used by the room generator so
 * doorways and standalone partitions can skip walls whose paintings would
 * otherwise get chopped up by an opening.
 * @returns {Promise<Object<string, number>>} keys: `${roomId}|${wall}`.
 */
export async function getWallReserves() {
  try {
    const response = await fetch('artworks/currentShow.json');
    const data = await response.json();
    const artworks = data.currentShow || [];
    const scale = 0.05; // must match loadPaintingData
    const GRID_GAP = 0.3; // must match loadPaintingData grid logic
    const reserves = {};

    artworks.forEach((art) => {
      const sceneScale = typeof art.sceneScale === 'number' && art.sceneScale > 0
        ? art.sceneScale
        : 1;
      let w = 5;
      let h = 3;
      if (art.dimension) {
        const dims = art.dimension.match(/(\d+\.?\d*)\s*x\s*(\d+\.?\d*)/);
        if (dims) {
          h = parseFloat(dims[1]);
          w = parseFloat(dims[2]);
        }
      }
      let width = w * scale * sceneScale;

      // Grid artwork occupies cols × canvasW + (cols - 1) × gap on the wall.
      const paths = Array.isArray(art.filePath) ? art.filePath : [art.filePath];
      const cleanPaths = paths.filter((p) => typeof p === 'string' && p.trim().length > 0);
      if (cleanPaths.length > 1) {
        const rows = 2;
        const cols = Math.ceil(cleanPaths.length / rows);
        width = cols * width + (cols - 1) * GRID_GAP;
      }

      const roomId = ROOM_ID_MAP[art.room] ?? (art.room || 'main');
      const wall = WALL_ID_MAP[art.wall] ?? (art.wall || 'front');
      const key = `${roomId}|${wall}`;
      reserves[key] = (reserves[key] || 0) + width;
    });

    return reserves;
  } catch (err) {
    console.warn('getWallReserves: failed to pre-fetch artwork data', err);
    return {};
  }
}

// Export empty array for backwards compatibility
// Actual data will be loaded asynchronously
export const paintingData = [];
