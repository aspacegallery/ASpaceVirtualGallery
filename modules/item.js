import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { isMobileDevice } from './mobileDetection.js';
import { isInputLocked } from './inputLock.js';

// Detect if mobile for position adjustments
const isMobile = isMobileDevice();

// Position offset for mobile (move items to the left)
const mobileXOffset = -0.15; // Move 0.15 units to the left on mobile

// Array of available items with their model paths
// NOTE: Rotation values are in DEGREES (automatically converted to radians)
const items = [
  {
    id: 0,
    name: 'Wine Glass',
    modelPath: '/models/wineGlass/wineGlass.obj',
    texturePath: '/models/wineGlass/texture.png',
    audioPath: '/sounds/audio/wineGlass.mp3',
    model: null,
    audio: null,
    position: { 
      x: isMobile ? 0.25 + mobileXOffset : 0.25, 
      y: -0.5, 
      z: -0.8 
    },
    rotation: { x: 7, y: 0, z: 0 },
    scale: 1.3,
    // Right-click interaction animation (ADJUST THESE)
    interaction: {
      rotation: {
        x: 45,            // Pitch (degrees) - tilt toward/away from camera
        y: 0,             // Yaw (degrees) - rotate left/right
        z: 0              // Roll (degrees) - tilt sideways
      },
      position: {
        x: -0.2,          // Left/Right movement
        y: 0.15,          // Up/Down movement
        z: 0.2            // Forward/Back movement (negative = closer)
      }
    }
  },
  {
    id: 1,
    name: 'Beer',
    modelPath: '/models/beer/beer.obj',
    texturePath: '/models/beer/texture.png',
    audioPath: '/sounds/audio/beer.mp3',
    model: null,
    audio: null,
    position: { 
      x: isMobile ? 0.25 + mobileXOffset : 0.25, 
      y: -0.35, 
      z: -0.8 
    },
    rotation: { x: 0, y: 150, z: 0 },
    scale: 0.00075,
    // Right-click interaction animation (ADJUST THESE)
    interaction: {
      rotation: {
        x: 45,            // Pitch (degrees) - tilt toward/away from camera
        y: 25,            // Yaw (degrees) - rotate left/right
        z: 0              // Roll (degrees) - tilt sideways
      },
      position: {
        x: -0.2,          // Left/Right movement
        y: 0.08,          // Up/Down movement
        z: 0.25           // Forward/Back movement
      }
    }
  },
  {
    id: 2,
    name: 'Cigarette',
    modelPath: '/models/cigarette/cigarette.obj',
    texturePath: '/models/cigarette/texture.png',
    audioPath: '/sounds/audio/cigarette.mp3',
    model: null,
    audio: null,
    position: { 
      x: isMobile ? 0.25 + mobileXOffset : 0.25, 
      y: -0.3, 
      z: -0.8 
    },
    rotation: { x: 110, y: 45, z: 25 },
    scale: 6,
    // Right-click interaction animation (ADJUST THESE)
    interaction: {
      rotation: {
        x: -35,           // Pitch (degrees) - tilt toward/away from camera
        y: 0,            // Yaw (degrees) - rotate left/right
        z: -15           // Roll (degrees) - tilt sideways
      },
      position: {
        x: -0.2,          // Left/Right movement
        y: 0,          // Up/Down movement
        z: 0.2            // Forward/Back movement
      }
    }
  },
  {
    id: 3,
    name: 'Camera',
    modelPath: '/models/camera/Camera.obj',
    texturePath: '/models/camera/texCamera.png',
    audioPath: '/sounds/audio/cameraShutter.mp3',
    model: null,
    audio: null,
    position: { 
      x: isMobile ? 0.25 + mobileXOffset : 0.25, 
      y: -0.3, 
      z: -0.8 
    },
    rotation: { x: 0, y: 90, z: 0 },
    scale: 3.2,
    // Right-click interaction: same as Beer, but without rotation
    interaction: {
      rotation: {
        x: 0,             // Pitch (degrees)
        y: 0,             // Yaw (degrees)
        z: 0              // Roll (degrees)
      },
      position: {
        x: -0.2,          // Left/Right movement
        y: 0.1,          // Up/Down movement
        z: 0.25           // Forward/Back movement
      }
    }
  },
  {
    id: 4,
    name: 'Card',
    // Plane-based item: no OBJ, just a textured quad with 3.5:2 aspect (landscape)
    plane: { width: 0.35, height: 0.2 },
    texturePath: '/otherAssets/otherTexture/card.jpg',
    audioPath: '/sounds/audio/businessCard.mp3',
    model: null,
    audio: null,
    position: {
      x: isMobile ? 0.25 + mobileXOffset : 0.25,
      y: -0.35,
      z: -0.8
    },
    rotation: { x: -15, y: 0, z: 0 },
    scale: 1,
    interaction: {
      rotation: { x: 15, y: 0, z: 0 },
      position: { x: -0.25, y: 0.3, z: 0.35 }
    }
  }
];

