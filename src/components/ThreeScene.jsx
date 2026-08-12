import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { scene, setupScene } from '../../modules/scene.js';
import { createPaintings } from '../../modules/paintings.js';
import { createBoundingBoxes } from '../../modules/boundingBox.js';
import { setupRendering } from '../../modules/rendering.js';
import { setupEventListeners } from '../../modules/eventListeners.js';
import { addObjectsToScene } from '../../modules/sceneHelpers.js';
import { clickHandling } from '../../modules/clickHandling.js';
import { loadStatueModel, loadRockingHorseModel, loadFireExtinguisherModel, loadWineBottles } from '../../modules/model.js';
import { spawnRoomFurniture, computePaintingExclusionRects } from '../../modules/roomFurniture.js';
import { setupBackgroundMusic } from '../../modules/music.js';
import { setupItemSelection, initializeItems } from '../../modules/item.js';
import { initializeControls } from '../../modules/controlsManager.js';
import { createMultiRoomSetup } from '../../modules/roomManager.js';
import { generateRoomLayout, generateStandaloneWalls } from '../../modules/roomGenerator.js';
import { getGridWalls, getWallReserves } from '../../modules/paintingData.js';
// import { loadHDRIEnvironment } from '../../modules/hdriEnvironment.js';

function ThreeScene({ onControlsReady, onAudioReady, onSceneReady, onReady }) {
  const mountRef = useRef(null);
  const sceneInitialized = useRef(false);
  const audioRef = useRef(null);

  useEffect(() => {
    // Only initialize once
    if (sceneInitialized.current) return;
    sceneInitialized.current = true;

    async function initScene() {
      try {
        let { camera, controls, renderer } = setupScene();

        // loadHDRIEnvironment(scene, renderer);

        // Pass controls back to parent
        if (onControlsReady) {
          onControlsReady(controls);
        }

        const textureLoader = new THREE.TextureLoader();

        // Setup background music
        const audio = setupBackgroundMusic(camera);
        audioRef.current = audio;
        
        // Pass audio back to parent
        if (onAudioReady) {
          onAudioReady(audio);
        }

        // ===== NEW ROOM MANAGER SYSTEM =====
        // Room 1 (main) is fixed; the remaining rooms are generated rogue-like each load.
        const mainRoom = {
          id: 'main',
          width: 80,
          depth: 40,
          height: 20,
          position: { x: 0, y: 0, z: 0 },
        };

        // Pre-load painting metadata: which walls host grid artworks (need
        // continuous space) and the total artwork width per wall (used to
        // stop doorways/standalone walls from chopping wide paintings).
        const [gridWalls, wallReserves] = await Promise.all([
          getGridWalls(),
          getWallReserves(),
        ]);

        const { rooms: generatedRooms, doorways: generatedDoorways } = generateRoomLayout({
          baseRoom: mainRoom,
          numNewRooms: 4,
          minGap: 3,
          maxGap: 20,
          // room2 hosts a wide zine grid (~24 units), so lock it to the max size.
          roomOverrides: {
            room2: { width: 50, depth: 40 },
          },
          wallReserves,
        });

        const standaloneWalls = generateStandaloneWalls(generatedRooms, generatedDoorways, {
          // Keep standalone walls away from the player's spawn point (camera
          // starts at x=0, z=10 in scene.js).
          avoidPoints: [{ x: 0, z: 10, r: 8 }],
          blockedWalls: gridWalls,
          wallReserves,
        });

        if (onSceneReady) {
          onSceneReady({
            camera,
            rooms: generatedRooms,
            doorways: generatedDoorways,
          });
        }

        const roomConfig = {
          rooms: generatedRooms,
          doorways: generatedDoorways,
          standaloneWalls,
          spotlights: [
            {
              name: 'Rocking Horse Light',
              position: { x: -15, y: 10, z: 0 },
              target: { x: -15, y: -4.2, z: 5 },
              intensity: 3,
              shadow: true,
              angle: 0.4,
              decay: 0.5,
              penumbra: 0.35,
              distance: 16
            }
          ]
        };

        const { walls, floors, rooms } = createMultiRoomSetup(scene, textureLoader, roomConfig);
        const floor = floors[0]; // Use first floor for raycasting

        // Wait for paintings to load from JSON (pass roomConfig for multi-room support)
        const paintings = await createPaintings(scene, textureLoader, roomConfig);

        // Lighting is now handled automatically by roomManager

        // Add bounding boxes for collision detection (handled automatically by roomManager)
        createBoundingBoxes(walls);
        createBoundingBoxes(paintings);

        addObjectsToScene(scene, paintings);

        setupEventListeners(controls);

        clickHandling(renderer, camera, paintings);

        // Setup item selection with scroll wheel
        setupItemSelection(camera, controls);
        initializeItems(camera);

        // Initialize controls based on device type (mobile or desktop)
        initializeControls(camera, scene, controls, renderer.domElement, floor);

        // Store models for trigger detection
        const models = {};

        // Load models and setup rendering
        loadStatueModel(scene, (statue) => {
          models.statue = statue;
        });
        loadRockingHorseModel(scene);
        loadFireExtinguisherModel(scene);
        loadWineBottles(scene);

        // Random furniture across all rooms. Static props (rocking horse,
        // statue, wine bottles, fire extinguisher) are pre-registered so the
        // spawner won't drop pieces on top of them. Rectangles in front of
        // every painting (width of painting × 10 units into the room) keep
        // artwork sightlines clear.
        spawnRoomFurniture(scene, roomConfig.rooms, {
          wallMargin: 0,
          preOccupied: [
            { x: -15, z: 5,   r: 5 },  // rocking horse
            { x: 37,  z: -16, r: 5 },  // statue
            { x: -39, z: -19, r: 2 },  // fire extinguisher
            { x: 36,  z: -17, r: 3 },  // wine bottles
          ],
          avoidRects: computePaintingExclusionRects(paintings, 10),
        });

        setupRendering(scene, camera, renderer, paintings, controls, walls, floor, models, audio);

        // Append the renderer's canvas to the React mount point
        if (mountRef.current) {
          // Clear any existing content first
          mountRef.current.innerHTML = '';
          mountRef.current.appendChild(renderer.domElement);
        }

        // Pre-compile all shaders in the background so the first view rotation
        // doesn't stutter. `compileAsync` uses KHR_parallel_shader_compile when
        // available and doesn't block the main thread. Returns a Promise so
        // App.jsx can await warmup before hiding the menu.
        const warmupShaders = () => {
          if (renderer.compileAsync) {
            return renderer.compileAsync(scene, camera).catch(() => {});
          }
          renderer.compile(scene, camera);
          return Promise.resolve();
        };
        // Run a first pass ~2s after init (async model loads have finished by
        // then). When compileAsync resolves, notify App.jsx so the "EXPLORE
        // ART" button can leave its LOADING… state.
        setTimeout(() => {
          const p = warmupShaders();
          Promise.resolve(p).finally(() => {
            if (onReady) onReady();
          });
        }, 2000);
        // Expose a manual trigger so App.jsx can re-warm on Explore Art click
        window.warmupShaders = warmupShaders;
      } catch (error) {
        console.error('Error initializing scene:', error);
      }
    }

    initScene();

    // Cleanup function
    return () => {
      delete window.warmupShaders;
    };
  }, [onControlsReady, onAudioReady, onSceneReady, onReady]); // Include callbacks in dependencies

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
}

export default ThreeScene;

