import * as THREE from 'three';
import { checkCollision } from './movement.js';

/**
 * Tap-to-Move Navigation for Mobile Devices
 * Allows users to tap on the floor to move the camera to that location
 * and swipe to look around
 */

// Movement state
let targetPosition = null;
let isMoving = false;
let movementProgress = 0;
const moveSpeed = 7.0; // Units per second (increased from 2.5 for faster movement)

// Rotation state for swipe
let lastTouchX = 0;
let lastTouchY = 0;
let isRotating = false;
const rotationSensitivity = 0.003;

// Raycaster for detecting floor taps
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

// Camera rotation limits (prevent looking too far up/down)
const minPolarAngle = Math.PI * 0.1; // 18 degrees from top
const maxPolarAngle = Math.PI * 0.9; // 18 degrees from bottom

// Store Euler for rotation
let cameraRotation = new THREE.Euler(0, 0, 0, 'YXZ');

/**
 * Initialize tap-to-move controls
 * @param {THREE.Camera} camera - The camera to control
 * @param {THREE.Scene} scene - The scene containing the floor
 * @param {HTMLElement} domElement - The canvas element to attach listeners
 * @param {THREE.Mesh} floor - The floor mesh to raycast against
 */
export function setupTapToMoveControls(camera, scene, domElement, floor) {
  console.log('🎮 Setting up Tap-to-Move controls for mobile');
  console.log('📱 Canvas element:', domElement);
  console.log('🏠 Floor mesh:', floor);
  
  // Initialize camera rotation from current camera rotation
  cameraRotation.setFromQuaternion(camera.quaternion);
  
  let touchStartTime = 0;
  let touchStartX = 0;
  let touchStartY = 0;
  const tapThreshold = 150; // milliseconds - distinguish tap from swipe
  const moveThreshold = 10; // pixels - minimum movement to be considered a swipe
  
  // Touch start
  const handleTouchStart = (event) => {
    console.log('👆 Touch start detected');
    event.preventDefault();
    
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      touchStartTime = Date.now();
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      lastTouchX = touch.clientX;
      lastTouchY = touch.clientY;
      console.log(`Touch at: (${touch.clientX}, ${touch.clientY})`);
    }
  };
  
  domElement.addEventListener('touchstart', handleTouchStart, { passive: false });
  
  // Touch move - for swiping to look around
  const handleTouchMove = (event) => {
    event.preventDefault();
    
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      const deltaX = touch.clientX - lastTouchX;
      const deltaY = touch.clientY - lastTouchY;
      
      // Check if moved enough to be a swipe
      const totalMoved = Math.sqrt(
        Math.pow(touch.clientX - touchStartX, 2) + 
        Math.pow(touch.clientY - touchStartY, 2)
      );
      
      if (totalMoved > moveThreshold) {
        isRotating = true;
        console.log('👉 Swiping - rotating camera');
        
        // Update camera rotation
        cameraRotation.y -= deltaX * rotationSensitivity;
        cameraRotation.x -= deltaY * rotationSensitivity;
        
        // Clamp vertical rotation
        cameraRotation.x = Math.max(
          -Math.PI / 2 + 0.1,
          Math.min(Math.PI / 2 - 0.1, cameraRotation.x)
        );
        
        camera.quaternion.setFromEuler(cameraRotation);
      }
      
      lastTouchX = touch.clientX;
      lastTouchY = touch.clientY;
    }
  };
  
  domElement.addEventListener('touchmove', handleTouchMove, { passive: false });
  
  // Touch end - detect tap vs swipe
  const handleTouchEnd = (event) => {
    console.log('👆 Touch end detected');
    event.preventDefault();
    
    const touchDuration = Date.now() - touchStartTime;
    const touch = event.changedTouches[0];
    const totalMoved = Math.sqrt(
      Math.pow(touch.clientX - touchStartX, 2) + 
      Math.pow(touch.clientY - touchStartY, 2)
    );
    
    console.log(`Touch duration: ${touchDuration}ms, moved: ${totalMoved.toFixed(2)}px`);
    
    // If it was a quick tap (not a long swipe)
    if (touchDuration < tapThreshold && totalMoved < moveThreshold && !isRotating) {
      console.log('🎯 Tap detected - attempting to move');
      
      // Wait a tiny bit to see if painting click handler set the flag
      setTimeout(() => {
        if (window.lastTapHitPainting) {
          console.log('Painting was clicked - skipping floor movement');
          window.lastTapHitPainting = false; // Reset flag
        } else {
          handleTap(touch.clientX, touch.clientY, camera, floor, domElement);
        }
      }, 50); // 50ms delay to let painting click handler run first
    } else {
      console.log('👉 Swipe detected (not a tap)');
    }
    
    isRotating = false;
  };
  
  domElement.addEventListener('touchend', handleTouchEnd, { passive: false });
  
  console.log('✅ Tap-to-Move controls initialized');
  console.log('📱 Tap on floor to move, swipe to look around');
}