// Current selected item index
let currentItemIndex = 0;
let currentItemMesh = null;
let modelsLoaded = false;
let isAnimating = false; // Prevent scrolling during animation
let isInteracting = false; // Prevent right-click spam during interaction
let audioListener = null; // Audio listener for 3D sound
let smokeTexture = null; // Smoke texture for cigarette effect
let smokeMesh = null; // Current smoke mesh attached to camera

// Load all item models
export async function loadItemModels(camera) {
  const objLoader = new OBJLoader();
  const textureLoader = new THREE.TextureLoader();
  const audioLoader = new THREE.AudioLoader();
  
  // Detect mobile for performance optimizations
  const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

  // Create audio listener if not already created
  if (!audioListener) {
    audioListener = new THREE.AudioListener();
    camera.add(audioListener);
  }

  // Load smoke texture for cigarette effect
  smokeTexture = textureLoader.load('/models/cigarette/smoke.png', () => {
    console.log('✓ Loaded smoke texture');
  });
  smokeTexture.transparent = true;

  console.log('Loading item models with textures and audio...');

  const loadPromises = items.map((item, index) => {
    return new Promise((resolve, reject) => {
      // Load texture
      const texture = textureLoader.load(
        item.texturePath,
        () => {
          console.log(`✓ Loaded texture for ${item.name}`);
        },
        undefined,
        (error) => {
          console.error(`Error loading texture for ${item.name}:`, error);
        }
      );

      // Configure texture for proper display with performance optimizations
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = true; // Important for OBJ models
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.generateMipmaps = true;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.anisotropy = 2; // Reduced for GPU texture unit limit

      // Load audio (optional — skip items without an audioPath)
      if (item.audioPath) {
        const audio = new THREE.Audio(audioListener);
        audioLoader.load(
          item.audioPath,
          (buffer) => {
            audio.setBuffer(buffer);
            audio.setVolume(0.7); // Set volume to 70%
            items[index].audio = audio;
            console.log(`✓ Loaded ${item.name} audio`);
          },
          undefined,
          (error) => {
            console.error(`Error loading audio for ${item.name}:`, error);
          }
        );
      }

      // Plane-based item: build a textured quad instead of loading an OBJ
      if (item.plane) {
        const { width, height } = item.plane;
        const geometry = new THREE.PlaneGeometry(width, height);
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.DoubleSide,
          transparent: true
        });
        const mesh = new THREE.Mesh(geometry, material);
        items[index].model = mesh;
        console.log(`✓ Built ${item.name} plane mesh`);
        resolve();
        return;
      }

      // Load OBJ model
      objLoader.load(
        item.modelPath,
        (object) => {
          // Apply texture to all meshes
          object.traverse((child) => {
            if (child.isMesh) {
              // Create new material with the texture
              child.material = new THREE.MeshStandardMaterial({
                map: texture,
                metalness: 0,
                roughness: 1,
                side: THREE.DoubleSide // Render both sides to ensure visibility
              });
              child.castShadow = !isMobile; // Disable shadows on mobile
              child.receiveShadow = !isMobile;
            }
          });

          // Store the loaded model
          items[index].model = object;
          console.log(`✓ Loaded ${item.name} model with texture`);
          resolve();
        },
        // Progress callback
        (xhr) => {
          const percentComplete = (xhr.loaded / xhr.total) * 100;
          if (percentComplete === 100) {
            console.log(`${item.name} model downloaded`);
          }
        },
        // Error callback
        (error) => {
          console.error(`Error loading OBJ for ${item.name}:`, error);
          reject(error);
        }
      );
    });
  });

  try {
    await Promise.all(loadPromises);
    modelsLoaded = true;
    console.log('All item models loaded successfully with proper UV mapping!');
  } catch (error) {
    console.error('Error loading some item models:', error);
  }
}

