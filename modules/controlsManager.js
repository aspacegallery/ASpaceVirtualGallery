import * as THREE from 'three';
import { isMobileDevice, logDeviceInfo } from './mobileDetection.js';
import { setupTapToMoveControls, updateTapToMove } from './tapToMove.js';
import { updateMovement } from './movement.js';
import { isInputLocked } from './inputLock.js';

/**
 * Controls Manager
 * Detects device type and sets up appropriate controls
 */

let currentControlType = null;
let tapToMoveEnabled = false;

/**
 * Initialize controls based on device type
 * @param {THREE.Camera} camera - The camera
 * @param {THREE.Scene} scene - The scene
 * @param {Object} controls - PointerLockControls (for desktop)
 * @param {HTMLElement} domElement - Canvas element
 * @param {THREE.Mesh} floor - Floor mesh for raycasting
 * @returns {string} Control type used ('desktop' or 'mobile')
 */
export function initializeControls(camera, scene, controls, domElement, floor) {
  // Log device detection info
  logDeviceInfo();
  
  const isMobile = isMobileDevice();
  
  if (isMobile) {
    console.log('🎮 Mobile device detected - using Tap-to-Move controls');
    currentControlType = 'mobile';
    tapToMoveEnabled = true;
    
    // Setup tap-to-move controls
    setupTapToMoveControls(camera, scene, domElement, floor);
    
    // Completely disable pointer lock controls on mobile
    if (controls) {
      controls.enabled = false;
      // Remove pointer lock capability to prevent any attempts
      controls.lock = () => {
        console.log('⚠️ Pointer lock not available on mobile - using tap controls');
      };
      controls.unlock = () => {};
    }
    
    // Show mobile-specific instructions
    updateControlInstructions('mobile');
    
  } else {
    console.log('🖥️ Desktop device detected - using Pointer Lock controls');
    currentControlType = 'desktop';
    tapToMoveEnabled = false;
    
    // Keep pointer lock controls (already set up in scene.js)
    if (controls) {
      controls.enabled = true;
    }
    
    // Show desktop-specific instructions
    updateControlInstructions('desktop');
  }
  
  return currentControlType;
}

/**
 * Update controls in animation loop
 * @param {number} delta - Time since last frame
 * @param {THREE.Camera} camera - The camera
 * @param {Object} controls - PointerLockControls
 * @param {THREE.Group} walls - Walls for collision detection
 */
export function updateControls(delta, camera, controls, walls) {
  // Freeze scene movement while UI overlays (menu / about) are open
  if (isInputLocked()) return;

  if (currentControlType === 'mobile' && tapToMoveEnabled) {
    // Update tap-to-move
    updateTapToMove(delta, camera, walls);
  } else if (currentControlType === 'desktop') {
    // Update desktop keyboard movement
    updateMovement(delta, controls, camera, walls);
  }
}

/**
 * Get current control type
 * @returns {string} 'desktop' or 'mobile'
 */
export function getControlType() {
  return currentControlType;
}

/**
 * Check if tap-to-move is enabled
 * @returns {boolean}
 */
export function isTapToMoveEnabled() {
  return tapToMoveEnabled;
}

/**
 * Force switch control type (for testing or user preference)
 * @param {string} type - 'desktop' or 'mobile'
 */
export function switchControlType(type, camera, scene, controls, domElement, floor) {
  console.log(`🔄 Switching controls to: ${type}`);
  
  if (type === 'mobile') {
    currentControlType = 'mobile';
    tapToMoveEnabled = true;
    setupTapToMoveControls(camera, scene, domElement, floor);
    if (controls) controls.enabled = false;
    updateControlInstructions('mobile');
    
  } else if (type === 'desktop') {
    currentControlType = 'desktop';
    tapToMoveEnabled = false;
    if (controls) controls.enabled = true;
    updateControlInstructions('desktop');
  }
}

/**
 * Update control instructions in the InfoPanel
 * @param {string} type - 'desktop' or 'mobile'
 */
function updateControlInstructions(type) {
  const infoContent = document.getElementById('info-content');
  
  if (!infoContent) return;
  
  if (type === 'mobile') {
    infoContent.innerHTML = `
      <p>Tap floor: Move to location</p>
      <p>Swipe: Look around</p>
      <p>Tap painting: View artwork info</p>
      <p>Tap item (bottom-right): Interact</p>
      <p>Two-finger tap: Switch item</p>
      <p>Menu button (bottom-left): Open menu</p>
    `;
  } else {
    infoContent.innerHTML = `
      <p>W/A/S/D: Move around</p>
      <p>Mouse: Look around</p>
      <p>Mouse Wheel: Change items</p>
      <p>Left Click: Open artwork link</p>
      <p>Right Click: Interact with item</p>
      <p>Space: Toggle pointer lock</p>
      <p>M: Show Menu</p>
      <p>Enter: Start exploration</p>
      <p>Esc: Stop exploration</p>
    `;
  }
}

/**
 * Handle window resize - may need to re-detect for orientation changes
 */
export function handleControlsResize() {
  // On mobile, orientation change might affect controls
  if (currentControlType === 'mobile') {
    console.log('📱 Screen orientation/size changed');
    // Could re-initialize if needed
  }
}