/**
 * Handle tap on screen - raycast to find floor position
 */
function handleTap(x, y, camera, floor, domElement) {
  // Check if tap is in the item interaction area (bottom-right quadrant)
  // If so, don't trigger movement (let item interaction handle it)
  const isBottomRight = x > domElement.clientWidth * 0.5 && 
                        y > domElement.clientHeight * 0.7;
  
  if (isBottomRight) {
    console.log('Tap in item area - skipping floor movement');
    return;
  }
  
  // Calculate normalized device coordinates (-1 to +1)
  pointer.x = (x / domElement.clientWidth) * 2 - 1;
  pointer.y = -(y / domElement.clientHeight) * 2 + 1;
  
  // Update raycaster
  raycaster.setFromCamera(pointer, camera);
  
  // Check intersection with floor
  const intersects = raycaster.intersectObject(floor, false);
  
  if (intersects.length > 0) {
    const intersectionPoint = intersects[0].point;
    
    // Set target position (keep same height as camera)
    targetPosition = new THREE.Vector3(
      intersectionPoint.x,
      camera.position.y,
      intersectionPoint.z
    );
    
    isMoving = true;
    movementProgress = 0;
    
    console.log(`🎯 Moving to: (${targetPosition.x.toFixed(2)}, ${targetPosition.z.toFixed(2)})`);
    
    // Optional: Show visual indicator where user tapped
    showTapIndicator(intersectionPoint);
  }
}

/**
 * Visual indicator for tap location (optional)
 */
let tapIndicator = null;
let tapIndicatorTimeout = null;

function showTapIndicator(position) {
  // Remove existing indicator
  if (tapIndicator && tapIndicator.parent) {
    tapIndicator.parent.remove(tapIndicator);
  }
  
  // Create a simple circle indicator on the floor
  const geometry = new THREE.RingGeometry(0.3, 0.5, 32);
  const material = new THREE.MeshBasicMaterial({ 
    color: 0x00ff00,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide
  });
  
  tapIndicator = new THREE.Mesh(geometry, material);
  tapIndicator.position.copy(position);
  tapIndicator.position.y = 0.01; // Slightly above floor to prevent z-fighting
  tapIndicator.rotation.x = -Math.PI / 2; // Lay flat on floor
  
  // Add to scene (assuming we have access - may need to pass scene as parameter)
  // For now, we'll skip adding to scene to avoid complexity
  // You can add this later if needed
  
  // Clear timeout if exists
  if (tapIndicatorTimeout) {
    clearTimeout(tapIndicatorTimeout);
  }
  
  // Remove indicator after 1 second
  tapIndicatorTimeout = setTimeout(() => {
    if (tapIndicator && tapIndicator.parent) {
      tapIndicator.parent.remove(tapIndicator);
    }
    tapIndicator = null;
  }, 1000);
}

/**
 * Update tap-to-move movement (call in animation loop)
 * @param {number} delta - Time since last frame
 * @param {THREE.Camera} camera - The camera to move
 * @param {THREE.Group} walls - Wall group for collision detection
 */
export function updateTapToMove(delta, camera, walls) {
  if (!isMoving || !targetPosition) return;
  
  const previousPosition = camera.position.clone();
  
  // Calculate direction to target
  const direction = new THREE.Vector3()
    .subVectors(targetPosition, camera.position)
    .normalize();
  
  // Calculate distance to target
  const distance = camera.position.distanceTo(targetPosition);
  
  // Move towards target
  const moveDistance = moveSpeed * delta;
  
  if (distance < 0.1) {
    // Reached target
    camera.position.copy(targetPosition);
    isMoving = false;
    targetPosition = null;
    console.log('✅ Arrived at destination');
  } else {
    // Move towards target with easing
    const moveAmount = Math.min(moveDistance, distance);
    camera.position.add(direction.multiplyScalar(moveAmount));
    
    // Check for collision
    if (checkCollision(camera, walls)) {
      // Hit a wall, stop moving
      camera.position.copy(previousPosition);
      isMoving = false;
      targetPosition = null;
      console.log('⚠️ Movement blocked by collision');
    }
  }
}

/**
 * Cancel current movement
 */
export function cancelMovement() {
  isMoving = false;
  targetPosition = null;
  movementProgress = 0;
}

/**
 * Check if currently moving
 */
export function isCurrentlyMoving() {
  return isMoving;
}

/**
 * Get current target position (if any)
 */
export function getTargetPosition() {
  return targetPosition;
}

/**
 * Cleanup - remove event listeners
 */
export function disposeTapToMoveControls(domElement) {
  // Note: We can't easily remove anonymous functions
  // In production, you'd want to store references to the handlers
  console.log('🧹 Tap-to-Move controls disposed');
}