// Setup scroll event listener for item selection
export function setupItemSelection(camera, controls) {
  // Scroll wheel event
  window.addEventListener('wheel', (event) => {
    if (isInputLocked()) return;

    if (!modelsLoaded) {
      console.log('Models still loading...');
      return;
    }

    // Don't allow scrolling during animation or interaction
    if (isAnimating || isInteracting) {
      return;
    }

    // Determine new index
    let newItemIndex;
    if (event.deltaY > 0) {
      // Scroll down
      newItemIndex = (currentItemIndex + 1) % items.length;
    } else {
      // Scroll up
      newItemIndex = (currentItemIndex - 1 + items.length) % items.length;
    }
    
    console.log('=============================');
    console.log('Selected item ID:', newItemIndex);
    console.log('Item name:', items[newItemIndex].name);
    console.log('=============================');

    // Animate transition
    animateItemTransition(camera, newItemIndex);
  }, { passive: true, capture: true });

  // Right-click event (works during pointer lock)
  window.addEventListener('mousedown', (event) => {
    // Check if it's a right-click (button 2)
    if (event.button !== 2) {
      return;
    }

    if (isInputLocked()) return;

    if (!modelsLoaded || !currentItemMesh || isInteracting || isAnimating) {
      return;
    }

    console.log('Right-click: Interacting with', items[currentItemIndex].name);
    animateItemInteraction(camera);
  });

  // Touch event for mobile (tap on item)
  let touchStartTime = 0;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartFingers = 0;
  
  window.addEventListener('touchstart', (event) => {
    touchStartTime = Date.now();
    touchStartFingers = event.touches.length;
    if (event.touches.length === 1) {
      touchStartX = event.touches[0].clientX;
      touchStartY = event.touches[0].clientY;
    }
  }, { passive: true });
  
  window.addEventListener('touchend', (event) => {
    if (isInputLocked()) return;

    if (!modelsLoaded) {
      return;
    }
    
    const touchDuration = Date.now() - touchStartTime;
    
    // Check for two-finger tap to switch items
    if (touchStartFingers === 2 && touchDuration < 300 && !isAnimating) {
      console.log('Two-finger tap detected - switching item');
      const newItemIndex = (currentItemIndex + 1) % items.length;
      console.log('=============================');
      console.log('Selected item ID:', newItemIndex);
      console.log('Item name:', items[newItemIndex].name);
      console.log('=============================');
      animateItemTransition(camera, newItemIndex);
      return;
    }
    
    // Single finger tap for item interaction
    if (touchStartFingers === 1 && !isInteracting && !isAnimating && currentItemMesh) {
      const touch = event.changedTouches[0];
      const touchMoved = Math.sqrt(
        Math.pow(touch.clientX - touchStartX, 2) + 
        Math.pow(touch.clientY - touchStartY, 2)
      );
      
      // If it was a quick tap (not a swipe) and in the bottom-right area (where item is displayed)
      const isBottomRight = touch.clientX > window.innerWidth * 0.5 && 
                            touch.clientY > window.innerHeight * 0.7;
      
      if (touchDuration < 300 && touchMoved < 20 && isBottomRight) {
        console.log('Mobile tap: Interacting with', items[currentItemIndex].name);
        animateItemInteraction(camera);
      }
    }
  }, { passive: true });

  // Prevent context menu when pointer is unlocked
  window.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });
}

