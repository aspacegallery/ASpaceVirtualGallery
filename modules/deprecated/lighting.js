import * as THREE from "three";
import { GUI } from "lil-gui";

export const setupLighting = (scene, paintings) => {
  // Detect mobile for performance optimizations
  const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  
  // Initialize GUI (only in development)
  const gui = import.meta.env.PROD ? null : new GUI();

  // Ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.1);
  scene.add(ambientLight);

  // GUI for Ambient Light (only in development)
  if (gui) {
    const ambientFolder = gui.addFolder("Ambient Light");
    ambientFolder.add(ambientLight, "intensity", 0, 20).name("Intensity");
  }

  function createSpotlight(x, y, z, intensity, targetPosition) {
    const spotlight = new THREE.SpotLight(0xffffff, intensity);
    spotlight.position.set(x, y, z);
    spotlight.target.position.copy(targetPosition);
    spotlight.castShadow = !isMobile; // Disable shadows on mobile for better performance
    spotlight.angle = 1.26134;
    spotlight.penumbra = 0.2;
    spotlight.decay = 0.4;
    spotlight.distance = 27;
    // Lower shadow resolution on mobile (512 vs 1024)
    spotlight.shadow.mapSize.width = isMobile ? 512 : 1024;
    spotlight.shadow.mapSize.height = isMobile ? 512 : 1024;

    // Add spotlight and its target to the scene
    scene.add(spotlight);
    scene.add(spotlight.target);

    // Add a helper for this spotlight
    // const spotlightHelper = new THREE.SpotLightHelper(spotlight);
    // scene.add(spotlightHelper);

    // Create a GUI folder for this spotlight (only in development)
    if (gui) {
      const folder = gui.addFolder(`Spotlight (${x}, ${y}, ${z})`);
      folder.add(spotlight, "intensity", 0, 20).name("Intensity");
      folder.add(spotlight, "angle", 0, Math.PI / 2).name("Angle");
      folder.add(spotlight, "penumbra", 0, 1).name("Penumbra");
      folder.add(spotlight, "decay", 0, 2).name("Decay");
      folder.add(spotlight, "distance", 0, 100).name("Distance");
      folder.add(spotlight.position, "x", -50, 50);
      folder.add(spotlight.position, "y", -50, 50);
      folder.add(spotlight.position, "z", -50, 50);
      folder.add(spotlight.target.position, "x", -50, 50);
      folder.add(spotlight.target.position, "y", -50, 50);
      folder.add(spotlight.target.position, "z", -50, 50);
    }

    return spotlight;
  }

  const frontWallSpotlight01 = createSpotlight(
    -25,
    6.7,
    -13,
    8,
    new THREE.Vector3(-25, 0, -20)
  );

  const frontWallSpotlight02 = createSpotlight(
    0,
    6.7,
    -13,
    8,
    new THREE.Vector3(0, 0, -20)
  );

  const frontWallSpotlight03 = createSpotlight(
    25,
    6.7,
    -13,
    8,
    new THREE.Vector3(25, 0, -20)
  );


  const backWallSpotlight01 = createSpotlight(
    -25,
    6.7,
    13,
    8,
    new THREE.Vector3(-25, 0, 20)
  );

  const backWallSpotlight02 = createSpotlight(
    0,
    6.7,
    13,
    8,
    new THREE.Vector3(0, 0, 20)
  );

  const backWallSpotlight03 = createSpotlight(
    25,
    6.7,
    13,
    8,
    new THREE.Vector3(25, 0, 20)
  );

  const leftWallSpotlight = createSpotlight(
    -33,
    6.7,
    0,
    8,
    new THREE.Vector3(-40, 0, 0)
  );

  const rightWallSpotlight = createSpotlight(
    33,
    6.7,
    0,
    8,
    new THREE.Vector3(40, 0, 0)
  );

  const statueSpotlight = createSpotlight(
    -15,
    10,
    0,
    8,
    new THREE.Vector3(-15, -4.2, 5)
  ); // Spotlight for the statue
  statueSpotlight.angle = 0.4;
  statueSpotlight.decay = 0.5;
  statueSpotlight.penumbra = 0.3;
  statueSpotlight.distance = 0;

  // GUI for Statue Light (only in development)
  if (gui) {
    const statueSpotlightFolder = gui.addFolder("Statue Light");
    statueSpotlightFolder.add(statueSpotlight, "intensity", 0, 20).name("Intensity");
    statueSpotlightFolder
      .add(statueSpotlight, "angle", 0, Math.PI / 2)
      .name("Angle");
    statueSpotlightFolder.add(statueSpotlight, "penumbra", 0, 1).name("Penumbra");
    statueSpotlightFolder.add(statueSpotlight, "decay", 0, 2).name("Decay");
  }
};