// Animate transition between items
function animateItemTransition(camera, newItemIndex) {
  isAnimating = true;
  const animationDuration = 100; // 0.5 seconds
  const moveDistance = 0.35; // Move down/up by 5 units
  
  const oldMesh = currentItemMesh;
  const oldItem = items[currentItemIndex];
  
  // Phase 1: Animate current item moving down
  if (oldMesh) {
    const startY = oldMesh.position.y;
    const targetY = startY - moveDistance;
    const startTime = Date.now();
    
    function animateOut() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / animationDuration, 1);
      
      // Ease out animation
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      oldMesh.position.y = startY + (targetY - startY) * easeProgress;
      
      if (progress < 1) {
        requestAnimationFrame(animateOut);
      } else {
        // Remove old item after animation
        camera.remove(oldMesh);
        
        // Phase 2: Create and animate new item coming up
        currentItemIndex = newItemIndex;
        animateNewItemIn(camera);
      }
    }
    
    animateOut();
  } else {
    // No old item, just show new one
    currentItemIndex = newItemIndex;
    animateNewItemIn(camera);
  }
}

// Animate new item coming up from below
function animateNewItemIn(camera) {
  const selectedItem = items[currentItemIndex];
  
  if (!selectedItem.model) {
    console.log('Model not loaded yet for:', selectedItem.name);
    isAnimating = false;
    return;
  }
  
  // Clone and setup the new item
  currentItemMesh = selectedItem.model.clone();
  
  currentItemMesh.position.set(
    selectedItem.position.x,
    selectedItem.position.y - 5, // Start 5 units below
    selectedItem.position.z
  );
  
  // Convert degrees to radians
  currentItemMesh.rotation.set(
    THREE.MathUtils.degToRad(selectedItem.rotation.x),
    THREE.MathUtils.degToRad(selectedItem.rotation.y),
    THREE.MathUtils.degToRad(selectedItem.rotation.z)
  );
  
  currentItemMesh.scale.set(
    selectedItem.scale,
    selectedItem.scale,
    selectedItem.scale
  );
  
  camera.add(currentItemMesh);
  
  // Animate up to normal position
  const animationDuration = 500;
  const startY = selectedItem.position.y - 5;
  const targetY = selectedItem.position.y;
  const startTime = Date.now();
  
  function animateIn() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / animationDuration, 1);
    
    // Ease out animation
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    
    currentItemMesh.position.y = startY + (targetY - startY) * easeProgress;
    
    if (progress < 1) {
      requestAnimationFrame(animateIn);
    } else {
      isAnimating = false; // Animation complete, allow scrolling again
      console.log(`Displaying: ${selectedItem.name}`);
    }
  }
  
  animateIn();
}

// Animate item interaction (right-click)
function animateItemInteraction(camera) {
  if (!currentItemMesh) return;
  
  isInteracting = true;
  
  const selectedItem = items[currentItemIndex];
  
  // Play the item's sound effect (Camera is delayed below)
  if (selectedItem.audio && selectedItem.name !== 'Camera') {
    // Stop if already playing
    if (selectedItem.audio.isPlaying) {
      selectedItem.audio.stop();
    }
    selectedItem.audio.play();
    console.log(`🔊 Playing ${selectedItem.name} sound`);
  }
  
  // Trigger smoke effect for cigarette (600ms after interaction)
  if (selectedItem.name === 'Cigarette') {
    setTimeout(() => {
      triggerSmokeEffect(camera);
    }, 800);
  }

  // Camera: play shutter sound + flash after 0.5s delay
  if (selectedItem.name === 'Camera') {
    setTimeout(() => {
      if (selectedItem.audio) {
        if (selectedItem.audio.isPlaying) {
          selectedItem.audio.stop();
        }
        selectedItem.audio.play();
        console.log(`🔊 Playing ${selectedItem.name} sound`);
      }
      triggerCameraFlash(camera);
    }, 400);
  }
  
  // Store original values
  const originalRotationX = THREE.MathUtils.degToRad(selectedItem.rotation.x);
  const originalRotationY = THREE.MathUtils.degToRad(selectedItem.rotation.y);
  const originalRotationZ = THREE.MathUtils.degToRad(selectedItem.rotation.z);
  const originalX = selectedItem.position.x;
  const originalY = selectedItem.position.y;
  const originalZ = selectedItem.position.z;
  
  // Get interaction settings for this specific item
  const interaction = selectedItem.interaction;
  
  // Calculate target values using item-specific interaction settings
  const targetRotationX = originalRotationX + THREE.MathUtils.degToRad(interaction.rotation.x);
  const targetRotationY = originalRotationY + THREE.MathUtils.degToRad(interaction.rotation.y);
  const targetRotationZ = originalRotationZ + THREE.MathUtils.degToRad(interaction.rotation.z);
  const targetX = originalX + interaction.position.x;
  const targetY = originalY + interaction.position.y;
  const targetZ = originalZ + interaction.position.z;
  
  // Phase 1: Tilt and raise (100ms)
  const tiltDuration = 100;
  let startTime = Date.now();
  
  function animateTilt() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / tiltDuration, 1);
    
    // Ease out
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    
    // Update rotation and position
    currentItemMesh.rotation.x = originalRotationX + (targetRotationX - originalRotationX) * easeProgress;
    currentItemMesh.rotation.y = originalRotationY + (targetRotationY - originalRotationY) * easeProgress;
    currentItemMesh.rotation.z = originalRotationZ + (targetRotationZ - originalRotationZ) * easeProgress;
    currentItemMesh.position.x = originalX + (targetX - originalX) * easeProgress;
    currentItemMesh.position.y = originalY + (targetY - originalY) * easeProgress;
    currentItemMesh.position.z = originalZ + (targetZ - originalZ) * easeProgress;
    
    if (progress < 1) {
      requestAnimationFrame(animateTilt);
    } else {
      // Phase 2: Hold for 500ms
      setTimeout(() => {
        animateReturn();
      }, 700);
    }
  }
  
  // Phase 3: Return to original (100ms)
  function animateReturn() {
    startTime = Date.now();
    
    function animateBack() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / tiltDuration, 1);
      
      // Ease out
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      // Reverse animation
      currentItemMesh.rotation.x = targetRotationX + (originalRotationX - targetRotationX) * easeProgress;
      currentItemMesh.rotation.y = targetRotationY + (originalRotationY - targetRotationY) * easeProgress;
      currentItemMesh.rotation.z = targetRotationZ + (originalRotationZ - targetRotationZ) * easeProgress;
      currentItemMesh.position.x = targetX + (originalX - targetX) * easeProgress;
      currentItemMesh.position.y = targetY + (originalY - targetY) * easeProgress;
      currentItemMesh.position.z = targetZ + (originalZ - targetZ) * easeProgress;
      
      if (progress < 1) {
        requestAnimationFrame(animateBack);
      } else {
        // Reset to exact original values
        currentItemMesh.rotation.x = originalRotationX;
        currentItemMesh.rotation.y = originalRotationY;
        currentItemMesh.rotation.z = originalRotationZ;
        currentItemMesh.position.x = originalX;
        currentItemMesh.position.y = originalY;
        currentItemMesh.position.z = originalZ;
        isInteracting = false;
        console.log('Interaction complete');
      }
    }
    
    animateBack();
  }
  
  animateTilt();
}

// Update which item is displayed in front of the camera (without animation)
function updateDisplayedItem(camera) {
  // Remove current item if it exists
  if (currentItemMesh) {
    camera.remove(currentItemMesh);
  }

  const selectedItem = items[currentItemIndex];

  if (!selectedItem.model) {
    console.log('Model not loaded yet for:', selectedItem.name);
    return;
  }

  // Clone the model and attach to camera
  currentItemMesh = selectedItem.model.clone();
  
  currentItemMesh.position.set(
    selectedItem.position.x,
    selectedItem.position.y,
    selectedItem.position.z
  );
  
  // Convert degrees to radians
  currentItemMesh.rotation.set(
    THREE.MathUtils.degToRad(selectedItem.rotation.x),
    THREE.MathUtils.degToRad(selectedItem.rotation.y),
    THREE.MathUtils.degToRad(selectedItem.rotation.z)
  );
  
  currentItemMesh.scale.set(
    selectedItem.scale,
    selectedItem.scale,
    selectedItem.scale
  );

  camera.add(currentItemMesh);
  console.log(`Displaying: ${selectedItem.name}`);
}

// Initialize the first item
export async function initializeItems(camera) {
  console.log('Initializing item selection system...');
  
  // Load all models and audio first
  await loadItemModels(camera);
  
  if (modelsLoaded) {
    console.log('Current item:', items[currentItemIndex].name);
    console.log('Use mouse scroll wheel to change items');
    
    // Display the first item
    updateDisplayedItem(camera);
  }

  // Pre-create the flash light (intensity 0) so its shaders compile during
  // load, preventing the first-photo stutter.
  ensureFlashLight(camera);
}

// Trigger smoke effect in front of camera
function triggerSmokeEffect(camera) {
  // Remove existing smoke if any
  if (smokeMesh) {
    camera.remove(smokeMesh);
    smokeMesh.geometry.dispose();
    smokeMesh.material.dispose();
  }

  // Create smoke plane
  const geometry = new THREE.PlaneGeometry(0.6, 0.95);
  const material = new THREE.MeshBasicMaterial({
    map: smokeTexture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.NormalBlending
  });

  smokeMesh = new THREE.Mesh(geometry, material);
  
  // Position in front of camera
  smokeMesh.position.set(0, -0.1, -0.6); // Centered, slightly in front
  
  // Rotate -45 degrees on X-axis
  smokeMesh.rotation.x = THREE.MathUtils.degToRad(-40);
  
  camera.add(smokeMesh);
  
  console.log('💨 Smoke effect triggered');
  
  // Animate smoke (500ms total)
  const duration = 800; // 500ms
  const startTime = Date.now();
  
  function animateSmoke() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    if (progress < 0.5) {
      // Fade in (first half - 250ms)
      const fadeInProgress = progress * 2; // 0 to 1 over first half
      smokeMesh.material.opacity = fadeInProgress * 0.6; // Max opacity 0.6
    } else {
      // Fade out (second half - 250ms)
      const fadeOutProgress = (progress - 0.5) * 2; // 0 to 1 over second half
      smokeMesh.material.opacity = (1 - fadeOutProgress) * 0.6;
    }
    
    // Slowly drift upward
    smokeMesh.position.y += 0.0006;
    
    // Slowly expand
    const scale = 1 + progress * 0.5; // Grows 30%
    smokeMesh.scale.set(scale, scale, 1);
    
    if (progress < 1) {
      requestAnimationFrame(animateSmoke);
    } else {
      // Remove smoke after animation
      camera.remove(smokeMesh);
      smokeMesh.geometry.dispose();
      smokeMesh.material.dispose();
      smokeMesh = null;
      console.log('💨 Smoke effect complete');
    }
  }
  
  animateSmoke();
}

// Persistent flash light. Created once and kept in the scene (intensity 0) so
// its shaders compile on load — this avoids the big stutter that happens the
// first time a new light is added to the scene.
let flashLight = null;

function ensureFlashLight(camera) {
  if (flashLight) return flashLight;
  flashLight = new THREE.SpotLight(0xffffff, 0, 30, Math.PI / 4, 0.4, 1);
  // In front of the handheld camera (which sits at z ≈ -0.8), pointing forward (-Z)
  flashLight.position.set(0, -0.3, -1.1);
  flashLight.target.position.set(0, -0.3, -2.1);
  camera.add(flashLight);
  camera.add(flashLight.target);
  return flashLight;
}

// Camera flash: light up the persistent flash, capture while it's lit, then dim
function triggerCameraFlash(camera) {
  const light = ensureFlashLight(camera);
  light.intensity = 60;
  console.log('📸 Camera flash triggered');

  const start = performance.now();
  // Capture the screenshot while the flash is still lighting the scene
  downloadScreenshot(() => {
    const elapsed = performance.now() - start;
    // Keep the flash visible for at least ~120ms total
    setTimeout(() => {
      light.intensity = 0;
      console.log('📸 Camera flash off');
    }, Math.max(0, 120 - elapsed));
  });
}

// Preload the film-grain overlay so the first shot doesn't wait on the network.
const cameraFilterImg = new Image();
cameraFilterImg.src = '/otherAssets/otherTexture/filter.png';

// Download the current WebGL canvas as a PNG image
// (DOM overlays like the Controls panel are NOT part of the canvas, so they
//  never appear in the screenshot. We only need to hide the handheld item.)
function downloadScreenshot(onCaptured) {
  const canvas = document.querySelector('canvas');
  if (!canvas) {
    console.warn('📸 No canvas found for screenshot');
    if (onCaptured) onCaptured();
    return;
  }

  // Hide the handheld camera model so it doesn't show up in the photo
  const wasVisible = currentItemMesh ? currentItemMesh.visible : false;
  if (currentItemMesh) currentItemMesh.visible = false;

  // Wait two frames so the render loop draws at least one frame without the item
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      // Restore the handheld item right after the frame is captured
      const restore = () => {
        if (currentItemMesh) currentItemMesh.visible = wasVisible;
      };

      try {
        // The WebGL buffer is a fixed 16:9 size, but it's rendered with the
        // window's aspect and CSS-stretched on screen. Redraw it onto a canvas
        // matching the displayed (CSS) size so the photo matches what's seen.
        const dispW = canvas.clientWidth || canvas.width;
        const dispH = canvas.clientHeight || canvas.height;
        const out = document.createElement('canvas');
        out.width = dispW;
        out.height = dispH;
        const outCtx = out.getContext('2d');
        outCtx.drawImage(canvas, 0, 0, dispW, dispH);

        // Overlay the film-grain filter (multiply blend keeps the photo
        // visible underneath while adding the texture on top).
        if (cameraFilterImg.complete && cameraFilterImg.naturalWidth > 0) {
          outCtx.globalCompositeOperation = 'multiply';
          outCtx.drawImage(cameraFilterImg, 0, 0, dispW, dispH);
          outCtx.globalCompositeOperation = 'source-over';
        }

        const dataUrl = out.toDataURL('image/png');
        restore();
        if (onCaptured) onCaptured();

        const link = document.createElement('a');
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.href = dataUrl;
        link.download = `ASpace-photo-${stamp}.png`;
        // Must be in the DOM for the download to fire in some browsers
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        console.log('📸 Screenshot downloaded');
      } catch (err) {
        restore();
        if (onCaptured) onCaptured();
        console.error('📸 Screenshot failed:', err);
      }
    });
  });
}

// Get current selected item info
export function getCurrentItem() {
  return items[currentItemIndex];
}

// Export items array for external access if needed
export { items };
